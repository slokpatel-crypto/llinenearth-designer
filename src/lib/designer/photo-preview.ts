import type { DesignerFabric, DesignerStyle } from "./engine";
import reference from "./reference-data.json";

/**
 * The photos are reusable mannequin templates, not pictures of finished Linen
 * Earth garments. A garment region is recoloured locally from a catalogue
 * swatch; each new cut requires a real matching photo and an aligned mask.
 */
export type PhotoTemplate = "pleated" | "wide" | "tucked";

// Paths are only clipping masks over a photograph; no vector mannequin is shown.
// Separate collar regions keep the photographic collar, seam and button shading.
// These are three separate photographed pieces: left sleeve, body, right
// sleeve. A single connected outline filled the empty space under both arms.
// The body follows the actual open neck, leaving the mannequin's skin clear.
export const PHOTO_UNTUCKED_SHIRT_BODY_CLIP = "M 351 244 L 448 205 L 448 249 L 480 218 L 509 258 L 545 218 L 577 249 L 577 205 L 669 244 L 643 315 L 647 498 L 650 676 Q 595 716 510 714 Q 425 716 368 676 L 372 498 L 377 315 Z";
export const PHOTO_UNTUCKED_LEFT_SLEEVE_CLIP = "M 351 244 Q 312 265 303 331 L 286 473 L 277 621 Q 274 664 287 700 L 335 700 L 345 650 L 365 547 Q 379 473 376 415 L 377 315 Z";
export const PHOTO_UNTUCKED_RIGHT_SLEEVE_CLIP = "M 669 244 Q 696 264 707 329 L 723 474 L 735 621 Q 739 662 727 699 L 682 700 L 672 650 L 652 547 Q 639 473 641 415 L 643 315 Z";
export const PHOTO_UNTUCKED_COLLAR_CLIP = "M 466 174 Q 450 186 448 207 L 448 249 L 481 220 Q 469 205 466 190 Z M 553 174 Q 572 187 577 208 L 577 249 L 544 220 Q 555 205 553 190 Z";
const SHIRT_MASK = `${PHOTO_UNTUCKED_SHIRT_BODY_CLIP} ${PHOTO_UNTUCKED_LEFT_SLEEVE_CLIP} ${PHOTO_UNTUCKED_RIGHT_SLEEVE_CLIP} ${PHOTO_UNTUCKED_COLLAR_CLIP}`;

// These small regions sit on the same photograph and preserve its seam folds.
// White is a colour preview; a separate actual collar cloth is still required.
export const PHOTO_COLLAR_MASK = "M 449 249 L 450 207 Q 454 191 465 194 L 494 221 L 482 229 Z M 578 249 L 576 210 Q 569 191 558 194 L 529 221 L 541 229 Z";
export const PHOTO_CUFF_MASK = "M 286 660 Q 307 652 338 664 L 336 703 L 288 706 Z M 677 663 Q 703 652 729 661 L 724 700 L 681 704 Z";
// Trace the actual fall and tips of the dark photographic collar. The collar
// itself has very little blue, so its outline cannot use the shirt colour mask.
export const PHOTO_TUCKED_COLLAR_MASK = "M 466 173 Q 451 184 447 203 L 447 249 L 481 219 Q 469 203 466 190 Z M 553 173 Q 573 184 582 207 L 582 249 L 544 219 Q 555 203 553 190 Z";
export const PHOTO_TUCKED_COLLAR_STAND_MASK = "M 463 172 L 490 215 L 481 227 L 446 192 Z M 556 172 L 530 215 L 542 227 L 582 192 Z";
export const PHOTO_TUCKED_CUFF_MASK = "M 285 654 Q 312 649 338 663 L 335 698 L 289 700 Z M 679 662 Q 706 651 733 656 L 730 700 L 682 699 Z";

