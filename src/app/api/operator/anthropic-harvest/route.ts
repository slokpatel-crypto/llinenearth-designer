import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
// @ts-ignore -- shared operational ESM module
import { KNOWLEDGE_PACKS, harvestOnePack } from "../../../../../scripts/harvest-anthropic-knowledge.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const jar = await cookies();
  if (!(await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))) {
    return NextResponse.json({ error: "Operator login required." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origin mismatch." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") || "0") > 800) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "No Anthropic key is configured in this server environment." }, { status: 503 });
  let packId = "unknown-pack";
  try {
    const body = await request.json() as { packId?: unknown };
    if (typeof body.packId !== "string") return NextResponse.json({ error: "Select one research pack." }, { status: 400 });
    packId = body.packId;
    const pack = KNOWLEDGE_PACKS.find((item: { id: string }) => item.id === packId);
    if (!pack) return NextResponse.json({ error: "Unknown research pack." }, { status: 400 });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
    const { entries, usage } = await harvestOnePack(pack, key, model);
    return NextResponse.json({
      schemaVersion: 1, id: pack.id, objective: pack.objective,
      source: "ai-generated-suggestions", reviewStatus: "unreviewed",
      physicalEvidenceVerified: false, model, createdAt: new Date().toISOString(),
      entries, usage: { inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null },
    }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const safeMessage = /Anthropic returned HTTP (400|401|403|404|413|429|500|502|503|529) for [a-z0-9-]+/.test(raw)
      ? raw
      : /Claude did not return a JSON object|Missing entries|Entry count must be 8-12|Malformed entry|Duplicate\/unsafe entry id|Unsafe evidence level/.test(raw)
        ? raw
        : /Invalid field length: (id|guideline|reason|applicableWhen|verifyWith|riskIfWrong|evidenceLevel)/.test(raw)
          ? raw
          : "Network timeout or unexpected response; inspect recent Vercel function logs.";
    console.error("[operator/anthropic-harvest] failed", JSON.stringify({ packId, diagnostic: safeMessage }));
    return NextResponse.json({ error: safeMessage + " No pack was approved." }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
