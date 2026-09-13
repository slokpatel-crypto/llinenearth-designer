"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import { saveDesign } from "@/lib/saved-designs";
import type { RenderSet, RenderView } from "@/lib/visualization-engine";
import { AtelierMannequin, type LayerStyle, type MannequinView, type ShirtStyle, type TrouserStyle } from "@/components/AtelierMannequin";

const VIEW_ORDER: RenderView[] = ["front", "back", "detail"];

function shirtStyleFromName(name: string): ShirtStyle {
  const value = name.toLowerCase();
  if (value.includes("camp") || value.includes("cuban")) return "cuban";
  if (value.includes("band") || value.includes("mandarin")) return "mandarin";
  if (value.includes("button-down") || value.includes("oxford")) return "buttonDown";
  if (value.includes("cutaway")) return "slim";
  return "classic";
}
function trouserStyleFromName(name: string): TrouserStyle {
  const value = name.toLowerCase();
  if (value.includes("wide")) return "wide";
  if (value.includes("drawstring") || value.includes("relaxed")) return "relaxed";
  if (value.includes("slim") || value.includes("taper")) return "tapered";
  return "straight";
}
function layerStyleFromName(name: string): LayerStyle {
  const value = name.toLowerCase();
  if (value.includes("no jacket") || value.includes("none")) return "none";
  if (value.includes("suit")) return "suit";
  return "blazer";
}
function safeColor(value: string | undefined, fallback: string) {
  return value && (/^#[0-9a-f]{3,8}$/i.test(value) || /^(rgb|hsl)a?\(/i.test(value)) ? value : fallback;
}

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
  const palette = version.candidate.palette;
  const mannequinProps = {
    shirtColor: safeColor(palette[1], "#f2eee6"),
    trouserColor: safeColor(palette[0], "#6f6559"),
    layerColor: safeColor(palette[0], "#14243b"),
    shirtStyle: shirtStyleFromName(version.candidate.garments.shirt),
    trouserStyle: trouserStyleFromName(version.candidate.garments.trouser),
    layerStyle: layerStyleFromName(version.candidate.garments.layer),
  };
  const mannequinView: MannequinView = activeView === "front" ? "front" : activeView === "back" ? "back" : "threeQuarter";

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
        <div><p className="eyebrow">FINAL DESIGN EXPERIENCE · SAME ATELIER MODEL</p><h1>Your AI direction, resolved on one consistent mannequin.</h1></div>
        <div className="visualizationMeta"><span>{version.id}</span><strong>{version.specHash}</strong><button className="textButton" onClick={onBack}>Back to locked design</button></div>
      </div>

      <div className="finalHero">
        <div className="finalHeroImage"><div className="aiMannequinPreview"><AtelierMannequin {...mannequinProps} view="front" /></div><div className="finalHeroBadge"><span>LLINEN EARTH DESIGN</span><strong>{version.specHash}</strong></div></div>
        <div className="finalHeroCopy">
          <p className="eyebrow">{brief.context.occasion} · {brief.context.venue}</p>
          <h2>{version.candidate.name}</h2>
          <p className="finalConcept">{version.candidate.concept}</p>
          <div className="finalContext"><span>{brief.context.time}</span><span>{brief.context.formality}</span><span>{brief.context.aesthetic}</span><span>{brief.context.fit}</span></div>
          <div className="finalActions"><button className="primarySave" onClick={saveCurrentDesign}>{saved ? "Saved to your atelier" : "Save this design"}<span>→</span></button><button onClick={() => void copyDesignId()}>{copied ? "Design ID copied" : "Copy design ID"}</button>{saved && <Link href="/designs">View saved designs</Link>}</div>
          <p className="finalTrust">The mannequin keeps one body, studio and camera language so outfit changes are easier to compare. It is a design visualization, not a made-to-measure fit guarantee.</p>
        </div>
      </div>

      <div className="renderGrid">
        <div className="renderStage">
          <div className="renderToolbar">
            <div className="viewTabs">{VIEW_ORDER.map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => { setActiveView(view); setZoomed(false); }}>{view === "detail" ? "3/4" : `${view[0].toUpperCase()}${view.slice(1)}`}</button>)}</div>
            <button className="zoomButton" onClick={() => setZoomed((x) => !x)}>{zoomed ? "Fit view" : "Inspect outfit"}</button>
          </div>

          <div className={zoomed ? "renderFrame zoomed" : "renderFrame"} onClick={() => setZoomed((x) => !x)}>
            <div className="aiMannequinPreview"><AtelierMannequin {...mannequinProps} view={mannequinView} /></div>
            <div className="renderBadge"><span>OUTFIT PREVIEW</span><strong>{active.validation.overall}%</strong></div>
          </div>

          <div className="renderFilmstrip">
            {renderSet.renders.map((render) => <button key={render.id} className={activeView === render.view ? "active" : ""} onClick={() => setActiveView(render.view)}><img src={render.src} alt="" /><span>{render.view === "detail" ? "3/4 outfit" : render.label}</span><em>{render.validation.overall}%</em></button>)}
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

          <div className="repairCard"><span className="micro">TARGETED REPAIR</span><h3>Keep the design fixed.</h3><p>The development renderer remains behind the mannequin preview for specification validation and later production image-model replacement.</p><button disabled={!!repairing} onClick={() => void repair(active.view)}>{repairing === active.view ? "Repairing selected view…" : `Repair ${active.view} view`}<span>→</span></button>{active.repairCount > 0 && <small>{active.repairCount} repair pass{active.repairCount === 1 ? "" : "es"} applied to this view.</small>}{error && <p className="studioError">{error}</p>}</div>

          <div className="providerNote"><strong>Consistent mannequin layer</strong><p>The customer-facing preview is deterministic and consistent. A photorealistic generation provider can later render this same locked outfit without changing the design logic.</p></div>
        </aside>
      </div>

      <div className="renderFooter"><div><span className="micro">CONTEXT</span><p>{brief.context.occasion} · {brief.context.venue} · {brief.context.time} · {brief.context.aesthetic}</p></div><div><span className="micro">PERSISTENCE</span><p>Save this final concept to your LLinen Earth atelier and return to the exact specification later.</p></div></div>
    </section>
  );
}
