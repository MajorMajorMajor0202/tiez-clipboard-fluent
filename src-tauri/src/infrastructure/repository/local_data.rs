use super::settings_repo::SqliteSettingsRepository;
use rusqlite::{params, Connection};
use std::collections::HashMap;

pub type WorkspaceAssignments = HashMap<String, Vec<i64>>;

#[cfg(test)]
mod tests {
    use super::super::clipboard_repo::{ClipboardRepository, SqliteClipboardRepository};
    use super::super::tag_repo::{SqliteTagRepository, TagRepository};
    use super::*;
    use std::sync::{Arc, Mutex};

    fn setup() -> (Arc<Mutex<Connection>>, SqliteClipboardRepository) {
        let conn = Connection::open_in_memory().unwrap();
        super::super::migrations::run_migrations(&conn).unwrap();
        let conn = Arc::new(Mutex::new(conn));
        let repo = SqliteClipboardRepository::new(conn.clone());
        (conn, repo)
    }
    fn setting(conn: &Connection, key: &str, value: &str) {
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)",
            params![key, value],
        )
        .unwrap();
    }
    fn item(conn: &Connection, id: i64, kind: &str, tags: &[&str]) {
        conn.execute("INSERT INTO clipboard_history(id,content_type,content,source_app,timestamp,preview,tags) VALUES (?,?,?,'test',?,'preview',?)",
            params![id,kind,format!("item {id}"),id,serde_json::to_string(tags).unwrap()]).unwrap();
        for tag in tags {
            conn.execute(
                "INSERT INTO entry_tags(entry_id,tag) VALUES (?,?)",
                params![id, tag],
            )
            .unwrap();
        }
    }
    #[test]
    fn cleanup_preserves_notes_and_workspace_materials() {
        let (conn, repo) = setup();
        {
            let db = conn.lock().unwrap();
            item(&db, 1, "note", &[]);
            item(&db, 2, "text", &[]);
            item(&db, 3, "text", &[]);
            item(&db, 4, "text", &[]);
            setting(&db, "app.tab_assignments", r#"{"work":[2]}"#);
            setting(&db, "app.persistent_limit", "1");
            assert_eq!(repo.enforce_limit_with_conn(&db, None).unwrap(), vec![3]);
        }
        repo.clear(None).unwrap();
        assert!(repo.get_entry_by_id(1).unwrap().is_some());
        assert!(repo.get_entry_by_id(2).unwrap().is_some());
        assert!(repo.get_entry_by_id(4).unwrap().is_none());
        repo.delete(2, None).unwrap();
        assert!(workspace_assignments(&conn.lock().unwrap()).unwrap()["work"].is_empty());
    }
    #[test]
    fn locked_entries_block_direct_and_tag_batch_deletion() {
        let (conn, repo) = setup();
        {
            let db = conn.lock().unwrap();
            item(&db, 1, "text", &["project"]);
            item(&db, 2, "text", &["project", "locked"]);
        }
        assert!(repo.delete(2, None).is_err());
        let tags = SqliteTagRepository::new(conn.clone());
        assert!(tags.delete_globally("project", None).is_err());
        assert_eq!(repo.get_count().unwrap(), 2);
        tags.update_entry_tags(2, vec!["project".into()]).unwrap();
        tags.delete_globally("project", None).unwrap();
        assert_eq!(repo.get_count().unwrap(), 0);
    }
    #[test]
    fn workspace_pages_and_search_are_independent_of_global_history_page() {
        let (conn, repo) = setup();
        {
            let db = conn.lock().unwrap();
            for id in 1..=300 {
                item(&db, id, "text", &[]);
            }
        }
        let members: Vec<_> = (1..=120).collect();
        let page = repo
            .get_workspace_history(&members, 20, 80, "", false, None)
            .unwrap();
        assert_eq!(page.first().unwrap().id, 81);
        assert_eq!(page.last().unwrap().id, 100);
        let found = repo
            .get_workspace_history(&members, 20, 0, "item 1", false, None)
            .unwrap();
        assert_eq!(found.first().unwrap().id, 1);
        assert!(repo
            .get_workspace_history(&members, 20, 0, "item 299", false, None)
            .unwrap()
            .is_empty());
    }
    #[test]
    fn notes_do_not_consume_clipboard_page_slots() {
        let (conn, repo) = setup();
        {
            let db = conn.lock().unwrap();
            for id in 1..=90 {
                item(&db, id, if id > 5 { "note" } else { "text" }, &[]);
            }
        }
        assert_eq!(
            repo.get_history_without_notes(3, 0, None)
                .unwrap()
                .iter()
                .map(|e| e.id)
                .collect::<Vec<_>>(),
            vec![5, 4, 3]
        );
        assert_eq!(repo.get_history_without_notes(3, 3, None).unwrap().len(), 2);
    }
    #[test]
    fn legacy_migration_preserves_tags_and_runs_once() {
        let (conn, _) = setup();
        let db = conn.lock().unwrap();
        item(&db, 1, "text", &["Work"]);
        setting(&db, "app.custom_tabs", r#"[{"id":"work","name":"Work"}]"#);
        migrate_workspace_tags(&db).unwrap();
        assert_eq!(workspace_assignments(&db).unwrap()["work"], vec![1]);
        let tags: String = db
            .query_row("SELECT tags FROM clipboard_history WHERE id=1", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(tags, r#"["Work"]"#);
        item(&db, 2, "text", &["Work"]);
        migrate_workspace_tags(&db).unwrap();
        assert_eq!(workspace_assignments(&db).unwrap()["work"], vec![1]);
    }
    #[test]
    fn temporary_members_are_persisted_once_and_invalid_save_rolls_back() {
        let (conn, repo) = setup();
        item(&conn.lock().unwrap(), 1, "text", &[]);
        let mut entry = repo.get_entry_by_id(1).unwrap().unwrap();
        entry.id = -1;
        entry.content = "temporary".into();
        let db = conn.lock().unwrap();
        let (saved, promoted) = persist_workspace_assignments(
            &db,
            &repo,
            r#"{"work":[-1,-1]}"#,
            &[entry],
            std::path::Path::new("."),
        )
        .unwrap();
        assert_eq!(promoted.len(), 1);
        assert_eq!(saved["work"].len(), 1);
        assert!(saved["work"][0] > 0);
        let (again, _) = persist_workspace_assignments(
            &db,
            &repo,
            r#"{"work":[-1]}"#,
            &[],
            std::path::Path::new("."),
        )
        .unwrap();
        assert_eq!(again, saved);
        assert!(persist_workspace_assignments(
            &db,
            &repo,
            r#"{"work":[-99]}"#,
            &[],
            std::path::Path::new(".")
        )
        .is_err());
        assert_eq!(workspace_assignments(&db).unwrap(), saved);
    }
    #[test]
    fn malformed_retention_blocks_cleanup() {
        let (conn, repo) = setup();
        {
            let db = conn.lock().unwrap();
            item(&db, 1, "text", &[]);
            setting(&db, "app.tab_assignments", "broken");
        }
        assert!(repo.clear(None).is_err());
        assert!(repo.delete(1, None).is_err());
        assert_eq!(repo.get_count().unwrap(), 1);
    }
    #[test]
    fn shared_attachment_survives_until_last_reference_is_deleted() {
        let (conn, repo) = setup();
        let dir = std::env::temp_dir().join(format!("tiez-data-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(dir.join("attachments")).unwrap();
        let file = dir.join("attachments/shared.txt");
        std::fs::write(&file, "shared").unwrap();
        {
            let db = conn.lock().unwrap();
            for id in 1..=2 {
                item(&db, id, "text", &[]);
                db.execute(
                    "UPDATE clipboard_history SET content=?,is_external=1 WHERE id=?",
                    params![file.to_string_lossy(), id],
                )
                .unwrap();
            }
        }
        repo.delete(1, Some(&dir)).unwrap();
        assert!(file.exists());
        repo.delete(2, Some(&dir)).unwrap();
        assert!(!file.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}

pub fn workspace_assignments(conn: &Connection) -> Result<WorkspaceAssignments, String> {
    let raw = SqliteSettingsRepository::get_raw(conn, "app.tab_assignments")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "{}".into());
    serde_json::from_str(&raw).map_err(|e| format!("Invalid workspace assignments: {e}"))
}

pub fn retained_ids_json(conn: &Connection) -> Result<String, String> {
    let ids: Vec<i64> = workspace_assignments(conn)?
        .into_values()
        .flatten()
        .collect();
    serde_json::to_string(&ids).map_err(|e| e.to_string())
}

pub fn is_locked(tags: &[String]) -> bool {
    tags.iter()
        .any(|tag| tag.trim().eq_ignore_ascii_case("locked") || tag.trim() == "已锁定")
}

/// One database transaction, all rows (not just the loaded UI page), once only.
/// Preserve source tags: a migration must not destroy a user's categorization.
pub fn migrate_workspace_tags(conn: &Connection) -> Result<(), String> {
    if SqliteSettingsRepository::get_raw(conn, "app.workspace_tag_migration_version")
        .map_err(|e| e.to_string())?
        .as_deref()
        == Some("1")
    {
        return Ok(());
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut assignments = workspace_assignments(&tx)?;
    let tabs: Vec<serde_json::Value> = serde_json::from_str(
        &SqliteSettingsRepository::get_raw(&tx, "app.custom_tabs")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "[]".into()),
    )
    .map_err(|e| e.to_string())?;
    for tab in tabs {
        let (Some(id), Some(name)) = (tab["id"].as_str(), tab["name"].as_str()) else {
            continue;
        };
        if id == "clipboard" || tab["isBuiltin"].as_bool() == Some(true) {
            continue;
        }
        let mut stmt = tx
            .prepare("SELECT id, tags FROM clipboard_history ORDER BY timestamp DESC, id DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let members = assignments.entry(id.to_string()).or_default();
        for row in rows {
            let (entry_id, raw) = row.map_err(|e| e.to_string())?;
            let tags: Vec<String> = serde_json::from_str(&raw).unwrap_or_default();
            if tags.iter().any(|tag| tag == name) && !members.contains(&entry_id) {
                members.push(entry_id);
            }
        }
    }
    tx.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app.tab_assignments', ?)",
        [serde_json::to_string(&assignments).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('app.workspace_tag_migration_version', '1')", [])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

pub fn remove_workspace_reference(conn: &Connection, id: i64) -> Result<(), String> {
    let mut assignments = workspace_assignments(conn)?;
    if !assignments.values().any(|members| members.contains(&id)) {
        return Ok(());
    }
    for members in assignments.values_mut() {
        members.retain(|member| *member != id);
    }
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app.tab_assignments', ?)",
        params![serde_json::to_string(&assignments).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn persist_workspace_assignments(
    conn: &Connection,
    repo: &super::clipboard_repo::SqliteClipboardRepository,
    raw: &str,
    session: &[crate::domain::models::ClipboardEntry],
    data_dir: &std::path::Path,
) -> Result<
    (
        WorkspaceAssignments,
        Vec<(i64, crate::domain::models::ClipboardEntry)>,
    ),
    String,
> {
    let mut assignments: WorkspaceAssignments =
        serde_json::from_str(raw).map_err(|e| format!("Invalid workspace assignments: {e}"))?;
    let mut promoted = Vec::new();
    let mut mapping: HashMap<i64, i64> = serde_json::from_str(
        &SqliteSettingsRepository::get_raw(conn, "app.workspace_session_id_map")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "{}".into()),
    )
    .map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for members in assignments.values_mut() {
        for id in members.iter_mut() {
            if *id >= 0 {
                continue;
            }
            if let Some(persistent) = mapping.get(id) {
                *id = *persistent;
                continue;
            }
            let old_id = *id;
            let mut entry = session
                .iter()
                .find(|entry| entry.id == old_id)
                .cloned()
                .ok_or_else(|| format!("Temporary item {old_id} is no longer available"))?;
            entry.id = 0;
            entry.id = repo.save_with_conn(&tx, &entry, Some(data_dir))?;
            mapping.insert(old_id, entry.id);
            *id = entry.id;
            promoted.push((old_id, entry));
        }
        let mut seen = std::collections::HashSet::new();
        members.retain(|id| seen.insert(*id));
    }
    tx.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app.tab_assignments', ?)",
        [serde_json::to_string(&assignments).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app.workspace_session_id_map', ?)",
        [serde_json::to_string(&mapping).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok((assignments, promoted))
}
