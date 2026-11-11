import type { StyleDirectorAnswers } from "../style-director-agent.ts";

/**
 * The public request contract is a closed set of selected journey IDs, not
 * merely six truthy values. TypeScript annotations do not validate JSON.
 * Read only own data descriptors to avoid inherited or accessor-backed
 * values if this parser is used beyond JSON-decoded requests.
 */
function allowedValue<T extends string>(
  body: object,
  key: keyof StyleDirectorAnswers,
  choices: readonly T[],
): T | null {
  const descriptor = Object.getOwnPropertyDescriptor(body, key);
  if (!descriptor || !("value" in descriptor) ||
      typeof descriptor.value !== "string") return null;
  const value = descriptor.value as string;
  return choices.includes(value as T) ? value as T : null;
}

export function parseStyleDirectorAnswers(body: unknown): StyleDirectorAnswers | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  try {
    const occasion = allowedValue(body, "occasion",
      ["Wedding", "Work", "Date", "Celebration", "Travel", "Everyday"] as const);
    const mood = allowedValue(body, "mood",
      ["Quiet", "Sharp", "Relaxed", "Statement"] as const);
    const time = allowedValue(body, "time", ["Day", "Evening"] as const);
    const climate = allowedValue(body, "climate", ["Hot", "Indoor", "Mixed"] as const);
    const garment = allowedValue(body, "garment",
      ["shirt", "trouser", "suit", "blazer"] as const);
    const colorDirection = allowedValue(body, "colorDirection",
      ["Light", "Earthy", "Blue", "Dark", "Surprise me"] as const);
    if (!occasion || !mood || !time || !climate || !garment || !colorDirection) return null;
    // Return a new, bounded value object. Ignore any extra client fields,
    // without invoking getters or forwarding arbitrary untrusted input.
    return { occasion, mood, time, climate, garment, colorDirection };
  } catch {
    return null;
  }
}
