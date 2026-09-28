import type { DesignerFabric, DesignerStyle, DesignerStyleOverrides, OccasionTier } from "./engine";

export type DesignerStyleInsight = {
  title: string;
  explanation: string;
  source: string;
  sourceUrl: string;
  action?: { label: string; patch: DesignerStyleOverrides };
};

// Small design decisions are tied to the chosen cloth and occasion, not
// applied to every look. Physical cloth and tailoring still need confirmation.
export function designerStyleInsights(
  shirt: DesignerFabric, pant: DesignerFabric, occasion: OccasionTier, style: DesignerStyle,
): DesignerStyleInsight[] {
  const insights: DesignerStyleInsight[] = [];
  const isStripe = /stripe/i.test(shirt.patternType);
  const dressy = occasion === "Semi-Formal" || occasion === "Formal";

  if (dressy && style.shirtWear === "Untucked") insights.push({
    title: "Give the shirt a clean waistline",
    explanation: "A tucked dress shirt reads more composed. Check the body length and waist ease so it stays tucked when worn.",
    source: "Proper Cloth · Shirt length", sourceUrl: "https://propercloth.com/reference/how-long-should-the-shirt-length-be/",
    action: { label: "Try tucked", patch: { shirtWear: "Tucked" } },
  });

  if (isStripe && dressy && style.collarFinish === "Self-fabric" && shirt.tone !== "Light") insights.push({
    title: "Let the stripe meet a white collar",
    explanation: "A white contrast collar can sharpen a striped dress shirt. The white cloth is an additional material to verify, not part of this swatch.",
    source: "Turnbull & Asser · Contrast stripe", sourceUrl: "https://turnbullandasser.com/products/striped-white-navy-regular-fit-shirt-cotton",
    action: { label: "Try white collar", patch: { collarFinish: "White contrast collar" } },
  });

  if (isStripe && pant.patternType !== "Solid") insights.push({
    title: "Let one pattern lead",
    explanation: "A quieter trouser gives the shirt stripe room. Compare the actual pattern sizes together before choosing another patterned cloth.",
    source: "Drake’s · Summer stripes", sourceUrl: "https://us.drakes.com/blogs/news/summer-stripes",
  });

  if (style.collarFinish !== "Self-fabric") insights.push({
    title: "The white finish needs its own cloth",
    explanation: `${style.collarFinish === "White contrast collar" ? "Matching white cuffs are another shirtmaking direction. " : ""}Confirm the white fabric’s shade, weight, shrinkage and available metres with the tailor.`,
    source: "Turnbull & Asser · Contrast collar & cuffs", sourceUrl: "https://turnbullandasser.com/products/wine-pinstripe-shirt-with-contrast-collar-cuffs",
    ...(style.collarFinish === "White contrast collar" ? {
      action: { label: "Match white cuffs", patch: { collarFinish: "White contrast collar + cuffs" } },
    } : {}),
  });

  return insights.slice(0, 3);
}