// Hard photographic boundaries for the tucked studio template. These are not
// garment illustrations: they only constrain the recolour operation to the
// photographed cloth. Colour segmentation alone can pick up the warm studio
// floor, neck shadows and the gap between the legs, which creates the cheap
// "fabric sticker" effect. The colour mask is intersected with these paths.
export const PHOTO_TUCKED_SHIRT_BODY_CLIP = "M 351 244 L 448 205 L 448 249 L 480 218 L 509 258 L 545 218 L 577 249 L 577 205 L 669 244 L 643 315 Q 640 414 628 544 Q 510 554 387 545 Q 378 414 377 315 Z";
export const PHOTO_TUCKED_LEFT_SLEEVE_CLIP = "M 351 244 Q 312 265 303 331 L 286 473 L 277 621 Q 274 664 287 700 L 335 700 L 345 650 L 365 547 Q 379 473 379 415 L 377 315 Z";
export const PHOTO_TUCKED_RIGHT_SLEEVE_CLIP = "M 669 244 Q 696 264 707 329 L 723 474 L 735 621 Q 739 662 727 699 L 682 700 L 672 650 L 652 547 Q 639 473 641 415 L 643 315 Z";
export const PHOTO_TUCKED_SHIRT_CLIP = `${PHOTO_TUCKED_SHIRT_BODY_CLIP} ${PHOTO_TUCKED_LEFT_SLEEVE_CLIP} ${PHOTO_TUCKED_RIGHT_SLEEVE_CLIP}`;
export const PHOTO_TUCKED_NECK_CLEAR = "M 466 165 L 488 216 L 510 242 L 535 216 L 557 165 L 579 190 L 567 251 L 457 251 L 445 190 Z";

// Split trouser construction keeps the photographed fly/waist joined while
// preventing any textile fill from bridging the inner-leg opening.
export const PHOTO_TUCKED_LEFT_TROUSER_CLIP = "M 368 542 L 510 542 L 510 690 C 505 775 497 900 485 1030 L 478 1350 L 468 1380 L 418 1382 L 382 1365 L 368 1300 L 368 671 Z";
export const PHOTO_TUCKED_RIGHT_TROUSER_CLIP = "M 510 542 L 650 542 L 655 690 L 650 1040 L 646 1300 L 636 1352 L 594 1370 L 560 1350 L 548 1280 L 525 1030 C 518 900 513 775 510 690 Z";
export const PHOTO_TUCKED_TROUSER_CLIP = `${PHOTO_TUCKED_LEFT_TROUSER_CLIP} ${PHOTO_TUCKED_RIGHT_TROUSER_CLIP}`;


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
    shirtPath: SHIRT_MASK,
    trouserPath: "M 369 673 C 425 708 590 718 650 674 L 650 831 L 652 1080 L 650 1306 L 643 1351 Q 608 1371 562 1354 L 553 1329 L 540 1132 L 526 934 L 511 759 L 495 758 L 477 938 L 469 1124 L 464 1327 L 458 1352 Q 418 1364 372 1355 L 365 1326 L 371 1115 L 374 884 Z",
  },
  wide: {
    src: "/designer/studio-wide.webp",
    trouser: "single-pleat wide leg",
    break: "Full Break",
    shirtPath: SHIRT_MASK,
    trouserPath: "M 368 674 C 424 709 592 719 653 675 L 661 886 L 677 1107 L 679 1316 L 678 1351 Q 609 1371 542 1353 L 537 1324 L 526 1065 L 513 774 L 497 770 L 486 1070 L 482 1327 L 479 1353 Q 415 1368 344 1353 L 342 1317 L 351 1085 L 357 875 Z",
  },
  tucked: {
    src: "/designer/studio-tucked.webp",
    trouser: "single-pleat straight leg",
    break: "Slight Break",
    // The tucked photograph has its own cloth-colour masks, traced from the
    // actual photographed edges rather than a simulated waistband path.
    shirtPath: "",
    trouserPath: "",
  },
};

export function photoTemplateForStyle(style: DesignerStyle): PhotoTemplate {
  if (style.shirtWear === "Tucked") return "tucked";
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
  if (template === "tucked") {
    if (style.rise !== "Mid Rise") gaps.push(style.rise);
    if (style.waistband !== "Belt Loops") gaps.push(style.waistband);
  } else gaps.push(`${style.rise} / ${style.waistband} (hidden under shirt)`);
  gaps.push(`${style.button} buttons (material not re-rendered)`);
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
