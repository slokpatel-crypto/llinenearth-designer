"use client";

import { useEffect, useState } from "react";
import { ContextConsultation } from "@/components/ContextConsultation";
import { FabricStudio } from "@/components/FabricStudio";
import type { ContextProfile, FabricSelection } from "@/lib/designer-types";

type Stage = "fabric" | "context" | "brief";
const STORAGE_KEY = "llinen-earth-designer-session-v1";

export function DesignerJourney() {
  const [stage, setStage] = useState<Stage>("fabric");
  const [fabric, setFabric] = useState<FabricSelection | null>(null);
  const [context, setContext] = useState<ContextProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { stage?: Stage; fabric?: FabricSelection; context?: ContextProfile };
        if (saved.fabric) setFabric(saved.fabric);
        if (saved.context) setContext(saved.context);
        if (saved.stage && saved.stage !== "fabric" && saved.fabric) setStage(saved.stage);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stage, fabric, context }));
  }, [stage, fabric, context, hydrated]);

  function acceptFabric(selection: FabricSelection) {
    setFabric(selection);
    setStage("context");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function acceptContext(profile: ContextProfile) {
    setContext(profile);
    setStage("brief");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!hydrated) return <section className="journeyLoading wrap"><span>Restoring your atelier session…</span></section>;

  if (stage === "context" && fabric) return <ContextConsultation fabric={fabric} onComplete={acceptContext} onBack={() => setStage("fabric")} />;

  if (stage === "brief" && fabric && context) {
    return (
      <section className="briefComplete">
        <p className="eyebrow">PHASE 3 · CONTEXT COMPLETE</p>
        <h1>Your design brief is ready.</h1>
        <p>The fabric and context are now structured. Phase 4 will use this exact brief to construct and score distinct outfit directions.</p>
        <div className="briefCompleteGrid">
          <article><span>OCCASION</span><strong>{context.occasion}</strong><p>{context.venue} · {context.time} · {context.environment}</p></article>
          <article><span>DIRECTION</span><strong>{context.aesthetic}</strong><p>{context.impression} · {context.fit} fit · {context.formality}</p></article>
          <article><span>FABRIC</span><strong>{fabric.materialOverride || fabric.profile.observations.find((x) => x.label === "Likely material family")?.value}</strong><p>{fabric.profile.summary}</p></article>
        </div>
        <div className="actions"><button className="button" onClick={() => setStage("context")}>Edit context</button><button className="button light" disabled>Designer Engine · Phase 4</button></div>
      </section>
    );
  }

  return <FabricStudio onContinue={acceptFabric} />;
}
