import { NextResponse } from "next/server";

function authorized(request: Request) {
  const configured = process.env.LLINEN_OPERATOR_SYNC_TOKEN;
  if (!configured) return false;
  const supplied = request.headers.get("authorization");
  return supplied === `Bearer ${configured}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
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
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/style_events?${params.toString()}`,
      {
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("[operator/sync] Supabase read failed", response.status, (await response.text()).slice(0, 300));
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
    console.error("[operator/sync]", error);
    return NextResponse.json({ error: "Cloud sync is temporarily unavailable." }, { status: 500 });
  }
}
