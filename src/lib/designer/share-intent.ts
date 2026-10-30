import type { LockedDesignRevision } from "./design-lock.ts";

export type ConsentedShareIntent = {
  revision: LockedDesignRevision;
  recoveryToken: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * A signed public link is an explicit disclosure of a locked design recipe.
 * Never mint one from a bare client-provided lock, a contact-consent checkbox,
 * or a recovery token that has not also been verified against its owner.
 */
export function parseConsentedShareIntent(input: unknown): ConsentedShareIntent | null {
  if (!record(input) || !record(input.revision) || input.consentToShare !== true) return null;
  if (typeof input.recoveryToken !== "string"
    || input.recoveryToken.length === 0
    || input.recoveryToken.length > 256
    || input.recoveryToken !== input.recoveryToken.trim()) return null;
  return {
    revision: input.revision as LockedDesignRevision,
    recoveryToken: input.recoveryToken,
  };
}
