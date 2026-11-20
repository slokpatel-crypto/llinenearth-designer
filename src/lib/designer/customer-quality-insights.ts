/**
 * Operator-only, read-only roadmap outcome intelligence.
 * Real delivered-garment outcomes are not new votes for Designer ranking.
 * Count unique orders with latest, unambiguously reviewed outcome and matching
 * immutable garment lineage; never emit customer notes, IDs or measurements.
 */
import {
  type CustomerOutcomeEvidenceRow,
  type CustomerOutcomePolicyRow,
  type CustomerOutcomeReviewRow,
} from "./customer-outcome-learning.ts";
import { PRODUCTION_LEARNING_CONTEXT_VERSION } from "./production-learning-context.ts";
import { CUSTOMER_OUTCOME_RATINGS, CUSTOMER_FIT_RESULTS } from "./customer-production-outcomes.ts";

export const CUSTOMER_INSIGHT_RPC_LIMITS = { outcomes: 1000, reviews: 5000, policies: 100 } as const;
export type QualityDimension = "Shirt fit" | "Trouser shape" | "Occasion";
export type QualityCohort = Readonly<{
  dimension: QualityDimension;
  value: string;
  orders: number;
  worn: number;
  cleanFirstFit: number;
  minorAlterations: number;
  majorAlterations: number;
  needsWork: number;
}>;

export type CustomerQualityInsights = Readonly<{
  reportedOutcomes: number;
  reviewedUniqueOrders: number;
  approvedWithLineage: number;
  verifiedWornFit: number;
  excluded: Readonly<{ unreviewed: number; rejected: number; invalidLineage: number; invalidData: number; ambiguous: number }>;
  ratings: Readonly<{ love: number; good: number; needs_work: number }>;
  fits: Readonly<{ clean_first_fit: number; minor_alteration: number; major_alteration: number }>;
  cohorts: readonly QualityCohort[];
  humanMinimum: number | null;
  sampleLimited: boolean;
  gate: "incomplete_snapshot" | "no_human_policy" | "collecting" | "review_only";
}>;

