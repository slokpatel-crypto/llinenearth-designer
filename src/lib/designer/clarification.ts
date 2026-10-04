import { DESIGNER_STYLE_CHOICES, type DesignerStyle } from "./engine.ts";
import { optionById } from "./options/library.ts";

export type DesignerClarification = {
  question: string;
  choices: Array<{ id: string; label: string; brief: string }>;
};

const choice = (id: string, label: string, brief: string) => ({ id, label, brief });
const known = (id: string) => optionById(id)!.label;

/** Offer a new, editable question. Never silently resolve the original brief. */
export function buildDesignerClarification(text: string, issues: string[], style: DesignerStyle): DesignerClarification {
  const conflict = issues.map(issue => issue.match(/^Choose one (\w+) option: (.+) or (.+)\.$/)).find(Boolean);
  if (conflict) {
    const key = conflict[1] as keyof DesignerStyle;
    const choices = DESIGNER_STYLE_CHOICES[key];
    if (choices?.includes(conflict[2]) && choices.includes(conflict[3])) return {
      question: "These choices describe different constructions. Compare them before choosing one?",
      choices: [choice("compare-conflict", "Compare these choices", `Keep both fabrics. Compare ${conflict[2]} vs ${conflict[3]}.`),
        choice("review-current", "Review my current construction", "Keep both fabrics. Review my current construction.")],
    };
  }
  if (issues.some(issue => /collar reference/.test(issue))) return {
    question: "Which supported collar direction would you like to explore?",
    choices: [choice("compare-collars", "Point vs spread", `Keep both fabrics. Compare ${known("point_standard_collar")} vs ${known("spread_collar")}.`),
      choice("compare-open-collars", "Mandarin vs camp", `Keep both fabrics. Compare ${known("mandarin_band_collar")} vs ${known("cuban_camp_collar")}.`)],
  };
  if (issues.some(issue => /separate slim or tapered trouser/.test(issue))) return {
    question: "A separate trouser fit is not supported here. Explore the available trouser shapes?",
    choices: [choice("compare-trousers", "Flat front vs pleated", `Keep both fabrics. Compare ${known("formal_flat_front")} vs ${known("pleated_trouser")}.`),
      choice("check-fit", "Check fit and movement", "Keep both fabrics. Check fit and movement in my current outfit.")],
  };
  if (/\b(?:jacket|blazer|saree|sari|dress|hoodie|sneaker|kurta|sherwani)\b/i.test(text)) return {
    question: "This garment needs a supported block. Would you like to explore a shirt or trouser instead?",
    choices: [choice("shirt-task", "Explore a shirt", "Design a shirt only for my current occasion."),
      choice("trouser-task", "Explore trousers", "Design trousers only for my current occasion.")],
  };
  if (issues.some(issue => /reference's visible collar/.test(issue))) return {
    question: "An exact reference copy cannot be promised. Which supported detail should we compare first?",
    choices: [choice("reference-collar", "Compare collar directions", `Keep both fabrics. Compare ${known("point_standard_collar")} vs ${known("spread_collar")}.`),
      choice("reference-fit", "Compare shirt fits", `Keep both fabrics. Compare ${known("regular_classic_fit")} vs ${known("relaxed_fit")}.`)],
  };
  const currentCollar = style.collar;
  const otherCollar = currentCollar === known("spread_collar") ? known("point_standard_collar") : known("spread_collar");
  return {
    question: "What would you like your designer to work on?",
    choices: [choice("design-outfit", "Design an outfit", "Design a shirt and trouser outfit for my current occasion."),
      choice("critique-outfit", "Critique my outfit", "Critique my current outfit."),
      choice("compare-construction", "Compare collars", `Keep both fabrics. Compare ${currentCollar} vs ${otherCollar}.`)],
  };
}
