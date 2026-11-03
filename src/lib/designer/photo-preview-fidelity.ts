import type { DesignerStyle } from "./engine.ts";
import type { StyleSpecV2 } from "./style-spec-v2.ts";

export type PhotoConstructionMismatch = {
  field: string;
  label: string;
  reason: string;
};

/**
 * Report selected construction which the fixed front-view source photographs
 * cannot honestly show. This is not a compatibility validator and never
 * changes or downgrades the customer's saved StyleSpecV2.
 *
 * The real model uses: point collar, standard placket, full sleeves with
 * one-button barrel cuffs, curved untucked shirttail, and a single-pleat trouser.
 * The wide-leg photograph is available only with the untucked shirt.
 */
export function photoConstructionMismatches(
  style: DesignerStyle,
  spec?: StyleSpecV2 | null,
): PhotoConstructionMismatch[] {
  const gaps: PhotoConstructionMismatch[] = [];
  const add = (field: string, label: string, reason: string) => {
    if (!gaps.some((entry) => entry.field === field)) gaps.push({ field, label, reason });
  };
  const tucked = style.shirtWear === "Tucked";
  const wide = style.trouser === "Wide-leg / Relaxed Drape Trouser";
  const photographedWide = !tucked && wide;

  if (style.collar !== "Point (Standard) Collar" ||
      (spec && spec.shirt.collar !== "point_standard_collar")) {
    add("shirt.collar", "collar shape", "The source photograph retains its point collar.");
  }
  if (style.cuff !== "Barrel Cuff (1-button)" ||
      (spec && spec.shirt.cuff !== "barrel_cuff_1_button")) {
    add("shirt.cuff", "cuff shape", "The source photograph retains one-button barrel cuffs.");
  }
  if (style.placket !== "Standard (visible stitch)" ||
      (spec && spec.shirt.placket !== "standard_visible_placket")) {
    add("shirt.placket", "placket", "The visible stitched placket is not rebuilt for hidden or alternative constructions.");
  }
  if (style.shirtFit !== "Regular / Classic Fit" ||
      (spec && spec.shirt.fit !== "regular_classic_fit")) {
    add("shirt.fit", "shirt fit", "The photographed shirt keeps its regular silhouette.");
  }

  if (style.trouser !== "Pleated Trouser" && !photographedWide) {
    add("pant.type", "trouser silhouette", tucked && wide
      ? "A tucked wide-leg selection still shows the tucked straight-leg photograph."
      : "No source photograph matches this trouser cut.");
  }
  if (style.break !== (photographedWide ? "Full Break" : "Slight Break")) {
    add("pant.break", "trouser break", "Hem length and break remain those of the source photograph.");
  }
  if (tucked && style.rise !== "Mid Rise") {
    add("pant.rise", "trouser rise", "The tucked photographed waistband remains mid rise.");
  }
  if (tucked && style.waistband !== "Belt Loops") {
    add("pant.waistband", "waistband", "The tucked photograph retains its photographed belt loops.");
  }
  if (!spec) return gaps;

  if (spec.shirt.type !== "dress_shirt") {
    add("shirt.type", "shirt construction", "A different shirt type requires its own photograph.");
  }
  if (spec.shirt.sleeve !== "full_sleeve") {
    add("shirt.sleeve", "sleeve length", "The source photograph keeps full-length sleeves.");
  }
  if (spec.shirt.pocket !== "no_pocket") {
    add("shirt.pocket", "shirt pocket", "Pocket construction is not reconstructed on the photograph.");
  }
  if (!tucked && spec.shirt.hem !== "curved_shirttail") {
    add("shirt.hem", "shirt hem", "The untucked photograph has a curved shirttail, even when the saved construction requests a straight or vented hem.");
  }
  if (!tucked && spec.shirt.length !== "shirt_length_regular") {
    add("shirt.length", "shirt length", "The photographed shirt length is not re-cut.");
  }
  if (spec.pant.pleat !== "single_pleat_forward") {
    add("pant.pleat", "trouser pleats", "The photograph has a single pleat; flat-front, reverse and double pleats are not reconstructed.");
  }
  if (spec.pant.fit !== (photographedWide ? "wide_leg_drape" : "pleated_straight")) {
    add("pant.fit", "trouser fit", "The selected trouser fit is not the photographed silhouette.");
  }
  if (spec.pant.hem !== "plain_hem") {
    add("pant.hem", "trouser hem finish", "Alternative trouser hem finishes are not shown.");
  }
  if (tucked && spec.pant.rise !== "mid_rise") {
    add("pant.rise", "trouser rise", "The photograph does not move the waistband.");
  }
  if (tucked && spec.pant.waistband !== "belt_loops") {
    add("pant.waistband", "waistband", "The photograph does not rebuild waistband hardware.");
  }
  return gaps;
}
