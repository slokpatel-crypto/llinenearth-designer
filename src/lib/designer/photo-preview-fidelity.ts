import type { DesignerStyle } from "./engine.ts";
import type { StyleSpecV2 } from "./style-spec-v2.ts";

/**
 * A Solid catalogue classification is not physical proof of reviewed textile
 * repeat scale. Only describe measured calibration where a visible motif is
 * actually selected and all visible repeat calibrations are verified.
 */
export function photoPatternScaleDisclosure(
  patternTypes: readonly string[],
  allVisibleRepeatsVerified: boolean,
  unverifiedFabricNames: readonly string[],
): string {
  const hasPatternRepeat = patternTypes.some((type) => type.trim().toLowerCase() !== "solid");
  if (!hasPatternRepeat) {
    return "no visible motif repeat is recorded for these solid selections";
  }
  if (allVisibleRepeatsVerified) {
    return "pattern scale uses reviewed physical evidence plus accepted studio calibration where a visible repeat exists";
  }
  return "pattern scale is still approximate for " + unverifiedFabricNames.join(" / ");
}

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
  // Button materials belong in the locked spec, not the fixed source photograph.
  if (style.button !== "Plastic / Resin" ||
      (spec && spec.shirt.button !== "plastic_resin")) {
    add("shirt.button", "button material", "The original photographed buttons remain unchanged; the selected material is specification-only.");
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

  // The Canvas compositor chooses its base photograph from the legacy style.
  // Advanced v2 values must never silently borrow that photograph's exactness.
  if (spec.shirt.wear !== (tucked ? "tucked" : "untucked")) {
    add("shirt.wear", "shirt tuck", "The photographed tuck mode follows the live selection, not this saved versioned wear choice.");
  }
  if (spec.shirt.collarFinish !== style.collarFinish) {
    add("shirt.collarFinish", "collar contrast", "The visible contrast cloth follows the live choice, not this saved versioned collar finish.");
  }
  if (spec.pant.type !== (photographedWide ? "wide_leg_relaxed_drape" : "pleated_trouser")) {
    add("pant.type", "trouser silhouette", "The versioned trouser construction differs from the fixed source photograph.");
  }
  if (spec.pant.break !== (photographedWide ? "full_break" : "slight_break")) {
    add("pant.break", "trouser break", "The versioned trouser break differs from the photographic hem length.");
  }
  if (spec.shirt.back !== "plain_back") {
    add("shirt.back", "back shaping", "A front photograph cannot verify or show this selected rear construction.");
  }

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
  if (tucked && spec.shirt.length !== "shirt_length_tuck") {
    add("shirt.length", "shirt length", "The tucked source does not reconstruct or verify an alternative shirt length hidden by the waistband.");
  }
  if (tucked && spec.shirt.hem !== "curved_shirttail") {
    add("shirt.hem", "shirt hem", "The tucked source does not reconstruct or verify an alternative hem hidden by the waistband.");
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
