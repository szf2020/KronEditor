fn main() {
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

    tauri_build::build();
    lalrpop::process_root().unwrap();
}
