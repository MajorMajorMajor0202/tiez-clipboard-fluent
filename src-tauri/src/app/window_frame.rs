use serde::Serialize;
use std::sync::atomic::{AtomicU8, Ordering};
use tauri::Emitter;

#[derive(Clone, Copy, Serialize)]
pub struct WindowFrameState {
    pub square_corners: bool,
    pub maximized: bool,
    pub snapped: bool,
}

#[cfg(target_os = "windows")]
fn is_arranged(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use std::sync::OnceLock;
    use windows::core::{s, w, BOOL};
    use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
    type IsWindowArranged = unsafe extern "system" fn(windows::Win32::Foundation::HWND) -> BOOL;
    // Available since Windows 10 1903; resolve dynamically for older systems.
    static API: OnceLock<Option<IsWindowArranged>> = OnceLock::new();
    let api = API.get_or_init(|| unsafe {
        let module = GetModuleHandleW(w!("user32.dll")).ok()?;
        let address = GetProcAddress(module, s!("IsWindowArranged"))?;
        // SAFETY: User32 exports BOOL WINAPI IsWindowArranged(HWND), matching this signature.
        Some(std::mem::transmute::<
            unsafe extern "system" fn() -> isize,
            IsWindowArranged,
        >(address))
    });
    api.map(|call| unsafe { call(hwnd).as_bool() })
        .unwrap_or(false)
}

pub fn query(window: &tauri::Window) -> WindowFrameState {
    let maximized = window.is_maximized().unwrap_or(false);
    #[cfg(target_os = "windows")]
    let snapped = window
        .hwnd()
        .map(|h| is_arranged(windows::Win32::Foundation::HWND(h.0)))
        .unwrap_or(false);
    #[cfg(not(target_os = "windows"))]
    let snapped = false;
    WindowFrameState {
        square_corners: maximized || snapped || window.is_fullscreen().unwrap_or(false),
        maximized,
        snapped,
    }
}

pub fn sync(window: &tauri::Window) -> WindowFrameState {
    let state = query(window);
    if window.label() != "main" {
        return state;
    }
    static PREVIOUS: AtomicU8 = AtomicU8::new(2);
    if PREVIOUS.swap(u8::from(state.square_corners), Ordering::Relaxed)
        == u8::from(state.square_corners)
    {
        return state;
    }
    #[cfg(target_os = "windows")]
    if let Ok(hwnd) = window.hwnd() {
        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND, DWMWCP_ROUND,
        };
        let preference = if state.square_corners {
            DWMWCP_DONOTROUND
        } else {
            DWMWCP_ROUND
        };
        unsafe {
            let _ = DwmSetWindowAttribute(
                windows::Win32::Foundation::HWND(hwnd.0),
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &preference as *const _ as _,
                std::mem::size_of_val(&preference) as u32,
            );
        }
    }
    let _ = window.emit("window-frame-changed", state);
    state
}

#[tauri::command]
pub fn get_window_frame_state(window: tauri::Window) -> WindowFrameState {
    sync(&window)
}
