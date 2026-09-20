import { NextResponse } from "next/server";
import { createOperatorSession, OPERATOR_COOKIE } from "@/lib/operator-session";
import { verifyOperatorPassword } from "@/lib/operator-password";

export const runtime = "nodejs";

const registry = (globalThis as typeof globalThis & {
  __llinenOperatorLoginRate?: Map<string,{at:number;count:number}>
}).__llinenOperatorLoginRate ||= new Map<string,{at:number;count:number}>();

function blocked(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = registry.get(ip);
  if (!current || now - current.at > 15 * 60_000) {
    registry.set(ip, { at: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 8;
}

export async function POST(request: Request) {
  if (blocked(request)) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  if (!process.env.LLINEN_OPERATOR_PASSWORD_HASH || !process.env.LLINEN_OPERATOR_SESSION_SECRET) {
    return NextResponse.json({ error: "Operator authentication is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json() as { password?: string };
    const password = String(body.password || "").slice(0, 300);
    if (!verifyOperatorPassword(password)) {
      return NextResponse.json({ error: "Incorrect operator password." }, { status: 401 });
    }

    const session = await createOperatorSession();
    if (!session) {
      return NextResponse.json({ error: "Operator session secret is not configured securely." }, { status: 503 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(OPERATOR_COOKIE.name, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/operator",
      maxAge: OPERATOR_COOKIE.maxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 400 });
  }
}
