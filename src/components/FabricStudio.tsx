"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import type { FabricProfile } from "@/lib/fabric-analysis";
import type { FabricSelection } from "@/lib/designer-types";

type Status = "idle" | "ready" | "analyzing" | "complete" | "error";

export function FabricStudio({ onContinue }: { onContinue?: (selection: FabricSelection) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [profile, setProfile] = useState<FabricProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [familyOverride, setFamilyOverride] = useState("");
  const [toneOverride, setToneOverride] = useState("");

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  }, [file]);

  function loadFile(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setError("Please choose a photo of the fabric.");
      setStatus("error");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setError("Please use an image smaller than 10 MB.");
      setStatus("error");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setProfile(null);
    setError(null);
    setStatus("ready");
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    loadFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    loadFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function analyze() {
    if (!file) return;
    setStatus("analyzing");
    setError(null);
    try {
      const response = await fetch("/api/fabric/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setProfile(data.profile);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStatus("error");
    }
  }

  function continueWithFabric() {
    if (!profile || !onContinue) return;
    onContinue({ profile, materialOverride: familyOverride || undefined, toneOverride: toneOverride || undefined });
  }

  const likelyFamily = profile?.observations.find((x) => x.label === "Likely material family")?.value ?? "";
  const dominantColor = profile?.observations.find((x) => x.label === "Dominant color")?.value ?? "";

  return (
    <section className="fabricStudio">
      <div className="studioIntro">
        <p className="eyebrow">PHASE 2 · FABRIC INTELLIGENCE</p>
        <h1>Start with the cloth.</h1>
        <p>Upload one clear fabric photo. LLinen Earth will separate what can be visually estimated from what still needs your confirmation.</p>
        <div className="studioSteps" aria-label="Fabric design process"><span className="active">01 Upload</span><span>02 Read fabric</span><span>03 Confirm</span><span>04 Build brief</span></div>
      </div>

      <div className="studioGrid">
        <div className="fabricCanvas">
          <div className="canvasHead"><div><span className="micro">YOUR FABRIC</span><h2>{file ? "Fabric captured" : "Show us the material"}</h2></div><span className="privacyTag">Private session asset</span></div>
          <label className={`uploadStage ${preview ? "hasImage" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <input type="file" accept="image/*" onChange={onInput} />
            {preview ? <><img src={preview} alt="Uploaded fabric preview" /><div className="uploadShade" /><div className="replaceHint">Click or drop another image to replace</div></> : <div className="uploadEmpty"><span className="uploadPlus">+</span><h3>Drop a fabric photo here</h3><p>or choose from your device · camera works on mobile</p><small>Best result: even light, fabric fills the frame, no heavy filters.</small></div>}
          </label>
          <div className="captureGuide"><div><span>01</span><strong>Natural light</strong><p>Avoid strong yellow or blue lighting.</p></div><div><span>02</span><strong>Fill the frame</strong><p>Show enough surface to read weave and pattern.</p></div><div><span>03</span><strong>Keep one fold</strong><p>A small fold helps communicate drape.</p></div></div>
          <div className="canvasActions"><div>{fileMeta ?? "PNG, JPG, WEBP · up to 10 MB"}</div><button className="button light" disabled={!file || status === "analyzing"} onClick={analyze}>{status === "analyzing" ? "Reading fabric…" : profile ? "Analyze again" : "Analyze fabric"}</button></div>
          {error && <p className="studioError">{error}</p>}
        </div>

        <aside className="analysisPanel">
          <div className="analysisHead"><div><span className="micro">FABRIC PROFILE</span><h2>{profile ? "What we can see" : "Waiting for fabric"}</h2></div><span className={`analysisState ${status}`}>{status === "complete" ? "Estimated" : status === "analyzing" ? "Analyzing" : "Not started"}</span></div>
          {!profile ? <div className="analysisEmpty"><div className="orb" /><p>Your structured fabric profile will appear here.</p><ul><li>Material family estimate</li><li>Color and pattern</li><li>Surface and drape cues</li><li>Climate direction</li></ul></div> : <>
            <p className="analysisSummary">{profile.summary}</p>
            <div className="paletteRow">{profile.palette.map((color) => <span key={color} style={{ background: color }} title={color} />)}</div>
            <div className="observationList">{profile.observations.map((item) => <div className="observation" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><div className="confidence"><i style={{ width: `${Math.round(item.confidence * 100)}%` }} /><em>{Math.round(item.confidence * 100)}%</em></div></div>)}</div>
            <div className="confirmBox"><span className="micro">YOUR CONFIRMATION</span><h3>Correct what the camera cannot know.</h3><label>Material family<select value={familyOverride} onChange={(e) => setFamilyOverride(e.target.value)}><option value="">Keep estimate: {likelyFamily}</option><option>Pure linen</option><option>Linen blend</option><option>Pure cotton</option><option>Cotton blend</option><option>Wool</option><option>Other / unsure</option></select></label><label>Color in person<select value={toneOverride} onChange={(e) => setToneOverride(e.target.value)}><option value="">Looks accurate: {dominantColor}</option><option>Warmer in person</option><option>Cooler in person</option><option>Lighter in person</option><option>Darker in person</option></select></label></div>
            <div className="cautionBox"><strong>Estimated from photo</strong>{profile.cautions.map((x) => <p key={x}>{x}</p>)}</div>
            <button className="continueButton" type="button" onClick={continueWithFabric}>Use this fabric profile <span>→</span></button>
            <p className="devNote">Phase 2 preview uses the development analysis adapter; the production vision provider plugs into the same structured contract.</p>
          </>}
        </aside>
      </div>
    </section>
  );
}
