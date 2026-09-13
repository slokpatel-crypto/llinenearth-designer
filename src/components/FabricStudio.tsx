"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import type { FabricProfile, FabricVisualSignals } from "@/lib/fabric-analysis";
import type { FabricSelection } from "@/lib/designer-types";

type Status = "idle" | "ready" | "analyzing" | "complete" | "error";

function rgbHex(r:number,g:number,b:number){return `#${[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("")}`;}
function clamp01(v:number){return Math.max(0,Math.min(1,v));}

async function extractVisualSignals(file: File): Promise<FabricVisualSignals> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve,reject)=>{ const el=new Image(); el.onload=()=>resolve(el); el.onerror=reject; el.src=url; });
    const canvas=document.createElement("canvas"); const size=128; canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext("2d",{willReadFrequently:true}); if(!ctx) throw new Error("Canvas unavailable");
    const scale=Math.max(size/img.width,size/img.height); const w=img.width*scale,h=img.height*scale;
    ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
    const data=ctx.getImageData(0,0,size,size).data;
    const lumas=new Float32Array(size*size); let sr=0,sg=0,sb=0,sat=0;
    for(let i=0,p=0;i<data.length;i+=4,p++){
      const r=data[i],g=data[i+1],b=data[i+2]; sr+=r;sg+=g;sb+=b;
      const max=Math.max(r,g,b),min=Math.min(r,g,b); sat+=max===0?0:(max-min)/max;
      lumas[p]=.2126*r+.7152*g+.0722*b;
    }
    const n=size*size, ar=sr/n,ag=sg/n,ab=sb/n, mean=(.2126*ar+.7152*ag+.0722*ab)/255;
    let variance=0,edges=0,hDiff=0,vDiff=0,colorVar=0;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const p=y*size+x,l=lumas[p]; variance+=(l-mean*255)**2;
      if(x<size-1){const d=Math.abs(l-lumas[p+1]); hDiff+=d; if(d>22) edges++;}
      if(y<size-1){const d=Math.abs(l-lumas[p+size]); vDiff+=d; if(d>22) edges++;}
      const i=p*4; colorVar+=(Math.abs(data[i]-ar)+Math.abs(data[i+1]-ag)+Math.abs(data[i+2]-ab))/3;
    }
    const std=Math.sqrt(variance/n)/128;
    const denom=size*(size-1);
    const horizontalStructure=clamp01((hDiff/denom)/42);
    const verticalStructure=clamp01((vDiff/denom)/42);
    const edgeDensity=clamp01(edges/(denom*2)*2.6);
    const texture=clamp01((horizontalStructure+verticalStructure)*.42+edgeDensity*.36+std*.22);
    return {
      dominantHex: rgbHex(ar,ag,ab), meanLightness: clamp01(mean), saturation: clamp01(sat/n), contrast: clamp01(std),
      texture, edgeDensity, horizontalStructure, verticalStructure, colorVariation: clamp01((colorVar/n)/72)
    };
  } finally { URL.revokeObjectURL(url); }
}

