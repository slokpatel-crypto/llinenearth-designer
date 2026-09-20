import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATOR_EVENT_TYPES = new Set([
  "session_started",
  "answer_selected",
  "look_selected",
  "customer_updated",
  "lead_status_changed",
  "order_status_changed",
  "visit_logged",
  "sale_logged",
  "operator_note",
  "measurements_updated",
]);

function authorized(request: Request) {
  const configured = process.env.LLINEN_OPERATOR_SYNC_TOKEN?.trim();
  const supplied = request.headers.get("authorization");
  if (!configured || !supplied?.startsWith("Bearer ")) return false;
  const candidate = supplied.slice(7);
  const a = Buffer.from(configured);
  const b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(a,b);
}

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanOperatorPayload(type: string, input: unknown) {
  const payload = input && typeof input === "object" ? input as Record<string,unknown> : {};

  if (type === "session_started") {
    return {
      entry: text(payload.entry, 40),
      source: "operator-desktop",
    };
  }

  if (type === "answer_selected") {
    const step = text(payload.step, 60);
    const value = text(payload.value, 240);
    if (!step || !value) return null;
    return { step, value };
  }

  if (type === "look_selected") {
    return {
      lookId: text(payload.lookId, 120),
      title: text(payload.title, 180),
      fabricId: text(payload.fabricId, 160),
      fabric: text(payload.fabric, 220),
      automatic: Boolean(payload.automatic),
    };
  }

  if (type === "customer_updated") {
    return {
      name: text(payload.name, 120),
      phone: text(payload.phone, 40),
      note: text(payload.note, 1000),
    };
  }

  if (type === "lead_status_changed") {
    const status = text(payload.status, 40);
    if (!["new","contacted","visit-booked","won","lost","follow-up"].includes(status)) return null;
    return { status };
  }

  if (type === "order_status_changed") {
    const status = text(payload.status, 40);
    if (!["quoted","measurement","deposit","cutting","tailoring","trial","ready","collected","cancelled"].includes(status)) return null;
    const dueDate = text(payload.dueDate, 10);
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
    return { status, dueDate, note: text(payload.note, 1000) };
  }

  if (type === "visit_logged") {
    return { status: "visited" };
  }

  if (type === "sale_logged") {
    const amount = Number(payload.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null;
    return { amount, currency: "INR" };
  }

  if (type === "operator_note") {
    return { note: text(payload.note, 1000) };
  }

  if (type === "measurements_updated") {
    const unit = text(payload.unit, 2);
    if (unit !== "in" && unit !== "cm") return null;
    const raw = payload.measurements && typeof payload.measurements === "object"
      ? payload.measurements as Record<string,unknown>
      : {};
    const allowed = new Set(["neck","chest","waist","seat","shoulder","sleeve","shirtLength","trouserWaist","outseam","inseam","thigh","bottom"]);
    const max = unit === "cm" ? 300 : 120;
    const measurements: Record<string,number> = {};

    for (const [key, rawValue] of Object.entries(raw)) {
      if (!allowed.has(key)) continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value <= 0 || value > max) return null;
      measurements[key] = Math.round(value * 100) / 100;
    }
    if (!Object.keys(measurements).length) return null;
    return { unit, measurements, note: text(payload.note, 1000) };
  }

  return null;
}

