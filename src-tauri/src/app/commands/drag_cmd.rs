use std::path::PathBuf;
use base64::Engine;

fn drag_paths(content: &str, content_type: &str) -> Result<Vec<PathBuf>, String> {
    if !matches!(content_type, "image" | "file" | "video") { return Err("此条目不是文件或图片".into()); }
    if content_type == "image" && (content.starts_with("data:image/") || (!content.starts_with("file:") && !std::path::Path::new(content).is_absolute())) {
        let encoded = if content.starts_with("data:") {
            let (header, encoded) = content.split_once(',').ok_or("图片数据格式无效")?;
            if !header.ends_with(";base64") { return Err("图片不是 Base64 格式".into()); }
            encoded
        } else { content };
        let bytes = base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|error| error.to_string())?;
        let extension = match image::guess_format(&bytes).map_err(|error| error.to_string())? {
            image::ImageFormat::Png => "png", image::ImageFormat::Jpeg => "jpg",
            image::ImageFormat::Gif => "gif", image::ImageFormat::WebP => "webp",
            image::ImageFormat::Bmp => "bmp", _ => return Err("图片格式不支持拖出".into()),
        };
        // Keep the file available for receivers that read it after Drop returns.
        // Existing startup cleanup removes TieZ_Clip_* temporary files.
        let path = std::env::temp_dir().join(format!("TieZ_Clip_Drag_{}.{}", uuid::Uuid::new_v4(), extension));
        std::fs::write(&path, bytes).map_err(|error| error.to_string())?;
        return Ok(vec![path]);
    }
    let values: Vec<&str> = if content_type == "image" { vec![content.trim()] } else { content.lines().map(str::trim).filter(|line| !line.is_empty()).collect() };
    if values.is_empty() { return Err("没有可拖出的文件".into()); }
    values.into_iter().map(|value| {
        let path = if value.starts_with("file:") {
            reqwest::Url::parse(value).map_err(|error| error.to_string())?.to_file_path().map_err(|_| "文件地址无效".to_string())?
        } else { PathBuf::from(value) };
        if !path.is_absolute() || !path.exists() { return Err("拖出的文件不存在或路径无效".into()); }
        Ok(path)
    }).collect()
}

#[tauri::command]
pub async fn start_content_drag(window: tauri::WebviewWindow, content: String, content_type: String, item_ids: Vec<i64>) -> Result<(), String> {
    #[cfg(windows)]
    {
        let paths = drag_paths(&content, &content_type)?;
        let (sender, receiver) = tokio::sync::oneshot::channel();
        window.run_on_main_thread(move || {
            use std::sync::atomic::Ordering;
            let previous = crate::global_state::IGNORE_BLUR.swap(true, Ordering::SeqCst);
            let result = crate::infrastructure::windows_api::drag_source::drag_files(&paths, item_ids);
            crate::global_state::IGNORE_BLUR.store(previous, Ordering::SeqCst);
            let _ = sender.send(result);
        }).map_err(|error| error.to_string())?;
        receiver.await.map_err(|error| error.to_string())?
    }
    #[cfg(not(windows))]
    { let _ = (window, content, content_type, item_ids); Err("当前平台不支持原生文件拖出".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_paths_are_not_inferred_from_text() {
        assert!(drag_paths("C:\\test.txt", "text").is_err());
        assert!(drag_paths("", "file").is_err());
        assert!(drag_paths("not-a-file", "image").is_err());
    }

    #[test]
    fn images_and_multifile_entries_are_real_paths() {
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=";
        let image = drag_paths(&format!("data:image/png;base64,{png}"), "image").unwrap();
        assert_eq!(image.len(), 1);
        assert_eq!(image[0].extension().unwrap(), "png");
        assert!(std::fs::read(&image[0]).unwrap().starts_with(b"\x89PNG"));
        let second = std::env::temp_dir().join(format!("TieZ_Clip_Drag_{}_test #%.txt", uuid::Uuid::new_v4()));
        std::fs::write(&second, b"test").unwrap();
        let content = format!("{}\r\n{}", image[0].display(), second.display());
        assert_eq!(drag_paths(&content, "file").unwrap(), vec![image[0].clone(), second.clone()]);
        let uri = reqwest::Url::from_file_path(&second).unwrap();
        assert_eq!(drag_paths(uri.as_str(), "file").unwrap(), vec![second.clone()]);
        let raw = drag_paths(png, "image").unwrap();
        for path in image.into_iter().chain(raw).chain([second]) { std::fs::remove_file(path).unwrap(); }
    }
}
