/**
 * Isolated, deterministic operator order lifecycle proposal.
 * This is NOT a production authorization or persistence layer: an authenticated,
 * transactional backend must enforce these rules and validate evidence against
 * physical receipts before the richer states may be enabled in Production Desk.
 * No stock, payment, customer, QC or delivery claim is inferred by this module.
 */
export const ORDER_LIFECYCLE_STAGES = [
  "created", "accepted", "cutting", "stitching", "finishing", "qc_pending",
  "qc_rework", "qc_approved", "dispatched", "delivered", "cancelled", "recovery_pending",
] as const;
export type OrderLifecycleStage = typeof ORDER_LIFECYCLE_STAGES[number];

export const ORDER_LIFECYCLE_ACTIONS = [
  "accept", "start_cutting", "start_stitching", "start_finishing", "submit_qc",
  "reject_qc", "approve_qc", "start_rework", "dispatch", "deliver", "cancel",
  "hold_for_recovery", "resume_recovery",
] as const;
export type OrderLifecycleAction = typeof ORDER_LIFECYCLE_ACTIONS[number];

export const ORDER_QC_CHECKS = [
  "recipe_match", "fabric_match", "measurement_check", "pattern_alignment",
  "stitching_finish", "clean_damage_free",
] as const;
export type OrderQcCheck = typeof ORDER_QC_CHECKS[number];

export type OrderQcEvidence = Readonly<{
  inspector: string;
  inspectionReference: string;
  revisionId: string;
  recipeHash: string;
  checks: Readonly<Record<OrderQcCheck, boolean>>;
}>;

export type OrderLifecycleEvent = Readonly<{
  eventId: string;
  orderId: string;
  action: OrderLifecycleAction;
  from: OrderLifecycleStage;
  sequence: number;
  previousEventId: string | null;
  occurredAt: string;
  actor: string;
  evidenceRef: string;
  reason?: string;
  qc?: OrderQcEvidence;
}>;

export type AppliedOrderLifecycleEvent = OrderLifecycleEvent & Readonly<{
  to: OrderLifecycleStage;
}>;

export type OrderLifecycleState = Readonly<{
  orderId: string;
  revisionId: string;
  recipeHash: string;
  status: OrderLifecycleStage;
  sequence: number;
  lastEventId: string | null;
  heldFrom: OrderLifecycleStage | null;
  audit: readonly AppliedOrderLifecycleEvent[];
}>;

const NEXT: Readonly<Partial<Record<OrderLifecycleStage, Readonly<Partial<Record<OrderLifecycleAction, OrderLifecycleStage>>>>>> = {
  created: { accept: "accepted" },
  accepted: { start_cutting: "cutting" },
  cutting: { start_stitching: "stitching" },
  stitching: { start_finishing: "finishing" },
  finishing: { submit_qc: "qc_pending" },
  qc_pending: { reject_qc: "qc_rework", approve_qc: "qc_approved" },
  qc_rework: { start_rework: "stitching" },
  qc_approved: { dispatch: "dispatched" },
  dispatched: { deliver: "delivered" },
};
const CANCELLABLE = new Set<OrderLifecycleStage>([
  "created", "accepted", "cutting", "stitching", "finishing", "qc_pending",
  "qc_rework", "qc_approved", "recovery_pending",
]);
const RECOVERABLE = new Set<OrderLifecycleStage>([
  "accepted", "cutting", "stitching", "finishing", "qc_pending", "qc_rework", "qc_approved",
]);
const STAGES = new Set<string>(ORDER_LIFECYCLE_STAGES);
const ACTIONS = new Set<string>(ORDER_LIFECYCLE_ACTIONS);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function nonEmpty(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== "string" || value.length < min || value.length > max ||
      value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Invalid " + name + ".");
  }
  return value;
}
function identifier(value: unknown, name: string): string {
  const text = nonEmpty(value, name, 8, 128);
  if (!IDENTIFIER.test(text)) throw new Error("Invalid " + name + ".");
  return text;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid lifecycle event.");
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): number {
  const text = nonEmpty(value, "event timestamp", 20, 40);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(text);
  if (!parts || !ISO_TIMESTAMP.test(text)) throw new Error("Invalid event timestamp.");
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  const offsetHour = parts[8] === undefined ? 0 : Number(parts[8]);
  const offsetMinute = parts[9] === undefined ? 0 : Number(parts[9]);
  // Date.parse silently normalizes e.g. February 30 to March 2.
  // Validate the written local calendar day before applying any timezone offset.
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] ||
      hour > 23 || minute > 59 || second > 59 || offsetHour > 14 ||
      offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
    throw new Error("Invalid event timestamp.");
  }
  const millis = Date.parse(text);
  if (!Number.isFinite(millis)) throw new Error("Invalid event timestamp.");
  return millis;
}

export function createOrderLifecycle(orderId: string, revisionId: string, recipeHash: string): OrderLifecycleState {
  identifier(orderId, "order ID");
  nonEmpty(revisionId, "locked revision ID", 12, 200);
  if (!/^[a-f0-9]{64}$/.test(recipeHash)) throw new Error("Invalid locked recipe hash.");
  return { orderId, revisionId, recipeHash, status: "created", sequence: 0,
    lastEventId: null, heldFrom: null, audit: [] };
}

