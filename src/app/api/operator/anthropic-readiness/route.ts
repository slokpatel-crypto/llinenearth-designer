import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Operator-only diagnostic. No model invocation or secret exposure.
export async function GET(request: NextRequest) {
  const expected = process.env.LLINEN_OPERATOR_SYNC_TOKEN;
  const supplied = request.headers.get("x-linen-operator-token");
  if (!expected || !supplied || supplied.length !== expected.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const crypto = await import("node:crypto");
  if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    provider: "anthropic",
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    readyForProbe: Boolean(process.env.ANTHROPIC_API_KEY),
    note: "Presence only; no API request or credit consumption."
  }, { headers: { "Cache-Control": "no-store" } });
}
