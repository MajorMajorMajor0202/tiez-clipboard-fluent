use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT, MOD_WIN, VK_CONTROL, VK_LWIN,
    VK_MENU, VK_RWIN, VK_SHIFT,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, KBDLLHOOKSTRUCT, MSLLHOOKSTRUCT, WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN,
    WM_MBUTTONDOWN, WM_RBUTTONDOWN, WM_SYSKEYDOWN, WM_SYSKEYUP, LLKHF_INJECTED,
};

use crate::app::window_manager::{hide_window_cmd, toggle_window};
use crate::app_state::SettingsState;
use crate::global_state::*;
use crate::infrastructure::windows_ext::WindowExt;

// Store registered hotkey IDs for cleanup
static BLOCKED_HOTKEY_IDS: std::sync::Mutex<Vec<i32>> = std::sync::Mutex::new(Vec::new());

#[cfg(target_os = "windows")]
static LIST_DIGIT_MASK: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
static LIST_PHYSICAL_MODIFIERS: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

fn modifier_key_bit(vk: u32) -> u32 {
    match vk {
        0x11 | 0xA2 => 1, 0xA3 => 2,
        0x12 | 0xA4 => 4, 0xA5 => 8,
        0x10 | 0xA0 => 16, 0xA1 => 32,
        0x5B => 64, 0x5C => 128,
        _ => 0,
    }
}

fn physical_modifier_mask(keys: u32) -> u8 {
    u8::from(keys & 3 != 0) | (u8::from(keys & 12 != 0) << 1)
        | (u8::from(keys & 48 != 0) << 2)
}

fn update_physical_keys(keys: u32, vk: u32, down: bool, injected: bool) -> u32 {
    if injected { return keys; }
    let bit = modifier_key_bit(vk);
    if down { keys | bit } else { keys & !bit }
}

#[tauri::command]
pub fn get_list_quick_paste_state(window: tauri::WebviewWindow) -> Option<&'static str> {
    if window.label() != "main" { return None; }
    #[cfg(windows)]
    {
        let hwnd = MAIN_WINDOW_HWND.load(Ordering::Relaxed);
        if hwnd == 0 || IS_HIDDEN.load(Ordering::Relaxed)
            || !WindowExt::is_window_visible(HWND(hwnd as _)) { return None; }
        let keys = LIST_PHYSICAL_MODIFIERS.load(Ordering::SeqCst);
        let configured = window.state::<SettingsState>().list_quick_paste_modifier.load(Ordering::Relaxed);
        let matches = configured != 0 && physical_modifier_mask(keys) == configured && keys & 192 == 0;
        return list_hint_action(false, matches, matches,
            WindowExt::get_foreground_window().0 as usize == hwnd);
    }
    #[cfg(not(windows))]
    None
}

fn list_hint_action(injected: bool, down: bool, matches: bool, foreground: bool) -> Option<&'static str> {
    // Menu suppression / remapping can inject Alt down immediately after a real
    // Alt up. Those events must not resurrect a released KeyTip session.
    if injected { return None; }
    Some(if down && matches {
        if foreground { "show-focused" } else { "show" }
    } else { "released" })
}

#[cfg(test)]
mod list_hint_tests {
    use super::{list_hint_action, physical_modifier_mask, update_physical_keys};

    #[test]
    fn held_modifiers_survive_synthetic_paste_transitions() {
        let mut keys = update_physical_keys(0, 0xA4, true, false);
        assert_eq!(physical_modifier_mask(keys), 2);
        keys = update_physical_keys(keys, 0x12, false, true);
        assert_eq!(physical_modifier_mask(keys), 2);
        keys = update_physical_keys(keys, 0xA5, true, false);
        keys = update_physical_keys(keys, 0xA4, false, false);
        assert_eq!(physical_modifier_mask(keys), 2, "right Alt remains held");
        keys = update_physical_keys(keys, 0xA2, true, false);
        assert_eq!(physical_modifier_mask(keys), 3);
        keys = update_physical_keys(keys, 0xA5, false, false);
        assert_eq!(physical_modifier_mask(keys), 1);
        keys = update_physical_keys(keys, 0xA2, false, false);
        keys = update_physical_keys(keys, 0xA4, true, true);
        assert_eq!(physical_modifier_mask(keys), 0, "synthetic Alt cannot restart the session");
    }

