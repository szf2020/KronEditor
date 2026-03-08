// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ast;
mod lexer;

use tauri::{command, Emitter, Manager, State};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use lalrpop_util::lalrpop_mod;
use logos::Logos;
use serde_json::{json, Value};

#[cfg(not(target_os = "windows"))]
use std::process::{Command, Child, Stdio};
#[cfg(not(target_os = "windows"))]
use std::thread;
#[cfg(not(target_os = "windows"))]
use std::time::Duration;
#[cfg(not(target_os = "windows"))]
use std::collections::HashMap;
#[cfg(not(target_os = "windows"))]
use serde_json::Map;

lalrpop_mod!(pub grammar);

// ---------------------------------------------------------------------------
// Platform constants
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "windows"))]
const TCC_SUBDIR: &str = "tcc/linux-x64";

#[cfg(not(target_os = "windows"))]
const TCC_BIN: &str = "tcc";

#[cfg(not(target_os = "windows"))]
const SIM_BIN: &str = "simulation";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

fn get_build_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let build_dir = data_dir.join("build");
    fs::create_dir_all(&build_dir).map_err(|e| e.to_string())?;
    Ok(build_dir)
}

fn get_resource_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().resource_dir().map_err(|e| e.to_string())
}

/// Strip the \\?\ long-path UNC prefix that Windows sometimes adds.
/// TCC does not accept this prefix in -I/-B arguments.
#[cfg(target_os = "windows")]
fn plain_path(p: &Path) -> PathBuf {
    match p.to_str() {
        Some(s) if s.starts_with("\\\\?\\") => PathBuf::from(&s[4..]),
        _ => p.to_path_buf(),
    }
}

#[cfg(not(target_os = "windows"))]
fn plain_path(p: &Path) -> PathBuf { p.to_path_buf() }

// ---------------------------------------------------------------------------
// Windows in-process TCC simulation
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
mod win_sim {
    use libloading::{Library, Symbol};
    use serde_json::{json, Map, Value};
    use std::cell::RefCell;
    use std::ffi::{CStr, CString, c_void};
    use std::os::raw::{c_char, c_int};
    use std::path::Path;
    use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
    use std::thread;
    use std::time::Duration;
    use tauri::Emitter;

    const TCC_OUTPUT_MEMORY: c_int = 1;
    // TCC_RELOCATE_AUTO = (void*)1  — allocate and manage memory internally
    const TCC_RELOCATE_AUTO: *mut c_void = 1usize as *mut c_void;

    // -------------------------------------------------------------------------
    // Thread-local error capture
    // -------------------------------------------------------------------------

    thread_local! {
        static TCC_ERRORS: RefCell<Vec<String>> = RefCell::new(Vec::new());
    }

    unsafe extern "C" fn error_cb(_opaque: *mut c_void, msg: *const c_char) {
        TCC_ERRORS.with(|e| {
            if let Ok(s) = CStr::from_ptr(msg).to_str() {
                e.borrow_mut().push(s.to_owned());
            }
        });
    }

    fn flush_errors() -> String {
        TCC_ERRORS.with(|e| e.borrow_mut().drain(..).collect::<Vec<_>>().join("\n"))
    }

    // -------------------------------------------------------------------------
    // TCC context — owns the library handle and the TCCState*
    // Does NOT implement Drop (caller must call delete() explicitly before
    // dropping the Library, to avoid calling tcc_delete after DLL unload).
    // -------------------------------------------------------------------------

    pub struct TccCtx {
        pub lib: Library,
        pub state: *mut c_void,
    }
    unsafe impl Send for TccCtx {}

    impl TccCtx {
        /// Call tcc_delete then drop the Library (unloads DLL).
        /// Must be called after all threads using this code have exited.
        pub unsafe fn free(self) {
            let TccCtx { lib, state } = self;
            if let Ok(f) = lib.get::<unsafe extern "C" fn(*mut c_void)>(b"tcc_delete\0") {
                f(state);
            }
            drop(lib); // unload DLL after tcc_delete
        }

        pub unsafe fn get_symbol(&self, name: &str) -> *mut c_void {
            if let Ok(f) = self.lib.get::<
                unsafe extern "C" fn(*mut c_void, *const c_char) -> *mut c_void
            >(b"tcc_get_symbol\0") {
                let c = CString::new(name).unwrap();
                f(self.state, c.as_ptr())
            } else {
                std::ptr::null_mut()
            }
        }
    }

    // -------------------------------------------------------------------------
    // Compiled — code loaded in memory, not yet running
    // -------------------------------------------------------------------------

    pub struct Compiled {
        ctx: Option<TccCtx>,
    }
    unsafe impl Send for Compiled {}

