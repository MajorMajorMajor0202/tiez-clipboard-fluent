use crate::app_state::SettingsState;
use crate::error::{AppError, AppResult};
use crate::global_state::HOTKEY_STRING;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};
use crate::database::DbState;
use crate::infrastructure::repository::settings_repo::SettingsRepository;

const NOTE_ACTIONS: [&str; 4] = ["new", "visibility", "collapse", "dock"];
static LAST_NOTE: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

pub(crate) fn remember_note(label: &str) {
    *LAST_NOTE.lock().unwrap() = Some(label.to_string());
}

pub(crate) fn handle_note_shortcut(app: &AppHandle, shortcut: &Shortcut) -> bool {
    let db = app.state::<DbState>();
    for action in NOTE_ACTIONS {
        let value = db.settings_repo.get(&format!("app.note_{action}_hotkey")).ok().flatten().unwrap_or_default();
        if value.is_empty() || value.replace("Win", "Super").replace("Command", "Super").replace("Cmd", "Super").parse::<Shortcut>().ok().as_ref() != Some(shortcut) { continue; }
        if action == "new" { let _ = app.emit_to("main", "new-note-shortcut", ()); return true; }
        let mut notes: Vec<_> = app.webview_windows().into_iter().filter(|(label, _)| label.starts_with("note-")).collect();
        notes.sort_by(|a, b| a.0.cmp(&b.0));
        if action == "visibility" {
            let hide = notes.iter().any(|(_, window)| window.is_visible().unwrap_or(false));
            for (_, window) in &notes { if hide { let _ = window.hide(); } else { let _ = window.show(); } }
            if !hide {
                let last = LAST_NOTE.lock().unwrap().clone();
                if let Some((_, window)) = notes.iter().find(|(label, _)| Some(label) == last.as_ref()).or_else(|| notes.first()) { let _ = window.set_focus(); }
            }
        } else {
            let last = LAST_NOTE.lock().unwrap().clone();
            if let Some((_, window)) = notes.iter().find(|(_, window)| window.is_focused().unwrap_or(false))
                .or_else(|| notes.iter().find(|(label, _)| Some(label) == last.as_ref())).or_else(|| notes.first()) {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("note-window-action", action);
            }
        }
        return true;
    }
    false
}

#[tauri::command]
pub fn set_note_hotkey(app_handle: AppHandle, action: String, hotkey: String) -> AppResult<()> {
    if !NOTE_ACTIONS.contains(&action.as_str()) { return Err(AppError::Validation("未知的便笺操作".into())); }
    let key = format!("app.note_{action}_hotkey");
    let db = app_handle.state::<DbState>();
    let old = db.settings_repo.get(&key)?.unwrap_or_default();
    if old == hotkey { return Ok(()); }
    let parse = |value: &str| value.replace("Win", "Super").replace("Command", "Super").replace("Cmd", "Super").parse::<Shortcut>();
    let old_shortcut = if old.is_empty() { None } else { parse(&old).ok() };
    let new_shortcut = if hotkey.trim().is_empty() { None } else { Some(parse(&hotkey).map_err(|_| AppError::Validation("快捷键格式无效".into()))?) };
    if new_shortcut != old_shortcut {
        if let Some(shortcut) = &new_shortcut {
            app_handle.global_shortcut().register(shortcut.clone()).map_err(|_| AppError::Validation("该快捷键已被占用，请选择其他组合".into()))?;
        }
    }
    if let Err(error) = db.settings_repo.set(&key, &hotkey) {
        if new_shortcut != old_shortcut { if let Some(shortcut) = new_shortcut { let _ = app_handle.global_shortcut().unregister(shortcut); } }
        return Err(error.into());
    }
    if new_shortcut != old_shortcut { if let Some(shortcut) = old_shortcut { let _ = app_handle.global_shortcut().unregister(shortcut); } }
    let _ = app_handle.emit("settings-changed", ());
    Ok(())
}
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

fn register_shortcut(app_handle: &AppHandle, hotkey: &str) {
    if hotkey.is_empty()
        || hotkey.eq_ignore_ascii_case("MouseMiddle")
        || hotkey.eq_ignore_ascii_case("MButton")
    {
        return;
    }

    let normalized = hotkey.replace("Win", "Super").replace("Command", "Super").replace("Cmd", "Super");
    if let Ok(shortcut) = normalized.parse::<Shortcut>() {
        let _ = app_handle.global_shortcut().register(shortcut);
    }
}

pub(crate) fn sync_registered_hotkeys(app_handle: &AppHandle) -> AppResult<()> {
    let _ = app_handle.global_shortcut().unregister_all();

    let Some(settings) = app_handle.try_state::<SettingsState>() else {
        return Ok(());
    };

    let main_hotkey = settings.main_hotkey.lock().unwrap().clone();
    register_shortcut(app_handle, &main_hotkey);

    let sequential_mode = settings.sequential_mode.load(Ordering::Relaxed);
    let sequential_hotkey = settings.sequential_paste_hotkey.lock().unwrap().clone();
    if sequential_mode {
        register_shortcut(app_handle, &sequential_hotkey);
    }

    let rich_hotkey = settings.rich_paste_hotkey.lock().unwrap().clone();
    register_shortcut(app_handle, &rich_hotkey);

    let search_hotkey = settings.search_hotkey.lock().unwrap().clone();
    register_shortcut(app_handle, &search_hotkey);

    let strip_newline_hotkey = settings.strip_newline_hotkey.lock().unwrap().clone();
    register_shortcut(app_handle, &strip_newline_hotkey);

    let pin_window_hotkey = settings.pin_window_hotkey.lock().unwrap().clone();
    register_shortcut(app_handle, &pin_window_hotkey);

    let db = app_handle.state::<DbState>();
    for action in NOTE_ACTIONS {
        if let Ok(Some(hotkey)) = db.settings_repo.get(&format!("app.note_{action}_hotkey")) { register_shortcut(app_handle, &hotkey); }
    }

    Ok(())
}

#[tauri::command]
pub fn register_hotkey(app_handle: AppHandle, hotkey: String) -> AppResult<()> {
    {
        let mut guard = HOTKEY_STRING.lock().unwrap();
        *guard = hotkey.clone();
    }

    if let Some(settings) = app_handle.try_state::<SettingsState>() {
        let mut guard = settings.main_hotkey.lock().unwrap();
        *guard = hotkey.clone();
    }

    sync_registered_hotkeys(&app_handle)
}

#[tauri::command]
pub fn test_hotkey_available(app_handle: AppHandle, hotkey: String) -> AppResult<bool> {
    if hotkey.is_empty()
        || hotkey.eq_ignore_ascii_case("MouseMiddle")
        || hotkey.eq_ignore_ascii_case("MButton")
    {
        return Ok(true);
    }

    let normalized = hotkey.replace("Win", "Super").replace("Command", "Super").replace("Cmd", "Super");
    let shortcut = normalized
        .parse::<Shortcut>()
        .map_err(|_| AppError::Validation("快捷键格式无效".to_string()))?;

    match app_handle.global_shortcut().register(shortcut.clone()) {
        Ok(_) => {
            let _ = app_handle.global_shortcut().unregister(shortcut);
            Ok(true)
        }
        Err(e) => {
            let err_str = format!("{:?}", e);
            let user_msg = if err_str.contains("AlreadyRegistered") {
                "该快捷键已被其他程序占用".to_string()
            } else {
                "快捷键不可用".to_string()
            };
            Err(AppError::Internal(user_msg))
        }
    }
}