type Row = Record<string, unknown>;
type ValidContext = { shirtFit: string; trouserShape: string; occasion: string };
function record(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}
function timestamp(value: unknown): number | null {
  if (typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
function category(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 90 ||
    /[^a-zA-Z0-9 _/().,+-]/.test(value)) return null;
  return value;
}
function lineage(outcome: CustomerOutcomeEvidenceRow): ValidContext | null {
  const source = record(outcome.learning_context);
  if (!source || source.version !== PRODUCTION_LEARNING_CONTEXT_VERSION ||
    source.revisionId !== outcome.revision_id ||
    typeof source.recipeHash !== "string" || !/^[a-f0-9]{64}$/i.test(source.recipeHash)) return null;
  const fabrics = record(source.fabrics);
  const shirt = record(source.shirt);
  const trouser = record(source.trouser);
  const context = record(source.context);
  if (!fabrics || typeof fabrics.shirtId !== "string" || fabrics.shirtId.length < 2 ||
    typeof fabrics.trouserId !== "string" || fabrics.trouserId.length < 2 ||
    !shirt || !trouser || !context) return null;
  const shirtFit = category(shirt.fit);
  const trouserShape = category(trouser.shape);
  const occasion = category(context.occasion);
  return shirtFit && trouserShape && occasion ? { shirtFit, trouserShape, occasion } : null;
}
function validOutcome(outcome: CustomerOutcomeEvidenceRow): boolean {
  return typeof outcome.outcome_id === "string" && outcome.outcome_id.length > 0 &&
    typeof outcome.order_id === "string" && outcome.order_id.length > 0 &&
    typeof outcome.revision_id === "string" && outcome.revision_id.length > 0 &&
    CUSTOMER_OUTCOME_RATINGS.some(x => x === outcome.overall_rating) &&
    CUSTOMER_FIT_RESULTS.some(x => x === outcome.fit_result) &&
    typeof outcome.worn_confirmed === "boolean" &&
    (outcome.worn_confirmed || outcome.fit_result === "not_checked");
}
type Latest<T> = { row: T; time: number; ambiguous: boolean };

/** Latest evidence wins, not a stale approval; equal-time conflicts fail closed. */
export function summarizeCustomerQualityInsights(
  outcomes: readonly CustomerOutcomeEvidenceRow[],
  reviews: readonly CustomerOutcomeReviewRow[],
  policies: readonly CustomerOutcomePolicyRow[],
): CustomerQualityInsights {
  const sampleLimited = outcomes.length >= CUSTOMER_INSIGHT_RPC_LIMITS.outcomes ||
    reviews.length >= CUSTOMER_INSIGHT_RPC_LIMITS.reviews ||
    policies.length >= CUSTOMER_INSIGHT_RPC_LIMITS.policies;
  const newestByOrder = new Map<string, Latest<CustomerOutcomeEvidenceRow>>();
  let invalidRows = 0;
  for (const outcome of outcomes) {
    if (!validOutcome(outcome) || timestamp(outcome.created_at) === null) { invalidRows++; continue; }
    const at = timestamp(outcome.created_at)!;
    const current = newestByOrder.get(outcome.order_id);
    if (!current || at > current.time) newestByOrder.set(outcome.order_id, { row: outcome, time: at, ambiguous: false });
    else if (at === current.time && (outcome.outcome_id !== current.row.outcome_id ||
        outcome.revision_id !== current.row.revision_id)) current.ambiguous = true;
  }
  const newestReview = new Map<string, Latest<CustomerOutcomeReviewRow>>();
  const blockedReviews = new Set<string>();
  for (const review of reviews) {
    if (typeof review.outcome_id !== "string" || !review.outcome_id) continue;
    const at = timestamp(review.created_at);
    if (at === null || (review.decision !== "approved" && review.decision !== "rejected")) {
      blockedReviews.add(review.outcome_id);
      continue;
    }
    const current = newestReview.get(review.outcome_id);
    if (!current || at > current.time) newestReview.set(review.outcome_id, { row: review, time: at, ambiguous: false });
    else if (at === current.time && (review.review_id !== current.row.review_id || review.decision !== current.row.decision))
      current.ambiguous = true;
  }
  let newestPolicy: Latest<CustomerOutcomePolicyRow> | null = null;
  for (const policy of policies) {
    const at = timestamp(policy.created_at);
    if (at === null || !Number.isInteger(policy.minimum_approved_cases) || policy.minimum_approved_cases < 1 ||
      policy.minimum_approved_cases > 10000 || typeof policy.approved_by !== "string" ||
      policy.approved_by.trim().length < 2) continue;
    if (!newestPolicy || at > newestPolicy.time) newestPolicy = { row: policy, time: at, ambiguous: false };
    else if (at === newestPolicy.time && policy.policy_id !== newestPolicy.row.policy_id)
      newestPolicy.ambiguous = true;
  }
  const humanMinimum = newestPolicy && !newestPolicy.ambiguous ? newestPolicy.row.minimum_approved_cases : null;
  const excluded = { unreviewed: 0, rejected: 0, invalidLineage: 0, invalidData: invalidRows, ambiguous: 0 };
  const ratings = { love: 0, good: 0, needs_work: 0 };
  const fits = { clean_first_fit: 0, minor_alteration: 0, major_alteration: 0 };
  const groups = new Map<string, QualityCohort>();
  let reviewedUniqueOrders = 0, approvedWithLineage = 0, verifiedWornFit = 0;
  for (const {row: outcome, ambiguous} of newestByOrder.values()) {
    if (ambiguous) { excluded.ambiguous++; continue; }
    const review = newestReview.get(outcome.outcome_id);
    if (blockedReviews.has(outcome.outcome_id) || review?.ambiguous) { excluded.ambiguous++; continue; }
    if (!review) { excluded.unreviewed++; continue; }
    reviewedUniqueOrders++;
    if (review.row.decision === "rejected") { excluded.rejected++; continue; }
    const context = lineage(outcome);
    if (!context) { excluded.invalidLineage++; continue; }
    approvedWithLineage++;
    ratings[outcome.overall_rating as keyof typeof ratings]++;
    const worn = outcome.worn_confirmed && outcome.fit_result !== "not_checked";
    if (worn) {
      verifiedWornFit++;
      fits[outcome.fit_result as keyof typeof fits]++;
    }
    const dimensions: [QualityDimension, string][] = [
      ["Shirt fit", context.shirtFit],
      ["Trouser shape", context.trouserShape],
      ["Occasion", context.occasion],
    ];
    for (const [dimension, value] of dimensions) {
      const key = dimension + "\u0000" + value;
      const prior = groups.get(key) || {dimension, value, orders:0, worn:0, cleanFirstFit:0,
        minorAlterations:0, majorAlterations:0, needsWork:0};
      groups.set(key, {
        ...prior, orders: prior.orders+1, worn: prior.worn+Number(worn),
        cleanFirstFit: prior.cleanFirstFit+Number(worn && outcome.fit_result === "clean_first_fit"),
        minorAlterations: prior.minorAlterations+Number(worn && outcome.fit_result === "minor_alteration"),
        majorAlterations: prior.majorAlterations+Number(worn && outcome.fit_result === "major_alteration"),
        needsWork: prior.needsWork+Number(outcome.overall_rating === "needs_work"),
      });
    }
  }
  const cohorts = [...groups.values()].sort((a,b)=>
    a.dimension.localeCompare(b.dimension) || b.orders-a.orders || a.value.localeCompare(b.value));
  const gate = sampleLimited ? "incomplete_snapshot" : humanMinimum === null ? "no_human_policy" :
    approvedWithLineage < humanMinimum ? "collecting" : "review_only";
  return { reportedOutcomes: outcomes.length, reviewedUniqueOrders, approvedWithLineage,
    verifiedWornFit, excluded, ratings, fits, cohorts, humanMinimum, sampleLimited, gate };
}
