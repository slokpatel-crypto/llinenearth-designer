/**
 * Roadmap v2 / reference-look M2: explicit, user-confirmed fabric pair.
 *
 * This transports ONLY existing catalogue IDs. Photo pixels, guessed colour,
 * stock claims and fit/cutting approval never leave the local matcher.
 */
export type ReferenceOutfitTarget = "shirt" | "pant";
export type ReferenceOutfitChoices = Readonly<{ shirt: string | null; pant: string | null }>;
export type ReferenceCatalogueItem = Readonly<{
  id: string;
  allowedGarments: readonly ("shirt" | "pant")[];
}>;

function knownId(id: unknown, target: ReferenceOutfitTarget, catalogue: readonly ReferenceCatalogueItem[]): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 160 &&
    catalogue.some((item) => item.id === id && item.allowedGarments.includes(target));
}

/** No silent default choice and no accidental shirt/trouser cross-assignments. */
export function chooseReferenceOutfitFabric(
  previous: ReferenceOutfitChoices,
  target: ReferenceOutfitTarget,
  id: string | null,
  shirts: readonly ReferenceCatalogueItem[],
  pants: readonly ReferenceCatalogueItem[],
): ReferenceOutfitChoices {
  if (target !== "shirt" && target !== "pant") return previous;
  if (id === null) return { ...previous, [target]: null };
  if (!knownId(id, target, target === "shirt" ? shirts : pants)) return previous;
  return { ...previous, [target]: id };
}

/** Version 1 is the reference-selection transport, NOT a new StyleSpec schema. */
export function buildReferenceOutfitHref(
  selection: ReferenceOutfitChoices,
  shirts: readonly ReferenceCatalogueItem[],
  pants: readonly ReferenceCatalogueItem[],
): string | null {
  if (!knownId(selection.shirt, "shirt", shirts) || !knownId(selection.pant, "pant", pants)) return null;
  const params = new URLSearchParams({
    from: "reference-match",
    referenceVersion: "1",
    shirt: selection.shirt,
    pant: selection.pant,
  });
  return "/designer-studio?" + params.toString();
}

/** Reject malformed/duplicate parameters and unknown, reversed or retired IDs. */
export function readReferenceOutfitHandoff(
  params: URLSearchParams,
  shirts: readonly ReferenceCatalogueItem[],
  pants: readonly ReferenceCatalogueItem[],
): Readonly<{ shirtId: string; pantId: string }> | null {
  for (const key of ["from", "referenceVersion", "shirt", "pant"]) {
    if (params.getAll(key).length !== 1) return null;
  }
  if (params.get("from") !== "reference-match" || params.get("referenceVersion") !== "1") return null;
  const shirtId = params.get("shirt");
  const pantId = params.get("pant");
  if (!knownId(shirtId, "shirt", shirts) || !knownId(pantId, "pant", pants)) return null;
  return { shirtId, pantId };
}
