"use client";

import { useEffect, useState } from "react";
import { ContextConsultation } from "@/components/ContextConsultation";
import { DesignDirections } from "@/components/DesignDirections";
import { FabricStudio } from "@/components/FabricStudio";
import { RefinementWorkspace } from "@/components/RefinementWorkspace";
import type { DesignCandidate } from "@/lib/designer-engine";
import type { ContextProfile, DesignerBrief, FabricSelection } from "@/lib/designer-types";

type Stage = "fabric" | "context" | "generating" | "directions" | "refine" | "error";
const STORAGE_KEY = "llinen-earth-designer-session-v3";

export function DesignerJourney() {
  const [stage, setStage] = useState<Stage>("fabric");
  const [fabric, setFabric] = useState<FabricSelection | null>(null);
  const [context, setContext] = useState<ContextProfile | null>(null);
  const [candidates, setCandidates] = useState<DesignCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<DesignCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { stage?: Stage; fabric?: FabricSelection; context?: ContextProfile; candidates?: DesignCandidate[]; selectedCandidate?: DesignCandidate };
        if (saved.fabric) setFabric(saved.fabric);
        if (saved.context) setContext(saved.context);
        if (saved.candidates) setCandidates(saved.candidates);
        if (saved.selectedCandidate) setSelectedCandidate(saved.selectedCandidate);
        if (saved.stage === "refine" && saved.fabric && saved.context && saved.candidates?.length && saved.selectedCandidate) setStage("refine");
        else if (saved.stage === "directions" && saved.fabric && saved.context && saved.candidates?.length) setStage("directions");
        else if (saved.stage === "context" && saved.fabric) setStage("context");
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stage, fabric, context, candidates, selectedCandidate }));
  }, [stage, fabric, context, candidates, selectedCandidate, hydrated]);

  function acceptFabric(selection: FabricSelection) {
    setFabric(selection);
    setCandidates([]);
    setSelectedCandidate(null);
    setStage("context");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function generate(brief: DesignerBrief) {
    setStage("generating");
    setError(null);
    try {
      const response = await fetch("/api/designer/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create directions.");
      setCandidates(data.candidates);
      setSelectedCandidate(null);
      setStage("directions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create directions.");
      setStage("error");
    }
  }

  function acceptContext(profile: ContextProfile) {
    if (!fabric) return;
    setContext(profile);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void generate({ fabric, context: profile });
  }

  function beginRefinement(candidate: DesignCandidate) {
    setSelectedCandidate(candidate);
    setStage("refine");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!hydrated) return <section className="journeyLoading"><span>Restoring your atelier session…</span></section>;
  if (stage === "context" && fabric) return <ContextConsultation fabric={fabric} onComplete={acceptContext} onBack={() => setStage("fabric")} />;

  if (stage === "generating") return (
    <section className="designerThinking">
      <p className="eyebrow">PHASE 4 · DESIGNER ENGINE</p>
      <h1>Building the shortlist.</h1>
      <div className="thinkingTrack"><i /></div>
      <div className="thinkingSteps"><span>Reading fabric constraints</span><span>Balancing context</span><span>Building silhouettes</span><span>Scoring directions</span></div>
    </section>
  );

  if (stage === "error" && fabric && context) return (
    <section className="briefComplete">
      <p className="eyebrow">DESIGNER ENGINE</p><h1>The brief is safe. The generation step needs another try.</h1><p>{error}</p>
      <div className="actions"><button className="button" onClick={() => setStage("context")}>Edit context</button><button className="button light" onClick={() => void generate({ fabric, context })}>Try again</button></div>
    </section>
  );

  if (stage === "refine" && fabric && context && candidates.length && selectedCandidate) return <RefinementWorkspace brief={{ fabric, context }} initialCandidate={selectedCandidate} candidates={candidates} onBack={() => setStage("directions")} />;

  if (stage === "directions" && fabric && context && candidates.length) return <DesignDirections brief={{ fabric, context }} candidates={candidates} onEditContext={() => setStage("context")} onRefine={beginRefinement} />;

  return <FabricStudio onContinue={acceptFabric} />;
}
