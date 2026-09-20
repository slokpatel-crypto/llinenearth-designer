import { NextRequest, NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "./lib/operator-session";

function harden(response: NextResponse) {
  response.headers.set("Cache-Control","no-store, max-age=0");
  response.headers.set("Pragma","no-cache");
  response.headers.set("X-Frame-Options","DENY");
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("Referrer-Policy","no-referrer");
  response.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Content-Security-Policy","frame-ancestors 'none'");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/operator")) {
    return NextResponse.next();
  }

  if (pathname === "/operator/login") {
    return harden(NextResponse.next());
  }

  const valid = await verifyOperatorSession(request.cookies.get(OPERATOR_COOKIE.name)?.value);
  if (valid) return harden(NextResponse.next());

  const login = new URL("/operator/login", request.url);
  const next = `${pathname}${search}`;
  if (next !== "/operator") login.searchParams.set("next", next);
  return harden(NextResponse.redirect(login));
}

export const config = {
  matcher: ["/operator/:path*"],
};
