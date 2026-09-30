"use client";

import { useEffect, useMemo, useState } from "react";
import type { DesignerClimate, DesignerFabric, DesignerStyle, OccasionTier } from "@/lib/designer/engine";
import { fromLegacyStyle, type StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import { optionById, optionsFor } from "@/lib/designer/options/library";
import type { GarmentOptionGroup } from "@/lib/designer/options/types";
import { evaluateCrossGarmentRules } from "@/lib/designer/rules/evaluator";
import { fabricTileSizePx, liveCapabilities, modelGeometry, type FabricRenderAsset, type PreviewView } from "@/lib/designer/live-preview";
import { BODY_HEIGHT_OPTIONS, BODY_SKIN_TONES, DEFAULT_BODY_PREVIEW_PROFILE, type BodyPreviewProfile } from "@/lib/designer/body-profile";
import { measurePreviewCommit } from "@/lib/designer/preview-performance-client";
import manifest from "../../public/fabric-tiles/manifest.json";

const assets=manifest.assets as Record<string,FabricRenderAsset>;
function assetFor(fabric:DesignerFabric):FabricRenderAsset|null {
  const name=fabric.image.split("/").pop()?.replace(/\.webp(?:\?.*)?$/,"")||"";
  return assets[name]||null;
}
const groups:Array<{title:string;fields:Array<[keyof StyleSpecV2["shirt"]|keyof StyleSpecV2["pant"],GarmentOptionGroup]>}>=[
  {title:"Shirt",fields:[
    ["type","shirt.type"],["collar","shirt.collar"],["cuff","shirt.cuff"],["placket","shirt.placket"],
    ["sleeve","shirt.sleeve"],["fit","shirt.fit"],["length","shirt.length"],["hem","shirt.hem"],
    ["pocket","shirt.pocket"],["back","shirt.back"],["wear","shirt.wear"],["button","shirt.button"],
  ]},
  {title:"Trousers",fields:[
    ["type","pant.type"],["fit","pant.fit"],["rise","pant.rise"],["pleat","pant.pleat"],
    ["waistband","pant.waistband"],["hem","pant.hem"],["break","pant.break"],
  ]},
];

export function LiveConstructionPreview({
  shirt,pant,style,occasion,climate,spec:controlledSpec,onSpecChange,bodyProfile:controlledBody,onBodyProfileChange,
}:{
  shirt:DesignerFabric;
  pant:DesignerFabric;
  style:DesignerStyle;
  occasion:OccasionTier;
  climate:DesignerClimate;
  spec?:StyleSpecV2;
  onSpecChange?:(next:StyleSpecV2)=>void;
  bodyProfile?:BodyPreviewProfile;
  onBodyProfileChange?:(next:BodyPreviewProfile)=>void;
}) {
  const base=useMemo(()=>fromLegacyStyle(style),[style]);
  const [localSpec,setLocalSpec]=useState<StyleSpecV2>(base);
  useEffect(()=>{
    if(!controlledSpec) setLocalSpec(base);
  },[base,controlledSpec]);
  const spec=controlledSpec || localSpec;
  const [view,setView]=useState<PreviewView>("front");
  const [localBody,setLocalBody]=useState<BodyPreviewProfile>(DEFAULT_BODY_PREVIEW_PROFILE);
  const bodyProfile=controlledBody || localBody;
  const [showControls,setShowControls]=useState(false);
  const [optionReviews,setOptionReviews]=useState<Record<string,"approved"|"rejected">>({});
  const [loadedTiles,setLoadedTiles]=useState<Set<string>>(()=>new Set());
  const geometry=useMemo(()=>modelGeometry(spec,view,bodyProfile),[spec,view,bodyProfile]);
  const capabilities=useMemo(()=>liveCapabilities(spec),[spec]);
  const shirtAsset=assetFor(shirt),pantAsset=assetFor(pant);
  useEffect(()=>{
    let cancelled=false;
    fetch("/api/designer/construction-options",{cache:"no-store"})
      .then((response)=>response.ok?response.json():null)
      .then((data:{reviews?:Record<string,"approved"|"rejected">}|null)=>{
        if(cancelled || !data?.reviews) return;
        setOptionReviews(data.reviews);
      })
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    const urls=[shirtAsset?.tileUrl,pantAsset?.tileUrl].filter((value):value is string=>Boolean(value));
    for(const url of urls) {
      if(loadedTiles.has(url)) continue;
      const image=new Image();
      image.decoding="async";
      image.onload=()=>{
        if(cancelled) return;
        setLoadedTiles((current)=>{
          if(current.has(url)) return current;
          const next=new Set(current);next.add(url);return next;
        });
      };
      image.src=url;
    }
    return ()=>{cancelled=true;};
  },[shirtAsset?.tileUrl,pantAsset?.tileUrl,loadedTiles]);
  const rules=useMemo(()=>evaluateCrossGarmentRules({spec,occasion,climate,pantDrapeVerified:false}),[spec,occasion,climate]);
  function change(side:"shirt"|"pant",key:string,id:string) {
    const started=performance.now();
    const next:StyleSpecV2={
      ...spec,
      shirt:{...spec.shirt},
      pant:{...spec.pant},
      legacy:{...spec.legacy},
    };
    (next[side] as Record<string,string>)[key]=id;
    if(onSpecChange) onSpecChange(next);
    else setLocalSpec(next);
    measurePreviewCommit("garment-option",started);
  }
  function changeBody(patch:Partial<BodyPreviewProfile>) {
    const started=performance.now();
    const manualBuild=patch.build!==undefined && patch.build!==bodyProfile.build;
    const next:BodyPreviewProfile={
      ...bodyProfile,
      ...patch,
      version:1,
      source:"manual",
      ...(manualBuild?{silhouette:undefined}:{}),
    };
    if(onBodyProfileChange) onBodyProfileChange(next);
    else setLocalBody(next);
    measurePreviewCommit("body-option",started);
  }
  function changeView(next:PreviewView) {
    const started=performance.now();
    setView(next);
    measurePreviewCommit("view",started);
  }
  const tileSize=fabricTileSizePx;
  const scaleApproximate=shirtAsset?.scaleApproximate!==false||pantAsset?.scaleApproximate!==false;
  const selectedIds=new Set([...Object.values(spec.shirt),...Object.values(spec.pant)]);
  const unsupported=Object.entries(capabilities).filter(([id,value])=>value==="none"&&selectedIds.has(id));
  const selectedOwnerOptions=[...selectedIds]
    .map((id)=>optionById(id))
    .filter((option):option is NonNullable<ReturnType<typeof optionById>>=>Boolean(option?.provenance==="owner-provided"));
  const provisionalSelections=selectedOwnerOptions.filter((option)=>!optionReviews[option.id]);
  const rejectedSelections=selectedOwnerOptions.filter((option)=>optionReviews[option.id]==="rejected");
  const approvedSelections=selectedOwnerOptions.filter((option)=>optionReviews[option.id]==="approved");
  const frontFacing=view==="front"||view==="three-quarter";
  const viewLabel=view==="three-quarter"?"3/4":view.charAt(0).toUpperCase()+view.slice(1);

  return <section className="liveConstruction" aria-label="Live construction preview">
    <div className="liveConstructionHead">
      <div><span>CONSTRUCTION STUDY · LIVE</span><h2>Explore the cut.</h2><p>A consistent model and real catalogue cloth. Shape and scale are approximate until a tailor and measured swatches confirm them.</p></div>
      <div className="liveConstructionSwitches" role="group" aria-label="Preview view">
        <button type="button" aria-pressed={view==="front"} onClick={()=>changeView("front")}>Front</button>
        <button type="button" aria-pressed={view==="three-quarter"} onClick={()=>changeView("three-quarter")}>3/4</button>
        <button type="button" aria-pressed={view==="side"} onClick={()=>changeView("side")}>Side</button>
        <button type="button" aria-pressed={view==="back"} onClick={()=>changeView("back")}>Back</button>
      </div>
    </div>
    <div className="liveConstructionStage">
      <svg viewBox="0 0 640 960" role="img" aria-label={`Approximate ${viewLabel} construction study of ${shirt.name} shirt with ${pant.name} trousers`}>
        <defs>
          <linearGradient id="lcSkin" x1="0" x2="1" y1="0" y2="1"><stop stopColor={BODY_SKIN_TONES[bodyProfile.skinTone].light}/><stop offset=".5" stopColor={BODY_SKIN_TONES[bodyProfile.skinTone].mid}/><stop offset="1" stopColor={BODY_SKIN_TONES[bodyProfile.skinTone].deep}/></linearGradient>
          <linearGradient id="lcClothLight" x1="0" x2="1"><stop stopColor="#111827" stopOpacity=".24"/><stop offset=".23" stopColor="#fff" stopOpacity=".12"/><stop offset=".52" stopColor="#fff" stopOpacity=".03"/><stop offset=".83" stopColor="#111827" stopOpacity=".13"/><stop offset="1" stopColor="#0b1321" stopOpacity=".28"/></linearGradient>
          {([["shirt",shirtAsset,shirt],["pant",pantAsset,pant]] as const).map(([name,asset,fabric])=>{
            const size=tileSize(asset);
            const sourceRotation=asset?.orientation==="horizontal"?90:0;
            const texture=asset
              ? (loadedTiles.has(asset.tileUrl)?asset.tileUrl:asset.placeholderUrl)
              : fabric.image;
            return <pattern key={name} id={`lc-${name}`} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform={`rotate(${sourceRotation} 320 480)`}>
              <rect width={size} height={size} fill={asset?.dominantHex||fabric.hex}/>
              <image href={texture} width={size} height={size} preserveAspectRatio="none" />
            </pattern>;
          })}
          <pattern id="lc-cross" width={tileSize(shirtAsset)} height={tileSize(shirtAsset)} patternUnits="userSpaceOnUse" patternTransform={`rotate(${shirtAsset?.orientation==="horizontal"?180:90} 320 190)`}>
            <rect width={tileSize(shirtAsset)} height={tileSize(shirtAsset)} fill={shirtAsset?.dominantHex||shirt.hex}/>
            <image href={shirtAsset ? (loadedTiles.has(shirtAsset.tileUrl)?shirtAsset.tileUrl:shirtAsset.placeholderUrl) : shirt.image} width={tileSize(shirtAsset)} height={tileSize(shirtAsset)} preserveAspectRatio="none" />
          </pattern>
        </defs>
        <ellipse cx="320" cy="931" rx="182" ry="15" fill="#1b2530" opacity=".09" />
        <g transform={`translate(${geometry.viewShiftX} 0) translate(320 62) skewY(${geometry.viewSkewY}) scale(${geometry.viewScaleX} ${geometry.heightScale}) translate(-320 -62)`}>
        {geometry.shoePaths.map((path,i)=><path key={`shoe-${i}`} d={path} fill="#302e2b" stroke="#232526" strokeWidth="2"/>)}
        <path d={geometry.neckPath} fill="url(#lcSkin)" stroke="#8c7a6e" strokeOpacity=".3"/>
        <path d={geometry.headPath} fill="url(#lcSkin)" stroke="#8c7a6e" strokeOpacity=".36" strokeWidth="2"/>
        {geometry.handPaths.map((path,i)=><path key={`hand-${i}`} d={path} fill="url(#lcSkin)" stroke="#887867" strokeOpacity=".3"/>)}
        {geometry.parts.map((part)=><g key={part.id}>
          <path d={part.path} fill={`url(#lc-${part.fabric})`} stroke="#35404c" strokeOpacity=".46" strokeWidth="2"/>
          <path d={part.path} fill="url(#lcClothLight)" pointerEvents="none"/>
        </g>)}
        {geometry.collarPaths.map((path,i)=><g key={`collar-${i}`}>
          <path d={path} fill={spec.shirt.collarFinish.startsWith("White contrast")?"#eeeae2":"url(#lc-cross)"} stroke="#48515a" strokeWidth="2"/>
          <path d={path} fill="url(#lcClothLight)" opacity=".55"/>
        </g>)}
        {geometry.cuffPaths.map((path,i)=><path key={`cuff-${i}`} d={path} fill={spec.shirt.collarFinish==="White contrast collar + cuffs"?"#eeeae2":"url(#lc-cross)"} stroke="#434951" strokeWidth="1.8"/>)}
        {geometry.pocketPath&&frontFacing&&<path d={geometry.pocketPath} fill="url(#lc-shirt)" stroke="#59626b" strokeOpacity=".7" strokeWidth="1.5"/>}
        {geometry.seams.map((path,i)=><path key={`seam-${i}`} d={path} fill="none" stroke="#1d2730" strokeOpacity=".31" strokeWidth="1.6"/>)}
        {frontFacing&&<g fill="#e8dec9" stroke="#454440" strokeWidth=".8">
          {[244,278,312,346,380].filter((y)=>y<geometry.shirtHemY-10).map((y)=><circle key={y} cx="320" cy={y} r="2.8"/>)}
        </g>}
        </g>
      </svg>
      <span className="liveConstructionTag">{viewLabel.toUpperCase()} / APPROXIMATE LIVE STUDY</span>
    </div>
    <div className="liveConstructionFoot">
      <div><strong>{shirt.name}</strong><span>Shirt cloth</span></div><div><strong>{pant.name}</strong><span>Trouser cloth</span></div>
      <p>{scaleApproximate?"Pattern scale approximate · add owner swatch width/repeat measurements for true scale.":"Pattern scale is calibrated from owner-declared millimetres against the 178 cm reference model."} Body preview: {bodyProfile.build}, {bodyProfile.heightCm} cm · {bodyProfile.silhouette ? `${bodyProfile.silhouette.evidenceCount}/6 preview proportions informed by saved measurements` : "visual approximation"}.</p>
    </div>
    <div className="liveConstructionToolbar">
      <label>Body build <select value={bodyProfile.build} onChange={(event)=>changeBody({build:event.target.value as BodyPreviewProfile["build"]})}>
        <option value="slim">Slim</option><option value="regular">Regular</option><option value="athletic">Athletic</option><option value="broad">Broad</option>
      </select></label>
      <label>Height <select value={bodyProfile.heightCm} onChange={(event)=>changeBody({heightCm:Number(event.target.value)})}>
        {BODY_HEIGHT_OPTIONS.map((item)=><option key={item.id} value={item.heightCm}>{item.label}</option>)}
      </select></label>
      <label>Skin tone <select value={bodyProfile.skinTone} onChange={(event)=>changeBody({skinTone:event.target.value as BodyPreviewProfile["skinTone"]})}>
        {Object.entries(BODY_SKIN_TONES).map(([id,item])=><option key={id} value={id}>{item.label}</option>)}
      </select></label>
      <button type="button" onClick={()=>setShowControls((value)=>!value)} aria-expanded={showControls}>{showControls?"Close cut controls":"Explore shirt & trouser cuts"}</button>
    </div>
    {showControls&&<div className="liveConstructionOptions">
      {groups.map(({title,fields})=><fieldset key={title}><legend>{title}</legend><div>
        {fields.map(([key,group])=><label key={group}>{group.split(".")[1].replace(/\b\w/g,(v)=>v.toUpperCase())}
          <select value={group.startsWith("shirt.")?spec.shirt[key as keyof typeof spec.shirt]:spec.pant[key as keyof typeof spec.pant]} onChange={(event)=>change(group.startsWith("shirt.")?"shirt":"pant",key,event.target.value)}>
            {optionsFor(group).map((option)=>{
              const review=option.provenance==="owner-provided" ? optionReviews[option.id] : undefined;
              const suffix=option.provenance!=="owner-provided" ? "" : review==="approved" ? " ✓ approved" : review==="rejected" ? " · not offered" : " · provisional";
              return <option key={option.id} value={option.id}>{option.label}{suffix}</option>;
            })}
          </select>
          <small>{(()=>{
            const id=group.startsWith("shirt.")?spec.shirt[key as keyof typeof spec.shirt]:spec.pant[key as keyof typeof spec.pant];
            const option=optionById(id);
            if(option?.provenance!=="owner-provided") return "Reference option · preview approximate";
            const review=optionReviews[option.id];
            if(review==="approved") return "House-approved direction · preview still approximate";
            if(review==="rejected") return "Not offered by Linen Earth · experimental preview only";
            return "Provisional option · owner/tailor approval needed";
          })()}</small>
        </label>)}
      </div></fieldset>)}
      <p className="liveConstructionDraftNote">Expanded cut choices are saved with this Designer draft. Final photoreal rendering stays locked until you confirm the design.</p>
      {(rejectedSelections.length>0||provisionalSelections.length>0||approvedSelections.length>0)&&<div className="liveConstructionApprovalState" data-status={rejectedSelections.length?"rejected":provisionalSelections.length?"provisional":"approved"}>
        {rejectedSelections.length>0 ? <><b>NOT A HOUSE-OFFERED CUT</b><span>{rejectedSelections.map((option)=>option.label).join(", ")} has been rejected for Linen Earth offering. Keep it only as an experimental study.</span></>
          : provisionalSelections.length>0 ? <><b>PROVISIONAL CONSTRUCTION</b><span>{provisionalSelections.map((option)=>option.label).join(", ")} still needs owner/tailor approval before it is treated as a Linen Earth house option.</span></>
          : <><b>HOUSE-APPROVED DIRECTION</b><span>{approvedSelections.map((option)=>option.label).join(", ")} has recorded approval. Fit and physical cloth verification are still separate.</span></>}
      </div>}
    </div>}
    <details className="liveConstructionVerdict"><summary>Styling reasons and accuracy</summary>
      {rules.length?<ul>{rules.slice(0,5).map((rule)=><li key={rule.ruleId}><b>{rule.effect.toUpperCase()}</b> {rule.explanation}</li>)}</ul>:<p>No cross-garment conflict from the provisional rules.</p>}
      {unsupported.length>0&&<p>Not shown in preview: {unsupported.map(([id])=>id.replaceAll("_"," ")).join(", ")}.</p>}
      <p>Every visible construction option is approximate. This drawing does not prove drape, fit, fibre, GSM, or finished colour.</p>
    </details>
  </section>;
}
