import { NextResponse } from "next/server";

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
]);

function authorized(request: Request) {
  const configured = process.env.LLINEN_OPERATOR_SYNC_TOKEN;
  if (!configured) return false;
  const supplied = request.headers.get("authorization");
  return supplied === `Bearer ${configured}`;
}

function cloudConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
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

  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  if (JSON.stringify(payload).length > 16_000) return null;

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

  const cloud = cloudConfig();
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
        apikey: cloud.key,
        authorization: `Bearer ${cloud.key}`,
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

  const cloud = cloudConfig();
  if (!cloud) {
    return NextResponse.json({ error: "Cloud memory is not configured." }, { status: 503 });
  }

  const incomingUrl = new URL(request.url);
  const cursor = incomingUrl.searchParams.get("cursor");
  const limit = Math.min(1000, Math.max(1, Number(incomingUrl.searchParams.get("limit") || 500)));

  const params = new URLSearchParams({
    select: "id,session_id,type,at,source,payload,received_at",
    order: "received_at.asc",
    limit: String(limit),
  });
  if (cursor) params.set("received_at", `gt.${cursor}`);

  try {
    const response = await fetch(
      `${cloud.url}/rest/v1/style_events?${params.toString()}`,
      {
        headers: {
          apikey: cloud.key,
          authorization: `Bearer ${cloud.key}`,
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
      nextCursor: rows.at(-1)?.received_at || cursor || null,
      hasMore: rows.length === limit,
    });
  } catch (error) {
    console.error("[operator/sync GET]", error);
    return NextResponse.json({ error: "Cloud sync is temporarily unavailable." }, { status: 500 });
  }
}
