import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { legacyBrandIdentifier, readBrandEnv } from "@/lib/runtime-compat";
import {parseOperatorSyncPage,validOperatorSyncId,validOperatorSyncSession,validOperatorSyncTimestamp,validOperatorLocalDate,validOperatorLocalDateTime,operatorSyncNumber,readOperatorSyncBatch,OperatorSyncBatchError,validateOperatorSyncReadRows} from "@/lib/operator-sync-integrity";

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
  "payment_logged",
  "appointment_updated",
]);

function authorized(request: Request) {
  const configured = readBrandEnv("LINEN_OPERATOR_SYNC_TOKEN");
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
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string,unknown> : {};

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
      automatic: payload.automatic === true,
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
    const status = payload.status;
    if (typeof status!=="string" || !["new","contacted","visit-booked","won","lost","follow-up"].includes(status)) return null;
    return { status };
  }

  if (type === "order_status_changed") {
    const status = payload.status;
    if (typeof status!=="string" || !["quoted","measurement","deposit","cutting","tailoring","trial","ready","collected","cancelled"].includes(status)) return null;
    const dueDate = payload.dueDate == null ? "" : payload.dueDate;
    if (typeof dueDate!=="string" || (dueDate && !validOperatorLocalDate(dueDate))) return null;
    const orderValue = payload.orderValue == null ? null : operatorSyncNumber(payload.orderValue,0,100_000_000);
    if (payload.orderValue != null && orderValue === null) return null;
    return { status, dueDate, note: text(payload.note, 1000), orderValue };
  }

  if (type === "visit_logged") {
    return { status: "visited" };
  }

  if (type === "sale_logged") {
    const amount = operatorSyncNumber(payload.amount,0,100_000_000);
    if (amount === null) return null;
    return { amount, currency: "INR" };
  }

  if (type === "operator_note") {
    return { note: text(payload.note, 1000) };
  }

  if (type === "measurements_updated") {
    const unit = payload.unit;
    if (unit !== "in" && unit !== "cm") return null;
    const raw = payload.measurements && typeof payload.measurements === "object" && !Array.isArray(payload.measurements)
      ? payload.measurements as Record<string,unknown>
      : null;
    if (!raw) return null;
    const allowed = new Set(["neck","chest","waist","seat","shoulder","sleeve","shirtLength","trouserWaist","outseam","inseam","thigh","bottom"]);
    const max = unit === "cm" ? 300 : 120;
    const measurements: Record<string,number> = {};

    for (const [key, rawValue] of Object.entries(raw)) {
      if (!allowed.has(key)) return null;
      const value = operatorSyncNumber(rawValue,0,max);
      if (value === null || value <= 0) return null;
      measurements[key] = Math.round(value * 100) / 100;
    }
    if (!Object.keys(measurements).length) return null;
    return { unit, measurements, note: text(payload.note, 1000) };
  }

  if (type === "payment_logged") {
    const amount = operatorSyncNumber(payload.amount,0,100_000_000);
    const method = payload.method;
    if (amount === null || amount <= 0) return null;
    if (typeof method!=="string" || !["cash","upi","card","bank","other"].includes(method)) return null;
    return {
      amount: Math.round(amount * 100) / 100,
      currency: "INR",
      method,
      note: text(payload.note, 500),
    };
  }

  if (type === "appointment_updated") {
    const kind = payload.kind;
    const status = payload.status;
    const dateTime = payload.dateTime == null ? "" : payload.dateTime;
    if (typeof dateTime !== "string") return null;
    if (typeof kind!=="string" || !["consultation","fitting","trial","pickup","delivery"].includes(kind)) return null;
    if (typeof status!=="string" || !["scheduled","completed","cancelled"].includes(status)) return null;
    if ((status === "scheduled" || dateTime) && !validOperatorLocalDateTime(dateTime)) return null;
    return {
      kind,
      status,
      dateTime,
      note: text(payload.note, 600),
    };
  }

  return null;
}

function cleanOperatorEvent(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const body = input as Record<string,unknown>;
  const id = body.id;
  const sessionId = body.sessionId ?? body.session_id;
  const type = body.type;
  if (!validOperatorSyncId(id) || !validOperatorSyncSession(sessionId) ||
      typeof type !== "string" || !OPERATOR_EVENT_TYPES.has(type) ||
      !validOperatorSyncTimestamp(body.at)) return null;
  const parsed = new Date(body.at);

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
    const incoming = await readOperatorSyncBatch(request);
    const events = incoming.map(cleanOperatorEvent);
    if (events.some((event) => !event)) {
      return NextResponse.json({error:"Operator sync batch contains invalid events."},{status:400});
    }
    const ids=events.map((event)=>event!.id);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({error:"Operator sync batch contains duplicate event IDs."},{status:400});
    }
    if (!events.length) return NextResponse.json({accepted:0,stored:0});

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

    // ignore-duplicates does not report how many existing IDs were inserted.
    return NextResponse.json({ accepted: events.length, acknowledged: events.length, stored: null });
  } catch (error) {
    if(error instanceof OperatorSyncBatchError)
      return NextResponse.json({error:error.message},{status:error.status});
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
      const callSchemaVersion = (rpcName:string) => fetch(`${cloud.url}/rest/v1/rpc/${rpcName}`, {
        method: "POST",
        headers: {
          ...supabaseAdminHeaders(cloud),
          "content-type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      let response = await callSchemaVersion("linen_cloud_schema_version");
      if (!response.ok && response.status === 404) {
        response = await callSchemaVersion(legacyBrandIdentifier("linen_cloud_schema_version"));
      }

      if (!response.ok) {
        console.error("[operator/sync health]", response.status, (await response.text()).slice(0,300));
        return NextResponse.json(
          { error: "Cloud schema is not ready. Apply the latest Supabase migration.", paired: true, cloudConfigured: true },
          { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
        );
      }

      const version:unknown = await response.json();
      if (typeof version !== "number" || version !== 5) {
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

  const page=parseOperatorSyncPage(incomingUrl);
  if(!page) return NextResponse.json({error:"Invalid operator sync cursor or limit."},{status:400,headers:{"cache-control":"private, no-store"}});
  const {limit,cursor}=page;

  const params = new URLSearchParams({
    select: "id,session_id,type,at,source,payload,received_at",
    order: "received_at.asc,id.asc",
    limit: String(limit),
  });

  if (cursor) {
    if (cursor.id !== null) {
      params.set("or", `(received_at.gt.${cursor.receivedAt},and(received_at.eq.${cursor.receivedAt},id.gt.${cursor.id}))`);
    } else {
      // Backward compatibility with the first desktop builds, which stored only received_at.
      params.set("received_at", `gt.${cursor.receivedAt}`);
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

    const rows=validateOperatorSyncReadRows(await response.json(),limit);
    if(!rows) return NextResponse.json({error:"Cloud sync returned malformed event rows."},{status:502,headers:{"cache-control":"private, no-store"}});

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
    },{headers:{"cache-control":"private, no-store"}});
  } catch (error) {
    console.error("[operator/sync GET]", error);
    return NextResponse.json({ error: "Cloud sync is temporarily unavailable." }, { status: 500 });
  }
}