    impl Drop for Compiled {
        fn drop(&mut self) {
            if let Some(ctx) = self.ctx.take() {
                unsafe { ctx.free(); }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Running — main() thread started, var reader running
    // -------------------------------------------------------------------------

    pub struct Running {
        ctx:          Option<TccCtx>,
        stop_ptr:     *mut i32,
        main_thr:     Option<thread::JoinHandle<i32>>,
        reader_stop:  Arc<AtomicBool>,
        reader_thr:   Option<thread::JoinHandle<()>>,
    }
    unsafe impl Send for Running {}

    impl Drop for Running {
        fn drop(&mut self) {
            unsafe { self.do_stop(); }
        }
    }

    impl Running {
        unsafe fn do_stop(&mut self) {
            // Signal PLC loop to exit
            if !self.stop_ptr.is_null() {
                *self.stop_ptr = 1;
            }
            // Join PLC main thread (exits after plc_stop check, ≤1ms)
            if let Some(h) = self.main_thr.take() { let _ = h.join(); }
            // Signal and join reader thread
            self.reader_stop.store(true, Ordering::Relaxed);
            if let Some(h) = self.reader_thr.take() { let _ = h.join(); }
            // Safe to free TCC memory — all threads have exited
            if let Some(ctx) = self.ctx.take() { ctx.free(); }
        }
    }

    // -------------------------------------------------------------------------
    // WinCtx — stored in SimState
    // -------------------------------------------------------------------------

    #[allow(dead_code)] // Running variant is dropped (not read) to trigger stop-on-drop
    pub enum WinCtx {
        Compiled(Compiled),
        Running(Running),
    }
    unsafe impl Send for WinCtx {}

    // -------------------------------------------------------------------------
    // compile() — load libtcc.dll, compile in memory, relocate
    // -------------------------------------------------------------------------

    pub unsafe fn compile(
        dll_path:     &Path,
        lib_dir:      &Path,   // where libtcc1-64.a + .def files live
        inc_dir:      &Path,   // TCC system headers
        build_dir:    &Path,   // plc.h location (generated files)
        resource_dir: &Path,   // bundled resources (include/, lib/)
        plc_c:        &Path,
    ) -> Result<Compiled, String> {
        TCC_ERRORS.with(|e| e.borrow_mut().clear());

        let lib = Library::new(dll_path)
            .map_err(|e| format!("Cannot load libtcc.dll: {}", e))?;

        // tcc_new
        let tcc_new: Symbol<unsafe extern "C" fn() -> *mut c_void> =
            lib.get(b"tcc_new\0").map_err(|e| e.to_string())?;
        let state = tcc_new();
        if state.is_null() {
            return Err("tcc_new() returned NULL".into());
        }

        // Error callback
        type ErrFn = unsafe extern "C" fn(*mut c_void, *const c_char);
        let set_err: Symbol<unsafe extern "C" fn(*mut c_void, *mut c_void, ErrFn)> =
            lib.get(b"tcc_set_error_func\0").map_err(|e| e.to_string())?;
        set_err(state, std::ptr::null_mut(), error_cb);

        // Output type: in-memory
        let set_out: Symbol<unsafe extern "C" fn(*mut c_void, c_int) -> c_int> =
            lib.get(b"tcc_set_output_type\0").map_err(|e| e.to_string())?;
        set_out(state, TCC_OUTPUT_MEMORY);

        // Library path (libtcc1-64.a, .def files)
        let set_lib: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char)> =
            lib.get(b"tcc_set_lib_path\0").map_err(|e| e.to_string())?;
        let p = CString::new(lib_dir.to_str().unwrap_or("")).unwrap();
        set_lib(state, p.as_ptr());

        // Include paths
        let add_sys_inc: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int> =
            lib.get(b"tcc_add_sysinclude_path\0").map_err(|e| e.to_string())?;
        let add_inc: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int> =
            lib.get(b"tcc_add_include_path\0").map_err(|e| e.to_string())?;

        add_sys_inc(state, CString::new(inc_dir.to_str().unwrap_or("")).unwrap().as_ptr());
        add_inc(state,     CString::new(build_dir.to_str().unwrap_or("")).unwrap().as_ptr());
        
        // Bundled resource includes (kron*.h headers)
        let res_inc = resource_dir.join("resources/include");
        add_inc(state, CString::new(res_inc.to_str().unwrap_or("")).unwrap().as_ptr());

        // Compile source files
        let add_file: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int> =
            lib.get(b"tcc_add_file\0").map_err(|e| e.to_string())?;

        // The bundled libtcc.dll uses ELF format internally (same as TCC on Linux).
        // Load pre-built TCC-ELF archives from Simulation/Windows/.
        let res_sim_win = resource_dir.join("resources/Simulation/Windows");
        if res_sim_win.exists() {
            if let Ok(entries) = std::fs::read_dir(&res_sim_win) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map_or(false, |e| e == "a") {
                        let r = add_file(state, CString::new(path.to_str().unwrap_or("")).unwrap().as_ptr());
                        let errs = flush_errors();
                        if r < 0 || !errs.is_empty() {
                            if let Ok(f) = lib.get::<unsafe extern "C" fn(*mut c_void)>(b"tcc_delete\0") { f(state); }
                            return Err(format!("TCC error loading {}:\n{}",
                                path.file_name().unwrap_or_default().to_string_lossy(),
                                if errs.is_empty() { "tcc_add_file failed".into() } else { errs }));
                        }
                    }
                }
            }
        }



        for (path, label) in &[(plc_c, "plc.c")] {
            let r = add_file(state, CString::new(path.to_str().unwrap_or("")).unwrap().as_ptr());
            let errs = flush_errors();
            if r < 0 || !errs.is_empty() {
                if let Ok(f) = lib.get::<unsafe extern "C" fn(*mut c_void)>(b"tcc_delete\0") { f(state); }
                return Err(format!("TCC error in {}:\n{}", label,
                    if errs.is_empty() { "tcc_add_file failed".into() } else { errs }));
            }
        }

        // Relocate — allocates executable memory and resolves all symbols/imports
        let relocate: Symbol<unsafe extern "C" fn(*mut c_void, *mut c_void) -> c_int> =
            lib.get(b"tcc_relocate\0").map_err(|e| e.to_string())?;
        let r = relocate(state, TCC_RELOCATE_AUTO);
        let errs = flush_errors();
        if r < 0 || !errs.is_empty() {
            if let Ok(f) = lib.get::<unsafe extern "C" fn(*mut c_void)>(b"tcc_delete\0") { f(state); }
            return Err(format!("TCC link/relocate error:\n{}",
                if errs.is_empty() { "tcc_relocate failed".into() } else { errs }));
        }

        Ok(Compiled { ctx: Some(TccCtx { lib, state }) })
    }

    // -------------------------------------------------------------------------
    // start() — get symbol ptrs, launch main() thread + reader thread
    // -------------------------------------------------------------------------

    pub unsafe fn start(
        compiled:  Compiled,
        var_table: &Value,
        app:       tauri::AppHandle,
    ) -> Result<(Running, Vec<super::VarSpec>), String> {
        // Move TccCtx out of Compiled without triggering Drop's free
        let mut c = compiled;
        let ctx = c.ctx.take().ok_or("No TCC context")?;
        // c.Drop() now does nothing (ctx is None)

        // Locate main() and plc_stop
        let main_ptr = ctx.get_symbol("main");
        if main_ptr.is_null() {
            ctx.free();
            return Err("Symbol 'main' not found — check generated C code".into());
        }
        let stop_ptr = ctx.get_symbol("plc_stop") as *mut i32;

        // Build VarSpec list from symbol pointers
        let mut var_specs: Vec<super::VarSpec> = Vec::new();
        if let Some(progs) = var_table.get("programs").and_then(|v| v.as_object()) {
            for (prog, info) in progs {
                if let Some(vars) = info.get("variables").and_then(|v| v.as_object()) {
                    for (var_name, var_info) in vars {
                        let c_sym = var_info.get("c_symbol").and_then(|v| v.as_str()).unwrap_or("");
                        let vtype = var_info.get("type").and_then(|v| v.as_str()).unwrap_or("BOOL");
                        let ptr = ctx.get_symbol(c_sym);
                        if !ptr.is_null() {
                            var_specs.push(super::VarSpec {
                                key:     format!("prog_{}_{}", prog, var_name),
                                address: ptr as u64,
                                vtype:   vtype.to_string(),
                            });
                        }
                    }
                }
            }
        }
        if let Some(gvars) = var_table.get("globalVars").and_then(|v| v.as_object()) {
            for (var_name, var_info) in gvars {
                let c_sym = var_info.get("c_symbol").and_then(|v| v.as_str()).unwrap_or(var_name);
                let vtype = var_info.get("type").and_then(|v| v.as_str()).unwrap_or("BOOL");
                let ptr = ctx.get_symbol(c_sym);
                if !ptr.is_null() {
                    var_specs.push(super::VarSpec {
                        key:     format!("prog__{}", var_name),
                        address: ptr as u64,
                        vtype:   vtype.to_string(),
                    });
                }
            }
        }
        // Process debugDefaults entries with base_symbol: array elements and struct members
        if let Some(debug) = var_table.get("debugDefaults").and_then(|v| v.as_object()) {
            for (key, entry) in debug {
                let base_sym = match entry.get("base_symbol").and_then(|v| v.as_str()) {
                    Some(s) => s,
                    None => continue, // top-level var entries — already handled above
                };
                let byte_offset = entry.get("byte_offset").and_then(|v| v.as_u64()).unwrap_or(0);
                let vtype = entry.get("type").and_then(|v| v.as_str()).unwrap_or("BOOL");
                let ptr = ctx.get_symbol(base_sym);
                if !ptr.is_null() {
                    var_specs.push(super::VarSpec {
                        key:     key.clone(),
                        address: ptr as u64 + byte_offset,
                        vtype:   vtype.to_string(),
                    });
                }
            }
        }

        if var_specs.is_empty() {
            ctx.free();
            return Err("No variables matched in compiled symbols".into());
        }

        // Launch PLC main() in a dedicated thread
        let main_fn: unsafe extern "C" fn() -> i32 = std::mem::transmute(main_ptr);
        let main_thr = thread::spawn(move || unsafe { main_fn() });

        // Launch variable reader thread
        let reader_stop = Arc::new(AtomicBool::new(false));
        let rs_clone    = reader_stop.clone();
        let specs_clone = var_specs.clone();
        let reader_thr = thread::spawn(move || {
            thread::sleep(Duration::from_millis(100)); // let PLC initialise
            loop {
                thread::sleep(Duration::from_millis(200));
                if rs_clone.load(Ordering::Relaxed) { break; }

                let mut vars_data: Map<String, Value> = Map::new();
                let mut any_ok = false;
                for spec in &specs_clone {
                    let size = super::type_size(&spec.vtype);
                    if size == 0 { continue; }
                    // Direct pointer read — same process, no OS call needed
                    let buf = unsafe {
                        let ptr = spec.address as *const u8;
                        std::slice::from_raw_parts(ptr, size)
                    };
                    vars_data.insert(spec.key.clone(), super::decode_value(buf, &spec.vtype));
                    any_ok = true;
                }
                if any_ok {
                    let _ = app.emit("simulation-output", json!({"vars": vars_data}).to_string());
                }
            }
        });

        Ok((
            Running {
                ctx:         Some(ctx),
                stop_ptr,
                main_thr:    Some(main_thr),
                reader_stop,
                reader_thr:  Some(reader_thr),
            },
            var_specs,
        ))
    }

