"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listSavedDesigns, removeSavedDesign, type SavedDesign } from "@/lib/saved-designs";

function frontImage(design: SavedDesign) {
  return design.renderSet.renders.find((render) => render.view === "front")?.src || design.renderSet.renders[0]?.src;
}

export function SavedDesignsClient() {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const loaded = listSavedDesigns();
    setDesigns(loaded);
    setActiveId(loaded[0]?.id || null);
  }, []);

  const active = useMemo(() => designs.find((item) => item.id === activeId) || designs[0], [designs, activeId]);

  function remove(id: string) {
    removeSavedDesign(id);
    const next = designs.filter((item) => item.id !== id);
    setDesigns(next);
    if (activeId === id) setActiveId(next[0]?.id || null);
  }

  async function copyId(design: SavedDesign) {
    const value = `${design.title} · ${design.version.specHash} · ${design.id}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(design.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  if (!designs.length) return (
    <section className="savedEmpty">
      <p className="eyebrow">YOUR ATELIER</p>
      <h1>No saved designs yet.</h1>
      <p>Finalize a direction in the Designer, visualize the locked specification, then save it here as a permanent concept card.</p>
      <Link className="button light" href="/designer">Start a design</Link>
    </section>
  );

  return (
    <section className="savedStudio">
      <div className="savedIntro">
        <div><p className="eyebrow">YOUR ATELIER · SAVED DESIGNS</p><h1>Ideas worth returning to.</h1></div>
        <p>Each saved card preserves the exact design version, context, render set and specification hash used to create it.</p>
      </div>

      <div className="savedLayout">
        <div className="savedGrid">
          {designs.map((design) => {
            const image = frontImage(design);
            return <button key={design.id} className={active?.id === design.id ? "savedCard active" : "savedCard"} onClick={() => setActiveId(design.id)}>
              <div className="savedImage">{image && <img src={image} alt={`${design.title} front visualization`} />}<span>{design.version.specHash}</span></div>
              <div className="savedCardCopy"><span>{design.brief.context.occasion} · {design.brief.context.aesthetic}</span><strong>{design.title}</strong><p>{design.version.candidate.garments.layer}</p></div>
            </button>;
          })}
        </div>

        {active && <aside className="savedDetail">
          <div className="savedDetailHero"><img src={frontImage(active)} alt={`${active.title} visualization`} /><div><span>LOCKED DESIGN</span><strong>{active.version.specHash}</strong></div></div>
          <p className="eyebrow">{active.brief.context.occasion} · {active.brief.context.venue}</p>
          <h2>{active.title}</h2>
          <p className="savedConcept">{active.version.candidate.concept}</p>
          <dl className="savedSpec">
            <div><dt>Shirt</dt><dd>{active.version.candidate.garments.shirt}</dd></div>
            <div><dt>Trouser</dt><dd>{active.version.candidate.garments.trouser}</dd></div>
            <div><dt>Layer</dt><dd>{active.version.candidate.garments.layer}</dd></div>
            <div><dt>Footwear</dt><dd>{active.version.candidate.garments.footwear}</dd></div>
            <div><dt>Fabric</dt><dd>{active.renderSet.spec.fabric.material}</dd></div>
            <div><dt>Model</dt><dd>{active.renderSet.modelId}</dd></div>
          </dl>
          <div className="savedPalette">{active.version.candidate.palette.map((color) => <i key={color} style={{ background: color }} />)}</div>
          <div className="savedActions"><button onClick={() => void copyId(active)}>{copied === active.id ? "Copied" : "Copy design ID"}</button><button className="danger" onClick={() => remove(active.id)}>Remove</button></div>
          <p className="savedTimestamp">Saved {new Date(active.savedAt).toLocaleString()}</p>
        </aside>}
      </div>
    </section>
  );
}
