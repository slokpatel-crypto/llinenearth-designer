import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type CloudEvent = {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  source: string;
  payload: Record<string,unknown>;
};

type Session = {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  events: CloudEvent[];
  answers: Record<string,string>;
  selectedLook: Record<string,unknown> | null;
  sale: Record<string,unknown> | null;
  customer: {name:string;phone:string;note:string};
  leadStatus: string;
  order: {status:string;dueDate:string;note:string} | null;
  measurements: {unit:string;values:Record<string,number>;note:string;at:string} | null;
};

function aggregate(events: CloudEvent[]) {
  const map = new Map<string,Session>();
  const counts:Record<string,number> = {};

  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
    const current = map.get(event.sessionId) || {
      sessionId: event.sessionId,
      firstAt: event.at,
      lastAt: event.at,
      events: [],
      answers: {},
      selectedLook: null,
      sale: null,
      customer: {name:"",phone:"",note:""},
      leadStatus: "",
      order: null,
      measurements: null,
    };

    if (event.at < current.firstAt) current.firstAt = event.at;
    if (event.at > current.lastAt) current.lastAt = event.at;
    current.events.push(event);

    if (event.type === "answer_selected" && event.payload?.step) {
      current.answers[String(event.payload.step)] = String(event.payload.value ?? "");
    }
    if (event.type === "look_selected") current.selectedLook = event.payload;
    if (event.type === "sale_logged") current.sale = event.payload;
    if (event.type === "customer_updated") {
      current.customer = {
        name: String(event.payload.name || current.customer.name || ""),
        phone: String(event.payload.phone || current.customer.phone || ""),
        note: String(event.payload.note || current.customer.note || ""),
      };
    }
    if (event.type === "lead_status_changed") {
      current.leadStatus = String(event.payload.status || "");
    }
    if (event.type === "order_status_changed") {
      current.order = {
        status: String(event.payload.status || ""),
        dueDate: String(event.payload.dueDate || ""),
        note: String(event.payload.note || ""),
      };
    }
    if (event.type === "measurements_updated") {
      const raw = event.payload.measurements;
      const values: Record<string,number> = {};
      if (raw && typeof raw === "object") {
        for (const [key,value] of Object.entries(raw as Record<string,unknown>)) {
          const number = Number(value);
          if (Number.isFinite(number)) values[key] = number;
        }
      }
      current.measurements = {
        unit: String(event.payload.unit || "in"),
        values,
        note: String(event.payload.note || ""),
        at: event.at,
      };
    }
    map.set(event.sessionId,current);
  }

  const sessions = [...map.values()]
    .map((session)=>({...session,events:session.events.sort((a,b)=>a.at.localeCompare(b.at))}))
    .sort((a,b)=>b.lastAt.localeCompare(a.lastAt));

  return {
    sessions,
    counts,
    totals: {
      sessions: sessions.length,
      renders: counts.render_completed || 0,
      whatsapp: counts.whatsapp_clicked || 0,
      sales: counts.sale_logged || 0,
    },
    lastEventAt: events.at(-1)?.at || null,
  };
}

export async function GET(request: Request) {
  const jar = await cookies();
  const valid = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cloud = getSupabaseAdminConfig();
  if (!cloud) {
    return NextResponse.json({ configured: false, ...aggregate([]) });
  }

  const incoming = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(incoming.searchParams.get("days") || 60)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const pageSize = 1000;
  const maxRows = 10_000;
  const events:CloudEvent[] = [];

  try {
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const params = new URLSearchParams({
        select: "id,session_id,type,at,source,payload,received_at",
        at: `gte.${since}`,
        order: "received_at.asc",
        limit: String(pageSize),
        offset: String(offset),
      });

      const response = await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`, {
        headers: {
          ...supabaseAdminHeaders(cloud),
          accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        console.error("[operator/cloud-summary]",response.status,(await response.text()).slice(0,300));
        return NextResponse.json({ error: "Cloud memory could not be read." }, { status: 502 });
      }

      const rows = await response.json() as Array<{
        id:string;session_id:string;type:string;at:string;source:string;payload:Record<string,unknown>;
      }>;

      for (const row of rows) {
        events.push({
          id: row.id,
          sessionId: row.session_id,
          type: row.type,
          at: row.at,
          source: row.source,
          payload: row.payload || {},
        });
      }

      if (rows.length < pageSize) break;
    }

    return NextResponse.json({
      configured: true,
      truncated: events.length >= maxRows,
      ...aggregate(events),
    });
  } catch (error) {
    console.error("[operator/cloud-summary]",error);
    return NextResponse.json({ error: "Cloud memory is temporarily unavailable." }, { status: 500 });
  }
}