    // -------------------------------------------------------------------------
    // compile_c_to_obj() — compile a single .c file to .o using libtcc.dll
    // -------------------------------------------------------------------------

    #[allow(dead_code)]
    const TCC_OUTPUT_OBJ: c_int = 4;

    #[allow(dead_code)]
    pub unsafe fn compile_c_to_obj(
        dll_path:  &Path,
        lib_dir:   &Path,    // where libtcc1-64.a lives
        inc_dir:   &Path,    // TCC system headers
        extra_inc: &[&Path], // additional include paths (clone dir, kron headers)
        c_file:    &Path,
        obj_file:  &Path,
    ) -> Result<(), String> {
        TCC_ERRORS.with(|e| e.borrow_mut().clear());

        let lib = Library::new(dll_path)
            .map_err(|e| format!("Cannot load libtcc.dll: {}", e))?;

        let tcc_new: Symbol<unsafe extern "C" fn() -> *mut c_void> =
            lib.get(b"tcc_new\0").map_err(|e| e.to_string())?;
        let state = tcc_new();
        if state.is_null() {
            return Err("tcc_new() returned NULL".into());
        }

        // Error callback
        type ErrFn = unsafe extern "C" fn(*mut c_void, *const c_char);
        let set_err: Symbol<unsafe extern "C" fn(*mut c_void, *mut c_void, ErrFn)> =
            lib.get(b"tcc_set_error_func\0").map_err(|e| e.to_string())?;
        set_err(state, std::ptr::null_mut(), error_cb);

        // Output type: object file
        let set_out: Symbol<unsafe extern "C" fn(*mut c_void, c_int) -> c_int> =
            lib.get(b"tcc_set_output_type\0").map_err(|e| e.to_string())?;
        set_out(state, TCC_OUTPUT_OBJ);

        // Library path (libtcc1-64.a)
        let set_lib: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char)> =
            lib.get(b"tcc_set_lib_path\0").map_err(|e| e.to_string())?;
        set_lib(state, CString::new(lib_dir.to_str().unwrap_or("")).unwrap().as_ptr());

        // System include path
        let add_sys_inc: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int> =
            lib.get(b"tcc_add_sysinclude_path\0").map_err(|e| e.to_string())?;
        let add_inc: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int> =
            lib.get(b"tcc_add_include_path\0").map_err(|e| e.to_string())?;

        add_sys_inc(state, CString::new(inc_dir.to_str().unwrap_or("")).unwrap().as_ptr());

        for dir in extra_inc {
            add_inc(state, CString::new(dir.to_str().unwrap_or("")).unwrap().as_ptr());
        }

        // Add source file
        let add_file: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int> =
            lib.get(b"tcc_add_file\0").map_err(|e| e.to_string())?;
        let r = add_file(state, CString::new(c_file.to_str().unwrap_or("")).unwrap().as_ptr());
        let errs = flush_errors();
        if r < 0 || !errs.is_empty() {
            if let Ok(f) = lib.get::<unsafe extern "C" fn(*mut c_void)>(b"tcc_delete\0") { f(state); }
            return Err(format!("TCC compile error: {}",
                if errs.is_empty() { "tcc_add_file failed".into() } else { errs }));
        }

        // Output to .o file
        let output_file: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int> =
            lib.get(b"tcc_output_file\0").map_err(|e| e.to_string())?;
        let r = output_file(state, CString::new(obj_file.to_str().unwrap_or("")).unwrap().as_ptr());
        let errs = flush_errors();

        // Cleanup
        if let Ok(f) = lib.get::<unsafe extern "C" fn(*mut c_void)>(b"tcc_delete\0") { f(state); }

        if r < 0 || !errs.is_empty() {
            return Err(format!("TCC output error: {}",
                if errs.is_empty() { "tcc_output_file failed".into() } else { errs }));
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// write_plc_files
// ---------------------------------------------------------------------------

#[tauri::command]
fn write_plc_files(
    app: tauri::AppHandle,
    header: String,
    source: String,
    variable_table: String,
) -> Result<String, String> {
    let build_dir = get_build_dir(&app)?;
    fs::write(build_dir.join("plc.h"), &header).map_err(|e| e.to_string())?;
    fs::write(build_dir.join("plc.c"), &source).map_err(|e| e.to_string())?;
    fs::write(build_dir.join("variable_table.json"), &variable_table).map_err(|e| e.to_string())?;
    Ok(build_dir.to_string_lossy().to_string())
}

// ---------------------------------------------------------------------------
// get_standard_headers
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_standard_headers(app: tauri::AppHandle) -> Result<Vec<(String, String)>, String> {
    let mut headers = Vec::new();

    // Read headers from bundled resources/include/ (the definitive location)
    if let Ok(resource_dir) = get_resource_dir(&app) {
        let include_dir = resource_dir.join("resources/include");
        if let Ok(entries) = fs::read_dir(&include_dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".h") {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            headers.push((name.to_string(), content));
                        }
                    }
                }
            }
        }
    }

    Ok(headers)
}

// ---------------------------------------------------------------------------
// update_libraries
// ---------------------------------------------------------------------------



fn find_files_with_ext(dir: &Path, ext: &str) -> Vec<PathBuf> {
    let mut result = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                result.extend(find_files_with_ext(&path, ext));
            } else if path.extension().and_then(|e| e.to_str()) == Some(ext) {
                result.push(path);
            }
        }
    }
    result
}

