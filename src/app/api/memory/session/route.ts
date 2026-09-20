import { NextResponse } from "next/server";
import { createMemorySessionToken, memorySessionConfigured } from "@/lib/memory-session";

export const runtime = "nodejs";

const registry = (globalThis as typeof globalThis & {
  __llinenMemorySessionRate?: Map<string,{at:number;count:number}>
}).__llinenMemorySessionRate ||= new Map<string,{at:number;count:number}>();

function blocked(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = registry.get(ip);
  if (!current || now - current.at > 60_000) {
    registry.set(ip,{at:now,count:1});
    return false;
  }
  current.count += 1;
  return current.count > 40;
}

export async function POST(request: Request) {
  if (blocked(request)) {
    return NextResponse.json({error:"Too many session requests."},{status:429});
  }
  if (!memorySessionConfigured()) {
    return NextResponse.json({error:"Memory session signing is not configured."},{status:503});
  }

  try {
    const body = await request.json() as {sessionId?:string};
    const sessionId = String(body.sessionId || "");
    if (!/^LE-[A-Za-z0-9-]{8,140}$/.test(sessionId)) {
      return NextResponse.json({error:"Invalid style session."},{status:400});
    }

    const token = createMemorySessionToken(sessionId);
    if (!token) return NextResponse.json({error:"Unable to sign memory session."},{status:503});
    return NextResponse.json({token});
  } catch {
    return NextResponse.json({error:"Unable to create memory session."},{status:400});
  }
}
