const COOKIE_NAME = "llinen_operator_session";
const SESSION_HOURS = 12;

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as T;
  } catch {
    return null;
  }
}

async function hmac(value: string) {
  const secret = process.env.LLINEN_OPERATOR_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

export async function createOperatorSession() {
  const payload = encodeJson({
    v: 1,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  });
  const signature = await hmac(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

export async function verifyOperatorSession(token?: string | null) {
  if (!token) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;
  const expectedSignature = await hmac(payload);
  if (!expectedSignature || !constantTimeEqual(expectedSignature, suppliedSignature)) return false;
  const data = decodeJson<{v?:number;exp?:number}>(payload);
  return data?.v === 1 && typeof data.exp === "number" && data.exp > Date.now();
}

export const OPERATOR_COOKIE = {
  name: COOKIE_NAME,
  maxAge: SESSION_HOURS * 60 * 60,
};
