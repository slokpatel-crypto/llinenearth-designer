"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  createPrototypeGarmentGlbUrl,
  GARMENT_PANEL_SPECS,
  PROTOTYPE_MODEL_ID,
} from "@/lib/garment-viewer-prototype";
import { garmentPanelTextureScale, resolveViewerTileWidthMm, type ViewerRuntimeRenderScale } from "@/lib/garment-viewer-scale";
import { validateGarmentViewerModelContract, validateGarmentViewerModelManifest, type GarmentViewerModelContractResult, type GarmentViewerModelManifest, type GarmentViewerManifestValidation } from "@/lib/garment-viewer-model-contract";
import { GARMENT_VIEWER_LATENCY_STORAGE_KEY, garmentViewerAssetIdentityKey, type GarmentViewerAssetIdentity } from "@/lib/garment-viewer-readiness";
import { GARMENT_CATEGORY_LIBRARY } from "@/lib/designer/garment-category-library";
import { optionById } from "@/lib/designer/options/library";

export type GarmentViewerFabric = {
  id:string;
  name:string;
  line:string;
  image:string;
  tileKey:string;
};

type ViewerSampler={
  scale?:{u:number;v:number}|null;
  offset?:{u:number;v:number}|null;
  rotation?:number|null;
  setScale?:(scale:{u:number;v:number}|null)=>void;
  setOffset?:(offset:{u:number;v:number}|null)=>void;
  setRotation?:(rotation:number|null)=>void;
};
type ViewerTexture={
  sampler?:ViewerSampler;
};
type TextureInfo={
  setTexture:(texture:ViewerTexture|null)=>void;
};
type Material={
  name:string;
  pbrMetallicRoughness:{
    baseColorTexture:TextureInfo|null;
    setBaseColorFactor:(color:string|number[])=>void;
    setMetallicFactor:(value:number)=>void;
    setRoughnessFactor:(value:number)=>void;
  };
  normalTexture?:TextureInfo|null;
};
type ModelViewerElement=HTMLElement&{
  model?:{materials:ReadonlyArray<Material>};
  cameraOrbit?:string;
  createTexture?:(url:string)=>Promise<ViewerTexture>;
  updateFraming?:()=>void|Promise<void>;
};
type DesignerDraftRecipe={
  occasion?:string;
  styleSpec?:{
    shirt?:{type?:string};
    pant?:{type?:string};
  };
  style?:{
    collar?:string;
    cuff?:string;
    placket?:string;
    shirtFit?:string;
    shirtWear?:string;
    trouser?:string;
    rise?:string;
    waistband?:string;
    break?:string;
    button?:string;
  };
};
type FabricTileManifest={
  assets?:Record<string,{
    tileRealWidthMm?:number|null;
    repeatPeriodPx?:number|null;
    scaleApproximate?:boolean;
    renderAssetVersion?:string;
  }>;
};
const CAMERA_VIEWS=[
  {id:"front",label:"Front",orbit:"0deg 76deg 2.65m"},
  {id:"three-quarter",label:"3/4",orbit:"35deg 76deg 2.65m"},
  {id:"side",label:"Side",orbit:"90deg 76deg 2.65m"},
  {id:"back",label:"Back",orbit:"180deg 76deg 2.65m"},
] as const;

const SHIRT_GARMENT_CATEGORY=GARMENT_CATEGORY_LIBRARY.find((item)=>item.id==="shirt")!;
const TROUSER_GARMENT_CATEGORY=GARMENT_CATEGORY_LIBRARY.find((item)=>item.id==="trouser")!;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

function createLinenNormalMap() {
  if(typeof document==="undefined") return "";
  const canvas=document.createElement("canvas");
  canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext("2d");
  if(!ctx) return "";
  const image=ctx.createImageData(64,64);
  for(let y=0;y<64;y++){
    for(let x=0;x<64;x++){
      const index=(y*64+x)*4;
      const warp=Math.sin(x*Math.PI*.5)*7;
      const weft=Math.sin(y*Math.PI*.4)*5;
      image.data[index]=clamp(128+warp,0,255);
      image.data[index+1]=clamp(128+weft,0,255);
      image.data[index+2]=252;
      image.data[index+3]=255;
    }
  }
  ctx.putImageData(image,0,0);
  return canvas.toDataURL("image/png");
}

function materialByName(viewer:ModelViewerElement,name:string) {
  return viewer.model?.materials.find((material)=>material.name===name) || null;
}

