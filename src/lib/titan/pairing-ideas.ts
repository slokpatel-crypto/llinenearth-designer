import {
  TITAN_FABRIC_CATALOG, type TitanFabricKind, type TitanFabricReference,
} from "./fabric-handoff.ts";

/**
 * Editorial starting points only. These rules use catalogue-authored names
 * and patterns, NOT pixel colours, measured material properties, inventory
 * availability, AI rendering, or a claim of physical fabric compatibility.
 *
 * Style Director remains the authoritative tailoring/style workflow.
 */
export type TitanPairingIdea = Readonly<{
  id: string;
  title: string;
  reason: string;
  shirtId: string;
  trouserId: string;
  counterpart: TitanFabricReference;
}>;

type Recipe = Readonly<{ id: string; title: string; reason: string }>;

const TROUSER_DARK = "linen-suiting-dark-grey";
const TROUSER_LIGHT = "linen-suiting-light-cream";
const TROUSER_BEIGE = "linen-suiting-beige";
const TROUSER_BLUE = "linen-suiting-denim-blue";
const TROUSER_SLATE = "linen-suiting-slate-gray";

const SHIRT_SKY = "linen-plain-60-sky-blue";
const SHIRT_OFFWHITE = "linen-plain-60-jute-offwhite";
const SHIRT_GREY = "linen-plain-60-light-grey";
const SHIRT_MAROON = "linen-plain-60-jute-maroon";
const SHIRT_PINK = "linen-plain-60-oyster-pink";
const SHIRT_PRINT = "linen-print-60-01";

const shirtPlain = (fabric: TitanFabricReference) =>
  /^plain(?:\s*\/|$)/i.test(fabric.pattern);

function trousersForShirt(fabric: TitanFabricReference): readonly Recipe[] {
  if (!shirtPlain(fabric)) return [
    { id: TROUSER_DARK, title: "Deep neutral", reason: "A plain dark-grey catalogue reference alongside the shirt's recorded pattern." },
    { id: TROUSER_BEIGE, title: "Warm neutral", reason: "An alternative plain beige reference that keeps the printed or checked shirt as the visual feature." },
    { id: TROUSER_SLATE, title: "Cool neutral", reason: "A plain slate-grey reference for another visual comparison." },
  ];
  if (/black|maroon|stresa|boulder|saffron/i.test(fabric.name)) return [
    { id: TROUSER_LIGHT, title: "Light neutral", reason: "Compare this shirt with a light-cream trouser reference." },
    { id: TROUSER_BEIGE, title: "Warm neutral", reason: "Try a beige trouser swatch as a second editorial starting point." },
    { id: TROUSER_SLATE, title: "Cool neutral", reason: "Try a slate-grey trouser swatch as a third editorial starting point." },
  ];
  return [
    { id: TROUSER_DARK, title: "Deep neutral", reason: "Try a plain dark-grey trouser reference beside this shirting." },
    { id: TROUSER_BEIGE, title: "Warm neutral", reason: "Try a plain beige trouser reference for a different visual direction." },
    { id: TROUSER_BLUE, title: "Blue option", reason: "Compare with the existing denim-blue trouser swatch." },
  ];
}

function shirtsForTrouser(fabric: TitanFabricReference): readonly Recipe[] {
  if (/beige|taupe|cream|platinum/i.test(fabric.name)) return [
    { id: SHIRT_SKY, title: "Blue shirting", reason: "Explore a plain sky-blue shirting reference with this trouser colourway." },
    { id: SHIRT_MAROON, title: "Deep accent", reason: "Explore a maroon shirting reference as a visibly different editorial choice." },
    { id: SHIRT_GREY, title: "Light neutral", reason: "Compare the catalogue's light-grey plain shirting." },
  ];
  if (/blue|chambray/i.test(fabric.name)) return [
    { id: SHIRT_OFFWHITE, title: "Pale shirting", reason: "An offwhite plain shirting reference against the selected blue trouser swatch." },
    { id: SHIRT_PINK, title: "Soft accent", reason: "Compare an oyster-pink plain shirting reference." },
    { id: SHIRT_GREY, title: "Neutral alternative", reason: "Compare a light-grey shirting reference." },
  ];
  return [
    { id: SHIRT_OFFWHITE, title: "Pale shirting", reason: "Compare a plain offwhite shirt reference with this trouser colourway." },
    { id: SHIRT_SKY, title: "Blue shirting", reason: "Compare a plain sky-blue shirt reference." },
    { id: SHIRT_PRINT, title: "Pattern option", reason: "Explore an existing botanical-print shirting reference as an alternative." },
  ];
}

/**
 * Every suggested combination is assembled entirely from current, validated
 * real catalogue IDs. Unknown inputs fail closed; no automatic Designer handoff
 * or writes to saved customer selections are performed.
 */
export function suggestTitanPairings(kind: TitanFabricKind, anchorId: string): TitanPairingIdea[] {
  const anchor = TITAN_FABRIC_CATALOG.find(item => item.kind === kind && item.id === anchorId);
  if (!anchor) return [];
  const opposite = kind === "shirt" ? "trouser" : "shirt";
  const recipes = kind === "shirt" ? trousersForShirt(anchor) : shirtsForTrouser(anchor);
  const seen = new Set<string>();
  return recipes.flatMap(recipe => {
    const counterpart = TITAN_FABRIC_CATALOG.find(item => item.kind === opposite && item.id === recipe.id);
    if (!counterpart || seen.has(counterpart.id)) return [];
    seen.add(counterpart.id);
    return [{
      id: `${anchor.id}:${counterpart.id}`,
      title: recipe.title,
      reason: recipe.reason,
      shirtId: kind === "shirt" ? anchor.id : counterpart.id,
      trouserId: kind === "trouser" ? anchor.id : counterpart.id,
      counterpart,
    }];
  }).slice(0, 3);
}
