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
// An arbitrary object can satisfy the TypeScript state shape at runtime. Only
// states minted by this reducer (or reconstructed by verified audit replay)
// may authorize the next transition. This is in-process provenance, NOT
// database authentication or cross-request concurrency control.
const TRUSTED_STATES = new WeakSet<OrderLifecycleState>();
function trustState<T extends OrderLifecycleState>(state: T): T {
  TRUSTED_STATES.add(state);
  return state;
}
const STAGES = new Set<string>(ORDER_LIFECYCLE_STAGES);
const ACTIONS = new Set<string>(ORDER_LIFECYCLE_ACTIONS);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function nonEmpty(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== "string" || value.length < min || value.length > max ||
      value.trim() !== value || value.trim().length === 0 || /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/.test(value)) {
    throw new Error("Invalid " + name + ".");
  }
  return value;
}
function identifier(value: unknown, name: string): string {
  const text = nonEmpty(value, name, 8, 128);
  if (!IDENTIFIER.test(text)) throw new Error("Invalid " + name + ".");
  return text;
}
// Persisted audits must not silently discard unexpected evidence fields during
// canonical replay. The allowlist is versioned with the event contract.
const QC_FIELDS = new Set(["inspector", "inspectionReference", "revisionId", "recipeHash", "checks"]);
const QC_CHECK_FIELDS = new Set<string>(ORDER_QC_CHECKS);
const SNAPSHOT_FIELDS = new Set(["orderId", "revisionId", "recipeHash", "status", "sequence", "lastEventId", "heldFrom", "audit"]);
const APPLIED_EVENT_FIELDS = new Set([
  "eventId", "orderId", "action", "from", "to", "sequence",
  "previousEventId", "occurredAt", "actor", "evidenceRef", "reason", "qc",
]);
function rejectUnknownFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  if (Object.keys(value).some(key => !allowed.has(key)))
    throw new Error("Unexpected " + label + " field.");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid lifecycle event.");
  // Audit records must be plain data. Inherited claims, getters and symbol
  // properties are not representable in a durable JSON event and could be
  // silently dropped or evaluated with side effects during validation.
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("Invalid lifecycle record prototype.");
  if (Reflect.ownKeys(value).some(key => typeof key !== "string" ||
      (() => { const descriptor = Object.getOwnPropertyDescriptor(value, key); return !descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable; })())) {
    throw new Error("Invalid lifecycle record property.");
  }
  return value as Record<string, unknown>;
}
/**
 * Stored history is JSON data, not an arbitrary JavaScript array. Reject holes,
 * custom properties, symbols, accessors and exotic prototypes before iterating:
 * they would otherwise be dropped by serialization or evaluated during replay.
 * The ordinary non-enumerable Array.length is the sole permitted exception.
 */
function auditArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error("Invalid or oversized order audit.");
  if (Object.getPrototypeOf(value) !== Array.prototype)
    throw new Error("Invalid order audit array prototype.");
  const entries = Reflect.ownKeys(value);
  for (const key of entries) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) ||
        Number(key) >= value.length) {
      throw new Error("Invalid order audit array property.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable)
      throw new Error("Invalid order audit array property.");
  }
  if (entries.length !== value.length + 1)
    throw new Error("Invalid or sparse order audit.");
  return value;
}

function timestamp(value: unknown): number {
  const text = nonEmpty(value, "event timestamp", 20, 40);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(text);
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
  return trustState(Object.freeze({ orderId, revisionId, recipeHash, status: "created", sequence: 0,
    lastEventId: null, heldFrom: null, audit: Object.freeze([]) }));
}

function validateQc(qc: unknown, state: OrderLifecycleState): OrderQcEvidence {
  const value = record(qc);
  rejectUnknownFields(value, QC_FIELDS, "QC evidence");
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
  rejectUnknownFields(checks, QC_CHECK_FIELDS, "QC check");
  if (Object.keys(checks).length !== ORDER_QC_CHECKS.length ||
      ORDER_QC_CHECKS.some(check => checks[check] !== true)) {
    throw new Error("All six named finished-garment QC checks must be true.");
  }
  return Object.freeze({ inspector, inspectionReference, revisionId: state.revisionId,
    recipeHash: state.recipeHash, checks: Object.freeze(Object.fromEntries(ORDER_QC_CHECKS.map(check => [check, true])) as Record<OrderQcCheck, boolean>) });
}

