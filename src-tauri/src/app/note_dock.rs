use serde::Deserialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use crate::error::{AppError, AppResult};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockArea { edge: i32, top: i32, bottom: i32, scale: f64 }
#[derive(Clone)]
struct Slot { label: String, area: DockArea }
static SLOTS: Mutex<Vec<Slot>> = Mutex::new(Vec::new());
fn same_area(a: &DockArea, b: &DockArea) -> bool { a.edge == b.edge && a.top == b.top && a.bottom == b.bottom }
fn slot_y(area: &DockArea, index: usize, count: usize) -> i32 {
    let height = (38.0 * area.scale).round() as i32;
    let padding = (12.0 * area.scale).round() as i32;
    let available = (area.bottom - area.top - 2 * padding - height).max(0);
    let step = ((46.0 * area.scale).round() as i32).min(if count > 1 { available / (count as i32 - 1) } else { available });
    area.top + padding + step * index as i32
}
fn notify(app: &AppHandle, slots: &[Slot], except: &str) {
    for slot in slots {
        if slot.label == except { continue; }
        let group: Vec<_> = slots.iter().filter(|s| same_area(&s.area, &slot.area)).collect();
        let index = group.iter().position(|s| s.label == slot.label).unwrap();
        if let Some(window) = app.get_webview_window(&slot.label) { let _ = window.emit("note-dock-position", slot_y(&slot.area, index, group.len())); }
    }
}
fn require_note(window: &WebviewWindow) -> AppResult<()> {
    if window.label().starts_with("note-") { Ok(()) } else { Err(AppError::Validation("此操作仅适用于便笺".into())) }
}
#[tauri::command]
pub fn dock_note(window: WebviewWindow, area: DockArea) -> AppResult<i32> {
    require_note(&window)?;
    if !area.scale.is_finite() || !(0.5..=8.0).contains(&area.scale) || area.bottom <= area.top { return Err(AppError::Validation("无效的屏幕范围".into())); }
    let mut slots = SLOTS.lock().unwrap();
    slots.retain(|s| s.label != window.label());
    slots.push(Slot { label: window.label().into(), area: area.clone() });
    let count = slots.iter().filter(|s| same_area(&s.area, &area)).count();
    let y = slot_y(&area, count - 1, count);
    notify(window.app_handle(), &slots, window.label());
    Ok(y)
}
#[tauri::command]
pub fn undock_note(window: WebviewWindow) -> AppResult<()> {
    require_note(&window)?;
    remove(window.app_handle(), window.label());
    Ok(())
}
pub fn remove(app: &AppHandle, label: &str) {
    let mut slots = SLOTS.lock().unwrap();
    let before = slots.len();
    slots.retain(|s| s.label != label);
    if before != slots.len() { notify(app, &slots, label); }
}
fn reorder(slots: &mut Vec<Slot>, label: &str, y: i32) -> Option<i32> {
    let index = slots.iter().position(|s| s.label == label)?;
    let slot = slots.remove(index);
    let others: Vec<_> = slots.iter().enumerate().filter(|(_, s)| same_area(&s.area, &slot.area)).map(|(i, _)| i).collect();
    let count = others.len() + 1;
    let target = (0..count).min_by_key(|i| (i64::from(slot_y(&slot.area, *i, count)) - i64::from(y)).abs()).unwrap();
    let insert = others.get(target).copied().unwrap_or_else(|| others.last().map(|i| i + 1).unwrap_or(slots.len()));
    let result = slot_y(&slot.area, target, count);
    slots.insert(insert, slot);
    Some(result)
}
#[tauri::command]
pub fn move_docked_note(window: WebviewWindow, y: i32) -> AppResult<i32> {
    require_note(&window)?;
    let mut slots = SLOTS.lock().unwrap();
    let result = reorder(&mut slots, window.label(), y).ok_or_else(|| AppError::Validation("便笺尚未停靠".into()))?;
    notify(window.app_handle(), &slots, window.label());
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn area() -> DockArea { DockArea { edge: 0, top: -1080, bottom: 0, scale: 1.5 } }
    #[test]
    fn reorder_preserves_other_monitors() {
        let a = area(); let b = DockArea { edge: 1920, ..a.clone() };
        let mut slots = vec![Slot {label:"note-1".into(),area:a.clone()},Slot{label:"note-2".into(),area:b},Slot{label:"note-3".into(),area:a}];
        let y = reorder(&mut slots, "note-3", -2000).unwrap();
        assert_eq!(y, -1062);
        let order: Vec<_> = slots.iter().map(|s| s.label.as_str()).collect();
        assert_eq!(order, ["note-3", "note-1", "note-2"]);
        reorder(&mut slots,"note-3",2000);
        let order: Vec<_> = slots.iter().filter(|s| s.area.edge==0).map(|s|s.label.as_str()).collect();
        assert_eq!(order,["note-1","note-3"]);
    }
    #[test]
    fn layout_stays_inside_short_work_area() {
        let a=DockArea{edge:1920,top:0,bottom:200,scale:1.0};
        assert!(slot_y(&a, 7, 8) + 38 <= 200);
    }
}
