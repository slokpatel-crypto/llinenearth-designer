"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import { saveDesign } from "@/lib/saved-designs";
import type { RenderSet, RenderView } from "@/lib/visualization-engine";

const VIEW_ORDER: RenderView[] = ["front", "back", "detail"];

export function VisualizationStudio({ brief, version, renderSet, onRenderSetChange, onBack }: {
  brief: DesignerBrief;
  version: DesignVersion;
  renderSet: RenderSet;
  onRenderSetChange: (set: RenderSet) => void;
  onBack: () => void;
}) {
  const [activeView, setActiveView] = useState<RenderView>("front");
  const [zoomed, setZoomed] = useState(false);
  const [repairing, setRepairing] = useState<RenderView | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatingReal, setGeneratingReal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = renderSet.renders.find((x) => x.view === activeView) || renderSet.renders[0];
  const front = renderSet.renders.find((x) => x.view === "front") || renderSet.renders[0];
  const average = useMemo(() => Math.round(renderSet.renders.reduce((sum, x) => sum + x.validation.overall, 0) / Math.max(1, renderSet.renders.length)), [renderSet]);

  async function generatePhotorealistic() {
    setGeneratingReal(true); setError(null);
    try {
      const response = await fetch("/api/visualization/fashn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create the photorealistic mannequin.");
      onRenderSetChange(data.renderSet); setActiveView("front"); setZoomed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the photorealistic mannequin.");
    } finally { setGeneratingReal(false); }
  }

  async function repair(view: RenderView) {
    setRepairing(view); setError(null);
    try {
      const response = await fetch("/api/visualization/repair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderSet, view, brief, version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to repair this view.");
      onRenderSetChange(data.renderSet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to repair this view.");
    } finally { setRepairing(null); }
  }

  function saveCurrentDesign() {
    saveDesign({ title: version.candidate.name, brief, version, renderSet });
    setSaved(true);
  }

  async function copyDesignId() {
    try {
      await navigator.clipboard.writeText(`${version.candidate.name} · ${version.specHash} · ${renderSet.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <section className="visualizationStudio phase7Presentation">
      <div className="visualizationIntro">
        <div><p className="eyebrow">FINAL DESIGN EXPERIENCE · SAME ATELIER MODEL</p><h1>Your AI direction, resolved on one consistent mannequin.</h1></div>
        <div className="visualizationMeta"><span>{version.id}</span><strong>{version.specHash}</strong><button className="textButton" onClick={onBack}>Back to locked design</button></div>
      </div>

      <div className="finalHero">
        <div className="finalHeroImage"><Image unoptimized fill sizes="(max-width: 1000px) 100vw, 58vw" src={front.src} alt={`Full-body ${front.provider === "fashn-edit" ? "photorealistic" : "preview"} of ${version.candidate.name}`} /><div className="finalHeroBadge"><span>{front.provider === "fashn-edit" ? "FASHN PHOTOREALISTIC RENDER" : "LLINEN EARTH DESIGN PREVIEW"}</span><strong>{version.specHash}</strong></div></div>
        <div className="finalHeroCopy">
          <p className="eyebrow">{brief.context.occasion} · {brief.context.venue}</p>
          <h2>{version.candidate.name}</h2>
          <p className="finalConcept">{version.candidate.concept}</p>
          <div className="finalContext"><span>{brief.context.time}</span><span>{brief.context.formality}</span><span>{brief.context.aesthetic}</span><span>{brief.context.fit}</span></div>
          <div className="finalActions"><button className="primarySave" onClick={saveCurrentDesign}>{saved ? "Saved to your atelier" : "Save this design"}<span>→</span></button><button onClick={() => void copyDesignId()}>{copied ? "Design ID copied" : "Copy design ID"}</button>{saved && <Link href="/designs">View saved designs</Link>}</div>
          <p className="finalTrust">{renderSet.provider === "fashn-edit" ? "FASHN generated this catalogue visualization from the locked design and selected fabric reference." : "This fast preview keeps the locked design visible before you spend FASHN credits on a photorealistic render."} It is a design visualization, not a made-to-measure fit guarantee.</p>
        </div>
      </div>

      <div className="renderGrid">
        <div className="renderStage">
          <div className="renderToolbar">
            <div className="viewTabs">{VIEW_ORDER.map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => { setActiveView(view); setZoomed(false); }}>{view === "detail" ? "3/4" : `${view[0].toUpperCase()}${view.slice(1)}`}</button>)}</div>
            <button className="zoomButton" onClick={() => setZoomed((x) => !x)}>{zoomed ? "Fit view" : "Inspect outfit"}</button>
          </div>

          <div className={zoomed ? "renderFrame zoomed" : "renderFrame"} onClick={() => setZoomed((x) => !x)}>
            <Image unoptimized fill sizes="(max-width: 1000px) 100vw, 65vw" src={active.src} alt={`${active.label} of ${version.candidate.name}`} />
            <div className="renderBadge"><span>OUTFIT PREVIEW</span><strong>{active.validation.overall}%</strong></div>
          </div>

          <div className="renderFilmstrip">
            {renderSet.renders.map((render) => <button key={render.id} className={activeView === render.view ? "active" : ""} onClick={() => setActiveView(render.view)}><Image unoptimized width={56} height={70} src={render.src} alt="" /><span>{render.view === "detail" ? "3/4 outfit" : render.label}<small>{render.provider === "fashn-edit" ? "FASHN real render" : "Fast preview"}</small></span><em>{render.validation.overall}%</em></button>)}
          </div>
        </div>

        <aside className="visualizationPanel">
          <div className="visualizationPanelHead"><span className="micro">RENDER SET · {renderSet.id}</span><h2>Source of truth preserved.</h2><p>The AI recommendation now uses the same mannequin language as Live Visual. Garment names, palette, layer and silhouette are translated into a consistent full-body outfit preview.</p></div>

          <div className="validationCard">
            <div className="validationScore"><strong>{average}</strong><span>/100 average consistency</span></div>
            {active.validation.signals.map((signal) => <div className="validationRow" key={signal.key}><span>{signal.label}</span><div><i style={{ width: `${signal.score}%` }} /><em>{signal.score}%</em></div></div>)}
          </div>

          <div className="visualSpec">
            <span className="micro">LOCKED SPECIFICATION</span>
            <dl><div><dt>Model</dt><dd>LLinen Earth Atelier Mannequin</dd></div><div><dt>Shirt</dt><dd>{version.candidate.garments.shirt}</dd></div><div><dt>Trouser</dt><dd>{version.candidate.garments.trouser}</dd></div><div><dt>Layer</dt><dd>{version.candidate.garments.layer}</dd></div><div><dt>Footwear</dt><dd>{version.candidate.garments.footwear}</dd></div><div><dt>Aesthetic</dt><dd>{version.candidate.aesthetic}</dd></div><div><dt>Fabric</dt><dd>{renderSet.spec.fabric.material}</dd></div></dl>
            <div className="visualPalette">{version.candidate.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
          </div>

          {renderSet.provider === "development-svg" ? <div className="fashnRenderCard"><span className="micro">REAL AI RENDER · FASHN</span><h3>Turn this into a real mannequin.</h3><p>FASHN converts the locked illustration into a premium, faceless, photorealistic male atelier mannequin. For LLinen Earth stock, the exact selected swatch is supplied as fabric context.</p><button disabled={generatingReal} onClick={() => void generatePhotorealistic()}>{generatingReal ? "FASHN is rendering…" : "Generate real front render"}<span>→</span></button><small>Balanced 1K quality · normally about 25 seconds · typically 2 FASHN credits.</small>{error && <p className="studioError">{error}</p>}</div> : <div className="repairCard"><span className="micro">FASHN VIEW CONTROL</span><h3>{active.provider === "fashn-edit" ? "Refine this real view." : `Generate the real ${active.view === "detail" ? "3/4" : active.view} view.`}</h3><p>FASHN uses the real front render to preserve the same mannequin, fabric and outfit while changing only this selected camera view.</p><button disabled={!!repairing || generatingReal} onClick={() => void repair(active.view)}>{repairing === active.view ? "FASHN is rendering…" : active.provider === "fashn-edit" ? `Regenerate ${active.view === "detail" ? "3/4" : active.view} view` : `Generate real ${active.view === "detail" ? "3/4" : active.view} view`}<span>→</span></button>{active.repairCount > 0 && <small>{active.repairCount} FASHN generation pass{active.repairCount === 1 ? "" : "es"} applied to this view.</small>}{error && <p className="studioError">{error}</p>}</div>}

          <div className="providerNote"><strong>{renderSet.providerLabel}</strong><p>{renderSet.provider === "fashn-edit" ? `Real fashion render active${renderSet.creditsUsed ? ` · ${renderSet.creditsUsed} credits used in this render set` : ""}. FASHN output URLs are temporary, so save the design specification as the permanent source of truth.` : "The deterministic preview validates the locked specification without using external generation credits."}</p></div>
        </aside>
      </div>

      <div className="renderFooter"><div><span className="micro">CONTEXT</span><p>{brief.context.occasion} · {brief.context.venue} · {brief.context.time} · {brief.context.aesthetic}</p></div><div><span className="micro">PERSISTENCE</span><p>Save this final concept to your LLinen Earth atelier and return to the exact specification later.</p></div></div>
    </section>
  );
}
