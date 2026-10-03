export const PHOTO_SHAPE_NEUTRAL_LUMINANCE=128;
export const PHOTO_SHAPE_MIN_LUMINANCE=48;
export const PHOTO_SHAPE_MAX_LUMINANCE=208;
export const PHOTO_SHAPE_CONTRAST_GAIN=.78;
export const PHOTO_SHAPE_LOG_CONTRAST=64;
const PHOTO_SHAPE_LINEAR_EPSILON=1e-4;

function srgbByteToLinear(value:number) {
  const encoded=Math.max(0,Math.min(255,Number.isFinite(value)?value:PHOTO_SHAPE_NEUTRAL_LUMINANCE))/255;
  return encoded<=.04045
    ? encoded/12.92
    : Math.pow((encoded+.055)/1.055,2.4);
}

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
 * Removes the photographed source cloth's base value while keeping relative
 * studio illumination. Intrinsic-image formation is multiplicative
 * (reflectance × shading), so the normalization uses a linear-light luminance
 * ratio in log space instead of treating equal sRGB byte deltas as equal
 * lighting. Mid gray stays neutral for the compositor's soft-light pass.
 */
export function neutralizePhotographicLuminance(
  luminance:number,
  garmentMean:number,
  gain=PHOTO_SHAPE_CONTRAST_GAIN,
) {
  const value=Number.isFinite(luminance)?luminance:PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  const mean=Number.isFinite(garmentMean)?garmentMean:PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  const safeGain=Number.isFinite(gain)?Math.max(0,Math.min(2,gain)):PHOTO_SHAPE_CONTRAST_GAIN;
  const valueLinear=srgbByteToLinear(value);
  const meanLinear=srgbByteToLinear(mean);
  const relativeIllumination=(valueLinear+PHOTO_SHAPE_LINEAR_EPSILON)/(meanLinear+PHOTO_SHAPE_LINEAR_EPSILON);
  const normalized=Math.round(
    PHOTO_SHAPE_NEUTRAL_LUMINANCE+
    Math.log(relativeIllumination)*PHOTO_SHAPE_LOG_CONTRAST*safeGain,
  );
  return Math.max(
    PHOTO_SHAPE_MIN_LUMINANCE,
    Math.min(PHOTO_SHAPE_MAX_LUMINANCE,normalized),
  );
}
