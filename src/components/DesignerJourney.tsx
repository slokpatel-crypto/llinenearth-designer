"use client";

import { useEffect, useState } from "react";
import { ContextConsultation } from "@/components/ContextConsultation";
import { DesignDirections } from "@/components/DesignDirections";
import { FabricStudio } from "@/components/FabricStudio";
import { RefinementWorkspace } from "@/components/RefinementWorkspace";
import { VisualizationStudio } from "@/components/VisualizationStudio";
import type { DesignCandidate } from "@/lib/designer-engine";
import type { ContextProfile, DesignerBrief, FabricSelection } from "@/lib/designer-types";
import type { MeasurementProfile } from "@/lib/measurements";
import { MEASUREMENT_STORAGE_KEY } from "@/lib/measurements";
import type { DesignVersion } from "@/lib/refinement-engine";
import type { RenderSet } from "@/lib/visualization-engine";

type Stage = "fabric" | "context" | "generating" | "directions" | "refine" | "visualizing" | "visualization" | "visualization-error" | "error";
const STORAGE_KEY = "llinen-earth-designer-session-v4";

export function DesignerJourney() {
  const [stage, setStage] = useState<Stage>("fabric");
  const [fabric, setFabric] = useState<FabricSelection | null>(null);
  const [context, setContext] = useState<ContextProfile | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementProfile | null>(null);
  const [candidates, setCandidates] = useState<DesignCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<DesignCandidate | null>(null);
  const [finalVersion, setFinalVersion] = useState<DesignVersion | null>(null);
  const [renderSet, setRenderSet] = useState<RenderSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { stage?: Stage; fabric?: FabricSelection; context?: ContextProfile; candidates?: DesignCandidate[]; selectedCandidate?: DesignCandidate; finalVersion?: DesignVersion; renderSet?: RenderSet };
        if (saved.fabric) setFabric(saved.fabric);
        if (saved.context) setContext(saved.context);
        if (saved.candidates) setCandidates(saved.candidates);
        if (saved.selectedCandidate) setSelectedCandidate(saved.selectedCandidate);
        if (saved.finalVersion) setFinalVersion(saved.finalVersion);
        if (saved.renderSet) setRenderSet(saved.renderSet);
        if (saved.stage === "visualization" && saved.fabric && saved.context && saved.finalVersion && saved.renderSet) setStage("visualization");
        else if (saved.stage === "refine" && saved.fabric && saved.context && saved.candidates?.length && saved.selectedCandidate) setStage("refine");
        else if (saved.stage === "directions" && saved.fabric && saved.context && saved.candidates?.length) setStage("directions");
        else if (saved.stage === "context" && saved.fabric) setStage("context");
      }
      const measureRaw = localStorage.getItem(MEASUREMENT_STORAGE_KEY);
      if (measureRaw) setMeasurements(JSON.parse(measureRaw) as MeasurementProfile);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stage, fabric, context, candidates, selectedCandidate, finalVersion, renderSet }));
  }, [stage, fabric, context, candidates, selectedCandidate, finalVersion, renderSet, hydrated]);

  function refreshMeasurements() {
    try {
      const raw = localStorage.getItem(MEASUREMENT_STORAGE_KEY);
      if (!raw) return measurements;
      const parsed = JSON.parse(raw) as MeasurementProfile;
      setMeasurements(parsed);
      return parsed;
    } catch { return measurements; }
  }

  function acceptFabric(selection: FabricSelection) {
    setFabric(selection); setCandidates([]); setSelectedCandidate(null); setFinalVersion(null); setRenderSet(null); setStage("context");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function generate(brief: DesignerBrief) {
    setStage("generating"); setError(null);
    try {
      const latestMeasurements = refreshMeasurements();
      const enrichedBrief: DesignerBrief = { ...brief, measurements: latestMeasurements || undefined };
      const response = await fetch("/api/designer/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(enrichedBrief) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create directions.");
      setCandidates(data.candidates); setSelectedCandidate(null); setFinalVersion(null); setRenderSet(null); setStage("directions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create directions."); setStage("error");
    }
  }

  function acceptContext(profile: ContextProfile) {
    if (!fabric) return;
    setContext(profile); window.scrollTo({ top: 0, behavior: "smooth" }); void generate({ fabric, context: profile, measurements: measurements || undefined });
  }

  function beginRefinement(candidate: DesignCandidate) {
    setSelectedCandidate(candidate); setFinalVersion(null); setRenderSet(null); setStage("refine"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function visualize(version: DesignVersion) {
    if (!fabric || !context) return;
    setFinalVersion(version); setRenderSet(null); setError(null); setStage("visualizing"); window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const response = await fetch("/api/visualization/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: { fabric, context, measurements: measurements || undefined }, version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to visualize this design.");
      setRenderSet(data.renderSet); setStage("visualization");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to visualize this design."); setStage("visualization-error");
    }
  }

  const currentBrief = fabric && context ? { fabric, context, measurements: measurements || undefined } : null;

  if (!hydrated) return <section className="journeyLoading"><span>Restoring your atelier session…</span></section>;
  if (stage === "context" && fabric) return <ContextConsultation fabric={fabric} onComplete={acceptContext} onBack={() => setStage("fabric")} />;

  if (stage === "generating") return <section className="designerThinking"><p className="eyebrow">DESIGNER ENGINE · FABRIC + FIT INTELLIGENCE</p><h1>Building the shortlist.</h1><div className="thinkingTrack"><i /></div><div className="thinkingSteps"><span>Reading fabric signals</span><span>Balancing occasion</span><span>Applying fit profile</span><span>Scoring directions</span></div></section>;

  if (stage === "visualizing") return <section className="designerThinking visualizationThinking"><p className="eyebrow">PHASE 6 · VISUALIZATION COMPILER</p><h1>Rendering the locked specification.</h1><div className="thinkingTrack"><i /></div><div className="thinkingSteps"><span>Compiling garment geometry</span><span>Locking model identity</span><span>Mapping fabric palette</span><span>Validating three views</span></div></section>;

  if (stage === "error" && currentBrief) return <section className="briefComplete"><p className="eyebrow">DESIGNER ENGINE</p><h1>The brief is safe. The generation step needs another try.</h1><p>{error}</p><div className="actions"><button className="button" onClick={() => setStage("context")}>Edit context</button><button className="button light" onClick={() => void generate(currentBrief)}>Try again</button></div></section>;

  if (stage === "visualization-error" && finalVersion) return <section className="briefComplete"><p className="eyebrow">VISUALIZATION PIPELINE</p><h1>The design is still locked. Only the render step failed.</h1><p>{error}</p><div className="actions"><button className="button" onClick={() => setStage("refine")}>Back to locked design</button><button className="button light" onClick={() => void visualize(finalVersion)}>Retry visualization</button></div></section>;

  if (stage === "visualization" && currentBrief && finalVersion && renderSet) return <VisualizationStudio brief={currentBrief} version={finalVersion} renderSet={renderSet} onRenderSetChange={setRenderSet} onBack={() => setStage("refine")} />;

  if (stage === "refine" && currentBrief && candidates.length && selectedCandidate) return <RefinementWorkspace brief={currentBrief} initialCandidate={selectedCandidate} candidates={candidates} onBack={() => setStage("directions")} onVisualize={(version) => void visualize(version)} />;

  if (stage === "directions" && currentBrief && candidates.length) return <DesignDirections brief={currentBrief} candidates={candidates} onEditContext={() => setStage("context")} onRefine={beginRefinement} />;

  return <FabricStudio onContinue={acceptFabric} />;
}
