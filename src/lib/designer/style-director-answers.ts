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

/**
 * Malformed, empty, or unreadable JSON is a client request failure, not an
 * internal Style Director error. Keep parsing ahead of inventory/network IO.
 */
// The questionnaire needs fewer than 300 bytes. Reject oversized public
// requests during streaming, before stock queries or JSON object allocation.
export const STYLE_DIRECTOR_MAX_REQUEST_BYTES = 8 * 1024;

export async function parseStyleDirectorJsonRequest(
  request: Pick<Request, "json"> & Partial<Pick<Request, "body">>,
): Promise<StyleDirectorAnswers | null> {
  try {
    const stream = request.body;
    // Keep the pure JSON-decoder test contract for synthetic Request substitutes.
    if (!stream) return parseStyleDirectorAnswers(await request.json());
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let body = "";
    let byteLength = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > STYLE_DIRECTOR_MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => {});
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return parseStyleDirectorAnswers(JSON.parse(body));
  } catch {
    return null;
  }
}
