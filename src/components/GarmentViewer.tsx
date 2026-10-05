"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { createPrototypeGarmentGlbUrl, PROTOTYPE_MODEL_ID } from "@/lib/garment-viewer-prototype";

export type GarmentViewerFabric = {
  id:string;
  name:string;
  line:string;
  image:string;
};

type TextureInfo={
  setTexture:(texture:unknown|null)=>void;
  setScale?:(scale:{u:number;v:number})=>void;
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
  setNormalScale?:(value:number)=>void;
};
type ModelViewerElement=HTMLElement&{
  model?:{materials:ReadonlyArray<Material>};
  cameraOrbit?:string;
  createTexture?:(url:string)=>Promise<unknown>;
  updateFraming?:()=>void|Promise<void>;
};

const CAMERA_VIEWS=[
  {id:"front",label:"Front",orbit:"0deg 76deg 2.65m"},
  {id:"three-quarter",label:"3/4",orbit:"35deg 76deg 2.65m"},
  {id:"side",label:"Side",orbit:"90deg 76deg 2.65m"},
  {id:"back",label:"Back",orbit:"180deg 76deg 2.65m"},
] as const;

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
      image.data[index]=Math.max(0,Math.min(255,128+warp));
      image.data[index+1]=Math.max(0,Math.min(255,128+weft));
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

export default function GarmentViewer({shirtFabrics,trouserFabrics}:{
  shirtFabrics:GarmentViewerFabric[];
  trouserFabrics:GarmentViewerFabric[];
}) {
  const viewerRef=useRef<ModelViewerElement|null>(null);
  const normalMapRef=useRef("");
  const applyToken=useRef(0);
  const [modelUrl,setModelUrl]=useState("");
  const [engineReady,setEngineReady]=useState(false);
  const [modelReady,setModelReady]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [activeView,setActiveView]=useState("front");
  const [shirtId,setShirtId]=useState(shirtFabrics[0]?.id || "");
  const [trouserId,setTrouserId]=useState(trouserFabrics[0]?.id || "");
  const [textureScale,setTextureScale]=useState(3.2);
  const [roughness,setRoughness]=useState(.84);

  const shirt=useMemo(()=>shirtFabrics.find((fabric)=>fabric.id===shirtId) || shirtFabrics[0],[shirtFabrics,shirtId]);
  const trouser=useMemo(()=>trouserFabrics.find((fabric)=>fabric.id===trouserId) || trouserFabrics[0],[trouserFabrics,trouserId]);

  useEffect(()=>{
    const url=createPrototypeGarmentGlbUrl();
    setModelUrl(url);
    normalMapRef.current=createLinenNormalMap();
    return ()=>URL.revokeObjectURL(url);
  },[]);

  useEffect(()=>{
    let cancelled=false;
    if(typeof customElements==="undefined") return;
    void customElements.whenDefined("model-viewer").then(()=>{if(!cancelled)setEngineReady(true);});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    const viewer=viewerRef.current;
    if(!viewer) return;
    const load=()=>{setModelReady(true);setProgress(1);setError("");};
    const fail=()=>{setError("The 3D garment prototype could not be loaded.");setModelReady(false);};
    const update=(event:Event)=>{
      const detail=(event as CustomEvent<{totalProgress?:number}>).detail;
      if(typeof detail?.totalProgress==="number") setProgress(Math.max(0,Math.min(1,detail.totalProgress)));
    };
    viewer.addEventListener("load",load);
    viewer.addEventListener("error",fail);
    viewer.addEventListener("progress",update);
    return ()=>{
      viewer.removeEventListener("load",load);
      viewer.removeEventListener("error",fail);
      viewer.removeEventListener("progress",update);
    };
  },[modelUrl,engineReady]);

  useEffect(()=>{
    if(!modelReady || !shirt || !trouser) return;
    const viewer=viewerRef.current;
    if(!viewer?.createTexture) return;
    const token=++applyToken.current;
    const apply=async()=>{
      try{
        const [shirtTexture,trouserTexture,normalTexture]=await Promise.all([
          viewer.createTexture!(shirt.image),
          viewer.createTexture!(trouser.image),
          normalMapRef.current ? viewer.createTexture!(normalMapRef.current) : Promise.resolve(null),
        ]);
        if(token!==applyToken.current) return;
        const entries=[
          {name:"ShirtFabric",texture:shirtTexture,normalScale:.34},
          {name:"TrouserFabric",texture:trouserTexture,normalScale:.27},
        ];
        for(const entry of entries){
          const material=materialByName(viewer,entry.name);
          if(!material) continue;
          material.pbrMetallicRoughness.setBaseColorFactor("#ffffff");
          material.pbrMetallicRoughness.setMetallicFactor(0);
          material.pbrMetallicRoughness.setRoughnessFactor(roughness);
          material.pbrMetallicRoughness.baseColorTexture?.setTexture(entry.texture);
          material.pbrMetallicRoughness.baseColorTexture?.setScale?.({u:textureScale,v:textureScale});
          if(normalTexture){
            material.normalTexture?.setTexture(normalTexture);
            material.normalTexture?.setScale?.({u:textureScale*1.35,v:textureScale*1.35});
            material.setNormalScale?.(entry.normalScale);
          }
        }
      }catch{
        if(token===applyToken.current)setError("Fabric texture application failed. The base 3D model is still available.");
      }
    };
    void apply();
  },[modelReady,shirt,trouser,textureScale,roughness]);

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
        <strong>{PROTOTYPE_MODEL_ID}</strong>
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
        <p>This is the engineering viewer foundation, not the final realism target. The same geometry stays fixed while Linen Earth swatches replace the shirt and trouser PBR materials.</p>
      </div>

      <label><span>Shirt fabric</span><select value={shirtId} onChange={(event)=>setShirtId(event.target.value)}>{shirtFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{shirt&&<><img src={shirt.image} alt="" /><span><b>{shirt.name}</b><small>{shirt.line}</small></span></>}</div>

      <label><span>Trouser fabric</span><select value={trouserId} onChange={(event)=>setTrouserId(event.target.value)}>{trouserFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{trouser&&<><img src={trouser.image} alt="" /><span><b>{trouser.name}</b><small>{trouser.line}</small></span></>}</div>

      <label className="garmentRange"><span>Fabric repeat scale <b>{textureScale.toFixed(1)}×</b></span><input type="range" min=".8" max="7" step=".1" value={textureScale} onChange={(event)=>setTextureScale(Number(event.target.value))}/><small>Higher values repeat the real swatch more tightly across the garment UVs.</small></label>
      <label className="garmentRange"><span>Surface roughness <b>{roughness.toFixed(2)}</b></span><input type="range" min=".55" max=".98" step=".01" value={roughness} onChange={(event)=>setRoughness(Number(event.target.value))}/><small>Linen stays non-metallic; roughness controls how dry or polished the temporary PBR surface reads.</small></label>

      <div className="garmentViewerFacts">
        <span><small>MODEL</small><b>Reusable GLB</b></span>
        <span><small>MATERIALS</small><b>PBR + normal</b></span>
        <span><small>VIEWS</small><b>4 fixed + free</b></span>
        <span><small>AI CREDITS</small><b>0</b></span>
      </div>
      <p className="garmentViewerGuardrail">Next realism step: replace this temporary block mannequin with the approved Linen Earth office-wear body/garment mesh. The viewer/material architecture remains reusable.</p>
    </aside>
  </section>;
}
