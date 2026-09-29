import { CROSS_GARMENT_RULES } from "./rules.ts";
import type { CrossGarmentRuleContext, CrossGarmentRuleResult } from "./types.ts";

export function evaluateCrossGarmentRules(context:CrossGarmentRuleContext):CrossGarmentRuleResult[] {
  return CROSS_GARMENT_RULES
    .filter((rule)=>rule.appliesWhen(context))
    .map((rule)=>({
      ruleId:rule.id,
      effect:rule.effect,
      severity:rule.severity,
      explanation:rule.explanation(context),
      provenance:rule.provenance,
      reviewStatus:rule.reviewStatus,
    }));
}
