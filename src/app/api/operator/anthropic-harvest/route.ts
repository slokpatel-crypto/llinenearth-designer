import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig } from "@/lib/supabase-admin";
import { appendCreativeEvent } from "@/lib/designer/creative-profile-server";
// @ts-ignore -- shared, pure operational ESM module deliberately has no TS declaration
import { KNOWLEDGE_PACKS, harvestOnePack } from "../../../../../scripts/harvest-anthropic-knowledge.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Operator-only, one pack per authenticated request. A durable daily claim
 * prevents repeated clicks or concurrent serverless instances from purchasing
 * the same pack more than once per UTC day. Claims stay consumed on failure.
 */
export async function POST(request: Request) {
  const jar = await cookies();
  if (!(await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))) {
    return NextResponse.json({ error: "Operator login required." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origin mismatch." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") || "0") > 800) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415, headers: { "cache-control": "no-store" } });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "No Anthropic key is configured in this server environment." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!getSupabaseAdminConfig()) {
    return NextResponse.json({ error: "Durable spend ledger is not configured." }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  let packId: string;
  try {
    const body = await request.json() as { packId?: unknown };
    if (typeof body.packId !== "string") return NextResponse.json({ error: "Select one research pack." }, { status: 400, headers: { "cache-control": "no-store" } });
    packId = body.packId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const pack = KNOWLEDGE_PACKS.find((item: { id: string }) => item.id === packId);
  if (!pack) return NextResponse.json({ error: "Unknown research pack." }, { status: 400, headers: { "cache-control": "no-store" } });

  const day = new Date().toISOString().slice(0, 10);
  const runId = "EV-CLAUDE-HARVEST-" + day + "-" + pack.id;
  try {
    const claim = await appendCreativeEvent("operator_note", {
      subtype: "anthropic_harvest_job",
      packId: pack.id,
      status: "claimed",
      runId,
      reviewStatus: "unreviewed",
      physicalEvidenceVerified: false,
    }, { id: runId, source: "operator", session: "anthropic-harvest" });
    if (claim.duplicate) {
      return NextResponse.json({
        error: "This research pack already has a spend claim for today. No duplicate request was sent.",
        packId: pack.id,
        status: "already_claimed",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
  } catch {
    return NextResponse.json({ error: "Could not create the durable spend claim; no provider request was sent." }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  try {
    const { entries, usage } = await harvestOnePack(pack, key, model);
    const result = {
      schemaVersion: 1,
      id: pack.id,
      objective: pack.objective,
      source: "ai-generated-suggestions" as const,
      reviewStatus: "unreviewed" as const,
      physicalEvidenceVerified: false as const,
      model,
      createdAt: new Date().toISOString(),
      entries,
      usage: { inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null },
    };
    await appendCreativeEvent("operator_note", {
      subtype: "anthropic_harvest_result",
      packId: pack.id,
      runId,
      status: "pending_human_review",
      ...result,
    }, { id: runId + "-result", source: "operator", session: "anthropic-harvest" });
    return NextResponse.json({ ...result, persistence: "saved_unreviewed", runId }, {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch (error) {
    // Provider and persistence errors may contain sensitive account information.
    console.error("[operator/anthropic-harvest] Research pack failed", JSON.stringify({
      packId: pack.id,
      errorType: error instanceof Error ? error.name : "unknown",
      runId,
      spendClaimRetained: true,
    }));
    return NextResponse.json({
      error: "Harvest failed or could not be persisted. No pack was approved; today's claim remains consumed to prevent duplicate billing.",
      packId: pack.id,
      runId,
    }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
