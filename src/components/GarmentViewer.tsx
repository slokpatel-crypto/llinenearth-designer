"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  createPrototypeGarmentGlbUrl,
  GARMENT_PANEL_SPECS,
  PROTOTYPE_MODEL_ID,
} from "@/lib/garment-viewer-prototype";
import { garmentPanelTextureScale, resolveViewerTileWidthMm, type ViewerRuntimeRenderScale } from "@/lib/garment-viewer-scale";
import { validateGarmentViewerModelContract, type GarmentViewerModelContractResult } from "@/lib/garment-viewer-model-contract";

export type GarmentViewerFabric = {
  id:string;
  name:string;
  line:string;
  image:string;
  tileKey:string;
};

type ViewerSampler={
  scale?:{u:number;v:number}|null;
  setScale?:(scale:{u:number;v:number}|null)=>void;
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

export default function GarmentViewer({shirtFabrics,trouserFabrics,modelSrc=null,modelId=PROTOTYPE_MODEL_ID}:{
  shirtFabrics:GarmentViewerFabric[];
  trouserFabrics:GarmentViewerFabric[];
  modelSrc?:string|null;
  modelId?:string;
}) {
  const viewerRef=useRef<ModelViewerElement|null>(null);
  const normalMapRef=useRef("");
  const applyToken=useRef(0);
  const [modelUrl,setModelUrl]=useState("");
  const [engineReady,setEngineReady]=useState(false);
  const [modelReady,setModelReady]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [modelContract,setModelContract]=useState<GarmentViewerModelContractResult|null>(null);
  const [activeView,setActiveView]=useState("front");
  const [shirtId,setShirtId]=useState(shirtFabrics[0]?.id || "");
  const [trouserId,setTrouserId]=useState(trouserFabrics[0]?.id || "");
  const [manifest,setManifest]=useState<FabricTileManifest>({});
  const [runtimeScale,setRuntimeScale]=useState<Record<string,ViewerRuntimeRenderScale>>({});
  const [shirtManualTileMm,setShirtManualTileMm]=useState(120);
  const [trouserManualTileMm,setTrouserManualTileMm]=useState(120);
  const [roughness,setRoughness]=useState(.84);

  const shirt=useMemo(()=>shirtFabrics.find((fabric)=>fabric.id===shirtId) || shirtFabrics[0],[shirtFabrics,shirtId]);
  const trouser=useMemo(()=>trouserFabrics.find((fabric)=>fabric.id===trouserId) || trouserFabrics[0],[trouserFabrics,trouserId]);
  const shirtMeasuredTileMm=useMemo(()=>measuredTileWidth(manifest,runtimeScale,shirt),[manifest,runtimeScale,shirt]);
  const trouserMeasuredTileMm=useMemo(()=>measuredTileWidth(manifest,runtimeScale,trouser),[manifest,runtimeScale,trouser]);
  const shirtTileMm=shirtMeasuredTileMm ?? shirtManualTileMm;
  const trouserTileMm=trouserMeasuredTileMm ?? trouserManualTileMm;

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
      .then((value)=>{if(!cancelled&&value&&typeof value==="object")setManifest(value as FabricTileManifest);})
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

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
    if(!modelReady || !shirt || !trouser) return;
    const viewer=viewerRef.current;
    if(!viewer?.createTexture) return;
    const token=++applyToken.current;
    const apply=async()=>{
      try{
        const prepared=await Promise.all(GARMENT_PANEL_SPECS.map(async(panel)=>{
          const fabric=panel.garment==="shirt"?shirt:trouser;
          const tileMm=panel.garment==="shirt"?shirtTileMm:trouserTileMm;
          const [texture,normal]=await Promise.all([
            viewer.createTexture!(fabric.image),
            normalMapRef.current ? viewer.createTexture!(normalMapRef.current) : Promise.resolve(null),
          ]);
          const scale=garmentPanelTextureScale(panel.widthMm,panel.heightMm,tileMm);
          texture.sampler?.setScale?.(scale);
          normal?.sampler?.setScale?.({u:clamp(scale.u*1.35,.35,100),v:clamp(scale.v*1.35,.35,100)});
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
        setError("");
      }catch{
        if(token===applyToken.current)setError("Fabric texture application failed. The base 3D model is still available.");
      }
    };
    void apply();
  },[modelReady,shirt,trouser,shirtTileMm,trouserTileMm]);

  useEffect(()=>{
    if(!modelReady) return;
    const viewer=viewerRef.current;
    if(!viewer) return;
    for(const panel of GARMENT_PANEL_SPECS){
      const material=materialByName(viewer,panel.material);
      material?.pbrMetallicRoughness.setRoughnessFactor(roughness);
    }
  },[modelReady,roughness]);

  function setCamera(view:(typeof CAMERA_VIEWS)[number]) {
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
    "camera-orbit":CAMERA_VIEWS[0].orbit,
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

  return <section className="garmentViewerShell">
    <div className="garmentViewerStage">
      <div className="garmentViewerStageHead">
        <span>GARMENTVIEWER · MILESTONE 1</span>
        <strong>{modelId}</strong>
      </div>
      <div className="garmentViewerCanvas">
        {modelViewer}
        {!modelReady&&<div className="garmentViewerLoading"><i style={{width:`${Math.round(progress*100)}%`}}/><strong>{engineReady?"Loading prototype garment…":"Starting 3D engine…"}</strong><span>{Math.round(progress*100)}%</span></div>}
        {error&&<div className="garmentViewerError">{error}</div>}
      </div>
      <div className="garmentCameraRail" role="group" aria-label="Garment camera views">
        {CAMERA_VIEWS.map((view)=><button key={view.id} type="button" aria-pressed={activeView===view.id} onClick={()=>setCamera(view)}>{view.label}</button>)}
      </div>
      <p className="garmentViewerHint">Drag to rotate · pinch/scroll to zoom · fixed camera buttons interpolate smoothly.</p>
    </div>

    <aside className="garmentViewerControls">
      <div>
        <span className="garmentViewerEyebrow">REAL FABRIC → REUSABLE MODEL</span>
        <h1>3D fabric mapping proof.</h1>
        <p>The same geometry stays fixed while seamless Linen Earth fabric tiles replace each shirt and trouser panel material. Calibrated tile widths are applied panel-by-panel when physical scale exists.</p>
      </div>

      <label><span>Shirt fabric</span><select value={shirtId} onChange={(event)=>setShirtId(event.target.value)}>{shirtFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{shirt&&<><img src={shirt.image} alt="" /><span><b>{shirt.name}</b><small>{shirt.line}</small><em data-calibrated={Boolean(shirtMeasuredTileMm)}>{shirtMeasuredTileMm?`Calibrated tile · ${shirtMeasuredTileMm.toFixed(1)} mm`:`Approximate tile · ${shirtManualTileMm} mm`}</em></span></>}</div>
      {!shirtMeasuredTileMm&&<label className="garmentRange"><span>Approx. shirt tile width <b>{shirtManualTileMm} mm</b></span><input type="range" min="30" max="260" step="5" value={shirtManualTileMm} onChange={(event)=>setShirtManualTileMm(Number(event.target.value))}/><small>Temporary only until owner/supplier physical scale is verified.</small></label>}

      <label><span>Trouser fabric</span><select value={trouserId} onChange={(event)=>setTrouserId(event.target.value)}>{trouserFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{trouser&&<><img src={trouser.image} alt="" /><span><b>{trouser.name}</b><small>{trouser.line}</small><em data-calibrated={Boolean(trouserMeasuredTileMm)}>{trouserMeasuredTileMm?`Calibrated tile · ${trouserMeasuredTileMm.toFixed(1)} mm`:`Approximate tile · ${trouserManualTileMm} mm`}</em></span></>}</div>
      {!trouserMeasuredTileMm&&<label className="garmentRange"><span>Approx. trouser tile width <b>{trouserManualTileMm} mm</b></span><input type="range" min="30" max="260" step="5" value={trouserManualTileMm} onChange={(event)=>setTrouserManualTileMm(Number(event.target.value))}/><small>Temporary only until owner/supplier physical scale is verified.</small></label>}

      <label className="garmentRange"><span>Surface roughness <b>{roughness.toFixed(2)}</b></span><input type="range" min=".55" max=".98" step=".01" value={roughness} onChange={(event)=>setRoughness(Number(event.target.value))}/><small>Linen stays non-metallic; roughness controls how dry or polished the temporary PBR surface reads.</small></label>

      <div className="garmentViewerFacts">
        <span><small>MODEL</small><b>{modelContract?.readiness==="contract_ready"?"Production contract":"Reusable GLB"}</b></span>
        <span><small>FABRIC</small><b>Panel-scaled PBR</b></span>
        <span><small>VIEWS</small><b>4 fixed + free</b></span>
        <span><small>AI CREDITS</small><b>0</b></span>
      </div>
      <p className="garmentViewerGuardrail">{modelContract?.readiness==="contract_failed" ? `Model contract blocked: ${modelContract.reasons.join(" ")}` : modelContract?.readiness==="contract_ready" ? "Approved GLB contract is active. Continue geometry, UV and realism QA before promotion to the customer Designer." : "Next realism step: replace this temporary block mannequin with the approved Linen Earth office-wear body/garment mesh. The panel material, physical-scale and camera architecture remains reusable."}</p>
    </aside>
  </section>;
}
