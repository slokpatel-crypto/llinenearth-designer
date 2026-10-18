export type ViewerTileScaleAsset={
  tileRealWidthMm?:number|null;
  tileRealHeightMm?:number|null;
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
  // JSON input is untrusted: a numeric-looking string is not a measured
  // supplier dimension and must not be coerced into a physical-scale claim.
  const width=asset?.tileRealWidthMm;
  // A malformed explicit *verified* width must not be silently overwritten
  // with an unrelated runtime estimate. Legacy missing width may still use
  // the declared repeat calibration below.
  if(asset?.scaleApproximate===false && width!=null
    && (typeof width!=="number" || !Number.isFinite(width) || width<=0)) return null;
  if(asset?.scaleApproximate===false && typeof width==="number"
    && Number.isFinite(width) && width>0) return width;

  const repeatMm=runtime?.repeatMm;
  const repeatPx=asset?.repeatPeriodPx;
  if(!runtime || !["declared_repeat","declared_swatch_width"].includes(runtime.physicalScaleStatus)
    || typeof repeatMm!=="number" || !Number.isFinite(repeatMm) || repeatMm<=0
    || typeof repeatPx!=="number" || !Number.isFinite(repeatPx) || repeatPx<=0) return null;

  const resolved=Math.round(200*128*repeatMm/repeatPx)/100;
  return Number.isFinite(resolved) && resolved>0 ? resolved : null;
}

/**
 * A supplier-measured rectangular swatch may declare the physical V tile
 * height separately. Unreviewed/approximate tile heights never gain a
 * physical-scale label. Legacy swatches remain width-only.
 */
export function resolveViewerTileHeightMm(asset:ViewerTileScaleAsset|undefined):number|null {
  if(asset?.scaleApproximate!==false) return null;
  const height=asset.tileRealHeightMm;
  return typeof height==="number" && Number.isFinite(height) && height>0 ? height : null;
}

/**
 * A genuinely absent V dimension is legacy square-tile data, but a present
 * malformed measured height is not. Refuse rendering a counterfeit physical
 * vertical repeat instead of silently treating it as the U width.
 */
export function hasInvalidVerifiedViewerTileWidth(asset:ViewerTileScaleAsset|undefined):boolean {
  if(asset?.scaleApproximate!==false || asset.tileRealWidthMm==null) return false;
  const width=asset.tileRealWidthMm;
  return typeof width!=="number" || !Number.isFinite(width) || width<=0;
}