    #[test]
    fn injected_alt_after_release_cannot_reopen_hints() {
        assert_eq!(list_hint_action(false, true, true, false), Some("show"));
        assert_eq!(list_hint_action(false, false, false, false), Some("released"));
        assert_eq!(list_hint_action(true, true, true, false), None);
        assert_eq!(list_hint_action(true, false, false, false), None);
        assert_eq!(list_hint_action(false, true, true, true), Some("show-focused"));
        assert_eq!(list_hint_action(false, true, false, true), Some("released"));
    }
}

// Ctrl=1, Alt=2, Shift=4. Keep this canonical set aligned with the UI options.
pub fn list_quick_paste_mask(value: &str) -> u8 {
    match value.trim().to_ascii_lowercase().as_str() {
        "disabled" => 0,
        "ctrl" => 1,
        "shift" => 4,
        "ctrl+alt" => 3,
        "ctrl+shift" => 5,
        "alt+shift" => 6,
        "ctrl+alt+shift" => 7,
        _ => 2,
    }
}

#[cfg(target_os = "windows")]
fn quick_paste_index_from_vk(vk: u32) -> Option<usize> {
    match vk {
        0x31 | 0x61 => Some(0),
        0x32 | 0x62 => Some(1),
        0x33 | 0x63 => Some(2),
        0x34 | 0x64 => Some(3),
        0x35 | 0x65 => Some(4),
        0x36 | 0x66 => Some(5),
        0x37 | 0x67 => Some(6),
        0x38 | 0x68 => Some(7),
        0x39 | 0x69 => Some(8),
        0x30 | 0x60 => Some(9),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
fn quick_paste_modifier_from_settings() -> String {
    if let Some(handle) = GLOBAL_APP_HANDLE.get() {
        let settings = handle.state::<SettingsState>();
        return settings
            .quick_paste_modifier
            .lock()
            .unwrap()
            .clone()
            .to_ascii_lowercase();
    }

    "disabled".to_string()
}

#[cfg(target_os = "windows")]
fn quick_paste_modifier_active(
    modifier: &str,
    ctrl_down: bool,
    alt_down: bool,
    shift_down: bool,
    win_down: bool,
) -> bool {
    match modifier {
        "disabled" => false,
        "ctrl" => ctrl_down && !alt_down && !shift_down && !win_down,
        "alt" => alt_down && !ctrl_down && !shift_down && !win_down,
        "shift" => shift_down && !ctrl_down && !alt_down && !win_down,
        "win" => win_down && !ctrl_down && !alt_down && !shift_down,
        _ => ctrl_down && !alt_down && !shift_down && !win_down,
    }
}

#[cfg(target_os = "windows")]
fn quick_tab_assign_modifier_active(
    modifier: &str,
    ctrl_down: bool,
    alt_down: bool,
    shift_down: bool,
    win_down: bool,
) -> bool {
    let m = modifier.trim().to_ascii_lowercase().replace(' ', "");
    match m.as_str() {
        "ctrl+alt" | "control+alt" | "alt+ctrl" => ctrl_down && alt_down && !shift_down && !win_down,
        "alt+shift" | "shift+alt" => alt_down && shift_down && !ctrl_down && !win_down,
        "ctrl+shift" | "control+shift" | "shift+ctrl" => ctrl_down && shift_down && !alt_down && !win_down,
        "win+alt" | "alt+win" => win_down && alt_down && !ctrl_down && !shift_down,
        _ => ctrl_down && alt_down && !shift_down && !win_down,
    }
}

#[tauri::command]
pub fn set_recording_mode(app_handle: AppHandle, enabled: bool) -> Result<(), String> {
    IS_RECORDING.store(enabled, Ordering::SeqCst);

    let mut ids = BLOCKED_HOTKEY_IDS.lock().unwrap();

    #[cfg(target_os = "windows")]
    if enabled {
        // Register ALL Win+ combinations to block system from handling them
        if let Some(window) = app_handle.get_webview_window("main") {
            if let Ok(hwnd_raw) = window.hwnd() {
                let hwnd = HWND(hwnd_raw.0);
                let mut id_counter = 0x1000i32;

                // Block Win + A-Z
                for vk in 0x41u32..=0x5Au32 {
                    unsafe {
                        if RegisterHotKey(Some(hwnd), id_counter, MOD_WIN | MOD_NOREPEAT, vk)
                            .is_ok()
                        {
                            ids.push(id_counter);
                        }
                    }
                    id_counter += 1;
                }

                // Block Win + 0-9
                for vk in 0x30u32..=0x39u32 {
                    unsafe {
                        if RegisterHotKey(Some(hwnd), id_counter, MOD_WIN | MOD_NOREPEAT, vk)
                            .is_ok()
                        {
                            ids.push(id_counter);
                        }
                    }
                    id_counter += 1;
                }

                // Block special keys
                let special_keys = [0x20u32, 0x0D, 0x09, 0x1B, 0x2C]; // Space, Enter, Tab, Esc, PrintScreen
                for vk in special_keys {
                    unsafe {
                        if RegisterHotKey(Some(hwnd), id_counter, MOD_WIN | MOD_NOREPEAT, vk)
                            .is_ok()
                        {
                            ids.push(id_counter);
                        }
                    }
                    id_counter += 1;
                }
                println!("Recording mode ON: Blocked {} Win+ combinations", ids.len());
            }
        }
    } else {
        // Unregister all blocked hotkeys
        if let Some(window) = app_handle.get_webview_window("main") {
            if let Ok(hwnd_raw) = window.hwnd() {
                let hwnd = HWND(hwnd_raw.0);
                for id in ids.drain(..) {
                    unsafe {
                        let _ = UnregisterHotKey(Some(hwnd), id);
                    }
                }
                println!("Recording mode OFF: Released blocked hotkeys");
            }
        }
    }

    Ok(())
}

// Low-level Keyboard Hook Procedure
#[cfg(target_os = "windows")]
pub unsafe extern "system" fn keyboard_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    let msg = w_param.0 as u32;
    let is_down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
    let is_up = msg == WM_KEYUP || msg == WM_SYSKEYUP;

    if n_code >= 0 && (is_down || is_up) {
        let kbd_struct = *(l_param.0 as *const KBDLLHOOKSTRUCT);
        let vk = kbd_struct.vkCode;
        // Track physical keys even while hidden. Paste/menu helpers inject
        // modifier transitions that must not change a held list shortcut.
        if modifier_key_bit(vk) != 0 {
            let previous = LIST_PHYSICAL_MODIFIERS.load(Ordering::SeqCst);
            let updated = update_physical_keys(previous, vk, is_down, kbd_struct.flags.contains(LLKHF_INJECTED));
            if updated != previous {
                LIST_PHYSICAL_MODIFIERS.store(updated, Ordering::SeqCst);
                if is_down { LIST_DIGIT_MASK.store(0, Ordering::SeqCst); }
            }
        }

        // Handle Recording Mode - Black Hole Logic
        if IS_RECORDING.load(Ordering::SeqCst) {
            let ctrl_down = GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000 != 0;
            let shift_down = GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000 != 0;
            let alt_down = GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000 != 0;
            let win_down = (GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000 != 0);

            // ESC to cancel
            if vk == 0x1B && is_down {
                IS_RECORDING.store(false, Ordering::SeqCst);
                if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                    let _ = handle.emit("recording-cancelled", ());
                }
                return CallNextHookEx(None, n_code, w_param, l_param);
            }

            let is_win = vk == 0x5B || vk == 0x5C;
            let is_other_modifier = (vk >= 0x10 && vk <= 0x12) || (vk >= 0xA0 && vk <= 0xA5);

            if is_other_modifier {
                return CallNextHookEx(None, n_code, w_param, l_param);
            }

            if !is_win && is_down {
                if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                    let key_name = match vk {
                        0x20 => "Space".to_string(),
                        0x0D => "Enter".to_string(),
                        0x09 => "Tab".to_string(),
                        0x08 => "Backspace".to_string(),
                        0x2E => "Delete".to_string(),
                        0x2D => "Insert".to_string(),
                        0x21 => "PageUp".to_string(),
                        0x22 => "PageDown".to_string(),
                        0x23 => "End".to_string(),
                        0x24 => "Home".to_string(),
                        0x25 => "Left".to_string(),
                        0x26 => "Up".to_string(),
                        0x27 => "Right".to_string(),
                        0x28 => "Down".to_string(),
                        0xBB => "Plus".to_string(),
                        0xBC => "Comma".to_string(),
                        0xBD => "Minus".to_string(),
                        0xBE => "Period".to_string(),
                        0xBF => "/".to_string(),
                        0xC0 => "`".to_string(),
                        0xBA => ";".to_string(),
                        0xDB => "[".to_string(),
                        0xDC => "\\".to_string(),
                        0xDD => "]".to_string(),
                        0xDE => "'".to_string(),
                        k if k >= 0x70 && k <= 0x87 => format!("F{}", k - 0x6F),
                        k if (k >= 0x30 && k <= 0x39) || (k >= 0x41 && k <= 0x5A) => {
                            format!("{}", char::from_u32(k).unwrap())
                        }
                        _ => format!("Key_{}", vk),
                    };

                    let final_hotkey = format!(
                        "{}{}{}{}{}",
                        if ctrl_down { "Ctrl+" } else { "" },
                        if shift_down { "Shift+" } else { "" },
                        if alt_down { "Alt+" } else { "" },
                        if win_down { "Win+" } else { "" },
                        key_name
                    );

                    println!("Recorded Hotkey: {}", final_hotkey);
                    let _ = handle.emit("hotkey-recorded", final_hotkey);
                    IS_RECORDING.store(false, Ordering::SeqCst);
                }
            }
            return LRESULT(1);
        }

        // 3. Global Paste Sound Trigger (Ctrl+V)
        {
            let ctrl_down = (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000) != 0;
            let alt_down = (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0;
            let shift_down = (GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000) != 0;
            let win_down = (GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000 != 0);

            if vk == 0x56 && ctrl_down && !alt_down && !shift_down && !win_down {
                if is_down {
                    if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                        let settings = handle.state::<SettingsState>();
                        if settings.sound_enabled.load(Ordering::Relaxed) {
                            std::thread::spawn(move || {
                                let _ = handle.emit("play-sound", "paste");
                            });
                        }
                    }
                }
            }
        }

        let main_hwnd = MAIN_WINDOW_HWND.load(Ordering::Relaxed);
        let main_is_foreground = main_hwnd != 0
            && WindowExt::get_foreground_window().0 as usize == main_hwnd;
        let main_is_visible = main_hwnd != 0
            && WindowExt::is_window_visible(HWND(main_hwnd as _));
        let list_modifier_active;
        // The popup is normally shown without activation. Forward its Alt shortcuts
        // to the frontend, which owns the workspace/search order. Focused WebView
        // handles DOM events directly so each press has exactly one owner.
        {
            let digit = quick_paste_index_from_vk(vk);
            if is_up {
                if let Some(index) = digit {
                    if LIST_DIGIT_MASK.fetch_and(!(1 << index), Ordering::SeqCst) & (1 << index) != 0 {
                        return LRESULT(1);
                    }
                }
            }
            let list_visible = NAVIGATION_ENABLED.load(Ordering::SeqCst)
                && !IS_HIDDEN.load(Ordering::Relaxed) && main_is_visible;
            let active = list_visible && !main_is_foreground;
            let configured = GLOBAL_APP_HANDLE.get().map(|handle| {
                handle.state::<SettingsState>().list_quick_paste_modifier.load(Ordering::Relaxed)
            }).unwrap_or(2);
            let physical_keys = LIST_PHYSICAL_MODIFIERS.load(Ordering::SeqCst);
            let pressed = physical_modifier_mask(physical_keys);
            list_modifier_active = configured != 0 && configured == pressed && physical_keys & 192 == 0;
            // Native notifications cover the non-activating popup; focused
            // WebView input also handles DOM keys when hooks do not deliver them.
            let modifier_event = matches!(vk,
                0x11 | 0xA2 | 0xA3 | 0x12 | 0xA4 | 0xA5 | 0x10 | 0xA0 | 0xA1 | 0x5B | 0x5C);
            if list_visible && modifier_event {
                if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                    if let Some(action) = list_hint_action(kbd_struct.flags.contains(LLKHF_INJECTED), is_down, list_modifier_active, main_is_foreground) {
                        let _ = handle.emit_to("main", "list-quick-paste", action);
                    }
                }
            }
            if active && list_modifier_active && is_down {
                if let Some(index) = digit {
                    let bit = 1 << index;
                    if LIST_DIGIT_MASK.fetch_or(bit, Ordering::SeqCst) & bit == 0 {
                        if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                            let key = if index == 9 { "0".to_string() } else { (index + 1).to_string() };
                            let _ = handle.emit_to("main", "list-quick-paste", key);
                        }
                    }
                    return LRESULT(1);
                }
            }
        }

        // 4. Quick Paste by Modifier+Number
        {
            let ctrl_down = (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000) != 0;
            let alt_down = (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0;
            let shift_down = (GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000) != 0;
            let win_down = (GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000 != 0);
            let quick_paste_modifier = quick_paste_modifier_from_settings();

            if is_up
                && matches!(
                    vk,
                    0x11 | 0xA2 | 0xA3 | 0x12 | 0xA4 | 0xA5 | 0x10 | 0xA0 | 0xA1 | 0x5B | 0x5C
                )
            {
                QUICK_PASTE_DIGIT_MASK.store(0, Ordering::SeqCst);
            }

            if let Some(index) = quick_paste_index_from_vk(vk) {
                let bit = 1u32 << index;

                if is_up {
                    let pressed_mask = QUICK_PASTE_DIGIT_MASK.fetch_and(!bit, Ordering::SeqCst);
                    if pressed_mask & bit != 0 {
                        return LRESULT(1);
                    }
                }

                // The focused main list owns its configured shortcut and filtered order.
                // Let WebView receive these keys instead of the global pinned shortcut.
                if is_down
                    && !(main_is_foreground && list_modifier_active)
                    && quick_paste_modifier_active(
                        &quick_paste_modifier,
                        ctrl_down,
                        alt_down,
                        shift_down,
                        win_down,
                    )
                {
                    let pressed_mask = QUICK_PASTE_DIGIT_MASK.fetch_or(bit, Ordering::SeqCst);
                    if pressed_mask & bit != 0 {
                        return LRESULT(1);
                    }

                    if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                        let handle_clone = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(err) =
                                crate::services::clipboard_ops::paste_history_item_by_index(
                                    handle_clone,
                                    index,
                                )
                                .await
                            {
                                eprintln!(
                                    "[ERROR] Quick paste by {}+{} failed: {}",
                                    quick_paste_modifier,
                                    index + 1,
                                    err
                                );
                            }
                        });
                    }

                    return LRESULT(1);
                }
            }
        }

        // 4.5. Quick Tab Assign by Modifier+Number within N seconds after copy
        {
            let ctrl_down = (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000) != 0;
            let alt_down = (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0;
            let shift_down = (GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000) != 0;
            let win_down = (GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000) != 0
                || (GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000) != 0;

            if is_up
                && matches!(
                    vk,
                    0x11 | 0xA2 | 0xA3 | 0x12 | 0xA4 | 0xA5 | 0x10 | 0xA0 | 0xA1 | 0x5B | 0x5C
                )
            {
                QUICK_TAB_ASSIGN_DIGIT_MASK.store(0, Ordering::SeqCst);
            }

            if let Some(index) = quick_paste_index_from_vk(vk) {
                let bit = 1u32 << index;

                if is_up {
                    let pressed_mask = QUICK_TAB_ASSIGN_DIGIT_MASK.fetch_and(!bit, Ordering::SeqCst);
                    if pressed_mask & bit != 0 {
                        return LRESULT(1);
                    }
                }

                if is_down && !(list_modifier_active && NAVIGATION_ENABLED.load(Ordering::Relaxed)
                    && !IS_HIDDEN.load(Ordering::Relaxed)) {
                    if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                        let settings = handle.state::<SettingsState>();
                        if settings.quick_tab_assign_enabled.load(Ordering::Relaxed) {
                            let modifier = settings
                                .quick_tab_assign_modifier
                                .lock()
                                .unwrap()
                                .clone();
                            if quick_tab_assign_modifier_active(
                                &modifier,
                                ctrl_down,
                                alt_down,
                                shift_down,
                                win_down,
                            ) {
                                let seconds = settings.quick_tab_assign_seconds.load(Ordering::Relaxed);
                                let now = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64;
                                let last_copy = LAST_COPY_TIMESTAMP.load(Ordering::Relaxed);
                                let diff = now.saturating_sub(last_copy);
                                if diff <= (seconds as u64) * 1000 {
                                    let pressed_mask = QUICK_TAB_ASSIGN_DIGIT_MASK.fetch_or(bit, Ordering::SeqCst);
                                    if pressed_mask & bit != 0 {
                                        return LRESULT(1);
                                    }

                                    let item_id = LAST_COPY_ITEM_ID.load(Ordering::Relaxed);
                                    let handle_clone = handle.clone();
                                    tauri::async_runtime::spawn(async move {
                                        let _ = handle_clone.emit("quick-assign-tab", serde_json::json!({
                                            "index": index,
                                            "itemId": item_id
                                        }));
                                    });

                                    return LRESULT(1);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. Global Navigation Keys (Up/Down, Enter, Esc)
        if NAVIGATION_ENABLED.load(Ordering::SeqCst) && !IS_RECORDING.load(Ordering::SeqCst) {
            if IS_HIDDEN.load(Ordering::Relaxed) {
                return CallNextHookEx(None, n_code, w_param, l_param);
            }
            let allow_navigation = if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                let settings = handle.state::<SettingsState>();
                settings.arrow_key_selection.load(Ordering::Relaxed)
            } else {
                true
            };

            if !allow_navigation {
                return CallNextHookEx(None, n_code, w_param, l_param);
            }

            let is_navigation_key = vk == 0x26 || vk == 0x28 || vk == 0x0D || vk == 0x1B;
            let is_enter = vk == 0x0D;
            let _is_escape = vk == 0x1B;

            if is_navigation_key && is_down {
                // Only Enter requires navigation mode to be active
                // Escape can always close the window when it's visible
                if is_enter && !NAVIGATION_MODE_ACTIVE.load(Ordering::Relaxed) {
                    return CallNextHookEx(None, n_code, w_param, l_param);
                }
                let ctrl_down = (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000) != 0;
                let alt_down = (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0;
                let win_down = (GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000 != 0)
                    || (GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000 != 0);

                if !ctrl_down && !alt_down && !win_down {
                    if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                        let action = match vk {
                            0x26 => "up",
                            0x28 => "down",
                            0x0D => "enter",
                            0x1B => "escape",
                            _ => "",
                        };

                        if !action.is_empty() {
                            if vk == 0x26 || vk == 0x28 {
                                NAVIGATION_MODE_ACTIVE.store(true, Ordering::Relaxed);
                            } else if vk == 0x1B {
                                NAVIGATION_MODE_ACTIVE.store(false, Ordering::Relaxed);
                            }
                            if action == "escape" {
                                let handle_clone = handle.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = handle_clone.emit("navigation-action", "escape");
                                    toggle_window(&handle_clone);
                                });
                            } else {
                                let _ = handle.emit("navigation-action", action);
                            }
                            return LRESULT(1);
                        }
                    }
                }
            }
        }
    }
    CallNextHookEx(None, n_code, w_param, l_param)
}

// Low-level Mouse Hook Procedure
#[cfg(target_os = "windows")]
pub unsafe extern "system" fn mouse_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code >= 0 {
        let msg = w_param.0 as u32;
        if msg == WM_MBUTTONDOWN
            || msg == WM_LBUTTONDOWN
            || msg == WM_RBUTTONDOWN
            || msg == windows::Win32::UI::WindowsAndMessaging::WM_LBUTTONUP
            || msg == windows::Win32::UI::WindowsAndMessaging::WM_RBUTTONUP
        {
            // Track mouse state globally
            if msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN {
                IS_MOUSE_BUTTON_DOWN.store(true, Ordering::SeqCst);
            } else if msg == windows::Win32::UI::WindowsAndMessaging::WM_LBUTTONUP
                || msg == windows::Win32::UI::WindowsAndMessaging::WM_RBUTTONUP
            {
                IS_MOUSE_BUTTON_DOWN.store(false, Ordering::SeqCst);
                return CallNextHookEx(None, n_code, w_param, l_param); // Return early for up events
            }

            // Handle Recording Mode
            if IS_RECORDING.load(Ordering::SeqCst) && msg == WM_MBUTTONDOWN {
                IS_RECORDING.store(false, Ordering::SeqCst);
                if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                    let _ = handle.emit("hotkey-recorded", "MouseMiddle");
                }
                return LRESULT(1);
            }

            // Click Elsewhere to Hide Logic
            if msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN {
                if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                    if let Some(window) = handle.get_webview_window("main") {
                        if !IGNORE_BLUR.load(Ordering::Relaxed) {
                            let mouse_struct = *(l_param.0 as *const MSLLHOOKSTRUCT);
                            let point = mouse_struct.pt;

                            if let Ok(hwnd_raw) = window.hwnd() {
                                let main_hwnd = HWND(hwnd_raw.0);
                                if !WindowExt::is_window_visible(main_hwnd) {
                                    return CallNextHookEx(None, n_code, w_param, l_param);
                                }
                                let mut rect = RECT::default();
                                let _ = windows::Win32::UI::WindowsAndMessaging::GetWindowRect(
                                    main_hwnd, &mut rect,
                                );

                                // Boundary check: Is point outside the rect? (with 5px margin of safety)
                                let margin = 5;
                                let is_outside = point.x < rect.left - margin
                                    || point.x > rect.right + margin
                                    || point.y < rect.top - margin
                                    || point.y > rect.bottom + margin;

                                if is_outside {
                                    // Status check before hiding
                                    if !WindowExt::is_window_visible(main_hwnd) {
                                        return CallNextHookEx(None, n_code, w_param, l_param);
                                    }

                                    if WINDOW_PINNED.load(Ordering::Relaxed) {
                                        // Pinned: Just reset focusable state to ensure we don't retain focus
                                        let _ = window.set_focusable(false);
                                    } else {
                                        let _ = hide_window_cmd(handle.clone(), None);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Handle configured middle mouse hotkey
            if msg == WM_MBUTTONDOWN {
                let current = HOTKEY_STRING.lock().unwrap().to_lowercase();
                if current == "mousemiddle" || current == "mbutton" {
                    if let Some(handle) = GLOBAL_APP_HANDLE.get() {
                        toggle_window(&handle);
                    }
                    return LRESULT(1);
                }
            }
        }
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

pub fn parse_hotkey_for_hook(hotkey: &str) -> Option<HookHotkey> {
    let parts: Vec<&str> = hotkey.split('+').collect();
    let mut vk = 0u32;
    let mut ctrl = false;
    let mut shift = false;
    let mut alt = false;
    let mut win = false;

    for part in parts {
        let part_upper = part.trim().to_uppercase();
        match part_upper.as_str() {
            "CTRL" | "CONTROL" => ctrl = true,
            "SHIFT" => shift = true,
            "ALT" | "MENU" => alt = true,
            "SUPER" | "WIN" | "COMMAND" | "META" => win = true,
            "SPACE" => vk = 0x20,
            "ENTER" | "RETURN" => vk = 0x0D,
            "TAB" => vk = 0x09,
            "BACKSPACE" => vk = 0x08,
            "DELETE" => vk = 0x2E,
            "INSERT" => vk = 0x2D,
            "PAGEUP" => vk = 0x21,
            "PAGEDOWN" => vk = 0x22,
            "END" => vk = 0x23,
            "HOME" => vk = 0x24,
            "LEFT" => vk = 0x25,
            "UP" => vk = 0x26,
            "RIGHT" => vk = 0x27,
            "DOWN" => vk = 0x28,
            "PLUS" | "=" => vk = 0xBB,
            "COMMA" | "," => vk = 0xBC,
            "MINUS" | "-" => vk = 0xBD,
            "PERIOD" | "." => vk = 0xBE,
            "/" | "SLASH" => vk = 0xBF,
            "`" | "TILDE" | "GRAVE" => vk = 0xC0,
            ";" | "SEMICOLON" => vk = 0xBA,
            "[" | "LBRACKET" => vk = 0xDB,
            "\\" | "BACKSLASH" => vk = 0xDC,
            "]" | "RBRACKET" => vk = 0xDD,
            "'" | "QUOTE" => vk = 0xDE,
            key if key.starts_with('F') && key.len() > 1 => {
                if let Ok(num) = key[1..].parse::<u32>() {
                    if (1..=24).contains(&num) {
                        vk = 0x6F + num;
                    }
                }
            }
            key => {
                if key.len() == 1 {
                    vk = key.chars().next().unwrap() as u32;
                }
            }
        }
    }

    if vk != 0 {
        Some(HookHotkey {
            vk,
            ctrl,
            shift,
            alt,
            win,
        })
    } else {
        None
    }
}

pub fn is_win_v_hotkey(hotkey: &str) -> bool {
    let parts: Vec<String> = hotkey
        .split('+')
        .map(|p| p.trim().to_uppercase())
        .filter(|p| !p.is_empty())
        .collect();

    if parts.is_empty() {
        return false;
    }

    let mut has_win = false;
    let mut has_v = false;

    for part in &parts {
        match part.as_str() {
            "WIN" | "SUPER" | "COMMAND" | "META" => has_win = true,
            "V" => has_v = true,
            _ => return false,
        }
    }

    has_win && has_v
}
