import "server-only";
import type { DesignerBrief } from "@/lib/designer-types";
import type { StockPairingEvaluation } from "@/lib/shirt-pant-designer";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

function safeText(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

export async function recordPhase1Recommendation(
  brief: DesignerBrief,
  evaluation: StockPairingEvaluation | null,
  ranked: StockPairingEvaluation[] = [],
) {
  if (!evaluation || !brief.sessionId) return { stored: false, provider: "not_applicable" as const };

  const cloud = getSupabaseAdminConfig();
  if (!cloud) return { stored: false, provider: "not_configured" as const };

  const event = {
    id: `EV-DESIGNER-${crypto.randomUUID()}`.slice(0, 160),
    session_id: safeText(brief.sessionId, 140),
    type: "looks_generated",
    at: new Date().toISOString(),
    source: "style-director",
    payload: {
      experience: "designer-phase1-shirt-pant",
      rulesVersion: evaluation.rulesVersion,
      input: {
        stockId: safeText(brief.fabric.stockId, 120),
        source: safeText(brief.fabric.source, 30),
        occasion: safeText(brief.context.occasion, 100),
        venue: safeText(brief.context.venue, 100),
        time: safeText(brief.context.time, 60),
        environment: safeText(brief.context.environment, 100),
        formality: safeText(brief.context.formality, 80),
        impression: safeText(brief.context.impression, 100),
        fit: safeText(brief.context.fit, 80),
        aesthetic: safeText(brief.context.aesthetic, 100),
      },
      output: {
        pairingId: evaluation.id,
        shirtId: evaluation.shirt.id,
        shirtName: evaluation.shirt.colorName,
        shirtLine: evaluation.shirt.line,
        shirtPattern: evaluation.shirt.pattern,
        trouserId: evaluation.trouser.id,
        trouserName: evaluation.trouser.colorName,
        trouserLine: evaluation.trouser.line,
        trouserPattern: evaluation.trouser.pattern,
        confidenceScore: evaluation.confidenceScore,
        brandAffinity: evaluation.brandAffinity,
        occasionBand: evaluation.occasionBand,
        relationship: evaluation.relationship,
        forced: evaluation.forced,
        needsHumanFallback: evaluation.needsHumanFallback,
        humanApprovedFallback: Boolean(evaluation.humanApprovedFallback),
        customerReason: evaluation.customerReason,
      },
      alternatives: ranked.slice(0,3).map((item)=>({
        pairingId:item.id,
        mode:item.mode || "Primary",
        rankScore:item.rankScore ?? item.confidenceScore,
        shirtId:item.shirt.id,
        shirtName:item.shirt.colorName,
        trouserId:item.trouser.id,
        trouserName:item.trouser.colorName,
        confidenceScore:item.confidenceScore,
        relationship:item.relationship,
        customerReason:item.customerReason,
      })),
      rules: evaluation.rules.map((rule) => ({
        id: rule.id,
        status: rule.status,
        penalty: rule.penalty,
        deduction: rule.deduction,
        reason: rule.reason,
      })),
      reasoningText: evaluation.reasoningText.slice(0, 4000),
      dataWarnings: evaluation.dataWarnings.slice(0, 8).map((item) => item.slice(0, 240)),
    },
  };

  try {
    const response = await fetch(`${cloud.url}/rest/v1/style_events`, {
      method: "POST",
      headers: {
        ...supabaseAdminHeaders(cloud),
        "content-type": "application/json",
        prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(event),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      console.error("[designer/telemetry] recommendation write failed", response.status, detail);
      return { stored: false, provider: "supabase_error" as const };
    }

    return { stored: true, provider: "supabase" as const };
  } catch (error) {
    console.error("[designer/telemetry] recommendation write failed", error);
    return { stored: false, provider: "supabase_error" as const };
  }
}