/// Create an AR archive from a list of object files (pure Rust, no subprocess).
#[allow(dead_code)]
fn create_ar_archive(output: &Path, obj_files: &[PathBuf]) -> Result<(), String> {
    use std::io::Write;
    let mut f = fs::File::create(output)
        .map_err(|e| format!("Cannot create {}: {}", output.display(), e))?;

    // Global AR header
    f.write_all(b"!<arch>\n").map_err(|e| e.to_string())?;

    for obj in obj_files {
        let data = fs::read(obj)
            .map_err(|e| format!("Cannot read {}: {}", obj.display(), e))?;
        let name = obj.file_name().unwrap_or_default().to_string_lossy();

        // AR member header: exactly 60 bytes
        // name/           16 bytes (name + "/" padded with spaces)
        // mtime           12 bytes
        // uid              6 bytes
        // gid              6 bytes
        // mode             8 bytes
        // size            10 bytes
        // fmag             2 bytes ("`\n")
        let name_with_slash = format!("{}/", &name[..name.len().min(15)]);
        let header = format!(
            "{:<16}{:<12}{:<6}{:<6}{:<8}{:<10}`\n",
            name_with_slash, "0", "0", "0", "100644", data.len()
        );
        debug_assert_eq!(header.len(), 60);

        f.write_all(header.as_bytes()).map_err(|e| e.to_string())?;
        f.write_all(&data).map_err(|e| e.to_string())?;

        // AR requires 2-byte alignment padding
        if data.len() % 2 != 0 {
            f.write_all(b"\n").map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn do_update_libraries(app: &tauri::AppHandle, repos: Vec<String>) -> Result<(), String> {
    let resource_dir = get_resource_dir(app)?;
    let include_dir = resource_dir.join("resources/include");
    fs::create_dir_all(&include_dir).map_err(|e| e.to_string())?;

    // Target directories for compiled libraries
    struct BuildTarget {
        name: &'static str,
        dir: PathBuf,
        dev_dir: Option<PathBuf>,
    }

    let target_names = [
        "Simulation/Linux", "Simulation/Windows",
        "CortexM0", "CortexM4F", "CortexM7F",
    ];

    let mut targets: Vec<BuildTarget> = Vec::new();
    for tname in &target_names {
        let dir = resource_dir.join(format!("resources/{}", tname));
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        targets.push(BuildTarget { name: tname, dir, dev_dir: None });
    }

    // In dev mode, also copy to the source tree so they persist across builds
    let mut dev_include_dir = None;
    if let Ok(cwd) = std::env::current_dir() {
        // resources/ is at the project root (sibling of src-tauri/)
        let target_res = if cwd.join("resources").exists() {
            Some(cwd.join("resources"))           // cwd = project root
        } else if cwd.ends_with("src-tauri") {
            cwd.parent().map(|p| p.join("resources"))  // cwd = src-tauri/
        } else {
            None
        };
        if let Some(res) = target_res {
            let i = res.join("include");
            let _ = fs::create_dir_all(&i);
            dev_include_dir = Some(i);

            for t in &mut targets {
                let d = res.join(t.name);
                let _ = fs::create_dir_all(&d);
                t.dev_dir = Some(d);
            }
        }
    }

    // TCC for Linux simulation
    #[cfg(not(target_os = "windows"))]
    let tcc_dir = resource_dir.join("tcc/linux-x64");
    #[cfg(target_os = "windows")]
    let tcc_dir = plain_path(&resource_dir.join("tcc/windows-x64"));

    #[cfg(not(target_os = "windows"))]
    let tcc_bin = tcc_dir.join("tcc");
    #[cfg(target_os = "windows")]
    let tcc_bin = tcc_dir.join("tcc.exe");

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(&tcc_bin) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&tcc_bin, perms);
        }
    }

    let temp_base = std::env::temp_dir().join("kroneditor_libs");
    let _ = fs::remove_dir_all(&temp_base);
    fs::create_dir_all(&temp_base).map_err(|e| e.to_string())?;

    let mut errors: Vec<String> = Vec::new();

    // --- Clone all repos, gather headers and sources ---
    let mut all_c_files: Vec<PathBuf> = Vec::new();
    let mut cloned_dirs: Vec<PathBuf> = Vec::new();

    for repo_name in &repos {
        let repo_url = format!("https://github.com/Krontek/{}.git", repo_name);
        let clone_dir = temp_base.join(repo_name);

        let _ = app.emit("library-update-progress", format!("[{}] Cloning...", repo_name));

        let clone_out = std::process::Command::new("git")
            .args(["clone", "--depth=1", "--quiet", &repo_url])
            .arg(&clone_dir)
            .output()
            .map_err(|e| format!("git not found: {}", e))?;

        if !clone_out.status.success() {
            let msg = format!(
                "[{}] Clone failed: {}",
                repo_name,
                String::from_utf8_lossy(&clone_out.stderr).trim()
            );
            let _ = app.emit("library-update-progress", format!("ERROR: {}", msg));
            errors.push(msg);
            continue;
        }

        // Copy .h files
        let h_files = find_files_with_ext(&clone_dir, "h");
        for h_file in &h_files {
            if let Some(fname) = h_file.file_name() {
                let _ = fs::copy(h_file, include_dir.join(fname));
                if let Some(ref dev_inc) = dev_include_dir {
                    let _ = fs::copy(h_file, dev_inc.join(fname));
                }
            }
        }
        let _ = app.emit(
            "library-update-progress",
            format!("[{}] Copied {} header(s)", repo_name, h_files.len()),
        );

        all_c_files.extend(find_files_with_ext(&clone_dir, "c"));
        cloned_dirs.push(clone_dir);
    }

    if all_c_files.is_empty() {
        let _ = fs::remove_dir_all(&temp_base);
        if errors.is_empty() {
            return Ok(());
        } else {
            return Err(errors.join("; "));
        }
    }

    // --- Compile for each target ---

    // Helper: compile .c files then create .a archive
    let compile_target = |
        target_name: &str,
        compiler: &str,
        cc_args: &[&str],
        ar_cmd: &str,
        target_lib_dir: &Path,
        dev_lib_dir: &Option<PathBuf>,
    | -> Result<(), String> {
        // Check compiler availability
        let check = std::process::Command::new(compiler)
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
        if check.is_err() || !check.unwrap().success() {
            return Err(format!("{} not found, skipping {}", compiler, target_name));
        }

        let obj_dir = temp_base.join(format!("obj_{}", target_name.replace('/', "_")));
        let _ = fs::create_dir_all(&obj_dir);

        let mut obj_files: Vec<PathBuf> = Vec::new();

        for c_file in &all_c_files {
            let stem = c_file.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let obj_path = obj_dir.join(format!("{}.o", stem));

            let mut cmd = std::process::Command::new(compiler);
            for arg in cc_args {
                cmd.arg(arg);
            }
            cmd.arg("-I").arg(&include_dir)
               .arg("-I").arg(tcc_dir.join("include"))
               .arg("-c").arg(c_file)
               .arg("-o").arg(&obj_path);

            // Add clone dirs as include paths
            for cdir in &cloned_dirs {
                cmd.arg("-I").arg(cdir);
            }

            let out = cmd.output();
            match out {
                Ok(o) if o.status.success() => obj_files.push(obj_path),
                Ok(o) => {
                    let _ = app.emit(
                        "library-update-progress",
                        format!(
                            "  [{}] WARN {}: {}",
                            target_name,
                            c_file.file_name().unwrap_or_default().to_string_lossy(),
                            String::from_utf8_lossy(&o.stderr).trim()
                        ),
                    );
                }
                Err(e) => {
                    let _ = app.emit(
                        "library-update-progress",
                        format!("  [{}] compile error: {}", target_name, e),
                    );
                }
            }
        }

        if !obj_files.is_empty() {
            let lib_path = target_lib_dir.join("libkron.a");

            let ar_out = std::process::Command::new(ar_cmd)
                .arg("rcs")
                .arg(&lib_path)
                .args(&obj_files)
                .output();

            match ar_out {
                Ok(o) if o.status.success() => {
                    let _ = app.emit(
                        "library-update-progress",
                        format!("  [{}] Created libkron.a ({} objects)", target_name, obj_files.len()),
                    );
                    if let Some(ref dev_dir) = dev_lib_dir {
                        let _ = fs::copy(&lib_path, dev_dir.join("libkron.a"));
                    }
                }
                Ok(o) => {
                    let _ = app.emit(
                        "library-update-progress",
                        format!("  [{}] archive warn: {}", target_name, String::from_utf8_lossy(&o.stderr).trim()),
                    );
                }
                Err(e) => {
                    let _ = app.emit(
                        "library-update-progress",
                        format!("  [{}] archive error: {}", target_name, e),
                    );
                }
            }

            for obj in &obj_files {
                let _ = fs::remove_file(obj);
            }
        }
        let _ = fs::remove_dir_all(&obj_dir);
        Ok(())
    };

    // ---- Simulation/Linux — TCC ----
    {
        let _ = app.emit("library-update-progress", "--- Building for Simulation/Linux ---".to_string());
        let t = &targets[0]; // Simulation/Linux
        let obj_dir = temp_base.join("obj_sim_linux");
        let _ = fs::create_dir_all(&obj_dir);

        let mut obj_files: Vec<PathBuf> = Vec::new();
        for c_file in &all_c_files {
            let stem = c_file.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let obj_path = obj_dir.join(format!("{}.o", stem));

            let mut cmd = std::process::Command::new(&tcc_bin);
            cmd.arg("-B").arg(&tcc_dir)
               .arg("-I").arg(&include_dir)
               .arg("-I").arg(tcc_dir.join("include"))
               .arg("-c").arg(c_file)
               .arg("-o").arg(&obj_path);
            for cdir in &cloned_dirs {
                cmd.arg("-I").arg(cdir);
            }

            let out = cmd.output();
            match out {
                Ok(o) if o.status.success() => obj_files.push(obj_path),
                Ok(o) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Linux] WARN {}: {}",
                        c_file.file_name().unwrap_or_default().to_string_lossy(),
                        String::from_utf8_lossy(&o.stderr).trim()
                    ));
                }
                Err(e) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Linux] TCC error: {}", e
                    ));
                }
            }
        }

        if !obj_files.is_empty() {
            let lib_path = t.dir.join("libkron.a");
            let mut ar_args = vec!["-ar".to_string(), "rcs".to_string(), lib_path.to_string_lossy().to_string()];
            for obj in &obj_files {
                ar_args.push(obj.to_string_lossy().to_string());
            }
            let ar_out = std::process::Command::new(&tcc_bin).args(&ar_args).output();
            match ar_out {
                Ok(o) if o.status.success() => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Linux] Created libkron.a ({} objects)", obj_files.len()
                    ));
                    if let Some(ref dev_dir) = t.dev_dir {
                        let _ = fs::copy(&lib_path, dev_dir.join("libkron.a"));
                    }
                }
                Ok(o) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Linux] archive warn: {}", String::from_utf8_lossy(&o.stderr).trim()
                    ));
                }
                Err(e) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Linux] archive error: {}", e
                    ));
                }
            }
            for obj in &obj_files { let _ = fs::remove_file(obj); }
        }
        let _ = fs::remove_dir_all(&obj_dir);
    }

    // ---- Simulation/Windows — TCC (ELF format, same as Linux) ----
    // libtcc.dll uses ELF format internally, so we build with Linux TCC.
    // MinGW (COFF format) archives crash TCC's in-memory linker.
    {
        let _ = app.emit("library-update-progress", "--- Building for Simulation/Windows (TCC/ELF) ---".to_string());
        let t = &targets[1]; // Simulation/Windows
        let obj_dir = temp_base.join("obj_sim_windows");
        let _ = fs::create_dir_all(&obj_dir);

        let mut obj_files: Vec<PathBuf> = Vec::new();
        for c_file in &all_c_files {
            let stem = c_file.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let obj_path = obj_dir.join(format!("{}.o", stem));

            let mut cmd = std::process::Command::new(&tcc_bin);
            cmd.arg("-B").arg(&tcc_dir)
               .arg("-I").arg(&include_dir)
               .arg("-I").arg(tcc_dir.join("include"))
               .arg("-c").arg(c_file)
               .arg("-o").arg(&obj_path);
            for cdir in &cloned_dirs {
                cmd.arg("-I").arg(cdir);
            }

            let out = cmd.output();
            match out {
                Ok(o) if o.status.success() => obj_files.push(obj_path),
                Ok(o) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Windows] WARN {}: {}",
                        c_file.file_name().unwrap_or_default().to_string_lossy(),
                        String::from_utf8_lossy(&o.stderr).trim()
                    ));
                }
                Err(e) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Windows] TCC error: {}", e
                    ));
                }
            }
        }

        if !obj_files.is_empty() {
            let lib_path = t.dir.join("libkron.a");
            let mut ar_args = vec!["-ar".to_string(), "rcs".to_string(), lib_path.to_string_lossy().to_string()];
            for obj in &obj_files {
                ar_args.push(obj.to_string_lossy().to_string());
            }
            let ar_out = std::process::Command::new(&tcc_bin).args(&ar_args).output();
            match ar_out {
                Ok(o) if o.status.success() => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Windows] Created libkron.a ({} objects)", obj_files.len()
                    ));
                    if let Some(ref dev_dir) = t.dev_dir {
                        let _ = fs::copy(&lib_path, dev_dir.join("libkron.a"));
                    }
                }
                Ok(o) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Windows] archive warn: {}", String::from_utf8_lossy(&o.stderr).trim()
                    ));
                }
                Err(e) => {
                    let _ = app.emit("library-update-progress", format!(
                        "  [Simulation/Windows] archive error: {}", e
                    ));
                }
            }
            for obj in &obj_files { let _ = fs::remove_file(obj); }
        }
        let _ = fs::remove_dir_all(&obj_dir);
    }

    // ---- ARM targets — arm-none-eabi-gcc ----
    let arm_targets: &[(&str, usize, &[&str])] = &[
        ("CortexM0", 2, &["-mcpu=cortex-m0", "-mthumb", "-mfloat-abi=soft", "-O2", "-ffunction-sections", "-fdata-sections"]),
        ("CortexM4F", 3, &["-mcpu=cortex-m4", "-mthumb", "-mfloat-abi=hard", "-mfpu=fpv4-sp-d16", "-O2", "-ffunction-sections", "-fdata-sections"]),
        ("CortexM7F", 4, &["-mcpu=cortex-m7", "-mthumb", "-mfloat-abi=hard", "-mfpu=fpv5-d16", "-O2", "-ffunction-sections", "-fdata-sections"]),
    ];

    for (name, idx, cc_args) in arm_targets {
        let _ = app.emit("library-update-progress", format!("--- Building for {} ---", name));
        let t = &targets[*idx];
        match compile_target(
            name,
            "arm-none-eabi-gcc",
            cc_args,
            "arm-none-eabi-ar",
            &t.dir,
            &t.dev_dir,
        ) {
            Ok(()) => {}
            Err(e) => {
                let _ = app.emit("library-update-progress", format!("  SKIP: {}", e));
            }
        }
    }

    // Cleanup
    for cdir in &cloned_dirs {
        let _ = fs::remove_dir_all(cdir);
    }
    let _ = fs::remove_dir_all(&temp_base);

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

