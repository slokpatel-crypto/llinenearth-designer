export type ViewerTileScaleAsset={
  tileRealWidthMm?:number|null;
  repeatPeriodPx?:number|null;
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
  const width=Number(asset?.tileRealWidthMm);
  if(asset?.scaleApproximate===false && Number.isFinite(width) && width>0) return width;

  const repeatMm=Number(runtime?.repeatMm);
  const repeatPx=Number(asset?.repeatPeriodPx);
  if(!runtime || runtime.physicalScaleStatus==="unknown"
    || !Number.isFinite(repeatMm) || repeatMm<=0
    || !Number.isFinite(repeatPx) || repeatPx<=0) return null;

  return Math.round(200*128*repeatMm/repeatPx)/100;
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
    // Sub-5 mm pinstripes need hundreds of physically sized repeats across
    // the body. The old 80-repeat cap enlarged them by 2-5x; likewise the
    // .35 floor shrank a wide check on narrow collars/cuffs. Limit only
    // astronomically small/large sampler transforms, not valid cloth scales.
    u:clamp(widthMm/tileWidthMm,1/4096,4096),
    v:clamp(heightMm/tileWidthMm,1/4096,4096),
  };
}
