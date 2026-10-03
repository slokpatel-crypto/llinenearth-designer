export const PHOTO_SHAPE_NEUTRAL_LUMINANCE=128;
export const PHOTO_SHAPE_MIN_LUMINANCE=48;
export const PHOTO_SHAPE_MAX_LUMINANCE=208;
export const PHOTO_SHAPE_CONTRAST_GAIN=.78;

/**
 * Calculates the average photographed luminance inside a garment alpha mask.
 * Inputs are RGBA arrays from equally sized canvases. Transparent/outside
 * pixels do not influence the source-cloth baseline.
 */
export function weightedGarmentLuminanceMean(
  grayscaleRgba:ArrayLike<number>,
  maskRgba:ArrayLike<number>,
) {
  if(grayscaleRgba.length!==maskRgba.length || grayscaleRgba.length<4 || grayscaleRgba.length%4!==0) {
    return PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  }
  let weightedLuminance=0;
  let totalWeight=0;
  for(let index=0;index<grayscaleRgba.length;index+=4) {
    const weight=Number(maskRgba[index+3])/255;
    if(!Number.isFinite(weight) || weight<.04) continue;
    weightedLuminance+=Number(grayscaleRgba[index])*weight;
    totalWeight+=weight;
  }
  return totalWeight>0 && Number.isFinite(weightedLuminance)
    ? weightedLuminance/totalWeight
    : PHOTO_SHAPE_NEUTRAL_LUMINANCE;
}

/**
 * Removes the source garment's base value while keeping relative studio
 * highlights/shadows. Equal lighting deltas normalize identically whether the
 * photographed source cloth is dark, mid or pale.
 */
export function neutralizePhotographicLuminance(
  luminance:number,
  garmentMean:number,
  gain=PHOTO_SHAPE_CONTRAST_GAIN,
) {
  const value=Number.isFinite(luminance)?luminance:PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  const mean=Number.isFinite(garmentMean)?garmentMean:PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  const safeGain=Number.isFinite(gain)?Math.max(0,Math.min(2,gain)):PHOTO_SHAPE_CONTRAST_GAIN;
  return Math.max(
    PHOTO_SHAPE_MIN_LUMINANCE,
    Math.min(
      PHOTO_SHAPE_MAX_LUMINANCE,
      Math.round(PHOTO_SHAPE_NEUTRAL_LUMINANCE+(value-mean)*safeGain),
    ),
  );
}