/** Pure reducer: reject stale writes, illegal jumps, replay, chronology regressions and fabricated QC approvals. */
export function applyOrderLifecycleEvent(state: OrderLifecycleState, rawEvent: unknown): OrderLifecycleState {
  if (!state || typeof state !== "object" || !TRUSTED_STATES.has(state)) {
    throw new Error("Untrusted lifecycle snapshot; restore audited history before applying events.");
  }
  // Replays reject audits above 10,000 entries; live transitions must enforce
  // the same bound so no reducer-minted state becomes impossible to restore.
  if (state.audit.length >= 10000) throw new Error("Order audit exceeds maximum event count.");
  const event = record(rawEvent);
  // Live inputs are untrusted too: never silently drop unexpected claims.
  rejectUnknownFields(event, APPLIED_EVENT_FIELDS, "order event");
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
  // One receipt cannot independently attest two distinct lifecycle events.
  // Reusing a prior event receipt would weaken the claimed audit chain.
  if (state.audit.some(item => item.evidenceRef === evidenceRef))
    throw new Error("External evidence reference already used by this order.");
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
  // A supplied destination is an explicit claim, not ignorable metadata.
  // Replayed applied events and live callers must agree with the computed transition.
  if (Object.hasOwn(event, "to") && event.to !== to)
    throw new Error("Tampered audit destination: Claimed order destination does not match the permitted transition.");
  const reason = event.reason === undefined ? undefined : nonEmpty(event.reason, "reason", 3, 500);
  const reasonRequired = ["cancel", "reject_qc", "hold_for_recovery", "resume_recovery"].includes(action);
  if (reasonRequired && !reason)
    throw new Error("A documented reason is required for cancellation, rework or recovery.");
  if (!reasonRequired && Object.hasOwn(event, "reason"))
    throw new Error("Unexpected reason on an ordinary order transition.");
  const validatedQc = action === "approve_qc" ? validateQc(event.qc, state) : undefined;
  if (action !== "approve_qc" && Object.hasOwn(event, "qc"))
    throw new Error("QC approval evidence belongs only on QC approval events.");
  if (to !== "recovery_pending" && action !== "resume_recovery") heldFrom = null;
  const applied: AppliedOrderLifecycleEvent = Object.freeze({
    eventId, orderId: state.orderId, action, from: state.status, to,
    sequence: event.sequence as number, previousEventId: state.lastEventId,
    occurredAt: event.occurredAt as string, actor, evidenceRef,
    ...(reason === undefined ? {} : { reason }),
    ...(validatedQc ? { qc: validatedQc } : {}),
  });
  // TypeScript readonly is compile-time only. Freeze the new snapshot and
  // nested QC record so downstream code cannot mutate accepted audit history.
  return trustState(Object.freeze({ ...state, status: to, sequence: applied.sequence, lastEventId: eventId,
    heldFrom, audit: Object.freeze([...state.audit, applied]) }));
}

/**
 * A pure retry decision for a FUTURE transaction-backed persistence adapter.
 * It does not replace the server's atomic compare-and-set, actor authentication,
 * idempotency-key reservation or evidence provenance validation.
 */
export type OrderLifecycleWriteResult = Readonly<{
  outcome: "applied" | "already_applied";
  state: OrderLifecycleState;
}>;

