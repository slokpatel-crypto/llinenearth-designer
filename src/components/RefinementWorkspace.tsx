"use client";

import { useEffect, useMemo, useState } from "react";
import type { DesignCandidate } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";
import { finalizeVersion, initialVersion, nextVersion, type DesignVersion, type LockableField, type RefinementResult } from "@/lib/refinement-engine";

const FIELDS: { key: LockableField; label: string }[] = [
  { key: "shirt", label: "Shirt" }, { key: "trouser", label: "Trouser" }, { key: "layer", label: "Layer" },
  { key: "footwear", label: "Footwear" }, { key: "aesthetic", label: "Aesthetic" }, { key: "palette", label: "Palette" },
];
const QUICK = ["More Italian", "More formal", "More relaxed", "Quieter", "Bolder", "Change trousers only"];

function fieldValue(candidate: DesignCandidate, field: LockableField) {
  if (field === "aesthetic") return candidate.aesthetic;
  if (field === "palette") return candidate.palette.join(" · ");
  return candidate.garments[field];
}

export function RefinementWorkspace({ brief, initialCandidate, candidates, onBack, onVisualize }: { brief: DesignerBrief; initialCandidate: DesignCandidate; candidates: DesignCandidate[]; onBack: () => void; onVisualize: (version: DesignVersion) => void }) {
  const storageKey = `llinen-earth-refinement-${initialCandidate.id}`;
  const [versions, setVersions] = useState<DesignVersion[]>([initialVersion(initialCandidate)]);
  const [index, setIndex] = useState(0);
  const [locks, setLocks] = useState<LockableField[]>([]);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const current = versions[index] ?? versions[0];

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { versions?: DesignVersion[]; index?: number; locks?: LockableField[] };
        if (saved.versions?.length) {
          setVersions(saved.versions);
          const safeIndex = Math.min(saved.index ?? saved.versions.length - 1, saved.versions.length - 1);
          setIndex(safeIndex);
          setLocks(saved.locks ?? saved.versions[safeIndex]?.lockedFields ?? []);
        }
      }
    } catch {}
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(storageKey, JSON.stringify({ versions, index, locks }));
  }, [hydrated, storageKey, versions, index, locks]);

  const compareRows = useMemo(() => [
    ["Shirt", ...candidates.map((x) => x.garments.shirt)],
    ["Trouser", ...candidates.map((x) => x.garments.trouser)],
    ["Layer", ...candidates.map((x) => x.garments.layer)],
    ["Aesthetic", ...candidates.map((x) => x.aesthetic)],
    ["Score", ...candidates.map((x) => `${x.scores.total}/100`)],
  ], [candidates]);

  function toggleLock(field: LockableField) {
    if (current.finalized) return;
    setLocks((prev) => prev.includes(field) ? prev.filter((x) => x !== field) : [...prev, field]);
  }

  async function applyRefinement(text: string) {
    if (!text.trim() || current.finalized) return;
    setBusy(true); setError(null);
    try {
      const versionNumber = index + 2;
      const response = await fetch("/api/designer/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, candidate: current.candidate, instruction: text, lockedFields: locks, versionNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to refine this design.");
      const result = data.result as RefinementResult;
      const next = nextVersion(current, result, locks, versionNumber, text);
      const retained = versions.slice(0, index + 1);
      setVersions([...retained, next]);
      setIndex(retained.length);
      setInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refine this design.");
    } finally { setBusy(false); }
  }

  function moveVersion(nextIndex: number) {
    const safe = Math.max(0, Math.min(nextIndex, versions.length - 1));
    setIndex(safe);
    setLocks(versions[safe]?.lockedFields ?? []);
  }

  function finalize() {
    const final = finalizeVersion({ ...current, lockedFields: [...locks] });
    setVersions((prev) => prev.map((v, i) => i === index ? final : v));
  }

  if (!hydrated) return <section className="journeyLoading"><span>Restoring refinement history…</span></section>;

  return (
    <section className="refineStudio">
      <div className="refineIntro">
        <div><p className="eyebrow">PHASE 5 · COMPARE, REFINE & VERSION</p><h1>Keep what works. Change only what should.</h1></div>
        <div className="refineMeta"><span>{brief.context.occasion}</span><span>{brief.context.aesthetic}</span><button className="textButton" onClick={onBack}>Back to directions</button></div>
      </div>

      <details className="compareDrawer">
        <summary><span>Compare original directions</span><em>Safe · Elevated · Statement</em></summary>
        <div className="compareTable">
          <div className="compareHeader"><strong>Attribute</strong>{candidates.map((c) => <strong key={c.id}>{c.tier}<small>{c.name}</small></strong>)}</div>
          {compareRows.map((row) => <div className="compareRow" key={row[0]}>{row.map((cell, i) => i === 0 ? <span key={i}>{cell}</span> : <p key={i}>{cell}</p>)}</div>)}
        </div>
      </details>

      <div className="refineGrid">
        <div className="specPanel">
          <div className="specHead"><div><span className="micro">CURRENT VERSION · {current.id}</span><h2>{current.candidate.name}</h2></div><div className="directionScore"><strong>{current.candidate.scores.total}</strong><span>/100</span></div></div>
          <p className="directionConcept">{current.candidate.concept}</p>

          <div className="lockedSpec">
            {FIELDS.map(({ key, label }) => {
              const locked = locks.includes(key);
              return <div className="specRow" key={key}><div><span>{label}</span><strong>{fieldValue(current.candidate, key)}</strong></div><button className={locked ? "lockButton locked" : "lockButton"} onClick={() => toggleLock(key)} disabled={current.finalized}>{locked ? "Locked" : "Lock"}</button></div>;
            })}
          </div>

          {current.delta.length > 0 && <div className="changePanel"><span className="micro">WHAT CHANGED IN {current.id}</span>{current.delta.map((d) => <div key={`${d.field}-${d.after}`}><strong>{d.field}</strong><p><del>{d.before}</del><span>→</span><ins>{d.after}</ins></p></div>)}</div>}
          {current.finalized && <div className="finalizedPanel"><span>LOCKED DESIGN</span><strong>{current.specHash}</strong><p>This exact version is the source of truth for visualization. Refinements cannot silently change it.</p></div>}
        </div>

        <aside className="refinePanel">
          <div><span className="micro">DESIGN CONTROL</span><h2>{current.finalized ? "Design locked." : "Refine with intent."}</h2></div>
          {!current.finalized && <>
            <div className="quickRefine">{QUICK.map((item) => <button key={item} disabled={busy} onClick={() => void applyRefinement(item)}>{item}</button>)}</div>
            <label className="refineInput"><span>Tell the designer what to change</span><textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. Keep the jacket, make the rest more relaxed" /><button disabled={busy || !instruction.trim()} onClick={() => void applyRefinement(instruction)}>{busy ? "Applying controlled change…" : "Apply refinement"}<i>→</i></button></label>
            {error && <p className="studioError">{error}</p>}
            <div className="lockSummary"><span>{locks.length}</span><p>locked field{locks.length === 1 ? "" : "s"}. Refinement cannot alter these components.</p></div>
          </>}

          <div className="versionPanel"><div className="versionHead"><span className="micro">VERSION HISTORY</span><div><button disabled={index === 0} onClick={() => moveVersion(index - 1)}>Undo</button><button disabled={index >= versions.length - 1} onClick={() => moveVersion(index + 1)}>Redo</button></div></div>{versions.map((version, i) => <button className={i === index ? "versionItem active" : "versionItem"} key={version.id} onClick={() => moveVersion(i)}><span>{version.id}</span><strong>{version.reason}</strong><em>{version.delta.length ? `${version.delta.length} changes` : "baseline"}</em></button>)}</div>

          {!current.finalized ? <button className="finalizeButton" onClick={finalize}><span>Lock this design</span><strong>Prepare for visualization →</strong></button> : <button className="finalizeButton done visualizationReady" onClick={() => onVisualize(current)}><span>Phase 5 complete · {current.specHash}</span><strong>Visualize locked design →</strong></button>}
        </aside>
      </div>
      <p className="engineNote">Every refinement creates an immutable version delta. Undo returns to the exact previous specification, and locked components are excluded from subsequent changes.</p>
    </section>
  );
}