#[tauri::command]
fn update_libraries(app: tauri::AppHandle, repos: Vec<String>) -> Result<String, String> {
    std::thread::spawn(move || {
        match do_update_libraries(&app, repos) {
            Ok(()) => {
                let _ = app.emit(
                    "library-update-done",
                    json!({"success": true, "message": "All libraries updated successfully"}),
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "library-update-done",
                    json!({"success": false, "message": e}),
                );
            }
        }
    });
    Ok("started".to_string())
}

// ---------------------------------------------------------------------------
// compile_simulation
// ---------------------------------------------------------------------------

/// Windows: compile plc.c in-memory via libtcc.dll, store compiled state.
#[cfg(target_os = "windows")]
#[tauri::command]
fn compile_simulation(
    app: tauri::AppHandle,
    state: State<'_, SimState>,
) -> Result<String, String> {
    let resource_dir = get_resource_dir(&app)?;
    let build_dir    = plain_path(&get_build_dir(&app)?);
    let tcc_dir      = plain_path(&resource_dir.join("tcc/windows-x64"));
    let dll_path     = tcc_dir.join("libtcc.dll");
    let lib_dir      = tcc_dir.join("lib");
    let inc_dir      = tcc_dir.join("include");
    let plc_c        = build_dir.join("plc.c");

    let compiled = unsafe {
        win_sim::compile(&dll_path, &lib_dir, &inc_dir, &build_dir, &resource_dir, &plc_c)
    }?;

    *state.win.lock().unwrap() = Some(win_sim::WinCtx::Compiled(compiled));
    Ok("Compiled in-memory".to_string())
}