function sameAppliedEvent(previous: AppliedOrderLifecycleEvent, event: Record<string, unknown>): boolean {
  // Live callers may omit the computed destination, unlike stored events.
  // No other field (including explicit undefined optional claims) may differ.
  const keys = Object.keys(previous).filter(key => key !== "to" || Object.hasOwn(event, "to"));
  if (Object.keys(event).length !== keys.length ||
      keys.some(key => !Object.hasOwn(event, key))) return false;
  for (const key of keys) {
    if (key === "qc") {
      const claimed = record(event.qc);
      const approved = previous.qc;
      if (!approved) return false;
      rejectUnknownFields(claimed, QC_FIELDS, "QC evidence");
      if (Object.keys(claimed).length !== QC_FIELDS.size ||
          claimed.inspector !== approved.inspector ||
          claimed.inspectionReference !== approved.inspectionReference ||
          claimed.revisionId !== approved.revisionId ||
          claimed.recipeHash !== approved.recipeHash) return false;
      const checks = record(claimed.checks);
      rejectUnknownFields(checks, QC_CHECK_FIELDS, "QC check");
      if (Object.keys(checks).length !== QC_CHECK_FIELDS.size ||
          ORDER_QC_CHECKS.some(check => checks[check] !== approved.checks[check])) return false;
    } else if (event[key] !== previous[key as keyof AppliedOrderLifecycleEvent]) {
      return false;
    }
  }
  return true;
}

/**
 * Return the same frozen state for a byte-for-byte-equivalent logical retry,
 * even when later events have been applied. Reuse of an event ID with modified
 * actor, stage, sequence, evidence, QC or destination must fail closed.
 * Persisted idempotency still requires a database-atomic unique event ID and
 * order-version compare-and-set; never use this alone for multi-user writes.
 */
export function applyOrderLifecycleEventIdempotently(
  state: OrderLifecycleState, rawEvent: unknown,
): OrderLifecycleWriteResult {
  if (!state || typeof state !== "object" || !TRUSTED_STATES.has(state))
    throw new Error("Untrusted lifecycle snapshot; restore audited history before applying events.");
  const event = record(rawEvent);
  rejectUnknownFields(event, APPLIED_EVENT_FIELDS, "order event");
  const eventId = identifier(event.eventId, "event ID");
  if (event.orderId !== state.orderId) throw new Error("Order identity mismatch.");
  const previous = state.audit.find(item => item.eventId === eventId);
  if (previous) {
    if (!sameAppliedEvent(previous, event))
      throw new Error("Conflicting order event retry.");
    return Object.freeze({ outcome: "already_applied", state });
  }
  return Object.freeze({ outcome: "applied", state: applyOrderLifecycleEvent(state, event) });
}

/**
 * Pure optimistic-write boundary for a future authenticated transactional adapter.
 * It captures both the locked garment identity and the last known event sequence.
 * This is a precondition contract, never a database lock or durable CAS.
 */
export type OrderLifecycleVersionFence = Readonly<{
  orderId: string;
  revisionId: string;
  recipeHash: string;
  sequence: number;
  lastEventId: string | null;
}>;

const VERSION_FENCE_FIELDS = new Set(["orderId", "revisionId", "recipeHash", "sequence", "lastEventId"]);

export function orderLifecycleVersionFence(state: OrderLifecycleState): OrderLifecycleVersionFence {
  if (!state || typeof state !== "object" || !TRUSTED_STATES.has(state))
    throw new Error("Untrusted lifecycle snapshot; restore audited history before applying events.");
  return Object.freeze({
    orderId: state.orderId, revisionId: state.revisionId, recipeHash: state.recipeHash,
    sequence: state.sequence, lastEventId: state.lastEventId,
  });
}

/**
 * An exact duplicate event can be acknowledged even if its original fence is
 * old. A *new* event must carry the latest sequence and last-event pointer.
 * A production server must perform this comparison and event append atomically
 * against stored rows, with authorization and unique event IDs.
 */
