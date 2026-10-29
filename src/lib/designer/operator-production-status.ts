import {
  ORDER_TRANSITIONS,
  QUOTE_TRANSITIONS,
  type ProductionOrderStatus,
  type ProductionQuoteStatus,
} from "./production-state.ts";

/**
 * Privileged status changes must use exact DB UUIDs and closed transition
 * vocabularies. The database still decides whether the current state allows
 * the requested transition; this parser never claims a successful transition.
 */
export type OperatorProductionStatusChange = {
  recordId: string;
  status: ProductionOrderStatus | ProductionQuoteStatus;
  note: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseOperatorProductionStatus(
  input: Record<string, unknown>,
  kind: "quote" | "order",
): OperatorProductionStatusChange | null {
  const rawId = kind === "quote" ? input.quoteId : input.orderId;
  if (typeof rawId !== "string" || !UUID.test(rawId.trim())) return null;
  if (typeof input.status !== "string") return null;

  const transitions = kind === "quote" ? QUOTE_TRANSITIONS : ORDER_TRANSITIONS;
  if (!Object.values(transitions).some((next) => (next as readonly string[]).includes(input.status as string))) {
    return null;
  }

  if (input.note !== undefined && input.note !== null && typeof input.note !== "string") return null;
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 1000) return null;

  return {
    recordId: rawId.trim().toLowerCase(),
    status: input.status as ProductionQuoteStatus | ProductionOrderStatus,
    note,
  };
}
