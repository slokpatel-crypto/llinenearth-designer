use chrono::{Local, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::Mutex;
const SEED_INVENTORY: &str = include_str!("../resources/seed-inventory.json");

use std::{
  collections::{HashMap, HashSet},
  fs::{self, OpenOptions},
  io::{BufRead, BufReader, Write},
  path::{Path, PathBuf},
};

struct SyncLock(Mutex<()>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLockStatus {
  configured: bool,
  credential_store: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventRecord {
  id: String,
  session_id: String,
  #[serde(rename = "type")]
  event_type: String,
  at: String,
  #[serde(default)]
  source: String,
  #[serde(default)]
  payload: Value,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct CustomerMeta {
  name: String,
  phone: String,
  note: String,
  lead_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionRecord {
  session_id: String,
  first_at: String,
  last_at: String,
  answers: HashMap<String, String>,
  selected_look: Option<Value>,
  sale: Option<Value>,
  customer: CustomerMeta,
  events: Vec<EventRecord>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct Totals {
  sessions: usize,
  renders: usize,
  whatsapp: usize,
  visits: usize,
  sales: usize,
  revenue: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardSummary {
  vault_path: String,
  totals: Totals,
  counts: HashMap<String, usize>,
  sessions: Vec<SessionRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncResult {
  configured: bool,
  imported: usize,
  next_cursor: Option<String>,
  message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SyncState {
  cursor: Option<String>,
  last_synced_at: Option<String>,
  last_pushed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SyncConfig {
  url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncPairingStatus {
  configured: bool,
  url: String,
  credential_store: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncFeed {
  #[serde(default)]
  events: Vec<EventRecord>,
  next_cursor: Option<String>,
  #[serde(default)]
  has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FabricRecord {
  id: String,
  family: String,
  line: String,
  color_name: String,
  hex: String,
  swatch_image_url: String,
  #[serde(default)]
  suitable_for: Vec<String>,
  pattern: String,
  composition_note: Option<String>,
  source_document: String,
  source_page: u32,
  in_stock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InventoryFeed {
  generated_at: String,
  #[serde(default)]
  fabrics: Vec<FabricRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct InventoryOverride {
  status: String,
  quantity_meters: Option<f64>,
  note: String,
  updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FabricInventoryItem {
  id: String,
  family: String,
  line: String,
  color_name: String,
  hex: String,
  swatch_image_url: String,
  suitable_for: Vec<String>,
  pattern: String,
  composition_note: Option<String>,
  source_document: String,
  source_page: u32,
  source_in_stock: bool,
  status: String,
  quantity_meters: Option<f64>,
  note: String,
  updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InventoryView {
  generated_at: Option<String>,
  cached_at: Option<String>,
  fabrics: Vec<FabricInventoryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct BrainActionState {
  status: String,
  note: String,
  updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemHealth {
  vault_path: String,
  event_files: usize,
  event_records: usize,
  event_bytes: u64,
  invalid_event_lines: usize,
  backup_count: usize,
  backup_bytes: u64,
  latest_backup: Option<String>,
  latest_backup_at: Option<String>,
  latest_backup_verified: bool,
  auto_backup_today: bool,
  visual_count: usize,
  visual_bytes: u64,
  marketing_briefs: usize,
  job_cards: usize,
  brain_actions: usize,
  inventory_count: usize,
  unverified_inventory: usize,
  inventory_overrides: usize,
  sync_configured: bool,
  sync_cursor: Option<String>,
  last_synced_at: Option<String>,
  last_pushed_at: Option<String>,
  issues: Vec<String>,
}

fn vault_root() -> PathBuf {
  if let Ok(custom) = std::env::var("LLINEN_EARTH_DATA_DIR") {
    let path = PathBuf::from(custom);
    if !path.as_os_str().is_empty() {
      return path;
    }
  }

  let home = std::env::var("USERPROFILE")
    .or_else(|_| std::env::var("HOME"))
    .unwrap_or_else(|_| ".".to_string());

  PathBuf::from(home)
    .join("Documents")
    .join("LLinenEarthData")
}

fn ensure_vault() -> Result<PathBuf, String> {
  let root = vault_root();
  fs::create_dir_all(root.join("events")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("backups")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("visuals")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("imports")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("sync")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("inventory")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("brain")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("marketing")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("job-cards")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("exports")).map_err(|e| e.to_string())?;
  Ok(root)
}

fn event_files(events_dir: &Path) -> Result<Vec<PathBuf>, String> {
  let mut files = fs::read_dir(events_dir)
    .map_err(|e| e.to_string())?
    .filter_map(|entry| entry.ok().map(|e| e.path()))
    .filter(|path| path.extension().and_then(|v| v.to_str()) == Some("ndjson"))
    .collect::<Vec<_>>();
  files.sort();
  Ok(files)
}

fn load_events() -> Result<Vec<EventRecord>, String> {
  let root = ensure_vault()?;
  let mut events = Vec::new();

  for path in event_files(&root.join("events"))? {
    let file = match fs::File::open(path) {
      Ok(file) => file,
      Err(_) => continue,
    };
    for line in BufReader::new(file).lines().map_while(Result::ok) {
      if line.trim().is_empty() {
        continue;
      }
      if let Ok(event) = serde_json::from_str::<EventRecord>(&line) {
        events.push(event);
      }
    }
  }

  events.sort_by(|a, b| a.at.cmp(&b.at));
  Ok(events)
}

fn number_from_payload(payload: &Value, key: &str) -> Option<f64> {
  payload
    .get(key)
    .and_then(|value| value.as_f64().or_else(|| value.as_str()?.parse::<f64>().ok()))
}

fn string_from_payload(payload: &Value, key: &str) -> Option<String> {
  payload
    .get(key)
    .and_then(Value::as_str)
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToOwned::to_owned)
}

fn aggregate(events: Vec<EventRecord>) -> DashboardSummary {
  let root = vault_root();
  let mut counts = HashMap::<String, usize>::new();
  let mut sessions = HashMap::<String, SessionRecord>::new();
  let mut totals = Totals::default();

  for event in events {
    *counts.entry(event.event_type.clone()).or_insert(0) += 1;

    let session = sessions.entry(event.session_id.clone()).or_insert_with(|| SessionRecord {
      session_id: event.session_id.clone(),
      first_at: event.at.clone(),
      last_at: event.at.clone(),
      answers: HashMap::new(),
      selected_look: None,
      sale: None,
      customer: CustomerMeta::default(),
      events: Vec::new(),
    });

    if event.at < session.first_at {
      session.first_at = event.at.clone();
    }
    if event.at > session.last_at {
      session.last_at = event.at.clone();
    }

    if event.event_type == "answer_selected" {
      if let (Some(step), Some(value)) = (
        event.payload.get("step").and_then(Value::as_str),
        event.payload.get("value").and_then(Value::as_str),
      ) {
        session.answers.insert(step.to_string(), value.to_string());
      }
    }

    if event.event_type == "look_selected" {
      session.selected_look = Some(event.payload.clone());
    }

    if event.event_type == "customer_updated" {
      if let Some(value) = string_from_payload(&event.payload, "name") {
        session.customer.name = value;
      }
      if let Some(value) = string_from_payload(&event.payload, "phone") {
        session.customer.phone = value;
      }
      if let Some(value) = string_from_payload(&event.payload, "note") {
        session.customer.note = value;
      }
    }

    if event.event_type == "lead_status_changed" {
      if let Some(value) = string_from_payload(&event.payload, "status") {
        session.customer.lead_status = value;
      }
    }

    if event.event_type == "sale_logged" {
      totals.revenue += number_from_payload(&event.payload, "amount").unwrap_or(0.0);
      session.sale = Some(event.payload.clone());
      if session.customer.lead_status.is_empty() {
        session.customer.lead_status = "won".to_string();
      }
    }

    session.events.push(event);
  }

  let mut session_list = sessions.into_values().collect::<Vec<_>>();
  session_list.sort_by(|a, b| b.last_at.cmp(&a.last_at));

  totals.sessions = session_list.len();
  totals.renders = *counts.get("render_completed").unwrap_or(&0);
  totals.whatsapp = *counts.get("whatsapp_clicked").unwrap_or(&0);
  totals.visits = *counts.get("visit_logged").unwrap_or(&0);
  totals.sales = *counts.get("sale_logged").unwrap_or(&0);

  DashboardSummary {
    vault_path: root.to_string_lossy().to_string(),
    totals,
    counts,
    sessions: session_list,
  }
}

fn append_event(event: &EventRecord) -> Result<(), String> {
  let root = ensure_vault()?;
  let day = event.at.get(0..10).unwrap_or("unknown");
  let file_path = root.join("events").join(format!("{day}.ndjson"));
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(file_path)
    .map_err(|e| e.to_string())?;
  let line = serde_json::to_string(event).map_err(|e| e.to_string())?;
  writeln!(file, "{line}").map_err(|e| e.to_string())
}

fn load_sync_state() -> Result<SyncState, String> {
  let root = ensure_vault()?;
  let path = root.join("sync").join("state.json");
  if !path.exists() {
    return Ok(SyncState::default());
  }
  let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
  serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_sync_state(state: &SyncState) -> Result<(), String> {
  let root = ensure_vault()?;
  let path = root.join("sync").join("state.json");
  fs::write(
    path,
    serde_json::to_string_pretty(state).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())
}

const DEFAULT_SYNC_URL: &str = "https://llinenearth-designer.vercel.app/api/operator/sync";
const SYNC_KEYRING_SERVICE: &str = "LLinen Earth OS";
const SYNC_KEYRING_USER: &str = "cloud-sync-token";
const LOCK_KEYRING_USER: &str = "desktop-lock-password";

fn sync_config_path() -> Result<PathBuf, String> {
  Ok(ensure_vault()?.join("sync").join("config.json"))
}

fn load_sync_config() -> Result<SyncConfig, String> {
  let path = sync_config_path()?;
  if !path.exists() {
    return Ok(SyncConfig { url: DEFAULT_SYNC_URL.to_string() });
  }
  let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
  let mut config = serde_json::from_str::<SyncConfig>(&content).map_err(|e| e.to_string())?;
  if config.url.trim().is_empty() {
    config.url = DEFAULT_SYNC_URL.to_string();
  }
  Ok(config)
}

fn save_sync_config(config: &SyncConfig) -> Result<(), String> {
  let path = sync_config_path()?;
  fs::write(
    path,
    serde_json::to_string_pretty(config).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())
}

fn sync_entry() -> Result<keyring::Entry, String> {
  keyring::Entry::new(SYNC_KEYRING_SERVICE, SYNC_KEYRING_USER).map_err(|e| e.to_string())
}

fn lock_entry() -> Result<keyring::Entry, String> {
  keyring::Entry::new(SYNC_KEYRING_SERVICE, LOCK_KEYRING_USER).map_err(|e| e.to_string())
}

fn stored_lock_password() -> Option<String> {
  lock_entry().ok()?.get_password().ok().filter(|value| !value.is_empty())
}

fn csv_cell(value: &str) -> String {
  let escaped = value.replace('"', "\"\"");
  format!("\"{escaped}\"")
}

fn html_escape(value: &str) -> String {
  value
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
    .replace('\'', "&#39;")
}

fn safe_filename(value: &str) -> String {
  value
    .chars()
    .map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { '-' })
    .collect::<String>()
    .split('-')
    .filter(|part| !part.is_empty())
    .take(8)
    .collect::<Vec<_>>()
    .join("-")
}

fn constant_time_text_equal(left: &str, right: &str) -> bool {
  let a = left.as_bytes();
  let b = right.as_bytes();
  if a.len() != b.len() {
    return false;
  }
  let mut diff = 0u8;
  for (x, y) in a.iter().zip(b.iter()) {
    diff |= x ^ y;
  }
  diff == 0
}

fn validate_lock_password(value: &str) -> Result<(), String> {
  let length = value.chars().count();
  if length < 6 {
    return Err("Desktop lock password must be at least 6 characters.".to_string());
  }
  if length > 128 {
    return Err("Desktop lock password is too long.".to_string());
  }
  Ok(())
}

fn load_sync_token() -> Option<String> {
  if let Ok(value) = std::env::var("LLINEN_OPERATOR_SYNC_TOKEN") {
    if !value.trim().is_empty() {
      return Some(value);
    }
  }
  sync_entry().ok()?.get_password().ok().filter(|value| !value.trim().is_empty())
}

fn current_sync_url() -> Result<String, String> {
  if let Ok(value) = std::env::var("LLINEN_EARTH_SYNC_URL") {
    if !value.trim().is_empty() {
      return Ok(value);
    }
  }
  Ok(load_sync_config()?.url)
}

fn validate_sync_url(value: &str) -> Result<String, String> {
  let parsed = reqwest::Url::parse(value.trim()).map_err(|_| "Sync URL is invalid.".to_string())?;
  let host = parsed.host_str().unwrap_or("");
  let local = host == "127.0.0.1" || host == "localhost";
  if parsed.scheme() != "https" && !(local && parsed.scheme() == "http") {
    return Err("Cloud sync requires HTTPS, except localhost development.".to_string());
  }
  Ok(parsed.to_string())
}

fn append_operator_event(session_id: String, event_type: &str, payload: Value) -> Result<(), String> {
  append_event(&EventRecord {
    id: format!("EV-{}", Utc::now().timestamp_micros()),
    session_id,
    event_type: event_type.to_string(),
    at: Utc::now().to_rfc3339(),
    source: "operator-desktop".to_string(),
    payload,
  })
}

fn inventory_feed_path() -> Result<PathBuf, String> {
  Ok(ensure_vault()?.join("inventory").join("current.json"))
}

fn inventory_cache_meta_path() -> Result<PathBuf, String> {
  Ok(ensure_vault()?.join("inventory").join("cache-meta.json"))
}

fn inventory_overrides_path() -> Result<PathBuf, String> {
  Ok(ensure_vault()?.join("inventory").join("overrides.json"))
}

fn load_inventory_overrides() -> Result<HashMap<String, InventoryOverride>, String> {
  let path = inventory_overrides_path()?;
  if !path.exists() {
    return Ok(HashMap::new());
  }
  let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
  serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_inventory_overrides(overrides: &HashMap<String, InventoryOverride>) -> Result<(), String> {
  let path = inventory_overrides_path()?;
  fs::write(
    path,
    serde_json::to_string_pretty(overrides).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())
}

fn brain_actions_path() -> Result<PathBuf, String> {
  Ok(ensure_vault()?.join("brain").join("actions.json"))
}

fn load_brain_actions() -> Result<HashMap<String, BrainActionState>, String> {
  let path = brain_actions_path()?;
  if !path.exists() {
    return Ok(HashMap::new());
  }
  let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
  serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_brain_actions(actions: &HashMap<String, BrainActionState>) -> Result<(), String> {
  let path = brain_actions_path()?;
  fs::write(
    path,
    serde_json::to_string_pretty(actions).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())
}

fn build_backup_payload() -> Result<Value, String> {
  let events = load_events()?;
  let summary = aggregate(events.clone());
  let inventory = get_fabric_inventory().ok();
  let brain_actions = load_brain_actions().ok();
  let sync_state = load_sync_state().ok();

  Ok(json!({
    "backupVersion": 2,
    "createdAt": Utc::now().to_rfc3339(),
    "events": events,
    "summary": summary,
    "inventory": inventory,
    "brainActions": brain_actions,
    "syncState": sync_state,
  }))
}

fn write_backup_file(prefix: &str) -> Result<PathBuf, String> {
  let root = ensure_vault()?;
  let stamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let path = root.join("backups").join(format!("{prefix}{stamp}.json"));
  let payload = build_backup_payload()?;
  fs::write(
    &path,
    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?,
  ).map_err(|e| e.to_string())?;
  verify_backup_file(&path)?;
  Ok(path)
}

fn verify_backup_file(path: &Path) -> Result<(), String> {
  let content = fs::read_to_string(path).map_err(|e| format!("Backup could not be read: {e}"))?;
  let value = serde_json::from_str::<Value>(&content).map_err(|e| format!("Backup JSON is invalid: {e}"))?;

  if value.get("backupVersion").and_then(Value::as_i64) != Some(2) {
    return Err("Backup version is missing or unsupported.".to_string());
  }

  let created_at = value.get("createdAt").and_then(Value::as_str)
    .ok_or_else(|| "Backup is missing createdAt.".to_string())?;
  chrono::DateTime::parse_from_rfc3339(created_at)
    .map_err(|_| "Backup createdAt timestamp is invalid.".to_string())?;

  let events = value.get("events").and_then(Value::as_array)
    .ok_or_else(|| "Backup is missing the event ledger.".to_string())?;
  for (index, event) in events.iter().enumerate() {
    serde_json::from_value::<EventRecord>(event.clone())
      .map_err(|e| format!("Backup event {} is invalid: {e}", index + 1))?;
  }

  if !value.get("summary").is_some_and(Value::is_object) {
    return Err("Backup is missing the dashboard summary.".to_string());
  }
  if !value.get("inventory").is_some_and(Value::is_object) {
    return Err("Backup is missing the inventory snapshot.".to_string());
  }
  if !value.get("brainActions").is_some_and(Value::is_object) {
    return Err("Backup is missing AI Brain action memory.".to_string());
  }
  if !value.get("syncState").is_some_and(Value::is_object) {
    return Err("Backup is missing cloud sync state.".to_string());
  }

  Ok(())
}

fn prune_auto_backups(limit: usize) -> Result<(), String> {
  let dir = ensure_vault()?.join("backups");
  let mut files = fs::read_dir(&dir)
    .map_err(|e| e.to_string())?
    .filter_map(|entry| entry.ok().map(|item| item.path()))
    .filter(|path| {
      path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| name.starts_with("llinen-earth-auto-") && name.ends_with(".json"))
    })
    .collect::<Vec<_>>();
  files.sort();
  if files.len() <= limit {
    return Ok(());
  }
  let remove_count = files.len() - limit;
  for path in files.into_iter().take(remove_count) {
    let _ = fs::remove_file(path);
  }
  Ok(())
}

fn auto_backup_exists_today() -> Result<bool, String> {
  let dir = ensure_vault()?.join("backups");
  let prefix = format!("llinen-earth-auto-{}", Local::now().format("%Y-%m-%d"));
  Ok(fs::read_dir(dir)
    .map_err(|e| e.to_string())?
    .filter_map(Result::ok)
    .any(|entry| entry.file_name().to_string_lossy().starts_with(&prefix)))
}

fn directory_stats(path: &Path) -> (usize, u64, Option<String>) {
  let mut count = 0usize;
  let mut bytes = 0u64;
  let mut latest: Option<(std::time::SystemTime, String)> = None;

  let Ok(entries) = fs::read_dir(path) else {
    return (0, 0, None);
  };

  for entry in entries.flatten() {
    let entry_path = entry.path();
    let Ok(meta) = entry.metadata() else { continue; };
    if !meta.is_file() { continue; }
    count += 1;
    bytes = bytes.saturating_add(meta.len());
    if let Ok(modified) = meta.modified() {
      let name = entry_path.file_name().and_then(|value| value.to_str()).unwrap_or("file").to_string();
      if latest.as_ref().is_none_or(|(time, _)| modified > *time) {
        latest = Some((modified, name));
      }
    }
  }

  (count, bytes, latest.map(|(_, name)| name))
}

fn latest_file_modified_at(path: &Path) -> Option<String> {
  let entries = fs::read_dir(path).ok()?;
  let latest = entries
    .flatten()
    .filter_map(|entry| {
      let meta = entry.metadata().ok()?;
      if !meta.is_file() { return None; }
      Some(meta.modified().ok()?)
    })
    .max()?;
  Some(chrono::DateTime::<Utc>::from(latest).to_rfc3339())
}

fn invalid_event_line_count(paths: &[PathBuf]) -> usize {
  let mut invalid = 0usize;
  for path in paths {
    let Ok(file) = fs::File::open(path) else {
      invalid += 1;
      continue;
    };
    for line in BufReader::new(file).lines().map_while(Result::ok) {
      if line.trim().is_empty() { continue; }
      if serde_json::from_str::<EventRecord>(&line).is_err() {
        invalid += 1;
      }
    }
  }
  invalid
}

fn build_system_health() -> Result<SystemHealth, String> {
  let root = ensure_vault()?;
  let events = load_events()?;
  let event_files = event_files(&root.join("events"))?;
  let event_bytes = event_files.iter()
    .filter_map(|path| fs::metadata(path).ok().map(|meta| meta.len()))
    .sum::<u64>();
  let invalid_event_lines = invalid_event_line_count(&event_files);

  let (backup_count, backup_bytes, latest_backup) = directory_stats(&root.join("backups"));
  let latest_backup_verified = latest_backup
    .as_ref()
    .is_some_and(|name| verify_backup_file(&root.join("backups").join(name)).is_ok());
  let auto_backup_today = auto_backup_exists_today().unwrap_or(false);
  let latest_backup_at = latest_file_modified_at(&root.join("backups"));
  let (visual_count, visual_bytes, _) = directory_stats(&root.join("visuals"));
  let (marketing_briefs, _, _) = directory_stats(&root.join("marketing"));
  let (job_cards, _, _) = directory_stats(&root.join("job-cards"));

  let inventory = get_fabric_inventory()?;
  let overrides = load_inventory_overrides()?;
  let brain_actions = load_brain_actions()?;
  let sync_state = load_sync_state().unwrap_or_default();
  let sync_configured = load_sync_token().is_some();

  let mut issues = Vec::<String>::new();
  if backup_count == 0 {
    issues.push("No local backup has been created yet.".to_string());
  } else if !latest_backup_verified {
    issues.push("The newest local backup failed verification.".to_string());
  }
  if !auto_backup_today {
    issues.push("Today's automatic backup has not been created yet.".to_string());
  } else if let Some(latest) = latest_backup_at.as_deref() {
    if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(latest) {
      if Utc::now().signed_duration_since(parsed.with_timezone(&Utc)).num_days() >= 7 {
        issues.push("The latest local backup is more than 7 days old.".to_string());
      }
    }
  }
  if invalid_event_lines > 0 {
    issues.push(format!("{invalid_event_lines} malformed local event record(s) were detected."));
  }
  if inventory.fabrics.iter().any(|fabric| fabric.status == "unverified") {
    issues.push(format!(
      "{} fabric entries are still unverified.",
      inventory.fabrics.iter().filter(|fabric| fabric.status == "unverified").count()
    ));
  }
  if !sync_configured {
    issues.push("Cloud sync is not paired on this PC.".to_string());
  } else if let Some(last_sync) = sync_state.last_synced_at.as_deref() {
    if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(last_sync) {
      if Utc::now().signed_duration_since(parsed.with_timezone(&Utc)).num_hours() >= 24 {
        issues.push("Cloud sync has not completed successfully in the last 24 hours.".to_string());
      }
    }
  } else {
    issues.push("Cloud sync is paired but has never completed successfully.".to_string());
  }
  if events.is_empty() {
    issues.push("No customer journey events are stored locally yet.".to_string());
  }

  Ok(SystemHealth {
    vault_path: root.to_string_lossy().to_string(),
    event_files: event_files.len(),
    event_records: events.len(),
    event_bytes,
    invalid_event_lines,
    backup_count,
    backup_bytes,
    latest_backup,
    latest_backup_at,
    latest_backup_verified,
    auto_backup_today,
    visual_count,
    visual_bytes,
    marketing_briefs,
    job_cards,
    brain_actions: brain_actions.len(),
    inventory_count: inventory.fabrics.len(),
    unverified_inventory: inventory.fabrics.iter().filter(|fabric| fabric.status == "unverified").count(),
    inventory_overrides: overrides.len(),
    sync_configured,
    sync_cursor: sync_state.cursor,
    last_synced_at: sync_state.last_synced_at,
    last_pushed_at: sync_state.last_pushed_at,
    issues,
  })
}

#[tauri::command]
fn get_dashboard_summary() -> Result<DashboardSummary, String> {
  Ok(aggregate(load_events()?))
}

#[tauri::command]
fn export_customers_csv() -> Result<String, String> {
  let summary = aggregate(load_events()?);
  let root = ensure_vault()?;
  let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let path = root.join("exports").join(format!("customers_{stamp}.csv"));

  let mut rows = vec!["session_id,name,phone,occasion,garment,color_direction,lead_status,last_activity,note".to_string()];
  for session in summary.sessions {
    rows.push([
      csv_cell(&session.session_id),
      csv_cell(&session.customer.name),
      csv_cell(&session.customer.phone),
      csv_cell(session.answers.get("occasion").map(String::as_str).unwrap_or("")),
      csv_cell(session.answers.get("garment").map(String::as_str).unwrap_or("")),
      csv_cell(session.answers.get("colorDirection").map(String::as_str).unwrap_or("")),
      csv_cell(&session.customer.lead_status),
      csv_cell(&session.last_at),
      csv_cell(&session.customer.note),
    ].join(","));
  }

  fs::write(&path, rows.join("\n")).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_orders_csv() -> Result<String, String> {
  let summary = aggregate(load_events()?);
  let root = ensure_vault()?;
  let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let path = root.join("exports").join(format!("orders_{stamp}.csv"));

  let mut rows = vec!["session_id,customer,phone,garment,status,due_date,order_value,paid,balance,appointment_type,appointment_time,appointment_status".to_string()];

  for session in summary.sessions {
    let mut status = String::new();
    let mut due_date = String::new();
    let mut order_value = 0.0f64;
    let mut paid = 0.0f64;
    let mut appointment_type = String::new();
    let mut appointment_time = String::new();
    let mut appointment_status = String::new();

    for event in &session.events {
      match event.event_type.as_str() {
        "order_status_changed" => {
          status = event.payload.get("status").and_then(Value::as_str).unwrap_or("").to_string();
          due_date = event.payload.get("dueDate").and_then(Value::as_str).unwrap_or("").to_string();
          order_value = event.payload.get("orderValue").and_then(Value::as_f64).unwrap_or(order_value);
        }
        "payment_logged" => {
          paid += event.payload.get("amount").and_then(Value::as_f64).unwrap_or(0.0);
        }
        "appointment_updated" => {
          appointment_type = event.payload.get("kind").and_then(Value::as_str).unwrap_or("").to_string();
          appointment_time = event.payload.get("dateTime").and_then(Value::as_str).unwrap_or("").to_string();
          appointment_status = event.payload.get("status").and_then(Value::as_str).unwrap_or("").to_string();
        }
        _ => {}
      }
    }

    if status.is_empty() && order_value <= 0.0 && paid <= 0.0 {
      continue;
    }

    let balance = (order_value - paid).max(0.0);
    rows.push([
      csv_cell(&session.session_id),
      csv_cell(&session.customer.name),
      csv_cell(&session.customer.phone),
      csv_cell(session.answers.get("garment").map(String::as_str).unwrap_or("")),
      csv_cell(&status),
      csv_cell(&due_date),
      format!("{order_value:.2}"),
      format!("{paid:.2}"),
      format!("{balance:.2}"),
      csv_cell(&appointment_type),
      csv_cell(&appointment_time),
      csv_cell(&appointment_status),
    ].join(","));
  }

  fs::write(&path, rows.join("\n")).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_inventory_csv() -> Result<String, String> {
  let inventory = get_fabric_inventory()?;
  let root = ensure_vault()?;
  let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let path = root.join("exports").join(format!("inventory_{stamp}.csv"));

  let mut rows = vec!["id,family,line,color_name,status,quantity_meters,pattern,suitable_for,source,note".to_string()];
  for fabric in inventory.fabrics {
    rows.push([
      csv_cell(&fabric.id),
      csv_cell(&fabric.family),
      csv_cell(&fabric.line),
      csv_cell(&fabric.color_name),
      csv_cell(&fabric.status),
      fabric.quantity_meters.map(|value| format!("{value:.2}")).unwrap_or_default(),
      csv_cell(&fabric.pattern),
      csv_cell(&fabric.suitable_for.join(" | ")),
      csv_cell(&fabric.source_document),
      csv_cell(&fabric.note),
    ].join(","));
  }

  fs::write(&path, rows.join("\n")).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_job_card(session_id: String) -> Result<String, String> {
  let summary = aggregate(load_events()?);
  let session = summary.sessions.into_iter()
    .find(|session| session.session_id == session_id)
    .ok_or_else(|| "Customer session not found.".to_string())?;

  let mut order_status = String::new();
  let mut due_date = String::new();
  let mut order_note = String::new();
  let mut order_value = 0.0f64;
  let mut appointment_kind = String::new();
  let mut appointment_date = String::new();
  let mut appointment_status = String::new();
  let mut appointment_note = String::new();
  let mut measurement_unit = String::new();
  let mut measurement_note = String::new();
  let mut measurements = serde_json::Map::<String,Value>::new();
  let mut payments = Vec::<(f64,String,String,String)>::new();

  for event in &session.events {
    match event.event_type.as_str() {
      "order_status_changed" => {
        order_status = event.payload.get("status").and_then(Value::as_str).unwrap_or("").to_string();
        due_date = event.payload.get("dueDate").and_then(Value::as_str).unwrap_or("").to_string();
        order_note = event.payload.get("note").and_then(Value::as_str).unwrap_or("").to_string();
        order_value = event.payload.get("orderValue").and_then(Value::as_f64).unwrap_or(0.0);
      }
      "appointment_updated" => {
        appointment_kind = event.payload.get("kind").and_then(Value::as_str).unwrap_or("").to_string();
        appointment_date = event.payload.get("dateTime").and_then(Value::as_str).unwrap_or("").to_string();
        appointment_status = event.payload.get("status").and_then(Value::as_str).unwrap_or("").to_string();
        appointment_note = event.payload.get("note").and_then(Value::as_str).unwrap_or("").to_string();
      }
      "measurements_updated" => {
        measurement_unit = event.payload.get("unit").and_then(Value::as_str).unwrap_or("in").to_string();
        measurement_note = event.payload.get("note").and_then(Value::as_str).unwrap_or("").to_string();
        measurements = event.payload.get("measurements")
          .and_then(Value::as_object)
          .cloned()
          .unwrap_or_default();
      }
      "payment_logged" => {
        let amount = event.payload.get("amount").and_then(Value::as_f64).unwrap_or(0.0);
        let method = event.payload.get("method").and_then(Value::as_str).unwrap_or("other").to_string();
        let note = event.payload.get("note").and_then(Value::as_str).unwrap_or("").to_string();
        payments.push((amount,method,note,event.at.clone()));
      }
      _ => {}
    }
  }

  let paid = payments.iter().map(|(amount,_,_,_)| *amount).sum::<f64>();
  let balance = (order_value - paid).max(0.0);
  let name = if session.customer.name.trim().is_empty() { "Customer" } else { session.customer.name.trim() };
  let filename_base = {
    let candidate = safe_filename(name);
    if candidate.is_empty() { safe_filename(&session.session_id) } else { candidate }
  };
  let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let path = ensure_vault()?.join("job-cards").join(format!("{filename_base}_{stamp}.html"));

  let measurements_html = if measurements.is_empty() {
    "<p class=\"muted\">No measurements recorded.</p>".to_string()
  } else {
    measurements.iter().map(|(key,value)| {
      let number = value.as_f64().map(|v| format!("{v:.2}")).unwrap_or_else(|| value.to_string());
      format!("<div><span>{}</span><b>{} {}</b></div>", html_escape(key), html_escape(&number), html_escape(&measurement_unit))
    }).collect::<Vec<_>>().join("")
  };

  let payments_html = if payments.is_empty() {
    "<p class=\"muted\">No payments recorded.</p>".to_string()
  } else {
    payments.iter().rev().map(|(amount,method,note,at)| {
      format!(
        "<tr><td>₹{:.0}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
        amount,
        html_escape(method),
        html_escape(note),
        html_escape(at)
      )
    }).collect::<Vec<_>>().join("")
  };

  let selected_look = session.selected_look.as_ref()
    .map(|value| {
      let title = value.get("title").and_then(Value::as_str).unwrap_or("");
      let fabric = value.get("fabric").and_then(Value::as_str).unwrap_or("");
      format!("{}{}", html_escape(title), if fabric.is_empty() { String::new() } else { format!(" · {}", html_escape(fabric)) })
    })
    .unwrap_or_else(|| "Not selected".to_string());

  let html = format!(r#"<!doctype html>
<html><head><meta charset="utf-8"><title>LLinen Earth Job Card</title>
<style>
body{{font-family:Arial,sans-serif;color:#102033;margin:36px;max-width:980px}}h1,h2{{font-family:Georgia,serif;font-weight:400}}header{{border-bottom:2px solid #102033;padding-bottom:18px;margin-bottom:22px}}header small{{letter-spacing:.18em}}.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}}.box{{border:1px solid #d8d4cc;padding:12px}}.box small{{display:block;font-size:10px;letter-spacing:.12em;color:#777;margin-bottom:5px}}.measure{{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}}.measure div{{background:#f1eee8;padding:10px}}.measure span{{display:block;font-size:10px;color:#777;text-transform:capitalize}}table{{width:100%;border-collapse:collapse}}th,td{{border-bottom:1px solid #ddd;padding:9px;text-align:left;font-size:12px}}section{{margin-top:24px}}.muted{{color:#777}}.money{{font-size:22px;font-family:Georgia,serif}}footer{{margin-top:34px;border-top:1px solid #ddd;padding-top:12px;font-size:10px;color:#777}}@media print{{body{{margin:18mm}}}}
</style></head><body>
<header><small>LLINEN EARTH · TAILORING JOB CARD</small><h1>{}</h1><p>{}</p></header>
<div class="grid">
<div class="box"><small>PHONE</small><b>{}</b></div>
<div class="box"><small>OCCASION</small><b>{}</b></div>
<div class="box"><small>GARMENT</small><b>{}</b></div>
<div class="box"><small>ORDER STAGE</small><b>{}</b></div>
<div class="box"><small>DUE DATE</small><b>{}</b></div>
<div class="box"><small>SELECTED LOOK / FABRIC</small><b>{}</b></div>
</div>
<section><h2>Order finance</h2><div class="grid">
<div class="box"><small>ORDER VALUE</small><b class="money">₹{:.0}</b></div>
<div class="box"><small>PAID</small><b class="money">₹{:.0}</b></div>
<div class="box"><small>BALANCE</small><b class="money">₹{:.0}</b></div>
</div></section>
<section><h2>Measurements</h2><div class="measure">{}</div>{}</section>
<section><h2>Next appointment</h2><div class="box"><b>{} · {} · {}</b><p>{}</p></div></section>
<section><h2>Workroom notes</h2><div class="box"><p>{}</p><p>{}</p></div></section>
<section><h2>Payment history</h2><table><thead><tr><th>Amount</th><th>Method</th><th>Note</th><th>Recorded</th></tr></thead><tbody>{}</tbody></table></section>
<footer>Generated by LLinen Earth OS · {} · Session {}</footer>
</body></html>"#,
    html_escape(name),
    html_escape(session.customer.note.trim()),
    html_escape(session.customer.phone.trim()),
    html_escape(session.answers.get("occasion").map(String::as_str).unwrap_or("")),
    html_escape(session.answers.get("garment").map(String::as_str).unwrap_or("")),
    html_escape(&order_status),
    html_escape(&due_date),
    selected_look,
    order_value, paid, balance,
    measurements_html,
    if measurement_note.is_empty() { String::new() } else { format!("<p><b>Fit note:</b> {}</p>", html_escape(&measurement_note)) },
    html_escape(&appointment_kind),
    html_escape(&appointment_date),
    html_escape(&appointment_status),
    html_escape(&appointment_note),
    html_escape(&order_note),
    html_escape(session.customer.note.trim()),
    payments_html,
    html_escape(&Utc::now().to_rfc3339()),
    html_escape(&session.session_id),
  );

  fs::write(&path, html).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_desktop_lock_status() -> Result<DesktopLockStatus, String> {
  Ok(DesktopLockStatus {
    configured: stored_lock_password().is_some(),
    credential_store: "Windows Credential Manager".to_string(),
  })
}

#[tauri::command]
fn verify_desktop_lock(password: String) -> Result<bool, String> {
  let Some(stored) = stored_lock_password() else {
    return Ok(true);
  };
  Ok(constant_time_text_equal(&stored, &password))
}

#[tauri::command]
fn set_desktop_lock(current_password: String, new_password: String) -> Result<DesktopLockStatus, String> {
  validate_lock_password(&new_password)?;

  if let Some(stored) = stored_lock_password() {
    if !constant_time_text_equal(&stored, &current_password) {
      return Err("Current desktop lock password is incorrect.".to_string());
    }
  }

  lock_entry()?.set_password(&new_password).map_err(|e| e.to_string())?;
  Ok(DesktopLockStatus {
    configured: true,
    credential_store: "Windows Credential Manager".to_string(),
  })
}

#[tauri::command]
fn clear_desktop_lock(password: String) -> Result<DesktopLockStatus, String> {
  let Some(stored) = stored_lock_password() else {
    return Ok(DesktopLockStatus {
      configured: false,
      credential_store: "Windows Credential Manager".to_string(),
    });
  };

  if !constant_time_text_equal(&stored, &password) {
    return Err("Desktop lock password is incorrect.".to_string());
  }

  lock_entry()?.delete_credential().map_err(|e| e.to_string())?;
  Ok(DesktopLockStatus {
    configured: false,
    credential_store: "Windows Credential Manager".to_string(),
  })
}

#[tauri::command]
fn get_sync_pairing_status() -> Result<SyncPairingStatus, String> {
  Ok(SyncPairingStatus {
    configured: load_sync_token().is_some(),
    url: current_sync_url()?,
    credential_store: "Windows Credential Manager".to_string(),
  })
}

#[tauri::command]
async fn save_sync_pairing(sync_url: String, token: String) -> Result<SyncPairingStatus, String> {
  let url = validate_sync_url(&sync_url)?;
  let clean_token = token.trim();
  if clean_token.len() < 24 {
    return Err("Use a long private sync token (at least 24 characters).".to_string());
  }

  let client = Client::builder()
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .map_err(|e| e.to_string())?;
  let response = client
    .get(&url)
    .bearer_auth(clean_token)
    .query(&[("health","1")])
    .send()
    .await
    .map_err(|e| format!("Could not reach the sync endpoint: {e}"))?;

  if response.status() == reqwest::StatusCode::UNAUTHORIZED {
    return Err("The server rejected this pairing token.".to_string());
  }

  let status = response.status();
  let health = response.json::<Value>().await.map_err(|e| format!("Invalid sync health response: {e}"))?;
  if !status.is_success() {
    let detail = health.get("error").and_then(Value::as_str).unwrap_or("Cloud sync is not ready.");
    return Err(format!("{detail} (HTTP {status})"));
  }

  let ready = health.get("ok").and_then(Value::as_bool).unwrap_or(false)
    && health.get("cloudConfigured").and_then(Value::as_bool).unwrap_or(false)
    && health.get("schemaVersion").and_then(Value::as_i64) == Some(5);

  if !ready {
    return Err("The sync server is reachable, but the LLinen cloud schema is not production-ready.".to_string());
  }

  sync_entry()?.set_password(clean_token).map_err(|e| e.to_string())?;
  save_sync_config(&SyncConfig { url: url.clone() })?;

  Ok(SyncPairingStatus {
    configured: true,
    url,
    credential_store: "Windows Credential Manager".to_string(),
  })
}

#[tauri::command]
fn clear_sync_pairing() -> Result<SyncPairingStatus, String> {
  if let Ok(entry) = sync_entry() {
    let _ = entry.delete_credential();
  }
  save_sync_config(&SyncConfig { url: DEFAULT_SYNC_URL.to_string() })?;
  Ok(SyncPairingStatus {
    configured: false,
    url: DEFAULT_SYNC_URL.to_string(),
    credential_store: "Windows Credential Manager".to_string(),
  })
}

#[tauri::command]
fn get_system_health() -> Result<SystemHealth, String> {
  build_system_health()
}

#[tauri::command]
fn export_system_report() -> Result<String, String> {
  let health = build_system_health()?;
  let root = ensure_vault()?;
  let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let path = root.join("backups").join(format!("llinen-earth-system-report-{stamp}.md"));
  let issues = if health.issues.is_empty() {
    "- No current integrity warnings.".to_string()
  } else {
    health.issues.iter().map(|issue| format!("- {issue}")).collect::<Vec<_>>().join("\n")
  };
  let report = format!(
    "# LLinen Earth OS — System Report\n\nGenerated: {}\n\n## Local vault\n- Path: {}\n- Event records: {} across {} daily files\n- Event bytes: {}\n- Invalid event lines: {}\n- Backups: {}\n- Latest backup: {}\n- Latest backup time: {}\n- Latest backup verified: {}\n- Automatic backup today: {}\n- Visual files: {}\n- Visual bytes: {}\n- Marketing briefs: {}\n- Job cards: {}\n- Brain action decisions: {}\n\n## Inventory\n- Entries: {}\n- Unverified: {}\n- Operator overrides: {}\n\n## Cloud sync\n- Paired: {}\n- Last synced: {}\n- Cursor present: {}\n\n## Current warnings\n{}\n",
    Utc::now().to_rfc3339(),
    health.vault_path,
    health.event_records,
    health.event_files,
    health.event_bytes,
    health.invalid_event_lines,
    health.backup_count,
    health.latest_backup.as_deref().unwrap_or("None"),
    health.latest_backup_at.as_deref().unwrap_or("Never"),
    if health.latest_backup_verified { "Yes" } else { "No" },
    if health.auto_backup_today { "Yes" } else { "No" },
    health.visual_count,
    health.visual_bytes,
    health.marketing_briefs,
    health.job_cards,
    health.brain_actions,
    health.inventory_count,
    health.unverified_inventory,
    health.inventory_overrides,
    if health.sync_configured { "Yes" } else { "No" },
    health.last_synced_at.as_deref().unwrap_or("Never"),
    if health.sync_cursor.is_some() { "Yes" } else { "No" },
    issues,
  );
  fs::write(&path, report).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_marketing_brief(title: String, content: String) -> Result<String, String> {
  let clean_title = title.trim();
  if clean_title.is_empty() {
    return Err("Marketing brief title is required.".to_string());
  }
  if content.len() > 50_000 {
    return Err("Marketing brief is too large.".to_string());
  }

  let slug = clean_title
    .chars()
    .map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { '-' })
    .collect::<String>()
    .split('-')
    .filter(|part| !part.is_empty())
    .take(10)
    .collect::<Vec<_>>()
    .join("-");

  let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let filename = format!("{}_{}.md", if slug.is_empty() { "campaign-brief" } else { &slug }, stamp);
  let path = ensure_vault()?.join("marketing").join(filename);
  fs::write(&path, content).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_brain_actions() -> Result<HashMap<String, BrainActionState>, String> {
  load_brain_actions()
}

#[tauri::command]
fn update_brain_action(action_id: String, status: String, note: String) -> Result<(), String> {
  const ALLOWED: [&str; 4] = ["open", "watching", "done", "dismissed"];
  if !ALLOWED.contains(&status.as_str()) {
    return Err("Unsupported brain action status.".to_string());
  }
  let clean_id = action_id.trim();
  if clean_id.is_empty() || clean_id.len() > 120 || !clean_id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_') {
    return Err("Invalid brain action id.".to_string());
  }

  let mut actions = load_brain_actions()?;
  actions.insert(
    clean_id.to_string(),
    BrainActionState {
      status,
      note: note.trim().chars().take(800).collect(),
      updated_at: Utc::now().to_rfc3339(),
    },
  );
  save_brain_actions(&actions)
}

#[tauri::command]
fn record_outcome(session_id: String, kind: String, amount: Option<f64>) -> Result<(), String> {
  if kind != "visit_logged" && kind != "sale_logged" {
    return Err("Unsupported outcome type.".to_string());
  }

  let payload = if kind == "sale_logged" {
    let sale_amount = amount.unwrap_or(0.0);
    if !sale_amount.is_finite() || sale_amount < 0.0 || sale_amount > 100_000_000.0 {
      return Err("Sale amount is invalid.".to_string());
    }
    json!({ "amount": sale_amount, "currency": "INR", "source": "desktop" })
  } else {
    json!({ "status": "visited", "source": "desktop" })
  };

  append_operator_event(session_id, &kind, payload)
}

#[tauri::command]
fn update_customer(session_id: String, name: String, phone: String, note: String) -> Result<(), String> {
  append_operator_event(
    session_id,
    "customer_updated",
    json!({
      "name": name.trim(),
      "phone": phone.trim(),
      "note": note.trim(),
    }),
  )
}

#[tauri::command]
fn create_walkin_customer(
  name: String,
  phone: String,
  note: String,
  occasion: String,
  garment: String,
) -> Result<String, String> {
  let clean_name = name.trim();
  let clean_phone = phone.trim();
  if clean_name.is_empty() && clean_phone.is_empty() {
    return Err("Add at least a customer name or phone number.".to_string());
  }

  let session_id = format!("walkin-{}", Utc::now().timestamp_micros());
  append_operator_event(
    session_id.clone(),
    "session_started",
    json!({ "entry": "walk-in", "source": "operator-desktop" }),
  )?;
  append_operator_event(
    session_id.clone(),
    "customer_updated",
    json!({ "name": clean_name, "phone": clean_phone, "note": note.trim() }),
  )?;

  if !occasion.trim().is_empty() {
    append_operator_event(
      session_id.clone(),
      "answer_selected",
      json!({ "step": "occasion", "value": occasion.trim() }),
    )?;
  }

  if !garment.trim().is_empty() {
    append_operator_event(
      session_id.clone(),
      "answer_selected",
      json!({ "step": "garment", "value": garment.trim() }),
    )?;
  }

  append_operator_event(
    session_id.clone(),
    "visit_logged",
    json!({ "status": "walk-in", "source": "operator-desktop" }),
  )?;

  Ok(session_id)
}

#[tauri::command]
fn save_measurements(
  session_id: String,
  unit: String,
  measurements: HashMap<String, f64>,
  note: String,
) -> Result<(), String> {
  if unit != "in" && unit != "cm" {
    return Err("Measurement unit must be in or cm.".to_string());
  }

  const ALLOWED: [&str; 12] = [
    "neck",
    "chest",
    "waist",
    "seat",
    "shoulder",
    "sleeve",
    "shirtLength",
    "trouserWaist",
    "outseam",
    "inseam",
    "thigh",
    "bottom",
  ];

  let max = if unit == "cm" { 300.0 } else { 120.0 };
  let mut clean = serde_json::Map::new();

  for (key, value) in measurements {
    if !ALLOWED.contains(&key.as_str()) {
      continue;
    }
    if !value.is_finite() || value <= 0.0 || value > max {
      return Err(format!("Measurement {key} is outside the allowed range."));
    }
    clean.insert(key, json!((value * 100.0).round() / 100.0));
  }

  if clean.is_empty() {
    return Err("Add at least one measurement before saving.".to_string());
  }

  append_operator_event(
    session_id,
    "measurements_updated",
    json!({
      "unit": unit,
      "measurements": Value::Object(clean),
      "note": note.trim().chars().take(1000).collect::<String>(),
    }),
  )
}

#[tauri::command]
fn set_order_status(
  session_id: String,
  status: String,
  due_date: String,
  note: String,
  order_value: Option<f64>,
) -> Result<(), String> {
  const ALLOWED: [&str; 9] = [
    "quoted",
    "measurement",
    "deposit",
    "cutting",
    "tailoring",
    "trial",
    "ready",
    "collected",
    "cancelled",
  ];

  if !ALLOWED.contains(&status.as_str()) {
    return Err("Unsupported order status.".to_string());
  }

  let clean_due = due_date.trim();
  if !clean_due.is_empty() && chrono::NaiveDate::parse_from_str(clean_due, "%Y-%m-%d").is_err() {
    return Err("Due date must be a valid YYYY-MM-DD date.".to_string());
  }

  let clean_order_value = match order_value {
    Some(value) if value.is_finite() && value >= 0.0 && value <= 100_000_000.0 => Some((value * 100.0).round() / 100.0),
    Some(_) => return Err("Order value is outside the allowed range.".to_string()),
    None => None,
  };

  append_operator_event(
    session_id,
    "order_status_changed",
    json!({
      "status": status,
      "dueDate": clean_due,
      "note": note.trim().chars().take(1000).collect::<String>(),
      "orderValue": clean_order_value,
    }),
  )
}

#[tauri::command]
fn set_appointment(
  session_id: String,
  kind: String,
  date_time: String,
  status: String,
  note: String,
) -> Result<(), String> {
  const KINDS: [&str; 5] = ["consultation", "fitting", "trial", "pickup", "delivery"];
  const STATUSES: [&str; 3] = ["scheduled", "completed", "cancelled"];

  if !KINDS.contains(&kind.as_str()) {
    return Err("Unsupported appointment type.".to_string());
  }
  if !STATUSES.contains(&status.as_str()) {
    return Err("Unsupported appointment status.".to_string());
  }

  let clean_date = date_time.trim();
  if status == "scheduled" {
    let valid = clean_date.len() == 16
      && clean_date.chars().enumerate().all(|(index, ch)| {
        match index {
          4 | 7 => ch == '-',
          10 => ch == 'T',
          13 => ch == ':',
          _ => ch.is_ascii_digit(),
        }
      });
    if !valid {
      return Err("Appointment date/time must use YYYY-MM-DDTHH:MM.".to_string());
    }
  }

  append_operator_event(
    session_id,
    "appointment_updated",
    json!({
      "kind": kind,
      "dateTime": if status == "scheduled" { clean_date } else { clean_date },
      "status": status,
      "note": note.trim().chars().take(600).collect::<String>(),
    }),
  )
}

#[tauri::command]
fn record_payment(
  session_id: String,
  amount: f64,
  method: String,
  note: String,
) -> Result<(), String> {
  if !amount.is_finite() || amount <= 0.0 || amount > 100_000_000.0 {
    return Err("Payment amount is outside the allowed range.".to_string());
  }

  const METHODS: [&str; 5] = ["cash", "upi", "card", "bank", "other"];
  if !METHODS.contains(&method.as_str()) {
    return Err("Unsupported payment method.".to_string());
  }

  append_operator_event(
    session_id,
    "payment_logged",
    json!({
      "amount": (amount * 100.0).round() / 100.0,
      "currency": "INR",
      "method": method,
      "note": note.trim().chars().take(500).collect::<String>(),
    }),
  )
}

#[tauri::command]
fn set_lead_status(session_id: String, status: String) -> Result<(), String> {
  const ALLOWED: [&str; 6] = ["new", "contacted", "visit-booked", "won", "lost", "follow-up"];
  if !ALLOWED.contains(&status.as_str()) {
    return Err("Unsupported lead status.".to_string());
  }
  append_operator_event(session_id, "lead_status_changed", json!({ "status": status }))
}

#[tauri::command]
fn get_fabric_inventory() -> Result<InventoryView, String> {
  let feed_path = inventory_feed_path()?;
  let content = if feed_path.exists() {
    fs::read_to_string(feed_path).map_err(|e| e.to_string())?
  } else {
    SEED_INVENTORY.to_string()
  };
  let feed = serde_json::from_str::<InventoryFeed>(&content).map_err(|e| e.to_string())?;
  let overrides = load_inventory_overrides()?;
  let cached_at = fs::read_to_string(inventory_cache_meta_path()?)
    .ok()
    .and_then(|value| serde_json::from_str::<Value>(&value).ok())
    .and_then(|value| value.get("cachedAt").and_then(Value::as_str).map(ToOwned::to_owned));

  let fabrics = feed.fabrics.into_iter().map(|fabric| {
    let override_item = overrides.get(&fabric.id).cloned().unwrap_or_else(|| InventoryOverride {
      status: if fabric.source_document == "llinenearth.com" { "unverified".to_string() } else if fabric.in_stock { "in-stock".to_string() } else { "out".to_string() },
      quantity_meters: None,
      note: String::new(),
      updated_at: String::new(),
    });

    FabricInventoryItem {
      id: fabric.id,
      family: fabric.family,
      line: fabric.line,
      color_name: fabric.color_name,
      hex: fabric.hex,
      swatch_image_url: fabric.swatch_image_url,
      suitable_for: fabric.suitable_for,
      pattern: fabric.pattern,
      composition_note: fabric.composition_note,
      source_document: fabric.source_document,
      source_page: fabric.source_page,
      source_in_stock: fabric.in_stock,
      status: override_item.status,
      quantity_meters: override_item.quantity_meters,
      note: override_item.note,
      updated_at: override_item.updated_at,
    }
  }).collect();

  Ok(InventoryView {
    generated_at: Some(feed.generated_at),
    cached_at,
    fabrics,
  })
}

#[tauri::command]
fn update_fabric_inventory(
  fabric_id: String,
  status: String,
  quantity_meters: Option<f64>,
  note: String,
) -> Result<(), String> {
  const ALLOWED: [&str; 4] = ["unverified", "in-stock", "low", "out"];
  if !ALLOWED.contains(&status.as_str()) {
    return Err("Unsupported inventory status.".to_string());
  }
  if quantity_meters.is_some_and(|value| value < 0.0) {
    return Err("Quantity cannot be negative.".to_string());
  }

  let mut overrides = load_inventory_overrides()?;
  overrides.insert(
    fabric_id,
    InventoryOverride {
      status,
      quantity_meters,
      note: note.trim().to_string(),
      updated_at: Utc::now().to_rfc3339(),
    },
  );
  save_inventory_overrides(&overrides)
}

#[tauri::command]
async fn sync_fabric_inventory() -> Result<SyncResult, String> {
  let inventory_url = std::env::var("LLINEN_EARTH_INVENTORY_URL")
    .unwrap_or_else(|_| "https://llinenearth-designer.vercel.app/api/inventory".to_string());

  let client = Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .build()
    .map_err(|e| e.to_string())?;

  let response = client
    .get(&inventory_url)
    .send()
    .await
    .map_err(|e| format!("Inventory sync failed: {e}"))?;

  if !response.status().is_success() {
    return Err(format!("Inventory feed returned HTTP {}.", response.status()));
  }

  let body = response.text().await.map_err(|e| e.to_string())?;
  let feed = serde_json::from_str::<InventoryFeed>(&body).map_err(|e| format!("Inventory feed was invalid: {e}"))?;
  let count = feed.fabrics.len();

  fs::write(inventory_feed_path()?, body).map_err(|e| e.to_string())?;
  fs::write(
    inventory_cache_meta_path()?,
    serde_json::to_string_pretty(&json!({
      "cachedAt": Utc::now().to_rfc3339(),
      "source": inventory_url,
      "fabrics": count,
    })).map_err(|e| e.to_string())?,
  ).map_err(|e| e.to_string())?;

  Ok(SyncResult {
    configured: true,
    imported: count,
    next_cursor: None,
    message: format!("Inventory refreshed: {count} structured fabric colours cached on this PC."),
  })
}

#[tauri::command]
fn create_backup() -> Result<String, String> {
  let path = write_backup_file("llinen-earth-memory-")?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn ensure_daily_backup() -> Result<String, String> {
  if auto_backup_exists_today()? {
    return Ok("Automatic backup already exists for today.".to_string());
  }

  let path = write_backup_file("llinen-earth-auto-")?;
  prune_auto_backups(30)?;
  Ok(format!("Automatic daily backup created: {}", path.to_string_lossy()))
}

#[tauri::command]
fn verify_latest_backup() -> Result<String, String> {
  let root = ensure_vault()?;
  let backup_dir = root.join("backups");
  let mut files = fs::read_dir(&backup_dir)
    .map_err(|e| e.to_string())?
    .filter_map(|entry| entry.ok().map(|item| item.path()))
    .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
    .collect::<Vec<_>>();
  files.sort();
  let latest = files.pop().ok_or_else(|| "No JSON backup exists yet.".to_string())?;
  verify_backup_file(&latest)?;
  Ok(format!("Verified: {}", latest.to_string_lossy()))
}

#[tauri::command]
async fn archive_visuals() -> Result<SyncResult, String> {
  const MAX_IMAGE_BYTES: usize = 12 * 1024 * 1024;
  let root = ensure_vault()?;
  let visual_dir = root.join("visuals");
  let client = Client::builder()
    .timeout(std::time::Duration::from_secs(35))
    .build()
    .map_err(|e| e.to_string())?;

  let mut archived = 0usize;
  let mut skipped = 0usize;

  for event in load_events()?.into_iter().filter(|event| event.event_type == "render_completed") {
    let Some(raw_url) = event.payload.get("imageUrl").and_then(Value::as_str) else {
      skipped += 1;
      continue;
    };

    let url = reqwest::Url::parse(raw_url).map_err(|_| "A stored visual URL was invalid.".to_string())?;
    let trusted_host = matches!(url.host_str(), Some("cdn.fashn.ai") | Some("media.fashn.ai"));
    if url.scheme() != "https" || !trusted_host {
      skipped += 1;
      continue;
    }

    let safe_event = event.id.chars()
      .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
      .collect::<String>();
    let target = visual_dir.join(format!("{safe_event}.jpg"));
    if target.exists() {
      continue;
    }

    let response = client.get(url).send().await.map_err(|e| format!("Visual archive download failed: {e}"))?;
    if !response.status().is_success() {
      skipped += 1;
      continue;
    }

    let is_image = response.headers()
      .get(reqwest::header::CONTENT_TYPE)
      .and_then(|value| value.to_str().ok())
      .is_some_and(|value| value.to_ascii_lowercase().starts_with("image/"));
    if !is_image {
      skipped += 1;
      continue;
    }

    if response.content_length().is_some_and(|size| size as usize > MAX_IMAGE_BYTES) {
      skipped += 1;
      continue;
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > MAX_IMAGE_BYTES {
      skipped += 1;
      continue;
    }

    fs::write(&target, &bytes).map_err(|e| e.to_string())?;
    archived += 1;
  }

  Ok(SyncResult {
    configured: true,
    imported: archived,
    next_cursor: None,
    message: if archived == 0 {
      format!("Visual archive is up to date. {skipped} record(s) had no downloadable photoreal file.")
    } else {
      format!("Archived {archived} photoreal visual(s) to {}.", visual_dir.to_string_lossy())
    },
  })
}

#[tauri::command]
async fn sync_from_cloud(sync_lock: tauri::State<'_, SyncLock>) -> Result<SyncResult, String> {
  let _sync_guard = sync_lock.0.lock().await;
  let sync_url = current_sync_url()?;
  let token = match load_sync_token() {
    Some(value) => value,
    None => {
      return Ok(SyncResult {
        configured: false,
        imported: 0,
        next_cursor: None,
        message: "Cloud sync is not paired on this PC yet.".to_string(),
      })
    }
  };

  let client = Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .build()
    .map_err(|e| e.to_string())?;

  let mut state = load_sync_state()?;
  let local_events = load_events()?;
  let operator_events = local_events
    .iter()
    .filter(|event| {
      event.source == "operator-desktop"
        && state.last_pushed_at.as_ref().is_none_or(|cursor| event.at > *cursor)
    })
    .cloned()
    .collect::<Vec<_>>();
  let mut pushed = 0usize;

  for chunk in operator_events.chunks(200) {
    let response = client
      .post(&sync_url)
      .bearer_auth(&token)
      .json(&json!({ "events": chunk }))
      .send()
      .await
      .map_err(|e| format!("Cloud upload failed: {e}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
      return Err("Cloud sync authorization was rejected.".to_string());
    }
    if !response.status().is_success() {
      return Err(format!("Cloud upload returned HTTP {}.", response.status()));
    }

    let result = response.json::<Value>().await.map_err(|e| e.to_string())?;
    pushed += result
      .get("accepted")
      .and_then(Value::as_u64)
      .map(|value| value as usize)
      .unwrap_or(chunk.len());
  }

  if let Some(last) = operator_events.iter().map(|event| event.at.clone()).max() {
    state.last_pushed_at = Some(last);
    save_sync_state(&state)?;
  }

  let mut known = local_events
    .into_iter()
    .map(|event| event.id)
    .collect::<HashSet<_>>();
  let mut imported = 0usize;

  for _ in 0..20 {
    let mut request = client
      .get(&sync_url)
      .bearer_auth(&token)
      .query(&[("limit", "500")]);

    if let Some(cursor) = state.cursor.as_deref() {
      request = request.query(&[("cursor", cursor)]);
    }

    let response = request.send().await.map_err(|e| format!("Cloud sync failed: {e}"))?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
      return Err("Cloud sync authorization was rejected.".to_string());
    }
    if !response.status().is_success() {
      return Err(format!("Cloud sync returned HTTP {}.", response.status()));
    }

    let feed = response.json::<SyncFeed>().await.map_err(|e| e.to_string())?;

    for event in feed.events {
      if known.insert(event.id.clone()) {
        append_event(&event)?;
        imported += 1;
      }
    }

    if let Some(cursor) = feed.next_cursor {
      state.cursor = Some(cursor);
    }
    state.last_synced_at = Some(Utc::now().to_rfc3339());
    save_sync_state(&state)?;

    if !feed.has_more {
      break;
    }
  }

  Ok(SyncResult {
    configured: true,
    imported,
    next_cursor: state.cursor,
    message: match (pushed, imported) {
      (0, 0) => "Cloud memory is already up to date.".to_string(),
      (uploaded, 0) => format!("Reconciled {uploaded} local operator event(s) with cloud memory."),
      (0, downloaded) => format!("Imported {downloaded} new cloud event(s)."),
      (uploaded, downloaded) => format!("Reconciled {uploaded} local event(s) and imported {downloaded} new cloud event(s)."),
    },
  })
}

fn main() {
  tauri::Builder::default()
    .manage(SyncLock(Mutex::new(())))
    .invoke_handler(tauri::generate_handler![
      get_dashboard_summary,
      export_customers_csv,
      export_orders_csv,
      export_inventory_csv,
      export_job_card,
      get_desktop_lock_status,
      verify_desktop_lock,
      set_desktop_lock,
      clear_desktop_lock,
      get_sync_pairing_status,
      save_sync_pairing,
      clear_sync_pairing,
      get_system_health,
      export_system_report,
      export_marketing_brief,
      get_brain_actions,
      update_brain_action,
      record_outcome,
      update_customer,
      create_walkin_customer,
      save_measurements,
      set_order_status,
      record_payment,
      set_appointment,
      set_lead_status,
      get_fabric_inventory,
      update_fabric_inventory,
      sync_fabric_inventory,
      archive_visuals,
      create_backup,
      ensure_daily_backup,
      verify_latest_backup,
      sync_from_cloud
    ])
    .run(tauri::generate_context!())
    .expect("error while running LLinen Earth OS");
}