export function applyOrderLifecycleEventWithVersionFence(
  state: OrderLifecycleState, rawEvent: unknown, rawFence: unknown,
): OrderLifecycleWriteResult {
  if (!state || typeof state !== "object" || !TRUSTED_STATES.has(state))
    throw new Error("Untrusted lifecycle snapshot; restore audited history before applying events.");
  const fence = record(rawFence);
  rejectUnknownFields(fence, VERSION_FENCE_FIELDS, "version fence");
  if (Object.keys(fence).length !== VERSION_FENCE_FIELDS.size ||
      !Number.isSafeInteger(fence.sequence) || (fence.sequence as number) < 0 ||
      (fence.sequence as number) > 10000 ||
      (fence.sequence === 0 && fence.lastEventId !== null) ||
      (fence.sequence !== 0 &&
        (typeof fence.lastEventId !== "string" || !IDENTIFIER.test(fence.lastEventId)))) {
    throw new Error("Invalid order lifecycle version fence.");
  }
  if (fence.orderId !== state.orderId || fence.revisionId !== state.revisionId ||
      fence.recipeHash !== state.recipeHash) {
    throw new Error("Order version fence locked identity mismatch.");
  }
  const event = record(rawEvent);
  rejectUnknownFields(event, APPLIED_EVENT_FIELDS, "order event");
  const eventId = identifier(event.eventId, "event ID");
  if (event.orderId !== state.orderId) throw new Error("Order identity mismatch.");
  const original = state.audit.find(previous => previous.eventId === eventId);
  if (original) {
    // A matching event body is not enough: its original write fence must also
    // match the exact predecessor in the immutable audit. Otherwise a guessed
    // or unrelated version can be used to acknowledge a completed operation.
    if (fence.sequence !== original.sequence - 1 ||
        fence.lastEventId !== original.previousEventId)
      throw new Error("Order event retry version fence does not match its original predecessor.");
    return applyOrderLifecycleEventIdempotently(state, event);
  }
  if (fence.sequence !== state.sequence || fence.lastEventId !== state.lastEventId)
    throw new Error("Stale order lifecycle version fence.");
  return applyOrderLifecycleEventIdempotently(state, event);
}

/** Replays the entire event history, refusing mismatched audit destinations. */
export function replayOrderLifecycle(orderId: string, revisionId: string, recipeHash: string,
  events: readonly unknown[]): OrderLifecycleState {
  const verifiedEvents = auditArray(events);
  let state = createOrderLifecycle(orderId, revisionId, recipeHash);
  for (const raw of verifiedEvents) {
    const source = record(raw);
    rejectUnknownFields(source, APPLIED_EVENT_FIELDS, "stored audit");
    state = applyOrderLifecycleEvent(state, source);
    // Stored applied events must explicitly carry the computed destination.
    // Missing/null/undefined `to` is tampering, not an unapplied event.
    if (source.to !== state.status) throw new Error("Tampered audit destination.");
  }
  return state;
}

/**
 * Rehydrate a serialized lifecycle only by replaying its complete audit.
 * Never trust a stored status, sequence or recovery pointer independently of
 * the event chain. This is consistency validation, not authentication or a
 * cryptographic integrity guarantee for a database-controlled audit.
 */
export function restoreOrderLifecycleSnapshot(rawSnapshot: unknown): OrderLifecycleState {
  const snapshot = record(rawSnapshot);
  rejectUnknownFields(snapshot, SNAPSHOT_FIELDS, "lifecycle snapshot");
  const orderId = identifier(snapshot.orderId, "order ID");
  const revisionId = nonEmpty(snapshot.revisionId, "locked revision ID", 12, 200);
  const recipeHash = snapshot.recipeHash;
  if (typeof recipeHash !== "string" || !/^[a-f0-9]{64}$/.test(recipeHash))
    throw new Error("Invalid locked recipe hash.");
  if (!Array.isArray(snapshot.audit)) throw new Error("Invalid or missing order audit.");
  const canonical = replayOrderLifecycle(orderId, revisionId, recipeHash, snapshot.audit);
  if (snapshot.status !== canonical.status || snapshot.sequence !== canonical.sequence ||
      snapshot.lastEventId !== canonical.lastEventId || snapshot.heldFrom !== canonical.heldFrom) {
    throw new Error("Order lifecycle snapshot does not match audited history.");
  }
  // Return a newly reconstructed, deeply frozen snapshot; do not retain the
  // mutable input's object or nested QC references.
  return canonical;
}
