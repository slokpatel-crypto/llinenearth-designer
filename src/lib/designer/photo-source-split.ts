/**
 * Source-reference wipe between the selected deterministic photo and the
 * unchanged source photograph. Bounded UI presentation only: never alters
 * a style recipe, fabric scale, fit evidence or saved/exported preview pixels.
 */
export type PhotoSourceSplitMode="selected"|"split"|"source";

function normalizePhotoSourceSplitPercent(input:number):number {
  return Number.isFinite(input)?Math.min(100,Math.max(0,Math.round(input))):50;
}

export function photoSourceSplitMode(input:number):PhotoSourceSplitMode {
  const percent=normalizePhotoSourceSplitPercent(input);
  if(percent===0) return "selected";
  if(percent===100) return "source";
  return "split";
}

export function photoSourceSplitClip(input:number):string {
  const percent=normalizePhotoSourceSplitPercent(input);
  return `inset(0 ${100-percent}% 0 0)`;
}
