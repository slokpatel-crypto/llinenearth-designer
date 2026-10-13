import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
// @ts-ignore -- shared, pure operational ESM module deliberately has no TS declaration
import { KNOWLEDGE_PACKS, harvestOnePack } from "../../../../../scripts/harvest-anthropic-knowledge.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Operator-only, one pack per authenticated request; no public paid generation. */
export async function POST(request: Request) {
  const jar = await cookies();
  if (!(await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))) {
    return NextResponse.json({ error: "Operator login required." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origin mismatch." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") || "0") > 800) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "No Anthropic key is configured in this server environment." }, { status: 503 });
  }
  try {
    const body = await request.json() as { packId?: unknown };
    if (typeof body.packId !== "string") return NextResponse.json({ error: "Select one research pack." }, { status: 400 });
    const pack = KNOWLEDGE_PACKS.find((item: { id: string }) => item.id === body.packId);
    if (!pack) return NextResponse.json({ error: "Unknown research pack." }, { status: 400 });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
    const { entries, usage } = await harvestOnePack(pack, key, model);
    return NextResponse.json({
      schemaVersion: 1,
      id: pack.id,
      objective: pack.objective,
      source: "ai-generated-suggestions",
      reviewStatus: "unreviewed",
      physicalEvidenceVerified: false,
      model,
      createdAt: new Date().toISOString(),
      entries,
      usage: { inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null },
    }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    // Error details from providers can include sensitive account information.
    console.error("[operator/anthropic-harvest] Research pack failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Claude did not return a validated research pack. No pack was approved." }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
