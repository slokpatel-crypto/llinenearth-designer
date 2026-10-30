import type { LockedDesignRevision } from "./design-lock.ts";

/**
 * A valid recipe hash authenticates the garment spec, not the complete
 * revision lineage. An owner-scoped read must recover the SAME saved revision:
 * an altered parent or lock instant cannot be silently accepted merely
 * because the garment spec, revision ID and recipe hash still match.
 *
 * Call only after both revisions pass verifyLockedDesignRevision. The vault
 * RPC itself remains responsible for authenticating owner access.
 */
export function sameLockedVaultRevision(
  expected:LockedDesignRevision,
  recovered:LockedDesignRevision,
):boolean{
  return expected.version===recovered.version&&
    expected.revisionId===recovered.revisionId&&
    expected.recipeHash===recovered.recipeHash&&
    expected.lockedAt===recovered.lockedAt&&
    expected.parentRevisionId===recovered.parentRevisionId;
}
