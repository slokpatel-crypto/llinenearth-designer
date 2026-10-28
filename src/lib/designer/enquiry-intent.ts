import type { LockedDesignRevision } from "./design-lock.ts";

type EnquiryIntent = {
  revision: LockedDesignRevision;
  recoveryToken: string | null;
  mode: "legacy_draft" | "consented";
};

function record(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

/**
 * Old clients may still prepare a WhatsApp draft using a locked revision.
 * Drafts are NEVER authenticated or called durable enquiry evidence.
 * Only explicit consent and a correctly typed recovery token may request
 * owner-scoped audit verification.
 */
export function parseEnquiryIntent(input: unknown): EnquiryIntent | null {
  if (!record(input)) return null;
  if (input.version === "linen-earth-design-lock-v1") {
    return {revision:input as LockedDesignRevision,recoveryToken:null,mode:"legacy_draft"};
  }
  if (!record(input.revision) || input.consentToContact !== true) return null;
  const token=input.recoveryToken;
  if (token !== undefined && token !== null && token !== "") {
    if (typeof token !== "string" || token.length > 256 || token !== token.trim()) return null;
  }
  return {
    revision:input.revision as LockedDesignRevision,
    recoveryToken:typeof token === "string" && token.length > 0 ? token : null,
    mode:"consented",
  };
}

/** Each record has a hash and timestamp-bound revision ID, but neither
 * proves that a customer owns the stored vault record. That is checked
 * independently through the server-only owned + access-key RPCs.
 */
export function sameLockedEnquiryRevision(
  requested: LockedDesignRevision,
  stored: LockedDesignRevision,
): boolean {
  return requested.version === stored.version
    && requested.revisionId === stored.revisionId
    && requested.recipeHash === stored.recipeHash
    && requested.lockedAt === stored.lockedAt
    && requested.parentRevisionId === stored.parentRevisionId;
}