function validateQc(qc: unknown, state: OrderLifecycleState): OrderQcEvidence {
  const value = record(qc);
  const inspector = nonEmpty(value.inspector, "QC inspector", 2, 120);
  const inspectionReference = nonEmpty(value.inspectionReference, "physical QC reference", 3, 240);
  if (value.revisionId !== state.revisionId || value.recipeHash !== state.recipeHash)
    throw new Error("QC evidence does not match the locked order revision and recipe.");
  // Rework or recovery invalidates the prior physical QC signoff. A fresh
  // approval must cite a distinct inspection record, not replay the old one.
  if (state.audit.some(item => item.action === "approve_qc" &&
      item.qc?.inspectionReference === inspectionReference)) {
    throw new Error("A fresh QC inspection reference is required after rework or recovery.");
  }
  const checks = record(value.checks);
  if (Object.keys(checks).length !== ORDER_QC_CHECKS.length ||
      ORDER_QC_CHECKS.some(check => checks[check] !== true)) {
    throw new Error("All six named finished-garment QC checks must be true.");
  }
  return { inspector, inspectionReference, revisionId: state.revisionId,
    recipeHash: state.recipeHash, checks: Object.fromEntries(ORDER_QC_CHECKS.map(check => [check, true])) as Record<OrderQcCheck, boolean> };
}

/** Pure reducer: reject stale writes, illegal jumps, replay, chronology regressions and fabricated QC approvals. */
export function applyOrderLifecycleEvent(state: OrderLifecycleState, rawEvent: unknown): OrderLifecycleState {
  const event = record(rawEvent);
  const eventId = identifier(event.eventId, "event ID");
  if (event.orderId !== state.orderId) throw new Error("Order identity mismatch.");
  if (!Number.isSafeInteger(event.sequence) || event.sequence !== state.sequence + 1)
    throw new Error("Stale or non-sequential order event.");
  if (event.previousEventId !== state.lastEventId || state.audit.some(item => item.eventId === eventId))
    throw new Error("Stale, replayed or duplicate order event.");
  if (event.from !== state.status) throw new Error("Order status changed before this event.");
  if (typeof event.action !== "string" || !ACTIONS.has(event.action)) throw new Error("Unknown order action.");
  if (!STAGES.has(state.status)) throw new Error("Unknown order state.");
  const action = event.action as OrderLifecycleAction;
  const at = timestamp(event.occurredAt);
  const previousAt = state.audit.length ? timestamp(state.audit[state.audit.length - 1].occurredAt) : -Infinity;
  if (at <= previousAt) throw new Error("Order audit timestamps must increase strictly.");
  const actor = nonEmpty(event.actor, "operator actor", 3, 120);
  const evidenceRef = nonEmpty(event.evidenceRef, "external evidence reference", 8, 240);
  let to = NEXT[state.status]?.[action];
  let heldFrom: OrderLifecycleStage | null = state.heldFrom;
  if (action === "cancel" && CANCELLABLE.has(state.status)) to = "cancelled";
  if (action === "hold_for_recovery" && RECOVERABLE.has(state.status)) {
    to = "recovery_pending";
    heldFrom = state.status;
  }
  if (action === "resume_recovery" && state.status === "recovery_pending" && state.heldFrom) {
    // Never revive an earlier QC approval or jump ahead after a recovery hold.
    to = ["accepted", "cutting", "stitching"].includes(state.heldFrom) ? state.heldFrom : "stitching";
    heldFrom = null;
  }
  if (!to) throw new Error("Illegal order transition from " + state.status + " using " + action + ".");
  const reason = event.reason === undefined ? undefined : nonEmpty(event.reason, "reason", 3, 500);
  if (["cancel", "reject_qc", "hold_for_recovery", "resume_recovery"].includes(action) && !reason)
    throw new Error("A documented reason is required for cancellation, rework or recovery.");
  if (action === "approve_qc") validateQc(event.qc, state);
  else if (event.qc !== undefined) throw new Error("QC approval evidence belongs only on QC approval events.");
  if (to !== "recovery_pending" && action !== "resume_recovery") heldFrom = null;
  const applied: AppliedOrderLifecycleEvent = {
    eventId, orderId: state.orderId, action, from: state.status, to,
    sequence: event.sequence as number, previousEventId: state.lastEventId,
    occurredAt: event.occurredAt as string, actor, evidenceRef,
    ...(reason === undefined ? {} : { reason }),
    ...(action === "approve_qc" ? { qc: validateQc(event.qc, state) } : {}),
  };
  return { ...state, status: to, sequence: applied.sequence, lastEventId: eventId,
    heldFrom, audit: [...state.audit, applied] };
}

/** Replays the entire event history, refusing mismatched audit destinations. */
export function replayOrderLifecycle(orderId: string, revisionId: string, recipeHash: string,
  events: readonly unknown[]): OrderLifecycleState {
  if (!Array.isArray(events) || events.length > 10000) throw new Error("Invalid or oversized order audit.");
  let state = createOrderLifecycle(orderId, revisionId, recipeHash);
  for (const raw of events) {
    const source = record(raw);
    state = applyOrderLifecycleEvent(state, source);
    // Stored applied events must explicitly carry the computed destination.
    // Missing/null/undefined `to` is tampering, not an unapplied event.
    if (source.to !== state.status) throw new Error("Tampered audit destination.");
  }
  return state;
}
