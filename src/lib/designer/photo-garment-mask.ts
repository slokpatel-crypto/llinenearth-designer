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
  const interior=unit((blurredGeometryAlpha-248)/6);
  const chroma=region==="shirt"
    ? unit((Math.min(green-red,blue-red-1)-1)/4)
    : unit(Math.min(red-green-3,red-blue-5)/7);
  const clothBrightness=region==="shirt"
    ? unit((165-Math.max(red,green,blue))/35)
    : unit((195-red)/12);
  return geometry*clothBrightness*Math.max(chroma,interior);
}
