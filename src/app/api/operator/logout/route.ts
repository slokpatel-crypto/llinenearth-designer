import { NextResponse } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/operator-session";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-site operator logout is not allowed." },
      { status: 403, headers: { "cache-control": "private, no-store, max-age=0" } },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("cache-control", "private, no-store, max-age=0");
  response.headers.set("pragma", "no-cache");
  response.cookies.set(OPERATOR_COOKIE.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
