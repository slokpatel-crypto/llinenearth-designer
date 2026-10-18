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
  if(!runtime || !["declared_repeat","declared_swatch_width"].includes(runtime.physicalScaleStatus)
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
    u:clamp(widthMm/tileWidthMm,.35,80),
    v:clamp(heightMm/tileWidthMm,.35,80),
  };
}


/**
 * Exactness receipt for the existing bounded preview renderer.
 * A visually rendered tile is NOT physically exact if renderer safety clamps
 * changed its authored repeat count, or if physical dimensions are unknown.
 * This is diagnostic-only and does not alter production scale or permissions.
 */
export function garmentPanelTextureScaleEvidence(
  widthMm:number,
  heightMm:number,
  tileWidthMm:number,
):{
  applied:{u:number;v:number};
  exactScaleWithinRendererLimits:boolean;
  rawRepeats:{u:number;v:number}|null;
  reason:"exact_within_limits"|"missing_physical_dimensions"|"renderer_clamped_repeat";
} {
  const applied=garmentPanelTextureScale(widthMm,heightMm,tileWidthMm);
  if(!Number.isFinite(widthMm)||widthMm<=0||!Number.isFinite(heightMm)||heightMm<=0||!Number.isFinite(tileWidthMm)||tileWidthMm<=0) {
    return {applied,exactScaleWithinRendererLimits:false,rawRepeats:null,reason:"missing_physical_dimensions"};
  }
  const rawRepeats={u:widthMm/tileWidthMm,v:heightMm/tileWidthMm};
  if(rawRepeats.u<.35||rawRepeats.u>80||rawRepeats.v<.35||rawRepeats.v>80) {
    return {applied,exactScaleWithinRendererLimits:false,rawRepeats,reason:"renderer_clamped_repeat"};
  }
  return {applied,exactScaleWithinRendererLimits:true,rawRepeats,reason:"exact_within_limits"};
}
