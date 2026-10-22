fn main() {
    if std::env::var("PROFILE").as_deref() == Ok("release") && tauri_build::is_dev() {
        panic!("Release must embed its UI. Build with npm run tauri:build or --features tauri/custom-protocol; a dev-server release cannot be used for autostart.");
    }
    tauri_build::build()
}
