export type ViewerTileScaleAsset={
  tileRealWidthMm?:number|null;
  repeatPeriodPx?:number|null;
  scaleApproximate?:boolean;
};

export type ViewerPanelUvUnits="normalized_panel"|"mesh_metres";

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
  uvUnits:ViewerPanelUvUnits="normalized_panel",
):{u:number;v:number} {
  if(!Number.isFinite(widthMm)||widthMm<=0||!Number.isFinite(heightMm)||heightMm<=0||!Number.isFinite(tileWidthMm)||tileWidthMm<=0) {
    return {u:1,v:1};
  }
  // Legacy candidate and prototype UV span 0..1 per panel; new Blender
  // source-derived UVs express both axes in METRES. Applying panel dimensions
  // again to the latter would shrink the pattern twice and break true scale.
  const raw=uvUnits==="mesh_metres"
    ? {u:1000/tileWidthMm,v:1000/tileWidthMm}
    : {u:widthMm/tileWidthMm,v:heightMm/tileWidthMm};
  return {
    u:clamp(raw.u,.35,80),
    v:clamp(raw.v,.35,80),
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
  uvUnits:ViewerPanelUvUnits="normalized_panel",
):{
  applied:{u:number;v:number};
  exactScaleWithinRendererLimits:boolean;
  rawRepeats:{u:number;v:number}|null;
  reason:"exact_within_limits"|"missing_physical_dimensions"|"renderer_clamped_repeat";
} {
  const applied=garmentPanelTextureScale(widthMm,heightMm,tileWidthMm,uvUnits);
  if(!Number.isFinite(widthMm)||widthMm<=0||!Number.isFinite(heightMm)||heightMm<=0||!Number.isFinite(tileWidthMm)||tileWidthMm<=0) {
    return {applied,exactScaleWithinRendererLimits:false,rawRepeats:null,reason:"missing_physical_dimensions"};
  }
  const rawRepeats=uvUnits==="mesh_metres"
    ? {u:1000/tileWidthMm,v:1000/tileWidthMm}
    : {u:widthMm/tileWidthMm,v:heightMm/tileWidthMm};
  if(rawRepeats.u<.35||rawRepeats.u>80||rawRepeats.v<.35||rawRepeats.v>80) {
    return {applied,exactScaleWithinRendererLimits:false,rawRepeats,reason:"renderer_clamped_repeat"};
  }
  return {applied,exactScaleWithinRendererLimits:true,rawRepeats,reason:"exact_within_limits"};
}
