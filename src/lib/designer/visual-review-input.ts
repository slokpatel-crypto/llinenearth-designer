import type { CanonicalCreativeVisualReview } from "./garment-spec.ts";

/**
 * Client-supplied visual-review scores are untrusted evidence. Coercing
 * "100", true, null or ["pass"] can manufacture a passing review.
 * Reject malformed receipts rather than repairing their claimed proof.
 */
export function parseCanonicalCreativeVisualReview(value:unknown):CanonicalCreativeVisualReview|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Record<string,unknown>;
  if(input.status!=="pass" && input.status!=="review") return null;
  for(const field of ["heroVisibility","boundaryIntegrity","protectedChange"] as const) {
    const score=input[field];
    if(typeof score!=="number" || !Number.isFinite(score) || score<0 || score>100) return null;
  }
  if(typeof input.evidenceAvailable!=="boolean" || typeof input.semanticAvailable!=="boolean") return null;
  if(input.semanticStatus!==undefined && input.semanticStatus!=="pass" && input.semanticStatus!=="review") return null;
  if(input.semanticAvailable && input.semanticStatus===undefined) return null;
  if(input.semanticIssue!==undefined && (typeof input.semanticIssue!=="string" || input.semanticIssue.length>180)) return null;
  if(input.redesignReason!==undefined && (typeof input.redesignReason!=="string" || input.redesignReason.length>40)) return null;
  return {
    status:input.status,
    heroVisibility:input.heroVisibility as number,
    boundaryIntegrity:input.boundaryIntegrity as number,
    protectedChange:input.protectedChange as number,
    evidenceAvailable:input.evidenceAvailable,
    semanticAvailable:input.semanticAvailable,
    ...(input.semanticStatus!==undefined?{semanticStatus:input.semanticStatus as "pass"|"review"}:{}),
    ...(input.semanticIssue!==undefined?{semanticIssue:input.semanticIssue as string}:{}),
    ...(input.redesignReason!==undefined?{redesignReason:input.redesignReason as string}:{}),
  };
}