function cleanOperatorEvent(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string,unknown>;
  const id = String(body.id || "").slice(0,160);
  const sessionId = String(body.sessionId || body.session_id || "").slice(0,140);
  const type = String(body.type || "");
  if (!id || !sessionId || !OPERATOR_EVENT_TYPES.has(type)) return null;

  const parsed = new Date(String(body.at || ""));
  if (Number.isNaN(parsed.getTime())) return null;

  const payload = cleanOperatorPayload(type, body.payload);
  if (!payload) return null;

  return {
    id,
    session_id: sessionId,
    type,
    at: parsed.toISOString(),
    source: "operator-desktop",
    payload,
  };
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cloud = getSupabaseAdminConfig();
  if (!cloud) {
    return NextResponse.json({ error: "Cloud memory is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json() as { events?: unknown[] };
    const incoming = Array.isArray(body.events) ? body.events.slice(0,250) : [];
    const events = incoming.map(cleanOperatorEvent).filter(Boolean);
    if (!events.length) {
      return NextResponse.json({ accepted: 0, stored: 0 });
    }

    const response = await fetch(`${cloud.url}/rest/v1/style_events`, {
      method: "POST",
      headers: {
        ...supabaseAdminHeaders(cloud),
        "content-type": "application/json",
        prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(events),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[operator/sync POST] Supabase write failed", response.status, (await response.text()).slice(0,300));
      return NextResponse.json({ error: "Cloud memory could not be updated." }, { status: 502 });
    }

    return NextResponse.json({ accepted: events.length, stored: events.length });
  } catch (error) {
    console.error("[operator/sync POST]", error);
    return NextResponse.json({ error: "Unable to upload operator events." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const incomingUrl = new URL(request.url);
  const cloud = getSupabaseAdminConfig();

  if (incomingUrl.searchParams.get("health") === "1") {
    if (!cloud) {
      return NextResponse.json(
        {
          ok: true,
          paired: true,
          cloudConfigured: false,
          mode: "bidirectional-event-sync",
          schemaVersion: null,
        },
        { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
      );
    }

    try {
      const response = await fetch(`${cloud.url}/rest/v1/rpc/llinen_cloud_schema_version`, {
        method: "POST",
        headers: {
          ...supabaseAdminHeaders(cloud),
          "content-type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });

      if (!response.ok) {
        console.error("[operator/sync health]", response.status, (await response.text()).slice(0,300));
        return NextResponse.json(
          { error: "Cloud schema is not ready. Apply the latest Supabase migration.", paired: true, cloudConfigured: true },
          { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
        );
      }

      const version = Number(await response.json());
      if (version !== 3) {
        return NextResponse.json(
          { error: `Unsupported cloud schema version ${version}.`, paired: true, cloudConfigured: true, schemaVersion: version },
          { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
        );
      }

      return NextResponse.json(
        { ok: true, paired: true, cloudConfigured: true, mode: "bidirectional-event-sync", schemaVersion: version },
        { headers: { "cache-control": "private, no-store, max-age=0" } },
      );
    } catch (error) {
      console.error("[operator/sync health]", error);
      return NextResponse.json(
        { error: "Cloud health check failed.", paired: true, cloudConfigured: true },
        { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
      );
    }
  }

  if (!cloud) {
    return NextResponse.json(
      { error: "Cloud memory is not configured." },
      { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
    );
  }

  const cursor = incomingUrl.searchParams.get("cursor");
  const limit = Math.min(1000, Math.max(1, Number(incomingUrl.searchParams.get("limit") || 500)));

  const params = new URLSearchParams({
    select: "id,session_id,type,at,source,payload,received_at",
    order: "received_at.asc,id.asc",
    limit: String(limit),
  });

  if (cursor) {
    const separator = cursor.lastIndexOf("|");
    if (separator > 0) {
      const time = cursor.slice(0, separator);
      const id = cursor.slice(separator + 1);
      params.set("or", `(received_at.gt.${time},and(received_at.eq.${time},id.gt.${id}))`);
    } else {
      // Backward compatibility with the first desktop builds, which stored only received_at.
      params.set("received_at", `gt.${cursor}`);
    }
  }

  try {
    const response = await fetch(
      `${cloud.url}/rest/v1/style_events?${params.toString()}`,
      {
        headers: {
          ...supabaseAdminHeaders(cloud),
          accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("[operator/sync GET] Supabase read failed", response.status, (await response.text()).slice(0,300));
      return NextResponse.json({ error: "Cloud memory could not be read." }, { status: 502 });
    }

    const rows = await response.json() as Array<{
      id: string;
      session_id: string;
      type: string;
      at: string;
      source: string;
      payload: Record<string, unknown>;
      received_at: string;
    }>;

    const events = rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      at: row.at,
      source: row.source,
      payload: row.payload,
      receivedAt: row.received_at,
    }));

    return NextResponse.json({
      events,
      nextCursor: rows.length
        ? `${rows.at(-1)?.received_at}|${rows.at(-1)?.id}`
        : cursor || null,
      hasMore: rows.length === limit,
    });
  } catch (error) {
    console.error("[operator/sync GET]", error);
    return NextResponse.json({ error: "Cloud sync is temporarily unavailable." }, { status: 500 });
  }
}
