use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
  collections::{HashMap, HashSet},
  fs::{self, OpenOptions},
  io::{BufRead, BufReader, Write},
  path::{Path, PathBuf},
};

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

#[tauri::command]
fn get_dashboard_summary() -> Result<DashboardSummary, String> {
  Ok(aggregate(load_events()?))
}

#[tauri::command]
fn record_outcome(session_id: String, kind: String, amount: Option<f64>) -> Result<(), String> {
  if kind != "visit_logged" && kind != "sale_logged" {
    return Err("Unsupported outcome type.".to_string());
  }

  let payload = if kind == "sale_logged" {
    json!({ "amount": amount.unwrap_or(0.0), "currency": "INR", "source": "desktop" })
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
fn set_lead_status(session_id: String, status: String) -> Result<(), String> {
  const ALLOWED: [&str; 6] = ["new", "contacted", "visit-booked", "won", "lost", "follow-up"];
  if !ALLOWED.contains(&status.as_str()) {
    return Err("Unsupported lead status.".to_string());
  }
  append_operator_event(session_id, "lead_status_changed", json!({ "status": status }))
}

#[tauri::command]
fn create_backup() -> Result<String, String> {
  let root = ensure_vault()?;
  let events = load_events()?;
  let summary = aggregate(events.clone());
  let stamp = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
  let path = root
    .join("backups")
    .join(format!("llinen-earth-memory-{stamp}.json"));

  let payload = json!({
    "createdAt": Utc::now().to_rfc3339(),
    "events": events,
    "summary": summary,
  });

  fs::write(
    &path,
    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())?;

  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn sync_from_cloud() -> Result<SyncResult, String> {
  let sync_url = std::env::var("LLINEN_EARTH_SYNC_URL")
    .unwrap_or_else(|_| "https://llinenearth-designer.vercel.app/api/operator/sync".to_string());
  let token = match std::env::var("LLINEN_OPERATOR_SYNC_TOKEN") {
    Ok(value) if !value.trim().is_empty() => value,
    _ => {
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
  let mut known = load_events()?
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
    message: if imported == 0 {
      "Cloud memory is already up to date.".to_string()
    } else {
      format!("Imported {imported} new website events.")
    },
  })
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      get_dashboard_summary,
      record_outcome,
      update_customer,
      set_lead_status,
      create_backup,
      sync_from_cloud
    ])
    .run(tauri::generate_context!())
    .expect("error while running LLinen Earth OS");
}
