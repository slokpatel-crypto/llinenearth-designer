/**
 * A signed Style Director recipe is compact, but unlike the six-choice public
 * questionnaire it includes a full canonical style spec and HMAC token.
 * Reject oversized/unreadable inbound request streams *before* JSON parsing,
 * token validation or optional network auditing.
 */
export const STYLE_DIRECTOR_HANDOFF_MAX_REQUEST_BYTES = 64 * 1024;

export async function parseBoundedStyleDirectorHandoffJson(
  request: Pick<Request, "body">,
): Promise<Record<string, unknown> | null> {
  const stream = request.body;
  if (!stream) return null;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = stream.getReader();
  } catch {
    return null;
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > STYLE_DIRECTOR_HANDOFF_MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body: unknown = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
