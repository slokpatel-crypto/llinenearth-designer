import type { MeasurementProfile } from "@/lib/measurements";
import type { DesignerStyle, DesignerStyleOverrides } from "@/lib/designer/engine";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";

export type BlockStrategySeverity = "info" | "review" | "warning";
export type ShirtBlockFamily = "unknown" | "balanced-shirt" | "shaped-shirt" | "straight-shirt" | "mobility-shirt";
export type TrouserBlockFamily = "unknown" | "clean-upper-block" | "roomy-seat-block" | "pleated-upper-block" | "relaxed-drape-block" | "flat-seat-cleanup";

export type BlockAdjustment = {
  id: string;
  garment: "shirt" | "trouser";
  area: string;
  severity: BlockStrategySeverity;
  message: string;
};

export type DesignerBlockStrategy = {
  version: "block-strategy-provisional-1";
  status: "insufficient_measurements" | "provisional";
  source: "measurements_and_manual_observations";
  torsoShape: "unknown" | "tapered" | "balanced" | "straight";
  seatShape: "unknown" | "pronounced" | "balanced" | "flat";
  shirtBlock: ShirtBlockFamily;
  trouserBlock: TrouserBlockFamily;
  adjustments: BlockAdjustment[];
  suggestedPatch?: DesignerStyleOverrides;
  score: number;
  summary: string[];
  caveats: string[];
};

function torsoShape(profile?: MeasurementProfile | null): DesignerBlockStrategy["torsoShape"] {
  const chest = profile?.shirt.chest;
  const waist = profile?.shirt.waist;
  if (!chest || !waist) return "unknown";
  const delta = chest - waist;
  return delta >= 18 ? "tapered" : delta <= 6 ? "straight" : "balanced";
}

function seatShape(profile?: MeasurementProfile | null, observations?: TailorObservationProfile | null): DesignerBlockStrategy["seatShape"] {
  if (observations?.seatBalance === "full") return "pronounced";
  if (observations?.seatBalance === "flat") return "flat";
  const seat = profile?.pants.seat;
  const waist = profile?.pants.waist;
  if (!seat || !waist) return "unknown";
  const delta = seat - waist;
  return delta >= 24 ? "pronounced" : delta <= 14 ? "flat" : "balanced";
}

function add(
  list: BlockAdjustment[],
  id: string,
  garment: BlockAdjustment["garment"],
  area: string,
  severity: BlockStrategySeverity,
  message: string,
) {
  list.push({ id, garment, area, severity, message });
}

