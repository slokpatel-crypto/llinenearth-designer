import type { LabColor } from "@/lib/vocab/color-distance";
import type { ColorFamilyId } from "@/lib/vocab/colors";

export type MeasuredPaletteEntry={
  hex:string;
  lab:LabColor;
  coverage:number;
};

export type FabricImageQuality={
  score:number;
  issues:string[];
  widthPx:number;
  heightPx:number;
  blurVariance:number;
  glarePct:number;
  meanLuma:number;
  colorCast:number;
  borderCenterDelta:number;
};

export type FabricPatternMeasurement={
  orientation:"none"|"vertical"|"horizontal"|"grid"|"uncertain";
  repeatPeriodPx:number|null;
  stripeWidthPx:number|null;
  repeatMm:number|null;
  stripeWidthMm:number|null;
  contrastDeltaE:number|null;
  luminanceRatio:number|null;
  density:"none"|"sparse"|"balanced"|"dense";
  scale:"none"|"fine"|"medium"|"bold";
  physicalScaleStatus:"declared_repeat"|"declared_swatch_width"|"unknown";
};

export type FabricMeasuredData={
  contentSha256:string;
  perceptualHash:string;
  colour:{
    hex:string;
    lab:LabColor;
    palette:MeasuredPaletteEntry[];
    mappedColorFamily:ColorFamilyId;
    deltaE:number;
  };
  pattern:FabricPatternMeasurement;
  imageQuality:FabricImageQuality;
  measuredAt:string;
};