/// Linux/macOS: compile via tcc subprocess, produce simulation binary.
#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn compile_simulation(app: tauri::AppHandle) -> Result<String, String> {
    let resource_dir = get_resource_dir(&app)?;
    let build_dir    = plain_path(&get_build_dir(&app)?);
    let tcc_dir      = resource_dir.join(TCC_SUBDIR);
    let tcc_bin      = tcc_dir.join(TCC_BIN);
    let plc_c        = build_dir.join("plc.c");
    let out_file     = build_dir.join(SIM_BIN);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(&tcc_bin) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&tcc_bin, perms);
        }
    }

    // Headers and libs come from resources/; build_dir only has generated plc.h/plc.c
    let res_include = resource_dir.join("resources/include");
    let sim_lib     = resource_dir.join("resources/Simulation/Linux");

    let mut cmd = Command::new(&tcc_bin);
    cmd.arg("-B").arg(&tcc_dir)
        .arg("-I").arg(tcc_dir.join("include"))
        .arg("-I").arg(&build_dir)
        .arg("-I").arg(&res_include)
        .arg("-L").arg(&sim_lib)
        .arg("-rdynamic")
        .arg("-o").arg(&out_file)
        .arg(&plc_c);

    // Add static libraries from Simulation/Linux/
    if let Ok(entries) = std::fs::read_dir(&sim_lib) {
        for entry in entries.flatten() {
            if entry.path().extension().map_or(false, |e| e == "a") {
                cmd.arg(entry.path());
            }
        }
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute TCC ({}): {}", tcc_bin.display(), e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let code   = output.status.code().map(|c| c.to_string()).unwrap_or_else(|| "?".into());
        return Err(format!(
            "TCC compilation failed (exit {})\nstderr: {}\nstdout: {}",
            code, stderr.trim(), stdout.trim()
        ));
    }

    Ok(out_file.to_string_lossy().to_string())
}

// ---------------------------------------------------------------------------
// SimState
// ---------------------------------------------------------------------------

struct SimState {
    var_specs: Mutex<Vec<VarSpec>>,
    // Linux/macOS: subprocess approach
    #[cfg(not(target_os = "windows"))]
    process: Mutex<Option<Child>>,
    #[cfg(not(target_os = "windows"))]
    pid:     Mutex<Option<u32>>,
    // Windows: in-process TCC simulation
    #[cfg(target_os = "windows")]
    win: Mutex<Option<win_sim::WinCtx>>,
}

// ---------------------------------------------------------------------------
// PLC type helpers
// ---------------------------------------------------------------------------

fn type_size(vtype: &str) -> usize {
    match vtype.to_uppercase().as_str() {
        "BOOL" | "SINT" | "USINT"           => 1,
        "INT"  | "UINT"                     => 2,
        "DINT" | "UDINT" | "TIME" | "REAL"  => 4,
        "LINT" | "ULINT" | "LREAL"          => 8,
        "TON"  | "TOF"                      => 16,
        "CTU"                               => 8,
        _                                   => 0,
    }
}

fn decode_value(buf: &[u8], vtype: &str) -> Value {
    let u = vtype.to_uppercase();
    match u.as_str() {
        "BOOL"  => json!(buf[0] != 0),
        "SINT"  => json!(buf[0] as i8),
        "USINT" => json!(buf[0]),
        "INT"   => json!(i16::from_le_bytes([buf[0], buf[1]])),
        "UINT"  => json!(u16::from_le_bytes([buf[0], buf[1]])),
        "DINT"  => json!(i32::from_le_bytes(buf[0..4].try_into().unwrap_or([0; 4]))),
        "UDINT" | "TIME" => json!(u32::from_le_bytes(buf[0..4].try_into().unwrap_or([0; 4]))),
        "LINT"  => json!(i64::from_le_bytes(buf[0..8].try_into().unwrap_or([0; 8]))),
        "ULINT" => json!(u64::from_le_bytes(buf[0..8].try_into().unwrap_or([0; 8]))),
        "REAL"  => json!(f32::from_le_bytes(buf[0..4].try_into().unwrap_or([0; 4]))),
        "LREAL" => json!(f64::from_le_bytes(buf[0..8].try_into().unwrap_or([0; 8]))),
        "TON" | "TOF" if buf.len() >= 15 => json!({
            "PT":        u32::from_le_bytes(buf[0..4].try_into().unwrap_or([0;4])),
            "ET":        u32::from_le_bytes(buf[4..8].try_into().unwrap_or([0;4])),
            "StartTime": u32::from_le_bytes(buf[8..12].try_into().unwrap_or([0;4])),
            "IN": buf[12] != 0,
            "Q":  buf[13] != 0,
            "M":  buf[14] != 0,
        }),
        "CTU" if buf.len() >= 8 => json!({
            "PV":    i16::from_le_bytes([buf[0], buf[1]]),
            "CV":    i16::from_le_bytes([buf[2], buf[3]]),
            "CU":    buf[4] != 0,
            "RESET": buf[5] != 0,
            "Q":     buf[6] != 0,
            "M":     buf[7] != 0,
        }),
        _ => json!(null),
    }
}

