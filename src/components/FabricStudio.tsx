"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import type { FabricProfile, FabricVisualSignals } from "@/lib/fabric-analysis";
import { fabricOptionsForGarment, fabricProfileFromStock, type FabricColorway, type GarmentKind } from "@/lib/fabric-stock";
import type { FabricSelection } from "@/lib/designer-types";

type Status = "idle" | "ready" | "analyzing" | "complete" | "error";
type SourceMode = "stock" | "upload";
type AnalysisMode = "stock_catalog" | "claude_vision_v1" | "development_visual_classifier_v3" | null;

const GARMENTS: Array<{ value: GarmentKind; label: string }> = [
  { value: "shirt", label: "Shirt" },
  { value: "trouser", label: "Trouser" },
  { value: "suit", label: "Suit" },
  { value: "blazer", label: "Blazer" },
];

function rgbHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}
function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }

async function extractVisualSignals(file: File): Promise<FabricVisualSignals> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas unavailable");
    const scale = Math.max(size / img.width, size / img.height);
    const width = img.width * scale;
    const height = img.height * scale;
    ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
    const data = ctx.getImageData(0, 0, size, size).data;
    const lumas = new Float32Array(size * size);
    let sr = 0; let sg = 0; let sb = 0; let sat = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      sr += r; sg += g; sb += b;
      const max = Math.max(r, g, b); const min = Math.min(r, g, b);
      sat += max === 0 ? 0 : (max - min) / max;
      lumas[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const count = size * size;
    const ar = sr / count; const ag = sg / count; const ab = sb / count;
    const mean = (0.2126 * ar + 0.7152 * ag + 0.0722 * ab) / 255;
    let variance = 0; let edges = 0; let horizontalDiff = 0; let verticalDiff = 0; let colorVar = 0;
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const p = y * size + x; const luma = lumas[p];
      variance += (luma - mean * 255) ** 2;
      if (x < size - 1) { const diff = Math.abs(luma - lumas[p + 1]); horizontalDiff += diff; if (diff > 22) edges += 1; }
      if (y < size - 1) { const diff = Math.abs(luma - lumas[p + size]); verticalDiff += diff; if (diff > 22) edges += 1; }
      const i = p * 4;
      colorVar += (Math.abs(data[i] - ar) + Math.abs(data[i + 1] - ag) + Math.abs(data[i + 2] - ab)) / 3;
    }
    const std = Math.sqrt(variance / count) / 128;
    const denominator = size * (size - 1);
    const horizontalStructure = clamp01((horizontalDiff / denominator) / 42);
    const verticalStructure = clamp01((verticalDiff / denominator) / 42);
    const edgeDensity = clamp01(edges / (denominator * 2) * 2.6);
    const texture = clamp01((horizontalStructure + verticalStructure) * 0.42 + edgeDensity * 0.36 + std * 0.22);
    return {
      dominantHex: rgbHex(ar, ag, ab), meanLightness: clamp01(mean), saturation: clamp01(sat / count), contrast: clamp01(std),
      texture, edgeDensity, horizontalStructure, verticalStructure, colorVariation: clamp01((colorVar / count) / 72),
    };
  } finally { URL.revokeObjectURL(url); }
}

