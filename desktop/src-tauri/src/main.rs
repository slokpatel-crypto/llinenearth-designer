use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
  collections::HashMap,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionRecord {
  session_id: String,
  first_at: String,
  last_at: String,
  answers: HashMap<String, String>,
  selected_look: Option<Value>,
  sale: Option<Value>,
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

    if event.event_type == "sale_logged" {
      totals.revenue += number_from_payload(&event.payload, "amount").unwrap_or(0.0);
      session.sale = Some(event.payload.clone());
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

#[tauri::command]
fn get_dashboard_summary() -> Result<DashboardSummary, String> {
  Ok(aggregate(load_events()?))
}

#[tauri::command]
fn record_outcome(session_id: String, kind: String, amount: Option<f64>) -> Result<(), String> {
  if kind != "visit_logged" && kind != "sale_logged" {
    return Err("Unsupported outcome type.".to_string());
  }

  let now = Utc::now().to_rfc3339();
  let payload = if kind == "sale_logged" {
    json!({ "amount": amount.unwrap_or(0.0), "currency": "INR", "source": "desktop" })
  } else {
    json!({ "status": "visited", "source": "desktop" })
  };

  append_event(&EventRecord {
    id: format!("EV-{}", Utc::now().timestamp_millis()),
    session_id,
    event_type: kind,
    at: now,
    source: "operator-desktop".to_string(),
    payload,
  })
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

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      get_dashboard_summary,
      record_outcome,
      create_backup
    ])
    .run(tauri::generate_context!())
    .expect("error while running LLinen Earth OS");
}
