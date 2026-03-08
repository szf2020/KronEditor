fn main() {
    // Create resources/ symlink inside src-tauri/ pointing to ../resources (project root).
    // This lets tauri.conf.json use simple "resources/..." glob patterns while the
    // actual files live at the project root (gitignored there, outside src-tauri/).
    let symlink_path = std::path::Path::new("resources");
    let target_path  = std::path::Path::new("../resources");
    if !symlink_path.exists() {
        #[cfg(unix)]
        let _ = std::os::unix::fs::symlink(target_path, symlink_path);
        #[cfg(windows)]
        let _ = std::os::windows::fs::symlink_dir(target_path, symlink_path);
    }

    // Ensure resource directories exist with a placeholder file so Tauri's
    // glob patterns don't fail when no libraries have been built yet.
    let res = std::path::Path::new("../resources");
    for dir in &["Simulation/Linux", "Simulation/Windows", "Simulation/MacOS",
                 "CortexM0", "CortexM4F", "CortexM7F"] {
        let d = res.join(dir);
        let _ = std::fs::create_dir_all(&d);
        let placeholder = d.join("EMPTY");
        if !placeholder.exists() {
            // Only create if directory truly has no real files
            let has_files = std::fs::read_dir(&d)
                .map(|entries| entries.flatten().any(|e| {
                    let name = e.file_name();
                    let n = name.to_string_lossy();
                    n != "EMPTY" && !n.starts_with('.')
                }))
                .unwrap_or(false);
            if !has_files {
                let _ = std::fs::write(&placeholder, "");
            }
        }
    }

    // Ensure MinGW resources directory exists so Tauri's glob doesn't fail
    // when the toolchain hasn't been downloaded yet.
    let mingw_bin = std::path::Path::new("mingw/windows-x64/bin");
    let _ = std::fs::create_dir_all(mingw_bin);
    // Place a placeholder only when directory is otherwise empty
    let placeholder = mingw_bin.join("EMPTY");
    if !placeholder.exists() {
        let has_files = std::fs::read_dir(mingw_bin)
            .map(|e| e.flatten().any(|f| {
                let n = f.file_name(); let s = n.to_string_lossy();
                s != "EMPTY" && !s.starts_with('.')
            }))
            .unwrap_or(false);
        if !has_files {
            let _ = std::fs::write(&placeholder, "");
        }
    }

    tauri_build::build();
    lalrpop::process_root().unwrap();
}
