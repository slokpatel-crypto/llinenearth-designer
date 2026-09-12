"use client";

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
  const [error, setError] = useState<string | null>(null);
  const active = renderSet.renders.find((x) => x.view === activeView) || renderSet.renders[0];
  const average = useMemo(() => Math.round(renderSet.renders.reduce((sum, x) => sum + x.validation.overall, 0) / Math.max(1, renderSet.renders.length)), [renderSet]);
  const front = renderSet.renders.find((x) => x.view === "front") || renderSet.renders[0];

  async function repair(view: RenderView) {
    setRepairing(view); setError(null);
    try {
      const response = await fetch("/api/visualization/repair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderSet, view }) });
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
        <div><p className="eyebrow">PHASE 7 · FINAL DESIGN EXPERIENCE</p><h1>Your design, resolved into one presentation.</h1></div>
        <div className="visualizationMeta"><span>{version.id}</span><strong>{version.specHash}</strong><button className="textButton" onClick={onBack}>Back to locked design</button></div>
      </div>

      <div className="finalHero">
        <div className="finalHeroImage"><img src={front.src} alt={`${version.candidate.name} final visualization`} /><div className="finalHeroBadge"><span>LLINEN EARTH DESIGN</span><strong>{version.specHash}</strong></div></div>
        <div className="finalHeroCopy">
          <p className="eyebrow">{brief.context.occasion} · {brief.context.venue}</p>
          <h2>{version.candidate.name}</h2>
          <p className="finalConcept">{version.candidate.concept}</p>
          <div className="finalContext"><span>{brief.context.time}</span><span>{brief.context.formality}</span><span>{brief.context.aesthetic}</span><span>{brief.context.fit}</span></div>
          <div className="finalActions"><button className="primarySave" onClick={saveCurrentDesign}>{saved ? "Saved to your atelier" : "Save this design"}<span>→</span></button><button onClick={() => void copyDesignId()}>{copied ? "Design ID copied" : "Copy design ID"}</button>{saved && <Link href="/designs">View saved designs</Link>}</div>
          <p className="finalTrust">Visualization is a design representation, not a guarantee of made-to-measure fit. The locked specification remains the source of truth.</p>
        </div>
      </div>

      <div className="renderGrid">
        <div className="renderStage">
          <div className="renderToolbar">
            <div className="viewTabs">{VIEW_ORDER.map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => { setActiveView(view); setZoomed(false); }}>{view === "detail" ? "Detail" : `${view[0].toUpperCase()}${view.slice(1)}`}</button>)}</div>
            <button className="zoomButton" onClick={() => setZoomed((x) => !x)}>{zoomed ? "Fit view" : "Inspect detail"}</button>
          </div>

          <div className={zoomed ? "renderFrame zoomed" : "renderFrame"} onClick={() => setZoomed((x) => !x)}>
            <img src={active.src} alt={`${active.label} of the locked LLinen Earth design`} />
            <div className="renderBadge"><span>APPROVED PREVIEW</span><strong>{active.validation.overall}%</strong></div>
          </div>

          <div className="renderFilmstrip">
            {renderSet.renders.map((render) => <button key={render.id} className={activeView === render.view ? "active" : ""} onClick={() => setActiveView(render.view)}><img src={render.src} alt="" /><span>{render.label}</span><em>{render.validation.overall}%</em></button>)}
          </div>
        </div>

        <aside className="visualizationPanel">
          <div className="visualizationPanelHead"><span className="micro">RENDER SET · {renderSet.id}</span><h2>Source of truth preserved.</h2><p>The render is compiled from the finalized specification. The image layer is not allowed to silently redesign the outfit.</p></div>

          <div className="validationCard">
            <div className="validationScore"><strong>{average}</strong><span>/100 average consistency</span></div>
            {active.validation.signals.map((signal) => <div className="validationRow" key={signal.key}><span>{signal.label}</span><div><i style={{ width: `${signal.score}%` }} /><em>{signal.score}%</em></div></div>)}
          </div>

          <div className="visualSpec">
            <span className="micro">LOCKED SPECIFICATION</span>
            <dl><div><dt>Model</dt><dd>{renderSet.modelId}</dd></div><div><dt>Shirt</dt><dd>{version.candidate.garments.shirt}</dd></div><div><dt>Trouser</dt><dd>{version.candidate.garments.trouser}</dd></div><div><dt>Layer</dt><dd>{version.candidate.garments.layer}</dd></div><div><dt>Footwear</dt><dd>{version.candidate.garments.footwear}</dd></div><div><dt>Aesthetic</dt><dd>{version.candidate.aesthetic}</dd></div><div><dt>Fabric</dt><dd>{renderSet.spec.fabric.material}</dd></div></dl>
            <div className="visualPalette">{version.candidate.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
          </div>

          <div className="repairCard"><span className="micro">TARGETED REPAIR</span><h3>Fix the view, not the whole outfit.</h3><p>If one angle fails, only that angle is regenerated. The locked design and other approved views stay untouched.</p><button disabled={!!repairing} onClick={() => void repair(active.view)}>{repairing === active.view ? "Repairing selected view…" : `Repair ${active.view} view`}<span>→</span></button>{active.repairCount > 0 && <small>{active.repairCount} repair pass{active.repairCount === 1 ? "" : "es"} applied to this view.</small>}{error && <p className="studioError">{error}</p>}</div>

          <div className="providerNote"><strong>Development visualization adapter</strong><p>The current previews validate the locked-spec, multi-view and repair experience. A production image-generation provider can replace the renderer behind the same contract.</p></div>
        </aside>
      </div>

      <div className="renderFooter"><div><span className="micro">CONTEXT</span><p>{brief.context.occasion} · {brief.context.venue} · {brief.context.time} · {brief.context.aesthetic}</p></div><div><span className="micro">PERSISTENCE</span><p>Save this final concept to your LLinen Earth atelier and return to the exact specification later.</p></div></div>
    </section>
  );
}
