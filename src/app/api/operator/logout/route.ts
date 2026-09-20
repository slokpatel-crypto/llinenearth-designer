import { NextResponse } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/operator-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OPERATOR_COOKIE.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
