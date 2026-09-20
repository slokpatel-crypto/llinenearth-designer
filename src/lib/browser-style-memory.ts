export type StyleMemoryEventType =
  | "session_started"
  | "answer_selected"
  | "looks_generated"
  | "look_selected"
  | "render_requested"
  | "render_completed"
  | "whatsapp_clicked"
  | "visit_logged"
  | "sale_logged"
  | "operator_note";

export type StyleMemoryEvent = {
  id: string;
  sessionId: string;
  type: StyleMemoryEventType;
  at: string;
  source: "style-director" | "operator";
  payload?: Record<string, unknown>;
};

export type LocalBridgeConfig = {
  url: string;
  token: string;
};

const EVENT_KEY = "llinen-earth:style-memory:v1";
const BRIDGE_KEY = "llinen-earth:local-bridge:v1";
const MAX_BROWSER_EVENTS = 1200;

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function createStyleSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `LE-${crypto.randomUUID()}`;
  return `LE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readBrowserStyleEvents(): StyleMemoryEvent[] {
  const w = safeWindow();
  if (!w) return [];
  try {
    const parsed = JSON.parse(w.localStorage.getItem(EVENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_BROWSER_EVENTS) : [];
  } catch {
    return [];
  }
}

export function readBridgeConfig(): LocalBridgeConfig | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const parsed = JSON.parse(w.sessionStorage.getItem(BRIDGE_KEY) || "null");
    return parsed?.url && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBridgeConfig(config: LocalBridgeConfig | null) {
  const w = safeWindow();
  if (!w) return;
  if (!config) w.sessionStorage.removeItem(BRIDGE_KEY);
  else w.sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(config));
}

async function mirrorToBridge(event: StyleMemoryEvent) {
  const config = readBridgeConfig();
  if (!config) return;
  try {
    await fetch(`${config.url.replace(/\/$/, "")}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // The website must continue to work if the operator's laptop or bridge is offline.
  }
}

export function recordStyleMemoryEvent(
  sessionId: string,
  type: StyleMemoryEventType,
  payload?: Record<string, unknown>,
  source: StyleMemoryEvent["source"] = "style-director",
) {
  const w = safeWindow();
  const event: StyleMemoryEvent = {
    id: `EV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type,
    at: new Date().toISOString(),
    source,
    payload,
  };
  if (w) {
    const events = readBrowserStyleEvents();
    events.push(event);
    w.localStorage.setItem(EVENT_KEY, JSON.stringify(events.slice(-MAX_BROWSER_EVENTS)));
    void mirrorToBridge(event);
  }
  return event;
}

export function clearBrowserStyleEvents() {
  safeWindow()?.localStorage.removeItem(EVENT_KEY);
}
