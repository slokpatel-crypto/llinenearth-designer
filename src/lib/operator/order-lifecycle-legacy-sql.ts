/**
 * Read-only compatibility audit for TITAN's proposed operator order lifecycle.
 *
 * The deployed SQL/production contract is intentionally NOT modified here.
 * Matching status labels do not imply that a production order may be written:
 * physical stock reservation, server authorization, receipts and atomic CAS
 * are not established by this pure diagnostic.
 */
import { ORDER_TRANSITIONS, canTransitionOrder, type ProductionOrderStatus } from "../designer/production-state.ts";
import {
  orderLifecycleVersionFence,
  type OrderLifecycleState, type AppliedOrderLifecycleEvent,
} from "./order-lifecycle.ts";

export type LegacySqlLifecycleGap = Readonly<{
  eventId: string;
  action: AppliedOrderLifecycleEvent["action"];
  from: AppliedOrderLifecycleEvent["from"];
  to: AppliedOrderLifecycleEvent["to"];
  reason: "unrepresented_status" | "forbidden_legacy_transition";
}>;

export type LegacySqlLifecycleReview = Readonly<{
  orderId: string;
  currentOperatorStage: OrderLifecycleState["status"];
  auditedEvents: number;
  allAuditTransitionsRepresentable: boolean;
  incompatibleEventCount: number;
  gaps: readonly LegacySqlLifecycleGap[];
  firstGap: LegacySqlLifecycleGap | null;
  productionWriteAuthorized: false;
  blocker: "sql_status_mapping_required" | "authenticated_transaction_required";
}>;

const LEGACY_STAGES = new Set<string>(Object.keys(ORDER_TRANSITIONS));

/**
 * Inspect every recorded operator transition against the actual deployed SQL
 * state graph. This never returns authorization to write a production status.
 * The first and every subsequent incompatibility give integration reviewers precise reasons.
 *
 * The reducer-created state must be trusted: do not inspect arbitrary caller
 * snapshots until restoreOrderLifecycleSnapshot verifies complete replay.
 */
export function reviewOrderLifecycleLegacySqlCompatibility(
  state: OrderLifecycleState,
): LegacySqlLifecycleReview {
  orderLifecycleVersionFence(state); // Enforces reducer-owned/replayed snapshot.
  const gaps: LegacySqlLifecycleGap[] = [];
  for (const event of state.audit) {
    let reason: LegacySqlLifecycleGap["reason"] | null = null;
    if (!LEGACY_STAGES.has(event.from) || !LEGACY_STAGES.has(event.to)) {
      reason = "unrepresented_status";
    } else if (!canTransitionOrder(
      event.from as ProductionOrderStatus, event.to as ProductionOrderStatus,
    )) {
      reason = "forbidden_legacy_transition";
    }
    if (reason) {
      gaps.push(Object.freeze({
        eventId: event.eventId, action: event.action,
        from: event.from, to: event.to, reason,
      }));
    }
  }
  // Preserve audit order and report *every* gap. A first-gap-only review
  // would hide later unrepresentable finishing, QC and dispatch requirements.
  const frozenGaps = Object.freeze(gaps);
  const firstGap = frozenGaps[0] ?? null;
  // A superficially identical transition (e.g. created -> cancelled) does not
  // prove operator identity, payment/refund policy or transactional persistence.
  return Object.freeze({
    orderId: state.orderId,
    currentOperatorStage: state.status,
    auditedEvents: state.audit.length,
    allAuditTransitionsRepresentable: frozenGaps.length === 0,
    incompatibleEventCount: frozenGaps.length,
    gaps: frozenGaps,
    firstGap,
    productionWriteAuthorized: false as const,
    blocker: frozenGaps.length === 0
      ? "authenticated_transaction_required" as const
      : "sql_status_mapping_required" as const,
  });
}
