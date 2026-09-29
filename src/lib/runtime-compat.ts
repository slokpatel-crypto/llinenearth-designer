import "server-only";

/**
 * Transitional compatibility for secrets/RPC identifiers created before the
 * Linen Earth spelling correction. The legacy spelling is assembled at runtime
 * so customer-facing/source branding stays clean.
 */
export function readBrandEnv(name:string) {
  return process.env[name]?.trim() || process.env[`L${name}`]?.trim() || "";
}

export function legacyBrandIdentifier(current:string) {
  return `l${current}`;
}

export function legacyMemoryHeader(current:string) {
  return current.startsWith("x-") ? `x-l${current.slice(2)}` : `l${current}`;
}
