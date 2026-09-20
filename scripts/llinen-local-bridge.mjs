#!/usr/bin/env node
import http from "node:http";
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.LLINEN_BRIDGE_PORT || 4317);
const HOST = "127.0.0.1";
const DATA_DIR = path.resolve(process.env.LLINEN_EARTH_DATA_DIR || path.join(os.homedir(), "LlinenEarthData"));
const EVENTS_DIR = path.join(DATA_DIR, "events");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const TOKEN = process.env.LLINEN_LOCAL_BRIDGE_TOKEN || randomBytes(24).toString("hex");
const ALLOWED_ORIGINS = new Set(
  (process.env.LLINEN_ALLOWED_ORIGINS || "https://llinenearth-designer.vercel.app,http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

await Promise.all([mkdir(EVENTS_DIR, { recursive: true }), mkdir(BACKUPS_DIR, { recursive: true })]);

function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const allowed = ALLOWED_ORIGINS.has(origin);
  return {
    "access-control-allow-origin": allowed ? origin : "null",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

function send(req, res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...corsHeaders(req) });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${TOKEN}`;
}

async function readJson(req, maxBytes = 64_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Request too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function safeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const type = String(event.type || "").slice(0, 80);
  const sessionId = String(event.sessionId || "").slice(0, 140);
  if (!type || !sessionId) return null;
  return {
    id: String(event.id || `EV-${Date.now()}`).slice(0, 160),
    sessionId,
    type,
    at: new Date(event.at || Date.now()).toISOString(),
    source: String(event.source || "unknown").slice(0, 40),
    payload: event.payload && typeof event.payload === "object" ? event.payload : {},
    receivedAt: new Date().toISOString(),
  };
}

function dayFile(date = new Date()) {
  return path.join(EVENTS_DIR, `${date.toISOString().slice(0, 10)}.ndjson`);
}

async function loadRecentEvents(days = 30) {
  const files = (await readdir(EVENTS_DIR)).filter((name) => /^\d{4}-\d{2}-\d{2}\.ndjson$/.test(name)).sort().slice(-days);
  const events = [];
  for (const file of files) {
    try {
      const text = await readFile(path.join(EVENTS_DIR, file), "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
    } catch {}
  }
  return events.slice(-5000);
}

function aggregate(events) {
  const sessions = new Map();
  const counts = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
    const session = sessions.get(event.sessionId) || { sessionId: event.sessionId, firstAt: event.at, lastAt: event.at, events: [], answers: {}, selectedLook: null, sale: null };
    session.lastAt = event.at;
    session.events.push(event);
    if (event.type === "answer_selected" && event.payload?.step) session.answers[event.payload.step] = event.payload.value;
    if (event.type === "look_selected") session.selectedLook = event.payload;
    if (event.type === "sale_logged") session.sale = event.payload;
    sessions.set(event.sessionId, session);
  }
  return {
    totals: {
      sessions: sessions.size,
      renders: counts.render_completed || 0,
      whatsapp: counts.whatsapp_clicked || 0,
      sales: counts.sale_logged || 0,
    },
    counts,
    sessions: [...sessions.values()].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt)),
    lastEventAt: events.at(-1)?.at || null,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/health" && req.method === "GET") {
    return send(req, res, 200, {
      ok: true,
      service: "LLinen Earth Local Memory Bridge",
      version: 1,
      port: PORT,
      dataDirectory: DATA_DIR,
    });
  }

  if (!authorized(req)) return send(req, res, 401, { error: "Pairing token required." });

  try {
    if (url.pathname === "/events" && req.method === "POST") {
      const event = safeEvent(await readJson(req));
      if (!event) return send(req, res, 400, { error: "Invalid event." });
      await appendFile(dayFile(new Date(event.at)), `${JSON.stringify(event)}\n`, "utf8");
      return send(req, res, 201, { ok: true, stored: event.id });
    }

    if (url.pathname === "/summary" && req.method === "GET") {
      const events = await loadRecentEvents(Number(url.searchParams.get("days") || 30));
      const summary = aggregate(events);
      return send(req, res, 200, { ok: true, dataDirectory: DATA_DIR, ...summary });
    }

    if (url.pathname === "/records" && req.method === "GET") {
      const events = await loadRecentEvents(Number(url.searchParams.get("days") || 30));
      const summary = aggregate(events);
      return send(req, res, 200, { ok: true, sessions: summary.sessions.slice(0, 250) });
    }

    if (url.pathname === "/backup" && req.method === "POST") {
      const events = await loadRecentEvents(3650);
      const summary = aggregate(events);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = path.join(BACKUPS_DIR, `llinen-earth-memory-${stamp}.json`);
      await writeFile(file, JSON.stringify({ createdAt: new Date().toISOString(), events, summary }, null, 2), "utf8");
      return send(req, res, 201, { ok: true, file });
    }

    return send(req, res, 404, { error: "Not found." });
  } catch (error) {
    return send(req, res, 500, { error: error instanceof Error ? error.message : "Local bridge error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log("\nLLinen Earth Local Memory Bridge");
  console.log("--------------------------------");
  console.log(`Running: http://${HOST}:${PORT}`);
  console.log(`Data:    ${DATA_DIR}`);
  console.log(`Token:   ${TOKEN}`);
  console.log("\nKeep this terminal open while the operator dashboard is using the local vault.");
  console.log("Set LLINEN_LOCAL_BRIDGE_TOKEN to keep the same token between restarts.\n");
});
