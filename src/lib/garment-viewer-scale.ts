export type ViewerTileScaleAsset={
  tileRealWidthMm?:number|null;
  repeatPeriodPx?:number|null;
  repeatDetected?:boolean;
  scaleApproximate?:boolean;
};

export type ViewerRuntimeRenderScale={
  physicalScaleStatus:"declared_repeat"|"declared_swatch_width"|"unknown";
  repeatMm:number|null;
};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/**
 * Mirrors the existing live-preview runtime calibration contract. A reviewed
 * physical repeat can upgrade an old approximate render tile without rebuilding
 * the asset. Unknown or invalid physical scale remains unknown.
 */
export function resolveViewerTileWidthMm(
  asset:ViewerTileScaleAsset|undefined,
  runtime:ViewerRuntimeRenderScale|undefined,
):number|null {
  const width=asset?.tileRealWidthMm;
  if(asset?.scaleApproximate===false &&
    typeof width==="number"&&Number.isFinite(width)&&width>0) return width;

  // Match the deterministic photo-preview gate: a measured swatch width is
  // not a measured repeat, and stale/unobserved pixel periods are not proof.
  const repeatMm=runtime?.repeatMm;
  const repeatPx=asset?.repeatPeriodPx;
  if(runtime?.physicalScaleStatus!=="declared_repeat" ||
    asset?.repeatDetected!==true ||
    typeof repeatMm!=="number"||!Number.isFinite(repeatMm)||repeatMm<=0 ||
    typeof repeatPx!=="number"||!Number.isFinite(repeatPx)||repeatPx<=0) return null;

  const tileMm=Math.round(200*128*repeatMm/repeatPx)/100;
  return Number.isFinite(tileMm)&&tileMm>0?tileMm:null;
}

/**
 * The temporary M1 model uses one UV span across the visible width/height of
 * each garment panel. Converting both axes through the same physical tile width
 * keeps repeat size consistent between torso, sleeves, waist and trouser legs.
 */
export function garmentPanelTextureScale(
  widthMm:number,
  heightMm:number,
  tileWidthMm:number,
):{u:number;v:number} {
  if(!Number.isFinite(widthMm)||widthMm<=0||!Number.isFinite(heightMm)||heightMm<=0||!Number.isFinite(tileWidthMm)||tileWidthMm<=0) {
    return {u:1,v:1};
  }
  return {
    u:clamp(widthMm/tileWidthMm,.35,80),
    v:clamp(heightMm/tileWidthMm,.35,80),
  };
}
