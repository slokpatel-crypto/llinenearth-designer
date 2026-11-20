import type { LockedDesignRevision } from "./design-lock.ts";
import {
  DESIGNER_STYLE_CHOICES,
  type DesignerClimate,
  type DesignerIntention,
  type DesignerStyle,
  type OccasionTier,
} from "./engine.ts";
import {
  fromLegacyStyle,
  toLegacyStyle,
  validateStyleSpecV2,
  type StyleSpecV2,
} from "./style-spec-v2.ts";
import {
  DEFAULT_BODY_PREVIEW_PROFILE,
  validBodyPreviewProfile,
  type BodyPreviewProfile,
} from "./body-profile.ts";

// A vault identifier is an opaque lookup key, never a recovery token.
// Account ownership is still enforced by /api/designer/vault -> loadOwned.
const VAULT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OCCASIONS: readonly OccasionTier[] = ["Casual","Smart-Casual","Semi-Formal","Formal"];
const CLIMATES: readonly DesignerClimate[] = ["Not specified","Hot / humid","Cool","Air-conditioned"];
const INTENTIONS: readonly DesignerIntention[] = ["Understated","Balanced","Expressive"];

export function validOwnedDesignVaultId(value: string | null): value is string {
  return typeof value === "string" && VAULT_ID.test(value);
}

export type OwnedDesignResume = {
  shirtId: string;
  pantId: string;
  occasion: OccasionTier;
  climate: DesignerClimate;
  intention: DesignerIntention;
  style: DesignerStyle;
  styleSpec: StyleSpecV2;
  bodyProfile: BodyPreviewProfile;
  parentRevisionId: string;
};

function knownLegacyStyle(value: DesignerStyle) {
  return (Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>).every(
    key => DESIGNER_STYLE_CHOICES[key].includes(value[key]),
  );
}

/**
 * Reopen a verified, account-owned immutable recipe as an EDITABLE draft.
 * No measurements, share secrets, fabric stock claims or saved-lock status
 * are promoted. The next lock points to the original revision as its parent.
 * Return null rather than quietly substituting an unavailable fabric/cut.
 */
export function draftFromOwnedLockedRevision(
  revision: LockedDesignRevision,
  shirtIds: readonly string[],
  pantIds: readonly string[],
): OwnedDesignResume | null {
  if (!revision || revision.version !== "linen-earth-design-lock-v1" ||
      typeof revision.revisionId !== "string" || !revision.revisionId ||
      revision.garmentSpec?.version !== "linen-earth-garment-spec-v1") return null;

  const spec = revision.garmentSpec;
  const shirtId = spec.fabrics?.shirt?.id;
  const pantId = spec.fabrics?.trouser?.id;
  if (!shirtId || !pantId || !shirtIds.includes(shirtId) || !pantIds.includes(pantId)) return null;
  if (!OCCASIONS.includes(spec.context?.occasion) ||
      !CLIMATES.includes(spec.context?.climate) ||
      !INTENTIONS.includes(spec.context?.intention)) return null;

  let style: DesignerStyle;
  let styleSpec: StyleSpecV2;
  if (spec.styleSpec !== null && spec.styleSpec !== undefined) {
    // Unknown future versions or removed options must not become an approximate
    // silent replacement for the customer's already locked construction.
    if (!validateStyleSpecV2(spec.styleSpec)) return null;
    styleSpec = spec.styleSpec;
    style = toLegacyStyle(styleSpec);
  } else {
    // Backwards compatibility for v1 locked recipes predating StyleSpec v2.
    const legacy: DesignerStyle = {
      collar:spec.shirt?.collar,
      collarFinish:spec.shirt?.collarFinish,
      cuff:spec.shirt?.cuff,
      placket:spec.shirt?.placket,
      shirtFit:spec.shirt?.fit,
      shirtWear:spec.shirt?.wear,
      trouser:spec.trouser?.shape,
      rise:spec.trouser?.rise,
      waistband:spec.trouser?.waistband,
      break:spec.trouser?.break,
      button:spec.shirt?.button,
    };
    if (!knownLegacyStyle(legacy)) return null;
    style = legacy;
    styleSpec = fromLegacyStyle(legacy);
  }
  if (!knownLegacyStyle(style)) return null;
  return {
    shirtId, pantId,
    occasion:spec.context.occasion,
    climate:spec.context.climate,
    intention:spec.context.intention,
    style:{...style},
    styleSpec:JSON.parse(JSON.stringify(styleSpec)) as StyleSpecV2,
    bodyProfile:spec.bodyProfile && validBodyPreviewProfile(spec.bodyProfile)
      ? {...spec.bodyProfile}
      : {...DEFAULT_BODY_PREVIEW_PROFILE},
    parentRevisionId:revision.revisionId,
  };
}
