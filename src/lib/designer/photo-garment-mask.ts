export type PhotographicGarmentRegion="shirt"|"pant";
const unit=(value:number)=>Math.max(0,Math.min(1,value));

/** Keep photographic colour segmentation at the traced edge, but do not use
 * tiny source-cloth RGB differences to punch holes through its known interior.
 * The blurred geometric mask supplies conservative interior coverage only.
 * Bright skin, shoes and floor remain excluded by the source brightness gate.
 */
export function photographicGarmentOpacity(
  region:PhotographicGarmentRegion,
  red:number,green:number,blue:number,
  geometryAlpha:number,blurredGeometryAlpha:number,
):number {
  if(![red,green,blue,geometryAlpha,blurredGeometryAlpha].every(Number.isFinite)) return 0;
  const geometry=unit(geometryAlpha/255);
  if(!geometry) return 0;
  // Fully recover folds a few pixels inside the boundary. Requiring almost
  // opaque blurred coverage left dark neutral folds beside the armhole exposed.
  const interior=unit((blurredGeometryAlpha-210)/24);
  const chroma=region==="shirt"
    ? unit((Math.min(green-red,blue-red-1)-1)/4)
    : unit(Math.min(red-green-3,red-blue-5)/7);
  const clothBrightness=region==="shirt"
    ? unit((165-Math.max(red,green,blue))/35)
    : unit((195-red)/12);
  return geometry*clothBrightness*Math.max(chroma,interior);
}

/** The existing neck-clear region also contains inner collar cloth. Its cool
 * source chroma and very dark cloth shadows distinguish it from this photograph's
 * brighter warm mannequin skin. A positive classification covers cloth without weakening deep
 * collar shadows merely because their RGB differences are small. */
export function photographicCollarOpacity(red:number,green:number,blue:number,geometryAlpha:number):number {
  if(![red,green,blue,geometryAlpha].every(Number.isFinite)) return 0;
  const sourceBrightness=Math.max(red,green,blue);
  // In this bounded source neckline, neutral near-black pixels are collar
  // folds. Quantised hue differences there cannot be used as coverage alpha.
  if(sourceBrightness>=100 && (green-red<=1 || blue-red<=1)) return 0;
  return unit(geometryAlpha/255)*unit((165-Math.max(red,green,blue))/35);
}
