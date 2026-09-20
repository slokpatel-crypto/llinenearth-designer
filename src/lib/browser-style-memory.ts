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
  | "operator_note"
  | "customer_updated"
  | "lead_status_changed"
  | "order_status_changed";

export type StyleMemoryEvent = {
  id: string;
  sessionId: string;
  type: StyleMemoryEventType;
  at: string;
  source: "style-director" | "operator" | "operator-desktop";
  payload?: Record<string, unknown>;
};

export type LocalBridgeConfig = {
  url: string;
  token: string;
};

const EVENT_KEY = "llinen-earth:style-memory:v1";
const BRIDGE_KEY = "llinen-earth:local-bridge:v1";
const SESSION_TOKEN_PREFIX = "llinen-earth:memory-session:";
const sessionTokenRequests = new Map<string,Promise<string|null>>();
const MAX_BROWSER_EVENTS = 1200;
const PENDING_KEY = "llinen-earth:style-cloud-pending:v1";
const MAX_PENDING_EVENTS = 600;
let cloudFlush: Promise<void> | null = null;

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function createStyleSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `LE-${crypto.randomUUID()}`;
  return `LE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readSessionToken(sessionId:string) {
  const w = safeWindow();
  if (!w) return null;
  return w.sessionStorage.getItem(`${SESSION_TOKEN_PREFIX}${sessionId}`);
}

async function ensureSessionToken(sessionId:string) {
  const existing = readSessionToken(sessionId);
  if (existing) return existing;

  const inFlight = sessionTokenRequests.get(sessionId);
  if (inFlight) return inFlight;

  const request = (async()=>{
    try {
      const response = await fetch("/api/memory/session",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({sessionId}),
        cache:"no-store",
      });
      if (!response.ok) return null;
      const data = await response.json() as {token?:string};
      if (!data.token) return null;
      safeWindow()?.sessionStorage.setItem(`${SESSION_TOKEN_PREFIX}${sessionId}`,data.token);
      return data.token;
    } catch {
      return null;
    } finally {
      sessionTokenRequests.delete(sessionId);
    }
  })();

  sessionTokenRequests.set(sessionId,request);
  return request;
}

export async function prepareStyleMemorySession(sessionId:string) {
  return ensureSessionToken(sessionId);
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

function readPendingEvents(): StyleMemoryEvent[] {
  const w = safeWindow();
  if (!w) return [];
  try {
    const parsed = JSON.parse(w.localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_PENDING_EVENTS) : [];
  } catch {
    return [];
  }
}

function writePendingEvents(events:StyleMemoryEvent[]) {
  const w = safeWindow();
  if (!w) return;
  w.localStorage.setItem(PENDING_KEY,JSON.stringify(events.slice(-MAX_PENDING_EVENTS)));
}

function enqueueCloudEvent(event:StyleMemoryEvent) {
  const pending = readPendingEvents();
  if (!pending.some((item)=>item.id===event.id)) pending.push(event);
  writePendingEvents(pending);
}

async function sendCloudEvent(event:StyleMemoryEvent) {
  const headers: Record<string,string> = { "content-type": "application/json" };
  if (event.source === "style-director") {
    const token = await ensureSessionToken(event.sessionId);
    if (!token) return false;
    headers["x-llinen-memory-token"] = token;
  }

  try {
    const response = await fetch("/api/memory/event", {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      keepalive: true,
    });
    return response.ok || response.status === 409;
  } catch {
    return false;
  }
}

export async function flushPendingStyleMemoryEvents() {
  const w = safeWindow();
  if (!w || cloudFlush) return cloudFlush || Promise.resolve();

  cloudFlush = (async()=>{
    const pending = readPendingEvents();
    if (!pending.length) return;

    const remaining:StyleMemoryEvent[] = [];
    for (const event of pending) {
      const sent = await sendCloudEvent(event);
      if (!sent) remaining.push(event);
    }
    writePendingEvents(remaining);
  })().finally(()=>{ cloudFlush = null; });

  return cloudFlush;
}

async function mirrorToCloud(event: StyleMemoryEvent) {
  enqueueCloudEvent(event);
  await flushPendingStyleMemoryEvents();
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
    void mirrorToCloud(event);
    void mirrorToBridge(event);
  }
  return event;
}

export function clearBrowserStyleEvents() {
  const w = safeWindow();
  w?.localStorage.removeItem(EVENT_KEY);
  w?.localStorage.removeItem(PENDING_KEY);
}
