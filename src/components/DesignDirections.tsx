"use client";

import { useState } from "react";
import type { DesignCandidate } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";

export function DesignDirections({ brief, candidates, onEditContext, onRefine }: { brief: DesignerBrief; candidates: DesignCandidate[]; onEditContext: () => void; onRefine: (candidate: DesignCandidate) => void }) {
  const [selectedId, setSelectedId] = useState(candidates.find((x) => x.tier === "Elevated")?.id || candidates[0]?.id);
  const selected = candidates.find((x) => x.id === selectedId) || candidates[0];

  return (
    <section className="directionsStudio">
      <div className="directionsIntro">
        <div><p className="eyebrow">DESIGNER ENGINE · FABRIC + OCCASION INTELLIGENCE</p><h1>Three ways forward.</h1></div>
        <div className="directionBrief"><span>{brief.context.occasion}</span><i>·</i><span>{brief.context.venue}</span><i>·</i><span>{brief.context.aesthetic}</span><button onClick={onEditContext}>Edit brief</button></div>
      </div>

      <div className="directionGrid">
        {candidates.map((candidate) => {
          const active = candidate.id === selectedId;
          const judge = candidate.fabricJudgement;
          return (
            <article className={`directionCard ${candidate.tier.toLowerCase()} ${active ? "selected" : ""}`} key={candidate.id}>
              <div className="directionTop"><div><span className="directionTier">{candidate.tier}</span><h2>{candidate.name}</h2></div><div className="directionScore"><strong>{candidate.scores.total}</strong><span>/100</span></div></div>
              <p className="directionConcept">{candidate.concept}</p>
              <div className="fabricRole"><span>YOUR FABRIC</span><p>{candidate.fabricUse}</p></div>
              <div className={`fabricJudge ${judge.verdict}`}>
                <div><span>FABRIC JUDGEMENT</span><strong>{judge.resolvedFabric?.name || "Unclassified fabric"}</strong><em>{judge.verdict} · {judge.overall}/100</em></div>
                <div className="judgeScores"><p><span>Occasion</span><b>{judge.occasionFit}</b></p><p><span>Climate</span><b>{judge.climateFit}</b></p><p><span>Role</span><b>{judge.roleFit}</b></p></div>
                <small>{judge.bestOutfitType}. {judge.reasons[1]}</small>
              </div>
              <div className="garmentStack">
                <div><span>SHIRT</span><strong>{candidate.garments.shirt}</strong></div>
                <div><span>TROUSER</span><strong>{candidate.garments.trouser}</strong></div>
                <div><span>LAYER</span><strong>{candidate.garments.layer}</strong></div>
                <div><span>FOOTWEAR</span><strong>{candidate.garments.footwear}</strong></div>
              </div>
              <div className="directionPalette">{candidate.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
              <div className="whyBlock"><span>WHY IT WORKS</span>{candidate.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
              <div className="tradeoff"><span>TRADEOFF</span><p>{candidate.tradeoff}</p></div>
              <div className="scoreStrip"><div><span>Fabric</span><b>{candidate.scores.fabric}</b></div><div><span>Climate</span><b>{candidate.scores.climate}</b></div><div><span>Occasion</span><b>{candidate.scores.occasion}</b></div><div><span>Aesthetic</span><b>{candidate.scores.aesthetic}</b></div></div>
              <button className={active ? "selectDirection active" : "selectDirection"} onClick={() => setSelectedId(candidate.id)}>{active ? "Selected direction" : "Choose this direction"}<span>→</span></button>
            </article>
          );
        })}
      </div>

      {selected && <div className="selectedBar"><div><span className="micro">SELECTED</span><strong>{selected.name}</strong><p>{selected.tier} · {selected.aesthetic} · design {selected.scores.total}/100 · fabric {selected.fabricJudgement.overall}/100</p></div><button className="button light" onClick={() => onRefine(selected)}>Compare & refine →</button></div>}
      <p className="engineNote">Fabric score is no longer image confidence alone. The Designer now evaluates fibre family, intended garment role, climate, formality and occasion before deciding whether the uploaded cloth should become a shirt, trouser, jacket, suit or Indian formal layer.</p>
    </section>
  );
}
