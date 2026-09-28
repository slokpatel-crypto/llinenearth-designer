import type { DesignerFabric, DesignerStyle } from "./engine";
import reference from "./reference-data.json";

/**
 * The photos are reusable mannequin templates, not pictures of finished LLinen
 * Earth garments. A garment region is recoloured locally from a catalogue
 * swatch; each new cut requires a real matching photo and an aligned mask.
 */
export type PhotoTemplate = "pleated" | "wide";

// Paths are only clipping masks over a photograph; no vector mannequin is shown.
// Separate collar regions keep the photographic collar, seam and button shading.
const SHIRT_MASK = "M 448 240 C 465 255 483 272 509 293 C 533 274 555 248 577 238 L 666 266 C 701 277 712 322 719 382 L 738 621 C 741 643 733 675 724 700 L 681 704 L 676 674 L 660 608 L 648 676 C 612 705 559 717 510 719 C 458 719 406 705 370 678 L 359 608 L 341 672 L 336 703 L 288 706 C 281 677 275 650 281 619 L 302 409 C 305 342 317 290 352 272 Z M 449 249 L 450 207 Q 454 191 465 194 L 494 221 L 482 229 Z M 578 249 L 576 210 Q 569 191 558 194 L 529 221 L 541 229 Z M 347 242 L 443 205 L 450 225 L 448 241 L 352 273 L 322 297 Z M 575 205 L 671 242 L 696 297 L 666 273 L 570 241 L 568 225 Z";
// The open-neck photo has pale shirt fabric beneath the collar. Include that
// shirt fabric in the recolour while leaving the mannequin's neck untouched.
const SHIRT_OPENING_MASK = "M 448 242 Q 482 257 509 284 Q 538 257 577 240 L 566 264 Q 537 288 509 300 Q 481 288 458 264 Z M 477 234 Q 491 245 509 268 Q 527 245 543 234 L 552 249 Q 533 271 509 288 Q 487 272 467 250 Z";
const SHIRT_WITH_OPENING_MASK = `${SHIRT_MASK} ${SHIRT_OPENING_MASK}`;
export const PHOTO_TUCKED_SHIRT_MASK = SHIRT_WITH_OPENING_MASK.replace(
  "L 660 608 L 648 676 C 612 705 559 717 510 719 C 458 719 406 705 370 678 L 359 608",
  "L 660 608 L 648 645 C 612 657 559 655 510 655 C 458 655 406 657 370 645 L 359 608",
);

// These small regions sit on the same photograph and preserve its seam folds.
// White is a colour preview; a separate actual collar cloth is still required.
export const PHOTO_COLLAR_MASK = "M 449 249 L 450 207 Q 454 191 465 194 L 494 221 L 482 229 Z M 578 249 L 576 210 Q 569 191 558 194 L 529 221 L 541 229 Z";
export const PHOTO_CUFF_MASK = "M 286 660 Q 307 652 338 664 L 336 703 L 288 706 Z M 677 663 Q 703 652 729 661 L 724 700 L 681 704 Z";
export const PHOTO_TUCKED_WAIST_MASK = "M 369 645 C 421 637 595 637 651 645 L 650 718 C 583 730 431 726 368 716 Z";

export const DESIGNER_PHOTO_TEMPLATES: Record<PhotoTemplate, {
  src: string;
  trouser: string;
  break: string;
  shirtPath: string;
  trouserPath: string;
}> = {
  pleated: {
    src: "/designer/studio-pleated.webp",
    trouser: "single-pleat straight leg",
    break: "Slight Break",
    shirtPath: SHIRT_WITH_OPENING_MASK,
    trouserPath: "M 369 673 C 425 708 590 718 650 674 L 650 831 L 652 1080 L 650 1306 L 643 1351 Q 608 1371 562 1354 L 553 1329 L 540 1132 L 526 934 L 511 759 L 495 758 L 477 938 L 469 1124 L 464 1327 L 458 1352 Q 418 1364 372 1355 L 365 1326 L 371 1115 L 374 884 Z",
  },
  wide: {
    src: "/designer/studio-wide.webp",
    trouser: "single-pleat wide leg",
    break: "Full Break",
    shirtPath: SHIRT_WITH_OPENING_MASK,
    trouserPath: "M 368 674 C 424 709 592 719 653 675 L 661 886 L 677 1107 L 679 1316 L 678 1351 Q 609 1371 542 1353 L 537 1324 L 526 1065 L 513 774 L 497 770 L 486 1070 L 482 1327 L 479 1353 Q 415 1368 344 1353 L 342 1317 L 351 1085 L 357 875 Z",
  },
};

