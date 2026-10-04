export const PHOTO_SHAPE_NEUTRAL_LUMINANCE=128;
export const PHOTO_SHAPE_MIN_LUMINANCE=48;
export const PHOTO_SHAPE_MAX_LUMINANCE=208;
export const PHOTO_SHAPE_CONTRAST_GAIN=.78;
export const PHOTO_SHAPE_LOG_CONTRAST=64;
const PHOTO_SHAPE_LINEAR_EPSILON=1e-4;

/** Neutral padding for garment-local filtering. Background/skin must never
 * become a highlight just because a blur kernel crosses the cloth boundary. */
export function maskedPhotographicLuminance(luminance:number,garmentMean:number,alpha:number) {
  const mean=Number.isFinite(garmentMean)?Math.max(0,Math.min(255,garmentMean)):PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  const value=Number.isFinite(luminance)?Math.max(0,Math.min(255,luminance)):mean;
  const weight=Number.isFinite(alpha)?Math.max(0,Math.min(1,alpha/255)):0;
  return Math.round(value*weight+mean*(1-weight));
}

function srgbByteToLinear(value:number) {
  const encoded=Math.max(0,Math.min(255,Number.isFinite(value)?value:PHOTO_SHAPE_NEUTRAL_LUMINANCE))/255;
  return encoded<=.04045
    ? encoded/12.92
    : Math.pow((encoded+.055)/1.055,2.4);
}

function linearToSrgbByte(value:number) {
  const linear=Math.max(0,Math.min(1,Number.isFinite(value)?value:srgbByteToLinear(PHOTO_SHAPE_NEUTRAL_LUMINANCE)));
  const encoded=linear<=.0031308
    ? linear*12.92
    : 1.055*Math.pow(linear,1/2.4)-.055;
  return Math.round(Math.max(0,Math.min(1,encoded))*255);
}

/**
 * Estimates the photographed garment's base luminance from the active alpha
 * mask. Because the later shape normalization is multiplicative in linear
 * light, the baseline is a weighted log-average of linear luminance rather
 * than an arithmetic mean of gamma-encoded sRGB bytes. This reduces bright
 * specular/highlight pixels dominating the cloth baseline while keeping a
 * constant garment value unchanged.
 */
export function weightedGarmentLuminanceMean(
  grayscaleRgba:ArrayLike<number>,
  maskRgba:ArrayLike<number>,
) {
  if(grayscaleRgba.length!==maskRgba.length || grayscaleRgba.length<4 || grayscaleRgba.length%4!==0) {
    return PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  }
  let weightedLogLuminance=0;
  let totalWeight=0;
  for(let index=0;index<grayscaleRgba.length;index+=4) {
    const weight=Number(maskRgba[index+3])/255;
    const luminance=Number(grayscaleRgba[index]);
    if(!Number.isFinite(weight) || weight<.04 || !Number.isFinite(luminance)) continue;
    weightedLogLuminance+=Math.log(srgbByteToLinear(luminance)+PHOTO_SHAPE_LINEAR_EPSILON)*weight;
    totalWeight+=weight;
  }
  if(totalWeight<=0 || !Number.isFinite(weightedLogLuminance)) return PHOTO_SHAPE_NEUTRAL_LUMINANCE;
  const linearMean=Math.max(0,Math.exp(weightedLogLuminance/totalWeight)-PHOTO_SHAPE_LINEAR_EPSILON);
  return linearToSrgbByte(linearMean);
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
