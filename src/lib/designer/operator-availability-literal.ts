/** A catalogue fabric is not operator-confirmed by JSON-coercible values.
 * A malformed newer availability note for a known fabric vetoes older
 * confirmations instead of silently falling through to them.
 */
export type LiteralOperatorAvailability = "available" | "unavailable" | "unknown";

export function parseLiteralOperatorAvailability(
  payload: Record<string, unknown>,
  catalogueIds: readonly string[],
): { fabricId: string; availability: LiteralOperatorAvailability; trustedSubtype: boolean } | null {
  const fabricId = typeof payload.fabricId === "string" ? payload.fabricId.trim() : "";
  if (!fabricId || !catalogueIds.includes(fabricId)) return null;

  if (payload.subtype !== "designer_fabric_metadata") {
    // Other notes do not override stock. A suspicious availability claim on
    // an active fabric is a veto, even when its subtype is malformed.
    return Object.prototype.hasOwnProperty.call(payload, "availability")
      ? { fabricId, availability: "unknown", trustedSubtype: false }
      : null;
  }

  const raw = payload.availability;
  const availability: LiteralOperatorAvailability =
    raw === "available" || raw === "unavailable" ? raw : "unknown";
  return { fabricId, availability, trustedSubtype: true };
}
