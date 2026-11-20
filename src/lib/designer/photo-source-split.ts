/**
 * Source-reference wipe between the selected deterministic photo and the
 * unchanged source photograph. Bounded UI presentation only: never alters
 * a style recipe, fabric scale, fit evidence or saved/exported preview pixels.
 */
export function photoSourceSplitClip(input:number):string {
  const percent=Number.isFinite(input)?Math.min(100,Math.max(0,Math.round(input))):50;
  return `inset(0 ${100-percent}% 0 0)`;
}