export function assessBlockStrategy(
  profile: MeasurementProfile | null | undefined,
  style: DesignerStyle,
  observations?: TailorObservationProfile | null,
): DesignerBlockStrategy {
  const torso = torsoShape(profile);
  const seat = seatShape(profile, observations);
  const adjustments: BlockAdjustment[] = [];
  const patch: DesignerStyleOverrides = {};

  if (!profile) {
    return {
      version: "block-strategy-provisional-1",
      status: "insufficient_measurements",
      source: "measurements_and_manual_observations",
      torsoShape: "unknown",
      seatShape: "unknown",
      shirtBlock: "unknown",
      trouserBlock: "unknown",
      adjustments: [{
        id: "BLOCK-DATA",
        garment: "shirt",
        area: "body block",
        severity: "review",
        message: "Add body measurements before selecting a starting garment block.",
      }],
      score: 50,
      summary: ["No measurement profile is available, so the starting block cannot be selected responsibly."],
      caveats: ["Block strategy is decision support for a tailor, not an automatic cutting pattern."],
    };
  }

  let shirtBlock: ShirtBlockFamily = torso === "tapered" ? "shaped-shirt"
    : torso === "straight" ? "straight-shirt" : torso === "balanced" ? "balanced-shirt" : "unknown";
  let trouserBlock: TrouserBlockFamily = seat === "pronounced" ? "roomy-seat-block"
    : seat === "flat" ? "flat-seat-cleanup" : seat === "balanced" ? "clean-upper-block" : "unknown";

  const slim = /slim/i.test(style.shirtFit);
  const relaxed = /relaxed/i.test(style.shirtFit);
  const pleated = /pleat/i.test(style.trouser);
  const wide = /wide|relaxed drape/i.test(style.trouser);
  const flatFront = /flat[- ]?front|formal trouser/i.test(style.trouser);

  if (observations?.mobilityPriority === "high") {
    shirtBlock = "mobility-shirt";
    add(adjustments, "BLOCK-MOBILITY", "shirt", "chest / armhole", slim ? "warning" : "review",
      slim
        ? "High mobility priority conflicts with an aggressively slim starting block. Preserve the visual line but begin from a roomier chest/armhole block."
        : "Use the roomier end of the provisional chest, bicep and armhole allowance and verify movement at the first fitting.");
    if (slim) patch.shirtFit = "Regular / Classic Fit";
  }

  if (torso === "tapered" && relaxed) {
    add(adjustments, "BLOCK-TORSO-VOLUME", "shirt", "waist suppression", "review",
      "The body is strongly tapered while the selected shirt is relaxed. Keep the fuller silhouette intentional and avoid accidental excess through the waist.");
  }
  if (torso === "straight" && slim) {
    add(adjustments, "BLOCK-TORSO-STRAIGHT", "shirt", "side seams", "review",
      "A straight torso with a slim fit can create artificial waist suppression. Shape the side seams conservatively and verify comfort seated.");
  }

  if (observations?.shoulderBalance === "sloping") {
    add(adjustments, "BLOCK-SHOULDER-SLOPING", "shirt", "shoulder slope / armhole", "review",
      "Lower the shoulder line from the starting block only after checking neck point, armhole depth and sleeve pitch on the customer.");
  } else if (observations?.shoulderBalance === "square") {
    add(adjustments, "BLOCK-SHOULDER-SQUARE", "shirt", "shoulder slope / armhole", "review",
      "Raise or square the shoulder line from the starting block only after checking armhole balance and sleeve pitch.");
  }

  if (observations?.posture === "forward") {
    add(adjustments, "BLOCK-POSTURE-FORWARD", "shirt", "front/back balance", "review",
      "Forward posture needs front/back length and yoke balance checked so the collar does not pull backward.");
  } else if (observations?.posture === "erect") {
    add(adjustments, "BLOCK-POSTURE-ERECT", "shirt", "front/back balance", "review",
      "Erect posture needs front/back balance checked so excess cloth does not collect across the back.");
  }

  if (wide) trouserBlock = "relaxed-drape-block";
  else if (pleated && seat === "pronounced") trouserBlock = "pleated-upper-block";

  if (seat === "pronounced" && flatFront) {
    trouserBlock = "roomy-seat-block";
    add(adjustments, "BLOCK-SEAT-FLATFRONT", "trouser", "seat / upper thigh", "warning",
      "A pronounced or manually noted full seat adds risk to a very clean flat-front block. Start from a roomier upper block or compare a pleated direction.");
    patch.trouser = "Pleated Trouser";
  } else if (seat === "pronounced") {
    add(adjustments, "BLOCK-SEAT-ROOM", "trouser", "back rise / seat", "review",
      "Preserve back-rise and upper-thigh room in the starting block, then taper below the thigh rather than reducing the seat.");
  }

  if (seat === "flat" && (pleated || wide)) {
    add(adjustments, "BLOCK-SEAT-FLAT", "trouser", "back rise / seat suppression", "review",
      "A flat-seat observation can leave excess cloth in a fuller block. Check back-rise shaping and seat suppression at fitting.");
  }

  if (/high rise/i.test(style.rise) && !profile.pants.frontRise) {
    add(adjustments, "BLOCK-RISE-DATA", "trouser", "rise balance", "review",
      "A high-rise starting block needs a recorded front-rise anchor before waistband position is finalized.");
  }

  const anchors = [
    profile.shirt.chest, profile.shirt.waist, profile.shirt.shoulder,
    profile.pants.waist, profile.pants.seat, profile.pants.frontRise,
  ].filter((value) => typeof value === "number" && value > 0).length;

  if (torso === "unknown") {
    add(adjustments, "BLOCK-TORSO-DATA", "shirt", "body block", "review",
      "Chest and shirt-waist measurements are needed to choose between straight, balanced and shaped torso blocks.");
  }
  if (seat === "unknown") {
    add(adjustments, "BLOCK-SEAT-DATA", "trouser", "upper block", "review",
      "Trouser waist and seat measurements are needed to choose the upper trouser block responsibly.");
  }

  const warnings = adjustments.filter((item) => item.severity === "warning").length;
  const reviews = adjustments.filter((item) => item.severity === "review").length;
  const score = Math.max(0, Math.min(100, 72 + anchors * 4 - warnings * 20 - reviews * 5));
  const status = anchors >= 4 && torso !== "unknown" && seat !== "unknown" ? "provisional" : "insufficient_measurements";

  const summary = [
    shirtBlock === "shaped-shirt" ? "Start from a shaped torso block and preserve chest movement before waist suppression."
      : shirtBlock === "straight-shirt" ? "Start from a straighter shirt body and avoid forced waist suppression."
        : shirtBlock === "mobility-shirt" ? "Start from a movement-first shirt block, then recover a clean visual line through shaping."
          : shirtBlock === "balanced-shirt" ? "Start from the balanced shirt block and tune shoulder/posture only where observed."
            : "Shirt block selection needs more measurement evidence.",
    trouserBlock === "pleated-upper-block" ? "Use a pleated upper block with room through seat and thigh, then control the lower leg."
      : trouserBlock === "roomy-seat-block" ? "Use a roomier upper trouser block before deciding how clean the front can remain."
        : trouserBlock === "relaxed-drape-block" ? "Use a fuller trouser block and verify cloth drape before approving the silhouette."
          : trouserBlock === "flat-seat-cleanup" ? "Use a cleaner back-seat block and check for excess cloth below the waistband."
            : trouserBlock === "clean-upper-block" ? "A clean balanced upper trouser block is a reasonable provisional start."
              : "Trouser block selection needs more measurement evidence.",
  ];

  return {
    version: "block-strategy-provisional-1",
    status,
    source: "measurements_and_manual_observations",
    torsoShape: torso,
    seatShape: seat,
    shirtBlock,
    trouserBlock,
    adjustments,
    ...(Object.keys(patch).length ? { suggestedPatch: patch } : {}),
    score,
    summary,
    caveats: [
      "Block strategy chooses a provisional starting block; it does not create or approve a cutting pattern.",
      "A tailor must verify shoulder slope, posture, armhole, sleeve pitch, rise, seat and crotch balance at fitting.",
    ],
  };
}
