import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.LLINEN_MEMORY_SESSION_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function sign(sessionId: string, expiresAt: number) {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key)
    .update(`${VERSION}.${sessionId}.${expiresAt}`)
    .digest("base64url");
}

export function memorySessionConfigured() {
  return Boolean(secret());
}

export function createMemorySessionToken(sessionId: string) {
  const expiresAt = Date.now() + MAX_AGE_MS;
  const signature = sign(sessionId, expiresAt);
  if (!signature) return null;
  return `${VERSION}.${expiresAt}.${signature}`;
}

export function verifyMemorySessionToken(sessionId: string, token?: string | null) {
  if (!token) return false;
  const [version, expiresRaw, supplied, extra] = token.split(".");
  if (version !== VERSION || !expiresRaw || !supplied || extra) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || expiresAt > Date.now() + MAX_AGE_MS + 60_000) {
    return false;
  }

  const expected = sign(sessionId, expiresAt);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a,b);
}
