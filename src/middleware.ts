import { NextRequest, NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "./lib/operator-session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/operator") || pathname === "/operator/login") {
    return NextResponse.next();
  }

  const valid = await verifyOperatorSession(request.cookies.get(OPERATOR_COOKIE.name)?.value);
  if (valid) return NextResponse.next();

  const login = new URL("/operator/login", request.url);
  const next = `${pathname}${search}`;
  if (next !== "/operator") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/operator/:path*"],
};