export function photoTemplateForStyle(style: DesignerStyle): PhotoTemplate {
  return style.trouser === "Wide-leg / Relaxed Drape Trouser" ? "wide" : "pleated";
}

export function photoTemplateGaps(style: DesignerStyle, template: PhotoTemplate): string[] {
  const gaps: string[] = [];
  if (style.collar !== "Point (Standard) Collar") gaps.push(style.collar);
  if (style.cuff !== "Barrel Cuff (1-button)") gaps.push(style.cuff);
  if (style.placket !== "Standard (visible stitch)") gaps.push(style.placket);
  if (style.shirtFit !== "Regular / Classic Fit") gaps.push(style.shirtFit);
  if (template === "wide" ? style.trouser !== "Wide-leg / Relaxed Drape Trouser" : style.trouser !== "Pleated Trouser") gaps.push(style.trouser);
  if (style.break !== DESIGNER_PHOTO_TEMPLATES[template].break) gaps.push(style.break);
  if (style.shirtWear === "Tucked") gaps.push(`${style.rise} / ${style.waistband} (waist placement is a photo composite)`);
  else gaps.push(`${style.rise} / ${style.waistband} (hidden under shirt)`);
  return gaps;
}

export function previewFabricLabel(shirt: DesignerFabric, pant: DesignerFabric) {
  return `${shirt.name} shirt with ${pant.name} trousers on a faceless studio mannequin`;
}

export function constructionNotes(style: DesignerStyle) {
  const rows = reference.sheets;
  const description = (group: Array<Record<string, unknown>>, nameKey: string, value: string) =>
    String(group.find((entry) => entry[nameKey] === value)?.Description || "Confirm the construction with the tailor.");
  return [
    {
      title: "Collar", name: style.collar,
      description: description(rows.Shirt_Collar, "Collar_Type", style.collar),
      source: "https://propercloth.com/reference/dress-shirt-collar-styles/",
      sourceLabel: "Collar construction reference",
    },
    {
      title: "Cuff", name: style.cuff,
      description: description(rows.Shirt_Cuff, "Cuff_Type", style.cuff),
      source: "https://propercloth.com/reference/dress-shirt-cuff-styles/",
      sourceLabel: "Cuff construction reference",
    },
    {
      title: "Trouser", name: style.trouser,
      description: description(rows.Pant_Trouser_Types, "Trouser_Type", style.trouser),
      source: "https://www.permanentstyle.com/2019/11/suit-style-7-a-guide-to-pleats-on-trousers.html",
      sourceLabel: "Tailoring reference",
    },
    {
      title: "Shirt finish", name: style.shirtWear,
      description: style.shirtWear === "Tucked" ? "Allow enough body length and waist ease for the shirt to stay tucked." : "An untucked hem is a more relaxed shirt direction.",
      source: "https://propercloth.com/reference/how-long-should-the-shirt-length-be/",
      sourceLabel: "Dress-shirt length reference",
    },
    ...(style.collarFinish !== "Self-fabric" ? [{
      title: "Collar cloth", name: style.collarFinish,
      description: "A white contrast collar is a separate fabric detail; the physical white cloth needs selection and matching before cutting.",
      source: "https://turnbullandasser.com/products/striped-white-navy-regular-fit-shirt-cotton",
      sourceLabel: "Contrast-collar reference",
    }] : []),
  ];
}