export function FabricStudio({ onContinue }: { onContinue?: (selection: FabricSelection) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [profile, setProfile] = useState<FabricProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [familyOverride, setFamilyOverride] = useState("");
  const [toneOverride, setToneOverride] = useState("");

  const fileMeta = useMemo(() => file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : null, [file]);

  function loadFile(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Please choose a photo of the fabric."); setStatus("error"); return; }
    if (next.size > 10 * 1024 * 1024) { setError("Please use an image smaller than 10 MB."); setStatus("error"); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setProfile(null); setError(null); setStatus("ready");
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) { loadFile(event.target.files?.[0] ?? null); }
  function onDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); loadFile(event.dataTransfer.files?.[0] ?? null); }

  async function analyze() {
    if (!file) return;
    setStatus("analyzing"); setError(null);
    try {
      const visualSignals = await extractVisualSignals(file);
      const response = await fetch("/api/fabric/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, visualSignals }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Analysis failed."); setProfile(data.profile); setStatus("complete");
    } catch (err) { setError(err instanceof Error ? err.message : "Analysis failed."); setStatus("error"); }
  }

  function continueWithFabric() { if (!profile || !onContinue) return; onContinue({ profile, materialOverride: familyOverride || undefined, toneOverride: toneOverride || undefined }); }
  const likelyFamily = profile?.observations.find((x) => x.label === "Likely material family")?.value ?? "";
  const dominantColor = profile?.observations.find((x) => x.label === "Dominant color")?.value ?? "";

  return <section className="fabricStudio">
    <div className="studioIntro"><p className="eyebrow">FABRIC INTELLIGENCE · V3</p><h1>Start with the cloth.</h1><p>Upload one clear fabric photo. LLinen Earth now reads pixel-level color, contrast, micro-texture, edge density and directional weave cues before ranking the most likely fabric families. You still confirm fibre composition because a photo cannot chemically prove it.</p><div className="studioSteps" aria-label="Fabric design process"><span className="active">01 Upload</span><span>02 Visual scan</span><span>03 Confirm composition</span><span>04 Build brief</span></div></div>

    <div className="studioGrid"><div className="fabricCanvas"><div className="canvasHead"><div><span className="micro">YOUR FABRIC</span><h2>{file ? "Fabric captured" : "Show us the material"}</h2></div><span className="privacyTag">Photo stays in your browser</span></div>
      <label className={`uploadStage ${preview ? "hasImage" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}><input type="file" accept="image/*" onChange={onInput} />{preview ? <><img src={preview} alt="Uploaded fabric preview" /><div className="uploadShade" /><div className="replaceHint">Click or drop another image to replace</div></> : <div className="uploadEmpty"><span className="uploadPlus">+</span><h3>Drop a fabric photo here</h3><p>or choose from your device · camera works on mobile</p><small>Best result: even light, cloth fills the frame, one small fold, no heavy filters.</small></div>}</label>
      <div className="captureGuide"><div><span>01</span><strong>Natural light</strong><p>Avoid strong yellow or blue lighting.</p></div><div><span>02</span><strong>Fill the frame</strong><p>Show enough surface to read weave and pattern.</p></div><div><span>03</span><strong>Keep one fold</strong><p>A small fold helps communicate drape.</p></div></div>
      <div className="canvasActions"><div>{fileMeta ?? "PNG, JPG, WEBP · up to 10 MB"}</div><button className="button light" disabled={!file || status === "analyzing"} onClick={analyze}>{status === "analyzing" ? "Scanning weave…" : profile ? "Analyze again" : "Analyze fabric"}</button></div>{error && <p className="studioError">{error}</p>}
    </div>

    <aside className="analysisPanel"><div className="analysisHead"><div><span className="micro">FABRIC PROFILE</span><h2>{profile ? "Visual classifier result" : "Waiting for fabric"}</h2></div><span className={`analysisState ${status}`}>{status === "complete" ? "V3 estimated" : status === "analyzing" ? "Scanning" : "Not started"}</span></div>
      {!profile ? <div className="analysisEmpty"><div className="orb" /><p>Your structured fabric profile will appear here.</p><ul><li>Ranked material-family matches</li><li>Actual image-derived color</li><li>Pattern and weave direction</li><li>Texture and drape proxy</li></ul></div> : <><p className="analysisSummary">{profile.summary}</p><div className="paletteRow">{profile.palette.map((color) => <span key={color} style={{ background: color }} title={color} />)}</div>
        {profile.alternatives?.length ? <div className="fabricMatches"><span className="micro">TOP VISUAL MATCHES</span>{profile.alternatives.slice(0,4).map((match,i)=><div className="fabricMatch" key={match.family}><b>{String(i+1).padStart(2,"0")}</b><div><strong>{match.family}</strong><small>{match.evidence[0] || "Visual structure match"}</small></div><em>{Math.round(match.confidence*100)}%</em></div>)}</div> : null}
        <div className="observationList">{profile.observations.map((item) => <div className="observation" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><div className="confidence"><i style={{ width: `${Math.round(item.confidence * 100)}%` }} /><em>{Math.round(item.confidence * 100)}%</em></div></div>)}</div>
        <div className="confirmBox"><span className="micro">YOUR CONFIRMATION</span><h3>Tell the Designer what the bolt actually is.</h3><label>Material family<select value={familyOverride} onChange={(e) => setFamilyOverride(e.target.value)}><option value="">Keep estimate: {likelyFamily}</option><optgroup label="LLinen Earth core"><option>Linen</option><option>Linen-Cotton</option><option>Cotton Poplin</option><option>Oxford Cotton</option><option>Cotton Twill</option><option>TR / Poly-Viscose Suiting</option><option>TR-Wool / Poly-Viscose-Wool</option><option>Tropical Wool</option><option>Hopsack Wool</option><option>Wool Flannel</option></optgroup><optgroup label="Specialist"><option>Cotton Seersucker</option><option>Denim</option><option>Corduroy</option><option>Velvet</option><option>Silk Blend</option></optgroup><option>Other / unsure</option></select></label><label>Color in person<select value={toneOverride} onChange={(e) => setToneOverride(e.target.value)}><option value="">Looks accurate: {dominantColor}</option><option>Warmer in person</option><option>Cooler in person</option><option>Lighter in person</option><option>Darker in person</option></select></label></div>
        <div className="cautionBox"><strong>Computer-vision estimate</strong>{profile.cautions.map((x) => <p key={x}>{x}</p>)}</div><button className="continueButton" type="button" onClick={continueWithFabric}>Judge this fabric for my occasion <span>→</span></button><p className="devNote">V3 is an on-device visual feature classifier, not laboratory fibre testing. Confirming known stock family lets the Designer use the correct performance model.</p>
      </>}
    </aside></div>
  </section>;
}