fn encode_value(vtype: &str, value_str: &str) -> Option<Vec<u8>> {
    let u = vtype.to_uppercase();
    let s = value_str.trim();
    match u.as_str() {
        "BOOL" => {
            let b: u8 = match s.to_uppercase().as_str() {
                "TRUE" | "1" => 1,
                _             => 0,
            };
            Some(vec![b])
        }
        "SINT"  => Some((s.parse::<i8>().ok()? as u8).to_le_bytes().to_vec()),
        "USINT" => Some(s.parse::<u8>().ok()?.to_le_bytes().to_vec()),
        "INT"   => Some(s.parse::<i16>().ok()?.to_le_bytes().to_vec()),
        "UINT"  => Some(s.parse::<u16>().ok()?.to_le_bytes().to_vec()),
        "DINT"  => Some(s.parse::<i32>().ok()?.to_le_bytes().to_vec()),
        "UDINT" | "TIME" => Some(s.parse::<u32>().ok()?.to_le_bytes().to_vec()),
        "LINT"  => Some(s.parse::<i64>().ok()?.to_le_bytes().to_vec()),
        "ULINT" => Some(s.parse::<u64>().ok()?.to_le_bytes().to_vec()),
        "REAL"  => Some(s.parse::<f32>().ok()?.to_le_bytes().to_vec()),
        "LREAL" => Some(s.parse::<f64>().ok()?.to_le_bytes().to_vec()),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Linux: write bytes into running process memory
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn write_proc_mem(pid: u32, address: u64, data: &[u8]) -> Result<(), String> {
    use std::io::{Seek, SeekFrom, Write};
    let path = format!("/proc/{}/mem", pid);
    let mut f = std::fs::OpenOptions::new().write(true).open(&path)
        .map_err(|e| format!("Cannot open {}: {}", path, e))?;
    f.seek(SeekFrom::Start(address)).map_err(|e| format!("Seek: {}", e))?;
    f.write_all(data).map_err(|e| format!("Write: {}", e))?;
    Ok(())
}

#[cfg(not(target_os = "linux"))]
#[cfg(not(target_os = "windows"))]
fn write_proc_mem(_pid: u32, _address: u64, _data: &[u8]) -> Result<(), String> {
    Err("Memory write not supported on this platform".into())
}

// ---------------------------------------------------------------------------
// VarSpec + symbol helpers (Linux)
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct VarSpec {
    key:     String,
    address: u64,
    vtype:   String,
}

#[cfg(not(target_os = "windows"))]
fn parse_symbols(bin_path: &Path) -> Result<HashMap<String, u64>, String> {
    use object::{Object, ObjectSymbol};
    let data = fs::read(bin_path).map_err(|e| format!("Failed to read binary: {}", e))?;
    let obj  = object::File::parse(&*data)
        .map_err(|e| format!("Failed to parse binary: {}", e))?;
    let mut map = HashMap::new();
    for sym in obj.symbols() {
        if sym.address() == 0 { continue; }
        if let Ok(name) = sym.name() {
            if !name.is_empty() { map.insert(name.to_string(), sym.address()); }
        }
    }
    for sym in obj.dynamic_symbols() {
        if sym.address() == 0 { continue; }
        if let Ok(name) = sym.name() {
            if !name.is_empty() { map.entry(name.to_string()).or_insert(sym.address()); }
        }
    }
    Ok(map)
}

#[cfg(not(target_os = "windows"))]
fn build_var_specs(var_table: &Value, symbols: &HashMap<String, u64>) -> Vec<VarSpec> {
    let mut specs = Vec::new();
    if let Some(programs) = var_table.get("programs").and_then(|v| v.as_object()) {
        for (prog, prog_info) in programs {
            if let Some(vars) = prog_info.get("variables").and_then(|v| v.as_object()) {
                for (var_name, var_info) in vars {
                    let c_sym = var_info.get("c_symbol").and_then(|v| v.as_str()).unwrap_or("");
                    let vtype = var_info.get("type").and_then(|v| v.as_str()).unwrap_or("BOOL");
                    if let Some(&addr) = symbols.get(c_sym) {
                        specs.push(VarSpec {
                            key:   format!("prog_{}_{}", prog, var_name),
                            address: addr,
                            vtype: vtype.to_string(),
                        });
                    }
                }
            }
        }
    }
    if let Some(gvars) = var_table.get("globalVars").and_then(|v| v.as_object()) {
        for (var_name, var_info) in gvars {
            let c_sym = var_info.get("c_symbol").and_then(|v| v.as_str()).unwrap_or(var_name);
            let vtype = var_info.get("type").and_then(|v| v.as_str()).unwrap_or("BOOL");
            if let Some(&addr) = symbols.get(c_sym) {
                specs.push(VarSpec {
                    key:   format!("prog__{}", var_name),
                    address: addr,
                    vtype: vtype.to_string(),
                });
            }
        }
    }
    // Process debugDefaults entries with base_symbol: array elements and struct members
    if let Some(debug) = var_table.get("debugDefaults").and_then(|v| v.as_object()) {
        for (key, entry) in debug {
            let base_sym = match entry.get("base_symbol").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => continue, // top-level var entries — already handled above
            };
            let byte_offset = entry.get("byte_offset").and_then(|v| v.as_u64()).unwrap_or(0);
            let vtype = entry.get("type").and_then(|v| v.as_str()).unwrap_or("BOOL");
            if let Some(&base_addr) = symbols.get(base_sym) {
                specs.push(VarSpec {
                    key:     key.clone(),
                    address: base_addr + byte_offset,
                    vtype:   vtype.to_string(),
                });
            }
        }
    }
    specs
}

// ---------------------------------------------------------------------------
// Linux: /proc/PID/mem reader
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
mod mem {
    use std::fs::OpenOptions;
    use std::io::{Read, Seek, SeekFrom};

    pub struct ProcMemReader { pid: u32 }

    impl ProcMemReader {
        pub fn open(pid: u32) -> Option<Self> {
            let path = format!("/proc/{}/mem", pid);
            if std::path::Path::new(&path).exists() { Some(ProcMemReader { pid }) } else { None }
        }
        pub fn read(&self, address: u64, size: usize) -> Option<Vec<u8>> {
            let mut f = OpenOptions::new().read(true)
                .open(format!("/proc/{}/mem", self.pid)).ok()?;
            f.seek(SeekFrom::Start(address)).ok()?;
            let mut buf = vec![0u8; size];
            f.read_exact(&mut buf).ok()?;
            Some(buf)
        }
        pub fn is_alive(&self) -> bool {
            std::path::Path::new(&format!("/proc/{}/mem", self.pid)).exists()
        }
    }
}

// ---------------------------------------------------------------------------
// run_simulation
// ---------------------------------------------------------------------------

/// Windows: get symbol pointers from compiled TCC state, start threads.
#[cfg(target_os = "windows")]
#[tauri::command]
fn run_simulation(
    app:   tauri::AppHandle,
    state: State<'_, SimState>,
) -> Result<String, String> {
    let build_dir      = plain_path(&get_build_dir(&app)?);
    let var_table_path = build_dir.join("variable_table.json");

    let var_table_str = fs::read_to_string(&var_table_path)
        .map_err(|e| format!("Failed to read variable_table.json: {}", e))?;
    let var_table: Value = serde_json::from_str(&var_table_str)
        .map_err(|e| format!("Failed to parse variable_table.json: {}", e))?;

    let mut win_guard = state.win.lock().unwrap();

    // Extract the Compiled context
    let compiled = match win_guard.take() {
        Some(win_sim::WinCtx::Compiled(c)) => c,
        Some(running @ win_sim::WinCtx::Running(_)) => {
            *win_guard = Some(running);
            return Err("Simulation is already running".into());
        }
        None => return Err("No compiled simulation. Call compile_simulation first.".into()),
    };

    let (running, var_specs) = unsafe {
        win_sim::start(compiled, &var_table, app.clone())
    }?;

    *win_guard = Some(win_sim::WinCtx::Running(running));
    drop(win_guard);

    *state.var_specs.lock().unwrap() = var_specs;
    let _ = app.emit("simulation-output", json!({"status": "started"}).to_string());
    Ok("Simulation started".into())
}

/// Linux: subprocess + procfs memory reader.
#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn run_simulation(
    app:   tauri::AppHandle,
    state: State<'_, SimState>,
) -> Result<String, String> {
    let build_dir      = plain_path(&get_build_dir(&app)?);
    let bin_path       = build_dir.join(SIM_BIN);
    let var_table_path = build_dir.join("variable_table.json");

    let var_table_str = fs::read_to_string(&var_table_path)
        .map_err(|e| format!("Failed to read variable_table.json: {}", e))?;
    let var_table: Value = serde_json::from_str(&var_table_str)
        .map_err(|e| format!("Failed to parse variable_table.json: {}", e))?;

    let symbols   = parse_symbols(&bin_path)?;
    let var_specs = build_var_specs(&var_table, &symbols);

    if var_specs.is_empty() {
        return Err("No variables matched in symbol table".into());
    }

    let mut proc_guard = state.process.lock().unwrap();
    if proc_guard.is_some() { return Err("Simulation is already running".into()); }

    let child = Command::new(&bin_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start simulation: {}", e))?;

    let pid = child.id();
    *proc_guard = Some(child);
    drop(proc_guard);

    *state.pid.lock().unwrap()       = Some(pid);
    *state.var_specs.lock().unwrap() = var_specs.clone();

    let _ = app.emit("simulation-output", json!({"status": "started"}).to_string());

    let app_handle = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(100));
        let reader = match mem::ProcMemReader::open(pid) {
            Some(r) => r,
            None => {
                let _ = app_handle.emit("simulation-output",
                    json!({"error": "Failed to open process memory"}).to_string());
                return;
            }
        };
        loop {
            thread::sleep(Duration::from_millis(200));
            if !reader.is_alive() { break; }
            let mut vars_data: Map<String, Value> = Map::new();
            let mut any_ok = false;
            for spec in &var_specs {
                let size = type_size(&spec.vtype);
                if size == 0 { continue; }
                if let Some(buf) = reader.read(spec.address, size) {
                    vars_data.insert(spec.key.clone(), decode_value(&buf, &spec.vtype));
                    any_ok = true;
                }
            }
            if any_ok {
                let _ = app_handle.emit("simulation-output", json!({"vars": vars_data}).to_string());
            }
        }
        let _ = app_handle.emit("simulation-output", json!({"status": "exited"}).to_string());
    });

    Ok("Simulation started".into())
}

