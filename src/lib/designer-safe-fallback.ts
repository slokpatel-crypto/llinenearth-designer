import "server-only";

import type { DesignerBrief } from "@/lib/designer-types";
import {
  approveHumanFallback,
  evaluateStockPairByIds,
  SHIRT_PANT_RULESET_VERSION,
  type StockPairingEvaluation,
} from "@/lib/shirt-pant-designer";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

type ReviewRow = {
  at: string;
  payload?: Record<string,unknown>;
};

function safe(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function hasBlockingRule(evaluation: StockPairingEvaluation) {
  return evaluation.rules.some((rule) => rule.status === "warn" && rule.penalty === "high");
}

export async function findApprovedSafeFallback(
  brief: DesignerBrief,
  primary: StockPairingEvaluation | null,
): Promise<StockPairingEvaluation | null> {
  if (!primary?.needsHumanFallback) return null;

  const cloud = getSupabaseAdminConfig();
  if (!cloud) return null;

  try {
    const params = new URLSearchParams({
      select: "at,payload",
      type: "eq.operator_note",
      source: "eq.operator",
      order: "at.desc",
      limit: "250",
    });

    const response = await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`, {
      headers: {
        ...supabaseAdminHeaders(cloud),
        accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[designer/fallback] review lookup failed", response.status);
      return null;
    }

    const rows = await response.json() as ReviewRow[];
    const seenPairings = new Set<string>();
    const approved: StockPairingEvaluation[] = [];

    for (const row of rows) {
      const payload = row.payload || {};
      if (safe(payload.subtype, 80) !== "designer_pairing_review") continue;
      if (safe(payload.rulesVersion, 80) !== SHIRT_PANT_RULESET_VERSION) continue;
      if (safe(payload.occasionBand, 40) !== primary.occasionBand) continue;

      const pairingId = safe(payload.pairingId, 220);
      if (!pairingId || seenPairings.has(pairingId)) continue;
      seenPairings.add(pairingId);

      if (safe(payload.decision, 40) !== "safe_fallback") continue;

      const shirtId = safe(payload.shirtId, 140);
      const trouserId = safe(payload.trouserId, 140);
      if (!shirtId || !trouserId) continue;

      const evaluation = evaluateStockPairByIds(brief, shirtId, trouserId);
      if (!evaluation || hasBlockingRule(evaluation)) continue;
      approved.push(approveHumanFallback(evaluation));
    }

    approved.sort((a,b) => b.confidenceScore - a.confidenceScore || a.id.localeCompare(b.id));
    return approved[0] || null;
  } catch (error) {
    console.error("[designer/fallback] review lookup failed", error);
    return null;
  }
}
