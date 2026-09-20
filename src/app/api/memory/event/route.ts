import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { verifyMemorySessionToken } from "@/lib/memory-session";

const PUBLIC_TYPES = new Set([
  "session_started",
  "answer_selected",
  "looks_generated",
  "look_selected",
  "render_requested",
  "render_completed",
  "whatsapp_clicked",
]);

const OPERATOR_TYPES = new Set([
  "visit_logged",
  "sale_logged",
  "operator_note",
]);

type IncomingEvent = {
  id?: string;
  sessionId?: string;
  type?: string;
  at?: string;
  source?: string;
  payload?: Record<string,unknown>;
};

const registry = (globalThis as typeof globalThis & {
  __llinenMemoryRate?: Map<string,{at:number;count:number}>
}).__llinenMemoryRate ||= new Map<string,{at:number;count:number}>();

function rateLimit(request:Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = registry.get(ip);
  if (!current || now-current.at > 60_000) {
    registry.set(ip,{at:now,count:1});
    return false;
  }
  current.count += 1;
  return current.count > 90;
}

const ANSWER_STEPS = new Set(["occasion","mood","time","climate","garment","colorDirection"]);
const RENDER_MODES = new Set(["preview","photo"]);

function text(value:unknown,max=160) {
  return String(value ?? "").trim().slice(0,max);
}

function cleanPayload(type:string, input:unknown) {
  const payload = input && typeof input === "object" ? input as Record<string,unknown> : {};

  if (type === "sale_logged") {
    const amount = Number(payload.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null;
    return { amount, currency: "INR" };
  }

  if (type === "visit_logged") {
    return { status: "visited" };
  }

  if (type === "operator_note") {
    return { note: text(payload.note,1000) };
  }

  if (type === "session_started") {
    return { experience: text(payload.experience,80) || "style-director" };
  }

  if (type === "answer_selected") {
    const step = text(payload.step,40);
    const value = text(payload.value,120);
    if (!ANSWER_STEPS.has(step) || !value) return null;
    return { step, value };
  }

  if (type === "looks_generated") {
    const rawLooks = Array.isArray(payload.looks) ? payload.looks.slice(0,3) : [];
    const looks = rawLooks.map((raw)=>{
      const look = raw && typeof raw === "object" ? raw as Record<string,unknown> : {};
      return {
        id: text(look.id,120),
        title: text(look.title,120),
        fabricId: text(look.fabricId,120),
        fabric: text(look.fabric,120),
        tier: text(look.tier,40),
      };
    }).filter((look)=>look.id && look.fabricId);
    return { looks };
  }

  if (type === "look_selected") {
    const lookId = text(payload.lookId,120);
    const fabricId = text(payload.fabricId,120);
    if (!lookId || !fabricId) return null;
    return {
      lookId,
      title: text(payload.title,120),
      fabricId,
      fabric: text(payload.fabric,120),
      automatic: Boolean(payload.automatic),
    };
  }

  if (type === "render_requested") {
    const mode = text(payload.mode,20);
    if (!RENDER_MODES.has(mode)) return null;
    return {
      mode,
      lookId: text(payload.lookId,120),
      fabricId: text(payload.fabricId,120),
    };
  }

  if (type === "render_completed") {
    const mode = text(payload.mode,20);
    if (!RENDER_MODES.has(mode)) return null;
    const rawImage = text(payload.imageUrl,600);
    const imageUrl = /^https:\/\/(cdn|media)\.fashn\.ai\//i.test(rawImage) ? rawImage : undefined;
    const generated = new Date(text(payload.generatedAt,80));
    return {
      mode,
      lookId: text(payload.lookId,120),
      fabricId: text(payload.fabricId,120),
      fabric: text(payload.fabric,120),
      line: text(payload.line,160),
      provider: text(payload.provider,80),
      ...(imageUrl ? { imageUrl } : {}),
      label: text(payload.label,120),
      generatedAt: Number.isNaN(generated.getTime()) ? undefined : generated.toISOString(),
    };
  }

  if (type === "whatsapp_clicked") {
    return {
      lookId: text(payload.lookId,120),
      fabricId: text(payload.fabricId,120),
      fabric: text(payload.fabric,120),
    };
  }

  return null;
}

function clean(body:IncomingEvent, operatorAuthorized:boolean) {
  const type = String(body.type || "");
  const sessionId = String(body.sessionId || "").slice(0,140);
  const operatorType = OPERATOR_TYPES.has(type);

  if (!sessionId) return null;
  if (!PUBLIC_TYPES.has(type) && !(operatorAuthorized && operatorType)) return null;

  const parsedAt = new Date(body.at || Date.now());
  if (Number.isNaN(parsedAt.getTime())) return null;

  if (PUBLIC_TYPES.has(type)) {
    const drift = parsedAt.getTime() - Date.now();
    if (drift > 10 * 60_000 || drift < -30 * 86_400_000) return null;
  }

  const payload = cleanPayload(type,body.payload);
  if (!payload) return null;

  return {
    id:String(body.id || `EV-${Date.now()}`).slice(0,160),
    session_id:sessionId,
    type,
    at:parsedAt.toISOString(),
    source:operatorType ? "operator" : "style-director",
    payload,
  };
}

export async function POST(request:Request) {
  if (rateLimit(request)) {
    return NextResponse.json({error:"Too many memory events."},{status:429});
  }

  try {
    const body = await request.json() as IncomingEvent;
    let operatorAuthorized = false;

    if (OPERATOR_TYPES.has(String(body.type || ""))) {
      const jar = await cookies();
      operatorAuthorized = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
    }

    const event = clean(body,operatorAuthorized);
    if (!event) {
      return NextResponse.json({error:"Invalid or unauthorized memory event."},{status:operatorAuthorized?400:403});
    }

    if (PUBLIC_TYPES.has(event.type)) {
      const token = request.headers.get("x-llinen-memory-token");
      if (!verifyMemorySessionToken(event.session_id,token)) {
        return NextResponse.json({error:"Invalid memory session."},{status:403});
      }
    }

    const cloud = getSupabaseAdminConfig();
    if (!cloud) {
      return NextResponse.json({stored:false,provider:"not_configured"},{status:202});
    }

    const response = await fetch(`${cloud.url}/rest/v1/style_events`,{
      method:"POST",
      headers:{
        ...supabaseAdminHeaders(cloud),
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
