/**
 * Source swatch photographs may include printed catalogue colour names below
 * the upper cloth field. The photo compositor must never tile those captions
 * as garment texture. Keep the original source and physical-evidence flags.
 *
 * The cut deliberately samples the upper 4%–36% of each image rather than the
 * former 18%–50% zone, which could intersect text near the image centre.
 * This is a visual asset crop, not a calibrated physical textile measurement.
 * The small-image floor also supports browser QA and thumbnail fallbacks; the
 * build-time catalogue pipeline separately requires >=150px source images.
 */
export function photoFabricCaptionSafeCrop(imageWidth: number, imageHeight: number) {
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) ||
      imageWidth < 32 || imageHeight < 32) {
    throw new RangeError("Expected valid swatch dimensions of at least 32px.");
  }
  const cropSide = Math.min(Math.round(imageWidth * 0.58), Math.round(imageHeight * 0.32));
  const left = Math.max(0, Math.round((imageWidth - cropSide) / 2));
  const top = Math.max(0, Math.round(imageHeight * 0.04));
  if (left + cropSide > imageWidth || top + cropSide > imageHeight ||
      top + cropSide > imageHeight * 0.38) {
    throw new RangeError("Swatch crop exceeds the verified upper cloth region.");
  }
  return { left, top, width: cropSide, height: cropSide };
}