function measuredTileWidth(
  manifest:FabricTileManifest,
  runtimeScale:Record<string,ViewerRuntimeRenderScale>,
  fabric:GarmentViewerFabric|undefined,
) {
  if(!fabric) return null;
  return resolveViewerTileWidthMm(manifest.assets?.[fabric.tileKey],runtimeScale[fabric.id]);
}

export default function GarmentViewer({shirtFabrics,trouserFabrics,modelSrc=null,modelManifestSrc=null,modelId=PROTOTYPE_MODEL_ID,assetIdentity=null}:{
  shirtFabrics:GarmentViewerFabric[];
  trouserFabrics:GarmentViewerFabric[];
  modelSrc?:string|null;
  modelManifestSrc?:string|null;
  modelId?:string;
  assetIdentity?:GarmentViewerAssetIdentity|null;
}) {
  const viewerRef=useRef<ModelViewerElement|null>(null);
  const normalMapRef=useRef("");
  const applyToken=useRef(0);
  const interactionStartedAt=useRef<number|null>(null);
  const [modelUrl,setModelUrl]=useState("");
  const [engineReady,setEngineReady]=useState(false);
  const [modelReady,setModelReady]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [modelContract,setModelContract]=useState<GarmentViewerModelContractResult|null>(null);
  const [modelManifest,setModelManifest]=useState<GarmentViewerModelManifest|null>(null);
  const [modelManifestValidation,setModelManifestValidation]=useState<GarmentViewerManifestValidation|null>(null);
  const [activeView,setActiveView]=useState("front");
  const [shirtId,setShirtId]=useState(shirtFabrics[0]?.id || "");
  const [trouserId,setTrouserId]=useState(trouserFabrics[0]?.id || "");
  const [tileManifest,setTileManifest]=useState<FabricTileManifest>({});
  const [runtimeScale,setRuntimeScale]=useState<Record<string,ViewerRuntimeRenderScale>>({});
  const [shirtManualTileMm,setShirtManualTileMm]=useState(120);
  const [trouserManualTileMm,setTrouserManualTileMm]=useState(120);
  const [roughness,setRoughness]=useState(.84);
  const [designerDraftRecipe,setDesignerDraftRecipe]=useState<DesignerDraftRecipe|null>(null);
  const draftShirtTypeLabel=designerDraftRecipe?.styleSpec?.shirt?.type ? optionById(designerDraftRecipe.styleSpec.shirt.type)?.label || designerDraftRecipe.styleSpec.shirt.type.replaceAll("_"," ") : "Shirt type not saved";
  const draftTrouserTypeLabel=designerDraftRecipe?.styleSpec?.pant?.type ? optionById(designerDraftRecipe.styleSpec.pant.type)?.label || designerDraftRecipe.styleSpec.pant.type.replaceAll("_"," ") : designerDraftRecipe?.style?.trouser || "Trouser type not saved";

  const shirt=useMemo(()=>shirtFabrics.find((fabric)=>fabric.id===shirtId) || shirtFabrics[0],[shirtFabrics,shirtId]);
  const trouser=useMemo(()=>trouserFabrics.find((fabric)=>fabric.id===trouserId) || trouserFabrics[0],[trouserFabrics,trouserId]);
  const shirtMeasuredTileMm=useMemo(()=>measuredTileWidth(tileManifest,runtimeScale,shirt),[tileManifest,runtimeScale,shirt]);
  const trouserMeasuredTileMm=useMemo(()=>measuredTileWidth(tileManifest,runtimeScale,trouser),[tileManifest,runtimeScale,trouser]);
  const assetIdentityKey=useMemo(()=>garmentViewerAssetIdentityKey(assetIdentity),[assetIdentity]);
  const shirtTileMm=shirtMeasuredTileMm ?? shirtManualTileMm;
  const trouserTileMm=trouserMeasuredTileMm ?? trouserManualTileMm;
  const productionManifestReady=!modelSrc || modelManifestValidation?.valid===true;
  const panelSpecs=useMemo(()=>GARMENT_PANEL_SPECS.map((panel)=>{
    const measured=modelManifest?.panels?.[panel.material];
    return measured ? {...panel,widthMm:measured.widthMm,heightMm:measured.heightMm,offsetU:measured.offsetU,offsetV:measured.offsetV,rotationDeg:measured.rotationDeg} : panel;
  }),[modelManifest]);
  const cameraViews=useMemo(()=>CAMERA_VIEWS.map((view)=>({
    ...view,
    orbit:modelManifest?.cameraOrbits?.[view.id] || view.orbit,
  })),[modelManifest]);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem("linen-earth:real-designer-draft:v2");
      const parsed=raw?JSON.parse(raw) as DesignerDraftRecipe:null;
      if(parsed?.style&&typeof parsed.style==="object") setDesignerDraftRecipe(parsed);
    }catch{/* 3D Lab stays usable without Designer browser state. */}
  },[]);

  useEffect(()=>{
    normalMapRef.current=createLinenNormalMap();
    if(modelSrc) {
      setModelUrl(modelSrc);
      return;
    }
    const url=createPrototypeGarmentGlbUrl();
    setModelUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[modelSrc]);

  useEffect(()=>{
    let cancelled=false;
    void fetch("/fabric-tiles/manifest.json",{cache:"no-store"})
      .then((response)=>response.ok?response.json():null)
      .then((value)=>{if(!cancelled&&value&&typeof value==="object")setTileManifest(value as FabricTileManifest);})
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    let cancelled=false;
    setModelManifest(null);
    setModelManifestValidation(modelSrc ? null : {valid:true,missingPanels:[],invalidPanels:[],reasons:[]});
    if(!modelSrc || !modelManifestSrc) {
      if(modelSrc) setModelManifestValidation({valid:false,missingPanels:GARMENT_PANEL_SPECS.map((panel)=>panel.material),invalidPanels:[],reasons:["Approved production model needs a matching viewer manifest."]});
      return ()=>{cancelled=true;};
    }
    void fetch(modelManifestSrc,{cache:"no-store"})
      .then(async(response)=>{
        if(!response.ok) throw new Error("Approved model manifest could not be loaded.");
        return response.json();
      })
      .then((value)=>{
        if(cancelled) return;
        const validation=validateGarmentViewerModelManifest(value,modelId);
        setModelManifestValidation(validation);
        if(validation.valid) setModelManifest(value as GarmentViewerModelManifest);
      })
      .catch((reason)=>{
        if(cancelled) return;
        setModelManifestValidation({valid:false,missingPanels:GARMENT_PANEL_SPECS.map((panel)=>panel.material),invalidPanels:[],reasons:[reason instanceof Error?reason.message:"Approved model manifest could not be loaded."]});
      });
    return ()=>{cancelled=true;};
  },[modelSrc,modelManifestSrc,modelId]);

  useEffect(()=>{
    let cancelled=false;
    void fetch("/api/designer/catalog",{cache:"no-store"})
      .then((response)=>response.ok?response.json():null)
      .then((value)=>{
        if(cancelled || !value || typeof value!=="object") return;
        const rows=[...((value as {shirts?:unknown[]}).shirts||[]),...((value as {pants?:unknown[]}).pants||[])];
        const next:Record<string,ViewerRuntimeRenderScale>={};
        for(const row of rows){
          if(!row || typeof row!=="object") continue;
          const item=row as {id?:unknown;renderScale?:ViewerRuntimeRenderScale|null};
          const id=String(item.id||"");
          const scale=item.renderScale;
          if(id && scale && ["declared_repeat","declared_swatch_width","unknown"].includes(scale.physicalScaleStatus)) next[id]=scale;
        }
        setRuntimeScale(next);
      })
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    let cancelled=false;
    if(typeof customElements==="undefined") {
      setError("This browser does not expose the custom-elements API required by the 3D viewer.");
      return;
    }
    const timeout=window.setTimeout(()=>{
      if(!cancelled && !customElements.get("model-viewer")) setError("The 3D viewer engine could not be started.");
    },12_000);
    void customElements.whenDefined("model-viewer").then(()=>{
      window.clearTimeout(timeout);
      if(!cancelled){setEngineReady(true);setError("");}
    });
    return ()=>{cancelled=true;window.clearTimeout(timeout);};
  },[]);

  useEffect(()=>{
    const viewer=viewerRef.current;
    if(!viewer) return;
    const load=()=>{
      setModelReady(true);setProgress(1);setError("");
      setModelContract(validateGarmentViewerModelContract({modelId,materialNames:(viewer.model?.materials||[]).map((material)=>material.name)}));
    };
    const fail=()=>{setError("The 3D garment prototype could not be loaded.");setModelReady(false);};
    const update=(event:Event)=>{
      const detail=(event as CustomEvent<{totalProgress?:number}>).detail;
      if(typeof detail?.totalProgress==="number") setProgress(clamp(detail.totalProgress,0,1));
    };
    viewer.addEventListener("load",load);
    viewer.addEventListener("error",fail);
    viewer.addEventListener("progress",update);
    return ()=>{
      viewer.removeEventListener("load",load);
      viewer.removeEventListener("error",fail);
      viewer.removeEventListener("progress",update);
    };
  },[modelUrl,modelId]);

  useEffect(()=>{
    if(!modelReady || !shirt || !trouser || !productionManifestReady || modelContract?.readiness==="contract_failed") return;
    const viewer=viewerRef.current;
    if(!viewer?.createTexture) return;
    const token=++applyToken.current;
    const apply=async()=>{
      try{
        const prepared=await Promise.all(panelSpecs.map(async(panel)=>{
          const fabric=panel.garment==="shirt"?shirt:trouser;
          const tileMm=panel.garment==="shirt"?shirtTileMm:trouserTileMm;
          const [texture,normal]=await Promise.all([
            viewer.createTexture!(fabric.image),
            normalMapRef.current ? viewer.createTexture!(normalMapRef.current) : Promise.resolve(null),
          ]);
          const scale=garmentPanelTextureScale(panel.widthMm,panel.heightMm,tileMm);
          const offset={u:Number(panel.offsetU)||0,v:Number(panel.offsetV)||0};
          const rotation=(Number(panel.rotationDeg)||0)*Math.PI/180;
          texture.sampler?.setScale?.(scale);
          texture.sampler?.setOffset?.(offset);
          texture.sampler?.setRotation?.(rotation);
          normal?.sampler?.setScale?.({u:clamp(scale.u*1.35,.35,100),v:clamp(scale.v*1.35,.35,100)});
          normal?.sampler?.setOffset?.(offset);
          normal?.sampler?.setRotation?.(rotation);
          return {panel,texture,normal};
        }));
        if(token!==applyToken.current) return;
        for(const entry of prepared){
          const material=materialByName(viewer,entry.panel.material);
          if(!material) continue;
          material.pbrMetallicRoughness.setBaseColorFactor("#ffffff");
          material.pbrMetallicRoughness.setMetallicFactor(0);
          material.pbrMetallicRoughness.baseColorTexture?.setTexture(entry.texture);
          if(entry.normal) material.normalTexture?.setTexture(entry.normal);
        }
        if(interactionStartedAt.current!==null && modelSrc && assetIdentityKey && modelContract?.readiness==="contract_ready"){
          const duration=performance.now()-interactionStartedAt.current;
          interactionStartedAt.current=null;
          if(Number.isFinite(duration)&&duration>=0&&duration<=10000){
            try{
              const raw=localStorage.getItem(GARMENT_VIEWER_LATENCY_STORAGE_KEY);
              const previous=raw?JSON.parse(raw):null;
              const samples=previous&&typeof previous==="object"&&!Array.isArray(previous)
                && String((previous as {assetKey?:unknown}).assetKey||"")===assetIdentityKey
                && Array.isArray((previous as {samples?:unknown}).samples)
                ? ((previous as {samples:unknown[]}).samples).map(Number).filter((value)=>Number.isFinite(value)&&value>=0&&value<=10000)
                : [];
              samples.push(Math.round(duration*10)/10);
              localStorage.setItem(GARMENT_VIEWER_LATENCY_STORAGE_KEY,JSON.stringify({assetKey:assetIdentityKey,samples:samples.slice(-120)}));
            }catch{}
          }
        }
        setError("");
      }catch{
        interactionStartedAt.current=null;
        if(token===applyToken.current)setError("Fabric texture application failed. The base 3D model is still available.");
      }
    };
    void apply();
  },[modelReady,shirt,trouser,shirtTileMm,trouserTileMm,panelSpecs,productionManifestReady,modelContract,modelSrc,assetIdentityKey]);

  useEffect(()=>{
    if(!modelReady) return;
    const viewer=viewerRef.current;
    if(!viewer) return;
    for(const panel of panelSpecs){
      const material=materialByName(viewer,panel.material);
      material?.pbrMetallicRoughness.setRoughnessFactor(roughness);
    }
  },[modelReady,roughness,panelSpecs]);

  function beginFabricInteraction(){
    interactionStartedAt.current=performance.now();
  }

  function setCamera(view:(typeof cameraViews)[number]) {
    setActiveView(view.id);
    const viewer=viewerRef.current;
    if(!viewer) return;
    viewer.cameraOrbit=view.orbit;
    viewer.setAttribute("camera-orbit",view.orbit);
  }

  const modelViewer=modelUrl ? createElement("model-viewer",{
    ref:(element:HTMLElement|null)=>{viewerRef.current=element as ModelViewerElement|null;},
    src:modelUrl,
    alt:"Interactive Linen Earth prototype male garment mannequin wearing a shirt and trousers",
    "camera-controls":true,
    "touch-action":"pan-y",
    "camera-orbit":cameraViews[0].orbit,
    "min-camera-orbit":"auto 58deg 2.15m",
    "max-camera-orbit":"auto 92deg 3.6m",
    "interpolation-decay":"130",
    "shadow-intensity":"1.15",
    "shadow-softness":".85",
    "exposure":"1.05",
    "tone-mapping":"commerce",
    loading:"eager",
    "interaction-prompt":"auto",
    className:"garmentModelViewer",
  }) : null;

  return <section className="garmentViewerShell" data-model-readiness={modelContract?.readiness || "loading"} data-manifest-ready={productionManifestReady}>
    <div className="garmentViewerStage">
      <div className="garmentViewerStageHead">
        <span>GARMENTVIEWER · DEEP ENGINE</span>
        <strong>SHIRT + TROUSER · BLAZER / SUIT NEXT</strong>
      </div>
      <div className="garmentViewerCanvas">
        {modelViewer}
        {!modelReady&&<div className="garmentViewerLoading"><i style={{width:`${Math.round(progress*100)}%`}}/><strong>{engineReady?"Loading prototype garment…":"Starting 3D engine…"}</strong><span>{Math.round(progress*100)}%</span></div>}
        {error&&<div className="garmentViewerError">{error}</div>}
      </div>
      <div className="garmentCameraRail" role="group" aria-label="Garment camera views">
        {cameraViews.map((view)=><button key={view.id} type="button" aria-pressed={activeView===view.id} onClick={()=>setCamera(view)}>{view.label}</button>)}
      </div>
      <p className="garmentViewerHint">Drag to rotate · pinch/scroll to zoom · fixed camera buttons interpolate smoothly.</p>
    </div>

    <aside className="garmentViewerControls">
      <div>
        <span className="garmentViewerEyebrow">REAL FABRIC → REUSABLE MODEL</span>
        <h1>3D fabric mapping proof.</h1>
        <p>The same geometry stays fixed while the current live Designer fabric library replaces each shirt and trouser panel material. {shirtFabrics.length} shirt fabrics and {trouserFabrics.length} trouser fabrics use the same active stock source as Designer. Calibrated tile widths are applied panel-by-panel when physical scale exists.</p>
      </div>

      <div className="garmentViewerReference">
        <div><span>SILHOUETTE / DRAPE TARGET</span><b>Current Linen Earth studio reference</b><small>Match the tucked shirt, clean neck/collar junction, hand clearance, waist overlap and straight premium officewear posture before any 3D model is promoted.</small></div>
        <img src="/designer/studio-tucked.webp" alt="Current Linen Earth tucked officewear studio reference"/>
      </div>

      <section className="garmentTypeLibrary" aria-label="Garment type roadmap">
        <div className="garmentTypeLibraryHead"><span>GARMENT TYPES · CURRENT + FUTURE</span><b>Fabric is only one layer. Each garment keeps its own construction details.</b></div>
        <div className="garmentTypeGrid">
          {GARMENT_CATEGORY_LIBRARY.map((garment)=><article key={garment.id} data-status={garment.status}>
            <div><strong>{garment.label}</strong><em>{garment.status==="live"?"LIVE":"FUTURE"}</em></div>
            <small>{garment.stageLabel}</small>
            <p>{garment.description}</p>
            <div className="garmentTypeExamples"><b>Types</b><span>{garment.typeExamples.join(" · ")}</span></div>
            <ul>{garment.detailFamilies.map((detail)=><li key={detail}>{detail}</li>)}</ul>
          </article>)}
        </div>
      </section>

      {designerDraftRecipe?.style&&<section className="garmentDraftRecipe" aria-label="Current Designer garment recipe">
        <div><span>YOUR DESIGNER RECIPE</span><b>{designerDraftRecipe.occasion||"Saved look"}</b></div>
        <div className="garmentDraftRecipeGrid">
          <article><strong>Shirt · {draftShirtTypeLabel}</strong><p>{[designerDraftRecipe.style.collar,designerDraftRecipe.style.cuff,designerDraftRecipe.style.placket,designerDraftRecipe.style.shirtFit,designerDraftRecipe.style.shirtWear].filter(Boolean).join(" · ")}</p></article>
          <article><strong>Trouser · {draftTrouserTypeLabel}</strong><p>{[designerDraftRecipe.style.rise,designerDraftRecipe.style.waistband,designerDraftRecipe.style.break].filter(Boolean).join(" · ")}</p></article>
        </div>
        <small>Recipe is shown for continuity. The temporary 3D block maps fabric now; construction-specific mesh changes remain a later production-model step.</small>
      </section>}

      <div className="garmentCurrentType"><span>ACTIVE GARMENT</span><b>Shirt</b><small>Types: {SHIRT_GARMENT_CATEGORY.typeExamples.slice(0,6).join(" · ")}</small><small>Details: {SHIRT_GARMENT_CATEGORY.detailFamilies.join(" · ")}</small></div>
      <label><span>Shirt fabric</span><select value={shirtId} onChange={(event)=>{beginFabricInteraction();setShirtId(event.target.value);}}>{shirtFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{shirt&&<><img src={shirt.image} alt="" /><span><b>{shirt.name}</b><small>{shirt.line}</small><em data-calibrated={Boolean(shirtMeasuredTileMm)}>{shirtMeasuredTileMm?`Calibrated tile · ${shirtMeasuredTileMm.toFixed(1)} mm`:`Approximate tile · ${shirtManualTileMm} mm`}</em></span></>}</div>
      {!shirtMeasuredTileMm&&<label className="garmentRange"><span>Approx. shirt tile width <b>{shirtManualTileMm} mm</b></span><input type="range" min="30" max="260" step="5" value={shirtManualTileMm} onChange={(event)=>setShirtManualTileMm(Number(event.target.value))}/><small>Temporary only until owner/supplier physical scale is verified.</small></label>}

      <div className="garmentCurrentType"><span>ACTIVE GARMENT</span><b>Trouser</b><small>Types: {TROUSER_GARMENT_CATEGORY.typeExamples.slice(0,6).join(" · ")}</small><small>Details: {TROUSER_GARMENT_CATEGORY.detailFamilies.join(" · ")}</small></div>
      <label><span>Trouser fabric</span><select value={trouserId} onChange={(event)=>{beginFabricInteraction();setTrouserId(event.target.value);}}>{trouserFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{trouser&&<><img src={trouser.image} alt="" /><span><b>{trouser.name}</b><small>{trouser.line}</small><em data-calibrated={Boolean(trouserMeasuredTileMm)}>{trouserMeasuredTileMm?`Calibrated tile · ${trouserMeasuredTileMm.toFixed(1)} mm`:`Approximate tile · ${trouserManualTileMm} mm`}</em></span></>}</div>
      {!trouserMeasuredTileMm&&<label className="garmentRange"><span>Approx. trouser tile width <b>{trouserManualTileMm} mm</b></span><input type="range" min="30" max="260" step="5" value={trouserManualTileMm} onChange={(event)=>setTrouserManualTileMm(Number(event.target.value))}/><small>Temporary only until owner/supplier physical scale is verified.</small></label>}

      <label className="garmentRange"><span>Surface roughness <b>{roughness.toFixed(2)}</b></span><input type="range" min=".55" max=".98" step=".01" value={roughness} onChange={(event)=>setRoughness(Number(event.target.value))}/><small>Linen stays non-metallic; roughness controls how dry or polished the temporary PBR surface reads.</small></label>

      <div className="garmentViewerFacts">
        <span><small>MODEL</small><b>{modelContract?.readiness==="contract_ready"&&productionManifestReady?"Production contract":"Reusable GLB"}</b></span>
        <span><small>FABRIC</small><b>Panel-scaled PBR</b></span>
        <span><small>VIEWS</small><b>4 fixed + free</b></span>
        <span><small>AI CREDITS</small><b>0</b></span>
      </div>
      <p className="garmentViewerGuardrail">{modelContract?.readiness==="contract_failed" ? `Model contract blocked: ${modelContract.reasons.join(" ")}` : modelSrc&&!productionManifestReady ? `Model manifest blocked: ${(modelManifestValidation?.reasons||["Manifest verification is pending."]).join(" ")}` : modelContract?.readiness==="contract_ready" ? "Approved GLB + physical panel manifest are active. Continue realism and boundary QA before promotion to the customer Designer." : "Next realism step: replace this temporary block mannequin with the approved Linen Earth office-wear body/garment mesh. The panel material, physical-scale and camera architecture remains reusable."}</p>
    </aside>
  </section>;
}