export function FabricStudio({ onContinue }: { onContinue?: (selection: FabricSelection) => void }) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("stock");
  const [garment, setGarment] = useState<GarmentKind>("shirt");
  const [stockLine, setStockLine] = useState("Linen Plain 60 Lea");
  const [selectedStock, setSelectedStock] = useState<FabricColorway | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [profile, setProfile] = useState<FabricProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [familyOverride, setFamilyOverride] = useState("");
  const [toneOverride, setToneOverride] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(null);

  const fileMeta = useMemo(() => file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : null, [file]);
  const garmentStock = useMemo(() => fabricOptionsForGarment(garment), [garment]);
  const stockLines = useMemo(() => [...new Set(garmentStock.map((fabric) => fabric.line))], [garmentStock]);
  const visibleStock = useMemo(() => garmentStock.filter((fabric) => fabric.line === stockLine), [garmentStock, stockLine]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function changeSource(next: SourceMode) {
    setSourceMode(next); setProfile(null); setSelectedStock(null); setAnalysisMode(null);
    setFamilyOverride(""); setToneOverride(""); setError(null);
    setStatus(next === "upload" && file ? "ready" : "idle");
  }

  function changeGarment(next: GarmentKind) {
    const options = fabricOptionsForGarment(next);
    setGarment(next); setStockLine(options[0]?.line || ""); setSelectedStock(null);
    setProfile(null); setAnalysisMode(null); setStatus("idle");
  }

  function chooseStock(fabric: FabricColorway) {
    setSelectedStock(fabric); setProfile(fabricProfileFromStock(fabric)); setAnalysisMode("stock_catalog");
    setFamilyOverride(""); setToneOverride(""); setError(null); setStatus("complete");
  }

  function loadFile(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Please choose a photo of the fabric."); setStatus("error"); return; }
    if (next.size > 10 * 1024 * 1024) { setError("Please use an image smaller than 10 MB."); setStatus("error"); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setProfile(null); setAnalysisMode(null); setError(null); setStatus("ready");
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) { loadFile(event.target.files?.[0] ?? null); }
  function onDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); loadFile(event.dataTransfer.files?.[0] ?? null); }

  function fileToBase64(target: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { const result = String(reader.result || ""); resolve(result.slice(result.indexOf(",") + 1)); };
      reader.onerror = reject;
      reader.readAsDataURL(target);
    });
  }

  async function analyze() {
    if (!file) return;
    setStatus("analyzing"); setError(null);
    try {
      const visualSignals = await extractVisualSignals(file);
      const payload: Record<string, unknown> = { fileName: file.name, contentType: file.type, size: file.size, visualSignals };
      if (aiConsent) { payload.aiConsent = true; payload.imageBase64 = await fileToBase64(file); }
      const response = await fetch("/api/fabric/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setProfile(data.profile); setAnalysisMode(data.mode ?? null); setStatus("complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed."); setStatus("error");
    }
  }

  function continueWithFabric() {
    if (!profile || !onContinue) return;
    if (selectedStock) {
      onContinue({ profile, materialOverride: selectedStock.family, toneOverride: selectedStock.colorName, source: "stock", stockId: selectedStock.id, swatchImageUrl: selectedStock.swatchImageUrl });
      return;
    }
    onContinue({ profile, materialOverride: familyOverride || undefined, toneOverride: toneOverride || undefined, source: "upload" });
  }

  const likelyFamily = profile?.observations.find((item) => item.label === "Likely material family")?.value ?? "";
  const dominantColor = profile?.observations.find((item) => item.label === "Dominant color")?.value ?? "";
  const profileTitle = analysisMode === "stock_catalog" ? "Selected stock fabric" : analysisMode === "claude_vision_v1" ? "AI vision result" : profile ? "Visual classifier result" : "Waiting for fabric";

  return <section className="fabricStudio">
    <div className="studioIntro"><p className="eyebrow">FABRIC INTELLIGENCE · LLINEN EARTH STOCK</p><h1>Start with the cloth.</h1><p>Choose a fabric from the LLinen Earth catalogue or upload a fabric of your own. The Designer carries the exact selected cloth into the occasion, fit and outfit direction.</p><div className="studioSteps" aria-label="Fabric design process"><span className="active">01 Choose cloth</span><span>02 Read details</span><span>03 Confirm selection</span><span>04 Build brief</span></div></div>

    <div className="fabricSourceTabs" role="tablist" aria-label="Choose fabric source">
      <button role="tab" aria-selected={sourceMode === "stock"} className={sourceMode === "stock" ? "active" : ""} onClick={() => changeSource("stock")}><span>LLinen Earth stock</span><small>66 real catalogue swatches</small></button>
      <button role="tab" aria-selected={sourceMode === "upload"} className={sourceMode === "upload" ? "active" : ""} onClick={() => changeSource("upload")}><span>Upload your fabric</span><small>Photograph any cloth you own</small></button>
    </div>

    <div className="studioGrid"><div className="fabricCanvas">
      {sourceMode === "stock" ? <>
        <div className="canvasHead"><div><span className="micro">SHOP FABRIC</span><h2>{selectedStock ? selectedStock.colorName : "Choose from our collection"}</h2></div><span className="privacyTag">LLinen Earth catalogue</span></div>
        <div className="stockGarmentFilters" aria-label="Garment type">{GARMENTS.map((option) => <button key={option.value} className={garment === option.value ? "active" : ""} onClick={() => changeGarment(option.value)}>{option.label}</button>)}</div>
        <div className="stockLineFilters" aria-label="Fabric range">{stockLines.map((line) => <button key={line} className={stockLine === line ? "active" : ""} onClick={() => { setStockLine(line); setSelectedStock(null); setProfile(null); setAnalysisMode(null); setStatus("idle"); }}>{line}</button>)}</div>
        <div className="stockGrid" aria-label={`${stockLine} fabric choices`}>{visibleStock.map((fabric) => <button key={fabric.id} className={`stockCard ${selectedStock?.id === fabric.id ? "selected" : ""}`} onClick={() => chooseStock(fabric)} aria-pressed={selectedStock?.id === fabric.id}><span className="stockImage"><img src={fabric.swatchImageUrl} alt={`${fabric.colorName} ${fabric.line} fabric swatch`} loading="lazy" /></span><span className="stockCardCopy"><strong>{fabric.colorName}</strong><small>{fabric.pattern}</small><i style={{ background: fabric.hex }} aria-hidden="true" /></span></button>)}</div>
        <div className="stockFoot"><span>{visibleStock.length} swatches in this range</span><span>Photographed from the supplied LLinen Earth catalogues</span></div>
      </> : <>
        <div className="canvasHead"><div><span className="micro">YOUR FABRIC</span><h2>{file ? "Fabric captured" : "Show us the material"}</h2></div><span className="privacyTag">{aiConsent ? "Photo sent to AI for this scan" : "Photo stays in your browser"}</span></div>
        <label className={`uploadStage ${preview ? "hasImage" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><input type="file" accept="image/*" onChange={onInput} />{preview ? <><img src={preview} alt="Uploaded fabric preview" /><div className="uploadShade" /><div className="replaceHint">Click or drop another image to replace</div></> : <div className="uploadEmpty"><span className="uploadPlus">+</span><h3>Drop a fabric photo here</h3><p>or choose from your device · camera works on mobile</p><small>Best result: even light, cloth fills the frame, one small fold, no heavy filters.</small></div>}</label>
        <div className="captureGuide"><div><span>01</span><strong>Natural light</strong><p>Avoid strong yellow or blue lighting.</p></div><div><span>02</span><strong>Fill the frame</strong><p>Show enough surface to read weave and pattern.</p></div><div><span>03</span><strong>Keep one fold</strong><p>A small fold helps communicate drape.</p></div></div>
        <label className="aiConsentRow"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /><span>Let LLinen Earth&apos;s AI read the actual photo for a more accurate result. Your photo is sent for this scan only. Leave this off to keep the on-device estimate.</span></label>
        <div className="canvasActions"><div>{fileMeta ?? "PNG, JPG, WEBP · up to 10 MB"}</div><button className="button light" disabled={!file || status === "analyzing"} onClick={analyze}>{status === "analyzing" ? (aiConsent ? "Asking the AI…" : "Scanning weave…") : profile ? "Analyze again" : "Analyze fabric"}</button></div>{error && <p className="studioError">{error}</p>}
      </>}
    </div>

      <aside className="analysisPanel"><div className="analysisHead"><div><span className="micro">FABRIC PROFILE</span><h2>{profileTitle}</h2></div><span className={`analysisState ${status}`}>{status === "complete" ? (analysisMode === "stock_catalog" ? "Stock confirmed" : analysisMode === "claude_vision_v1" ? "AI estimated" : "V3 estimated") : status === "analyzing" ? "Scanning" : "Not selected"}</span></div>
        {!profile ? <div className="analysisEmpty"><div className="orb" /><p>{sourceMode === "stock" ? "Select a swatch to see its fabric profile." : "Your structured fabric profile will appear here."}</p><ul><li>Material family and stock line</li><li>Real swatch color and pattern</li><li>Garment suitability</li><li>Designer-ready fabric profile</li></ul></div> : <>
          {selectedStock && <div className="selectedStockPreview"><img src={selectedStock.swatchImageUrl} alt={`${selectedStock.colorName} selected swatch`} /><div><span>{selectedStock.line}</span><strong>{selectedStock.colorName}</strong><small>{selectedStock.pattern} · catalogue page {selectedStock.sourcePage}</small></div></div>}
          <p className="analysisSummary">{profile.summary}</p><div className="paletteRow">{profile.palette.map((color) => <span key={color} style={{ background: color }} title={color} />)}</div>
          {profile.alternatives?.length ? <div className="fabricMatches"><span className="micro">{analysisMode === "stock_catalog" ? "CATALOGUE MATCH" : "TOP VISUAL MATCHES"}</span>{profile.alternatives.slice(0, 4).map((match, index) => <div className="fabricMatch" key={match.family}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{match.family}</strong><small>{match.evidence[0] || "Visual structure match"}</small></div><em>{Math.round(match.confidence * 100)}%</em></div>)}</div> : null}
          <div className="observationList">{profile.observations.map((item) => <div className="observation" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><div className="confidence"><i style={{ width: `${Math.round(item.confidence * 100)}%` }} /><em>{Math.round(item.confidence * 100)}%</em></div></div>)}</div>
          {analysisMode !== "stock_catalog" && <div className="confirmBox"><span className="micro">YOUR CONFIRMATION</span><h3>Tell the Designer what the bolt actually is.</h3><label>Material family<select value={familyOverride} onChange={(event) => setFamilyOverride(event.target.value)}><option value="">Keep estimate: {likelyFamily}</option><optgroup label="LLinen Earth core"><option>Linen</option><option>Linen-Cotton</option><option>Cotton Poplin</option><option>Oxford Cotton</option><option>Cotton Twill</option><option>TR / Poly-Viscose Suiting</option><option>TR-Wool / Poly-Viscose-Wool</option><option>Tropical Wool</option><option>Hopsack Wool</option><option>Wool Flannel</option></optgroup><optgroup label="Specialist"><option>Cotton Seersucker</option><option>Denim</option><option>Corduroy</option><option>Velvet</option><option>Silk Blend</option></optgroup><option>Other / unsure</option></select></label><label>Color in person<select value={toneOverride} onChange={(event) => setToneOverride(event.target.value)}><option value="">Looks accurate: {dominantColor}</option><option>Warmer in person</option><option>Cooler in person</option><option>Lighter in person</option><option>Darker in person</option></select></label></div>}
          <div className="cautionBox"><strong>{analysisMode === "stock_catalog" ? "Catalogue note" : "Computer-vision estimate"}</strong>{profile.cautions.map((caution) => <p key={caution}>{caution}</p>)}</div>
          <button className="continueButton" type="button" onClick={continueWithFabric}>{analysisMode === "stock_catalog" ? "Design with this LLinen Earth fabric" : "Judge this fabric for my occasion"}<span>→</span></button>
          <p className="devNote">{analysisMode === "stock_catalog" ? "This exact stock reference will stay attached to the design brief and visualization specification." : "Visual analysis is not laboratory fibre testing. Confirming the known family lets the Designer use the correct performance model."}</p>
        </>}
      </aside>
    </div>
  </section>;
}