export function hasInvalidVerifiedViewerTileHeight(asset:ViewerTileScaleAsset|undefined):boolean {
  if(asset?.scaleApproximate!==false || asset.tileRealHeightMm==null) return false;
  const height=asset.tileRealHeightMm;
  return typeof height!=="number" || !Number.isFinite(height) || height<=0;
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
  tileHeightMm:number=tileWidthMm,
):{u:number;v:number} {
  if(!Number.isFinite(widthMm)||widthMm<=0||!Number.isFinite(heightMm)||heightMm<=0
    ||!Number.isFinite(tileWidthMm)||tileWidthMm<=0||!Number.isFinite(tileHeightMm)||tileHeightMm<=0) {
    return {u:1,v:1};
  }
  return {
    u:clamp(widthMm/tileWidthMm,.35,80),
    v:clamp(heightMm/tileHeightMm,.35,80),
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
  tileHeightMm:number=tileWidthMm,
):{
  applied:{u:number;v:number};
  exactScaleWithinRendererLimits:boolean;
  rawRepeats:{u:number;v:number}|null;
  reason:"exact_within_limits"|"missing_physical_dimensions"|"renderer_clamped_repeat";
} {
  const applied=garmentPanelTextureScale(widthMm,heightMm,tileWidthMm,tileHeightMm);
  if(!Number.isFinite(widthMm)||widthMm<=0||!Number.isFinite(heightMm)||heightMm<=0
    ||!Number.isFinite(tileWidthMm)||tileWidthMm<=0||!Number.isFinite(tileHeightMm)||tileHeightMm<=0) {
    return {applied,exactScaleWithinRendererLimits:false,rawRepeats:null,reason:"missing_physical_dimensions"};
  }
  const rawRepeats={u:widthMm/tileWidthMm,v:heightMm/tileHeightMm};
  if(rawRepeats.u<.35||rawRepeats.u>80||rawRepeats.v<.35||rawRepeats.v>80) {
    return {applied,exactScaleWithinRendererLimits:false,rawRepeats,reason:"renderer_clamped_repeat"};
  }
  return {applied,exactScaleWithinRendererLimits:true,rawRepeats,reason:"exact_within_limits"};
}


export type GarmentUvCoordinateUnits="panel_normalized"|"mesh_metres"|"unknown";

/**
 * Translate a real tile width into repeat factors for the actual authored UV
 * units, without silently accepting a normalized-vs-metre convention mismatch.
 *
 * This only proves unit consistency. Planar projection distortion, garment
 * seams, supplier repeat, drape and photo parity remain independently unverified.
 * Never enable the experimental metric-UV scene based on this helper alone.
 */
export function garmentUvRepeatsForUnits(
  uvUnits:GarmentUvCoordinateUnits,
  widthMm:number,
  heightMm:number,
  tileWidthMm:number,
  tileHeightMm:number=tileWidthMm,
):{u:number;v:number}|null {
  if(!Number.isFinite(widthMm)||widthMm<=0
    ||!Number.isFinite(heightMm)||heightMm<=0
    ||!Number.isFinite(tileWidthMm)||tileWidthMm<=0
    ||!Number.isFinite(tileHeightMm)||tileHeightMm<=0) return null;
  if(uvUnits==="panel_normalized") {
    const evidence=garmentPanelTextureScaleEvidence(widthMm,heightMm,tileWidthMm,tileHeightMm);
    return evidence.exactScaleWithinRendererLimits ? evidence.applied : null;
  }
  if(uvUnits==="mesh_metres") {
    const repeatsU=1000/tileWidthMm;
    const repeatsV=1000/tileHeightMm;
    if(!Number.isFinite(repeatsU)||repeatsU<.35||repeatsU>80
      ||!Number.isFinite(repeatsV)||repeatsV<.35||repeatsV>80) return null;
    return {u:repeatsU,v:repeatsV};
  }
  return null;
}

/**
 * Cache only a fully prepared per-panel texture with identical UV settings.
 * The model key prevents texture objects being reused on a different GLB.
 * Different panels must never share the mutable model-viewer sampler object.
 */
export function garmentPanelTexturePreparationKey(input:{
  modelKey:string;panelMaterial:string;fabricUrl:string;normalUrl:string;
  u:number;v:number;offsetU:number;offsetV:number;rotation:number;
}):string {
  return JSON.stringify([
    input.modelKey,input.panelMaterial,input.fabricUrl,input.normalUrl,
    input.u,input.v,input.offsetU,input.offsetV,input.rotation,
  ]);
}

/**
 * Resolve every visible garment panel's UV transform before any asynchronous
 * GPU texture allocation. An invalid sixth panel must not leave five created
 * textures behind or paint a partly refreshed outfit.
 *
 * "null" units intentionally retains the old approximate, safety-clamped
 * prototype preview. A production GLB with declared metric/normalized units
 * cannot use that fallback: its repeat factors must satisfy the strict
 * renderer scale contract for BOTH axes.
 */
export type GarmentPanelUvPreparationInput={
  material:string;
  widthMm:number;
  heightMm:number;
  tileWidthMm:number;
  tileHeightMm:number;
  offsetU?:number;
  offsetV?:number;
  rotationDeg?:number;
};
export type GarmentPanelUvPreparation={
  material:string;
  scale:{u:number;v:number};
  offset:{u:number;v:number};
  rotation:number;
};
export function prepareGarmentPanelUvTransforms(
  units:GarmentUvCoordinateUnits|null,
  panels:readonly GarmentPanelUvPreparationInput[],
):GarmentPanelUvPreparation[]|null {
  if(!Array.isArray(panels)||panels.length===0
    ||(units!==null&&units!=="mesh_metres"&&units!=="panel_normalized")) return null;
  const seen=new Set<string>();
  const plans:GarmentPanelUvPreparation[]=[];
  for(const panel of panels) {
    if(!panel||typeof panel.material!=="string"||!panel.material.trim()||seen.has(panel.material)) return null;
    seen.add(panel.material);
    if(![panel.widthMm,panel.heightMm,panel.tileWidthMm,panel.tileHeightMm]
      .every((value)=>typeof value==="number"&&Number.isFinite(value)&&value>0)) return null;
    // Manifest inputs are untrusted. Never coerce missing-but-malformed phase
    // coordinates, booleans, or strings into physical seam alignment.
    const offsetU=panel.offsetU===undefined?0:panel.offsetU;
    const offsetV=panel.offsetV===undefined?0:panel.offsetV;
    const rotationDeg=panel.rotationDeg===undefined?0:panel.rotationDeg;
    if(![offsetU,offsetV,rotationDeg].every((value)=>typeof value==="number"&&Number.isFinite(value))
      ||Math.abs(offsetU)>10||Math.abs(offsetV)>10||Math.abs(rotationDeg)>360) return null;
    const scale=units===null
      ? garmentPanelTextureScale(panel.widthMm,panel.heightMm,panel.tileWidthMm,panel.tileHeightMm)
      : garmentUvRepeatsForUnits(units,panel.widthMm,panel.heightMm,panel.tileWidthMm,panel.tileHeightMm);
    if(!scale||![scale.u,scale.v].every((value)=>Number.isFinite(value)&&value>0)) return null;
    plans.push({material:panel.material,scale,offset:{u:offsetU,v:offsetV},rotation:rotationDeg*Math.PI/180});
  }
  return plans;
}

/**
 * model-viewer exposes UV sampler setters on the loaded texture. A texture
 * lacking one must NEVER be painted as if a physical textile repeat, grain
 * offset, or rotation were successfully applied. Check the COMPLETE adapter
 * before any mutation to prevent a partial scale/phase update.
 */
export function applyViewerTextureUvTransform(
  texture:{
    sampler?:{
      setScale?:(scale:{u:number;v:number})=>void;
      setOffset?:(offset:{u:number;v:number})=>void;
      setRotation?:(rotation:number)=>void;
    }|null;
  }|null|undefined,
  transform:Pick<GarmentPanelUvPreparation,"scale"|"offset"|"rotation">,
):boolean {
  const sampler=texture?.sampler;
  if(!sampler||typeof sampler.setScale!=="function"
    ||typeof sampler.setOffset!=="function"
    ||typeof sampler.setRotation!=="function") return false;
  sampler.setScale(transform.scale);
  sampler.setOffset(transform.offset);
  sampler.setRotation(transform.rotation);
  return true;
}