// ---------------------------------------------------------------------------
// stop_simulation
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
#[tauri::command]
fn stop_simulation(state: State<'_, SimState>) -> Result<String, String> {
    state.var_specs.lock().unwrap().clear();
    let ctx = state.win.lock().unwrap().take();
    match ctx {
        Some(win_sim::WinCtx::Running(_)) => {
            // Running::drop() calls do_stop() — signals plc_stop=1 and joins threads
            Ok("Simulation stopped".into())
        }
        Some(win_sim::WinCtx::Compiled(_)) => Ok("Compiled state cleared".into()),
        None => Err("No simulation running".into()),
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn stop_simulation(state: State<'_, SimState>) -> Result<String, String> {
    *state.pid.lock().unwrap() = None;
    state.var_specs.lock().unwrap().clear();
    let mut proc_guard = state.process.lock().unwrap();
    if let Some(mut child) = proc_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        Ok("Simulation stopped".into())
    } else {
        Err("No simulation running".into())
    }
}

// ---------------------------------------------------------------------------
// write_variable
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
#[tauri::command]
fn write_variable(
    name:  String,
    value: String,
    state: State<'_, SimState>,
) -> Result<(), String> {
    let (address, vtype) = {
        let specs = state.var_specs.lock().unwrap();
        let spec = specs.iter().find(|s| s.key == name)
            .ok_or_else(|| format!("Variable '{}' not found", name))?;
        (spec.address, spec.vtype.clone())
    };
    let data = encode_value(&vtype, &value)
        .ok_or_else(|| format!("Cannot encode '{}' as {}", value, vtype))?;
    // Direct write into in-process TCC memory
    unsafe {
        let ptr = address as *mut u8;
        std::ptr::copy_nonoverlapping(data.as_ptr(), ptr, data.len());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn write_variable(
    name:  String,
    value: String,
    state: State<'_, SimState>,
) -> Result<(), String> {
    let pid = state.pid.lock().unwrap().ok_or("No simulation running")?;
    let (address, vtype) = {
        let specs = state.var_specs.lock().unwrap();
        let spec = specs.iter().find(|s| s.key == name)
            .ok_or_else(|| format!("Variable '{}' not found", name))?;
        (spec.address, spec.vtype.clone())
    };
    let data = encode_value(&vtype, &value)
        .ok_or_else(|| format!("Cannot encode '{}' as {}", value, vtype))?;
    write_proc_mem(pid, address, &data)
}

// ---------------------------------------------------------------------------
// simulate_st (ST parser)
// ---------------------------------------------------------------------------

#[command]
fn simulate_st(code: String) -> Result<String, String> {
    let lexer = lexer::Token::lexer(&code);
    let parser_input = lexer.spanned().map(|(token, span)| match token {
        Ok(t) => Ok((span.start, t, span.end)),
        Err(_) => Err(()),
    });
    let parser = grammar::ProgramParser::new();
    match parser.parse(parser_input) {
        Ok(ast) => serde_json::to_string_pretty(&ast).map_err(|e| e.to_string()),
        Err(e) => Err(format!("Parse Error: {:?}", e)),
    }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .manage(SimState {
            var_specs: Mutex::new(Vec::new()),
            #[cfg(not(target_os = "windows"))]
            process:   Mutex::new(None),
            #[cfg(not(target_os = "windows"))]
            pid:       Mutex::new(None),
            #[cfg(target_os = "windows")]
            win:       Mutex::new(None),
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            simulate_st,
            write_plc_files,
            get_standard_headers,
            compile_simulation,
            run_simulation,
            stop_simulation,
            write_variable,
            update_libraries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
