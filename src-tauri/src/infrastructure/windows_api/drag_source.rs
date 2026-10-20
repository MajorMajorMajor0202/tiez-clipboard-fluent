use std::path::PathBuf;
use std::sync::Mutex;
use windows::{
    core::{implement, BOOL, HRESULT},
    Win32::{
        Foundation::{GlobalFree, DRAGDROP_S_CANCEL, DRAGDROP_S_DROP, DRAGDROP_S_USEDEFAULTCURSORS, S_OK},
        System::{
            Com::{IDataObject, DVASPECT_CONTENT, FORMATETC, STGMEDIUM, STGMEDIUM_0, TYMED_HGLOBAL},
            Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT},
            Ole::{DoDragDrop, IDropSource, IDropSource_Impl, OleInitialize, OleUninitialize, CF_HDROP, DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_NONE},
            SystemServices::MODIFIERKEYS_FLAGS,
        },
        UI::Shell::{SHCreateDataObject, DROPFILES},
    },
};

#[implement(IDropSource)]
struct FileDragSource;

impl IDropSource_Impl for FileDragSource_Impl {
    fn QueryContinueDrag(&self, escape: BOOL, keys: MODIFIERKEYS_FLAGS) -> HRESULT {
        if escape.as_bool() { DRAGDROP_S_CANCEL }
        else if keys.0 & 1 == 0 { DRAGDROP_S_DROP }
        else { S_OK }
    }

    fn GiveFeedback(&self, _: DROPEFFECT) -> HRESULT { DRAGDROP_S_USEDEFAULTCURSORS }
}

struct OleGuard;
impl Drop for OleGuard { fn drop(&mut self) { unsafe { OleUninitialize(); } } }

static ACTIVE_DRAG_ITEMS: Mutex<Option<Vec<i64>>> = Mutex::new(None);
pub fn active_drag_item_ids() -> Option<Vec<i64>> { ACTIVE_DRAG_ITEMS.lock().ok()?.clone() }
struct DragSession;
impl Drop for DragSession { fn drop(&mut self) { if let Ok(mut items) = ACTIVE_DRAG_ITEMS.lock() { *items = None; } } }

// Shell data objects expose actual files (including CF_HDROP) without a
// text/plain path fallback. No file contents are loaded into the WebView.
unsafe fn file_data_object(paths: &[PathBuf]) -> windows::core::Result<IDataObject> {
    use std::os::windows::ffi::OsStrExt;
    let data: IDataObject = SHCreateDataObject(None, None, None)?;
    let mut names: Vec<u16> = Vec::new();
    for path in paths {
        names.extend(path.as_os_str().encode_wide());
        names.push(0);
    }
    names.push(0);
    let header_size = std::mem::size_of::<DROPFILES>();
    let global = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, header_size + names.len() * 2)?;
    let memory = GlobalLock(global);
    if memory.is_null() {
        let error = windows::core::Error::from_win32();
        let _ = GlobalFree(Some(global));
        return Err(error);
    }
    std::ptr::write_unaligned(memory.cast::<DROPFILES>(), DROPFILES { pFiles: header_size as u32, fWide: BOOL(1), ..Default::default() });
    std::ptr::copy_nonoverlapping(names.as_ptr(), memory.cast::<u8>().add(header_size).cast::<u16>(), names.len());
    let _ = GlobalUnlock(global);
    let format = FORMATETC { cfFormat: CF_HDROP.0, dwAspect: DVASPECT_CONTENT.0, lindex: -1, tymed: TYMED_HGLOBAL.0 as u32, ..Default::default() };
    let medium = STGMEDIUM { tymed: TYMED_HGLOBAL.0 as u32, u: STGMEDIUM_0 { hGlobal: global }, ..Default::default() };
    if let Err(error) = data.SetData(&format, &medium, true) {
        let _ = GlobalFree(Some(global));
        return Err(error);
    }
    // IDataObject now owns the allocation and releases it with the COM object.
    Ok(data)
}

pub fn drag_files(paths: &[PathBuf], item_ids: Vec<i64>) -> Result<(), String> {
    *ACTIVE_DRAG_ITEMS.lock().map_err(|error| error.to_string())? = Some(item_ids);
    let _session = DragSession;
    unsafe {
        OleInitialize(None).map_err(|error| error.to_string())?;
        let _ole = OleGuard;
        let data = file_data_object(paths).map_err(|error| error.to_string())?;
        let source: IDropSource = FileDragSource.into();
        let mut effect = DROPEFFECT_NONE;
        let result = DoDragDrop(&data, &source, DROPEFFECT_COPY, &mut effect);
        if result == DRAGDROP_S_CANCEL || result == DRAGDROP_S_DROP { Ok(()) }
        else { result.ok().map_err(|error| error.to_string()) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::{System::Ole::ReleaseStgMedium, UI::Shell::{DragQueryFileW, HDROP}};

    #[test]
    fn shell_drag_exposes_files_from_different_folders() {
        let root = std::env::temp_dir().join(format!("TieZ_Clip_DragTest_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("子目录")).unwrap();
        let paths = [root.join("image #1.png"), root.join("子目录/test.txt")];
        for path in &paths { std::fs::write(path, b"fixture").unwrap(); }
        unsafe {
            OleInitialize(None).unwrap();
            let _ole = OleGuard;
            let data = file_data_object(&paths).unwrap();
            let format = FORMATETC { cfFormat: CF_HDROP.0, dwAspect: DVASPECT_CONTENT.0, lindex: -1, tymed: TYMED_HGLOBAL.0 as u32, ..Default::default() };
            assert_eq!(data.QueryGetData(&format), S_OK);
            let text = FORMATETC { cfFormat: 13, ..format.clone() };
            assert_ne!(data.QueryGetData(&text), S_OK, "S_FALSE is not an available format");
            assert!(data.GetData(&text).is_err(), "file drops do not provide plain path text");
            let mut medium = data.GetData(&format).unwrap();
            let drop = HDROP(medium.u.hGlobal.0);
            assert_eq!(DragQueryFileW(drop, u32::MAX, None), paths.len() as u32);
            for (index, path) in paths.iter().enumerate() {
                let size = DragQueryFileW(drop, index as u32, None) as usize;
                let mut name = vec![0u16; size + 1];
                DragQueryFileW(drop, index as u32, Some(&mut name));
                assert_eq!(String::from_utf16(&name[..size]).unwrap(), path.to_string_lossy());
            }
            ReleaseStgMedium(&mut medium);
        }
        for path in &paths { std::fs::remove_file(path).unwrap(); }
        std::fs::remove_dir(root.join("子目录")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}
