/**
 * TITAN -> existing Style Director handoff.
 * Accept only the Style Director's real first-step values. Never interpret
 * arbitrary query strings as styling choices or generate looks from this URL.
 */
export const TITAN_OCCASIONS = ["Wedding", "Work", "Date", "Celebration", "Travel", "Everyday"] as const;
export type TitanOccasion = (typeof TITAN_OCCASIONS)[number];

export function isTitanOccasion(value: string): value is TitanOccasion {
  return TITAN_OCCASIONS.some(occasion => occasion === value);
}

export function titanOccasionHref(value: TitanOccasion): string {
  return `/style-director?source=titan&occasion=${encodeURIComponent(value)}`;
}

export function readTitanOccasion(search: string): TitanOccasion | null {
  const params = new URLSearchParams(search);
  if (params.getAll("source").length !== 1 || params.get("source") !== "titan") return null;
  const values = params.getAll("occasion");
  if (values.length !== 1 || !isTitanOccasion(values[0])) return null;
  return values[0];
}
