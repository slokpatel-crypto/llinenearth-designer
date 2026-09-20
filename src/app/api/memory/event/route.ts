import { NextResponse } from "next/server";

const ALLOWED_TYPES = new Set([
  "session_started","answer_selected","looks_generated","look_selected",
  "render_requested","render_completed","whatsapp_clicked",
  "visit_logged","sale_logged","operator_note",
]);

type IncomingEvent = {
  id?: string;
  sessionId?: string;
  type?: string;
  at?: string;
  source?: string;
  payload?: Record<string,unknown>;
};

const registry = (globalThis as typeof globalThis & { __llinenMemoryRate?: Map<string,{at:number,count:number}> }).__llinenMemoryRate
  ||= new Map<string,{at:number,count:number}>();

function rateLimit(request:Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = registry.get(ip);
  if (!current || now-current.at > 60_000) { registry.set(ip,{at:now,count:1}); return false; }
  current.count += 1;
  return current.count > 90;
}

function clean(body:IncomingEvent) {
  const type = String(body.type || "");
  const sessionId = String(body.sessionId || "").slice(0,140);
  if (!ALLOWED_TYPES.has(type) || !sessionId) return null;
  return {
    id:String(body.id || `EV-${Date.now()}`).slice(0,160),
    session_id:sessionId,
    type,
    at:new Date(body.at || Date.now()).toISOString(),
    source:String(body.source || "style-director").slice(0,40),
    payload:body.payload && typeof body.payload === "object" ? body.payload : {},
  };
}

export async function POST(request:Request) {
  if (rateLimit(request)) return NextResponse.json({error:"Too many memory events."},{status:429});
  try {
    const event = clean(await request.json() as IncomingEvent);
    if (!event) return NextResponse.json({error:"Invalid memory event."},{status:400});

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({stored:false,provider:"not_configured"},{status:202});
    }

    const response = await fetch(`${url.replace(/\/$/,"")}/rest/v1/style_events`,{
      method:"POST",
      headers:{
        apikey:key,
        authorization:`Bearer ${key}`,
        "content-type":"application/json",
        prefer:"return=minimal,resolution=ignore-duplicates",
      },
      body:JSON.stringify(event),
      cache:"no-store",
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0,300);
      console.error("[memory/event] Supabase write failed",response.status,detail);
      return NextResponse.json({error:"Cloud memory is temporarily unavailable."},{status:502});
    }
    return NextResponse.json({stored:true,provider:"supabase"});
  } catch (error) {
    console.error("[memory/event]",error);
    return NextResponse.json({error:"Unable to record memory event."},{status:500});
  }
}
