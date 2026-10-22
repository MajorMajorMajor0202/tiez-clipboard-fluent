use crate::error::{AppError, AppResult};
use serde::Deserialize;
use tauri::WebviewWindow;

#[derive(Clone, Copy, Deserialize)]
pub struct NoteBounds { x: i32, y: i32, width: i32, height: i32 }

#[tauri::command]
pub async fn animate_note_bounds(window: WebviewWindow, target: NoteBounds, duration: u64) -> AppResult<()> {
    if !window.label().starts_with("note-") || target.width <= 0 || target.height <= 0 || target.width > 100_000 || target.height > 100_000 {
        return Err(AppError::Validation("无效的便笺动画范围".into()));
    }
    #[cfg(windows)]
    return tauri::async_runtime::spawn_blocking(move || animate(&window, target, duration.min(500)))
        .await.map_err(|e| AppError::Internal(e.to_string()))?;
    #[cfg(not(windows))]
    {
        let _ = duration;
        window.set_size(tauri::PhysicalSize::new(target.width as u32, target.height as u32)).map_err(|e| AppError::Internal(e.to_string()))?;
        window.set_position(tauri::PhysicalPosition::new(target.x, target.y)).map_err(|e| AppError::Internal(e.to_string()))
    }
}

#[cfg(windows)]
fn animate(window: &WebviewWindow, target: NoteBounds, duration: u64) -> AppResult<()> {
    use std::time::{Duration, Instant};
    use windows::Win32::{Foundation::{HWND, POINT, RECT}, Graphics::{Dwm::DwmFlush, Gdi::ClientToScreen}, UI::WindowsAndMessaging::{GetClientRect, GetWindowRect, IsWindow, SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER, SWP_NOOWNERZORDER}};
    let hwnd = HWND(window.hwnd().map_err(|e| AppError::Internal(e.to_string()))?.0);
    let failure = |e: windows::core::Error| AppError::Internal(format!("便笺动画失败：{e}"));
    let mut outer = RECT::default();
    let mut client = RECT::default();
    let mut origin = POINT::default();
    unsafe {
        GetWindowRect(hwnd, &mut outer).map_err(failure)?;
        GetClientRect(hwnd, &mut client).map_err(failure)?;
        if !ClientToScreen(hwnd, &mut origin).as_bool() { return Err(AppError::Internal("无法获取便笺屏幕位置".into())); }
    }
    let from = NoteBounds { x:outer.left, y:outer.top, width:outer.right-outer.left, height:outer.bottom-outer.top };
    // Frontend geometry uses client pixels. Keep native frame offsets at the current DPI.
    let to = NoteBounds {
        x: target.x - (origin.x - outer.left), y: target.y - (origin.y - outer.top),
        width: target.width + from.width - (client.right-client.left),
        height: target.height + from.height - (client.bottom-client.top),
    };
    let started = Instant::now();
    loop {
        if !unsafe { IsWindow(Some(hwnd)).as_bool() } { return Ok(()); }
        let t = if duration == 0 { 1.0 } else { (started.elapsed().as_secs_f64() * 1000.0 / duration as f64).min(1.0) };
        let ease = t * t * (3.0 - 2.0 * t);
        let lerp = |a: i32, b: i32| (a as f64 + (b as f64-a as f64)*ease).round() as i32;
        unsafe {
            // One window-manager update per compositor frame; no per-frame WebView IPC.
            SetWindowPos(hwnd, None, lerp(from.x,to.x), lerp(from.y,to.y), lerp(from.width,to.width), lerp(from.height,to.height), SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER).map_err(failure)?;
        }
        if t == 1.0 { return Ok(()); }
        if unsafe { DwmFlush() }.is_err() { std::thread::sleep(Duration::from_millis(8)); }
    }
}
