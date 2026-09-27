"use client";

import { useState } from "react";
import type { DesignCandidate } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";
import { measurementCoverage } from "@/lib/measurements";
import type { StockPairingPublic } from "@/lib/shirt-pant-designer";

export function DesignDirections({ brief, candidates, stockPairing, stockPairings = [], onEditContext, onRefine }: { brief: DesignerBrief; candidates: DesignCandidate[]; stockPairing?: StockPairingPublic | null; stockPairings?: StockPairingPublic[]; onEditContext: () => void; onRefine: (candidate: DesignCandidate, pairing?: StockPairingPublic | null) => void }) {
  const [selectedId, setSelectedId] = useState(candidates.find((x) => x.tier === "Elevated")?.id || candidates[0]?.id);
  const rankedStockPairings = stockPairings.length ? stockPairings : stockPairing ? [stockPairing] : [];
  const [selectedPairId, setSelectedPairId] = useState(stockPairing?.id || rankedStockPairings[0]?.id || "");
  const [pairFeedback, setPairFeedback] = useState<Record<string,"up" | "down">>({});
  const [feedbackSync, setFeedbackSync] = useState<Record<string,"idle" | "saving" | "saved" | "local">>({});
  const selected = candidates.find((x) => x.id === selectedId) || candidates[0];
  const selectedStockPairing = rankedStockPairings.find((pair)=>pair.id === selectedPairId) || stockPairing || rankedStockPairings[0] || null;
  const coverage = measurementCoverage(brief.measurements);

  async function submitPairFeedback(pairing: StockPairingPublic, value: "up" | "down") {
    setPairFeedback((current)=>({...current,[pairing.id]:value}));
    setFeedbackSync((current)=>({...current,[pairing.id]:"saving"}));
    try {
      if (!brief.sessionId) throw new Error("No designer session");
      const sessionResponse = await fetch("/api/memory/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: brief.sessionId }),
      });
      if (!sessionResponse.ok) throw new Error("Feedback sync unavailable");
      const session = await sessionResponse.json() as { token?: string };
      if (!session.token) throw new Error("Feedback token unavailable");

      const eventResponse = await fetch("/api/memory/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-llinen-memory-token": session.token,
        },
        body: JSON.stringify({
          id: `EV-DESIGNER-FEEDBACK-${crypto.randomUUID()}`,
          sessionId: brief.sessionId,
          type: "look_selected",
          at: new Date().toISOString(),
          payload: {
            lookId: pairing.id,
            title: `Phase 1 ${pairing.mode || "stock"} shirt-pant pairing`,
            fabricId: pairing.shirt.id,
            fabric: pairing.trouser.id,
            automatic: false,
            feedback: value,
            rulesVersion: pairing.rulesVersion,
          },
        }),
      });
      const event = await eventResponse.json() as { stored?: boolean };
      setFeedbackSync((current)=>({...current,[pairing.id]:eventResponse.ok && event.stored ? "saved" : "local"}));
    } catch {
      try {
        sessionStorage.setItem(`llinen-designer-feedback:${pairing.id}`, value);
      } catch {}
      setFeedbackSync((current)=>({...current,[pairing.id]:"local"}));
    }
  }

  return (
    <section className="directionsStudio">
      <div className="directionsIntro">
        <div><p className="eyebrow">DESIGNER ENGINE · FABRIC + OCCASION + FIT INTELLIGENCE</p><h1>Three ways forward.</h1></div>
        <div className="directionBrief"><span>{brief.context.occasion}</span><i>·</i><span>{brief.context.venue}</span><i>·</i><span>{brief.context.aesthetic}</span>{coverage.total > 0 && <><i>·</i><span>{coverage.total}/16 measurements</span></>}<button onClick={onEditContext}>Edit brief</button></div>
      </div>

      {selectedStockPairing && <section className={`stockPairingPanel ${selectedStockPairing.forced ? "ready" : "review"}`}>
        <div className="stockPairingHead">
          <div>
            <p className="eyebrow">REAL LLINEN EARTH STOCK · RANKED DESIGNER DIRECTIONS</p>
            <h2>{rankedStockPairings.length > 1 ? "Three ways to wear the fabric." : selectedStockPairing.forced ? "A grounded shirt–trouser pairing." : "A possible pairing — held for review."}</h2>
          </div>
          <div className="stockPairingScore"><strong>{selectedStockPairing.confidenceScore}</strong><span>/100 confidence</span></div>
        </div>

        {rankedStockPairings.length > 1 && <div className="stockPairingRanks">
          {rankedStockPairings.map((pair)=><button key={pair.id} className={pair.id === selectedStockPairing.id ? "active" : ""} onClick={()=>{setSelectedPairId(pair.id);const match=candidates.find((candidate)=>candidate.tier===pair.mode);if(match)setSelectedId(match.id);}}>
            <span>{pair.mode || "Direction"}</span>
            <strong>{pair.shirt.colorName} + {pair.trouser.colorName}</strong>
            <small>{pair.relationship} · {pair.rankScore ?? pair.confidenceScore}/100 fit</small>
            {pair.modeReason && <em>{pair.modeReason}</em>}
          </button>)}
        </div>}

        <div className="stockPairingPieces">
          <article>
            <img src={selectedStockPairing.shirt.swatchImageUrl} alt={`${selectedStockPairing.shirt.colorName} shirt fabric`} />
            <div><span>SHIRT</span><strong>{selectedStockPairing.shirt.colorName}</strong><small>{selectedStockPairing.shirt.line} · {selectedStockPairing.shirt.pattern}</small></div>
          </article>
          <i aria-hidden="true">+</i>
          <article>
            <img src={selectedStockPairing.trouser.swatchImageUrl} alt={`${selectedStockPairing.trouser.colorName} trouser fabric`} />
            <div><span>TROUSER</span><strong>{selectedStockPairing.trouser.colorName}</strong><small>{selectedStockPairing.trouser.line} · {selectedStockPairing.trouser.pattern}</small></div>
          </article>
        </div>
        <div className="stockPairingReason">
          <span>{selectedStockPairing.mode ? `${selectedStockPairing.mode} · ` : ""}{selectedStockPairing.occasionBand} · {selectedStockPairing.relationship}</span>
          <p>{selectedStockPairing.forced ? selectedStockPairing.customerReason : "The rules found a candidate, but the confidence is below the safe threshold. No combination is being forced until LLinen Earth approves the fallback choice."}</p>
          {selectedStockPairing.modeReason && <p className="stockModeReason"><b>Why this direction:</b> {selectedStockPairing.modeReason}</p>}
          <small>Rule set {selectedStockPairing.rulesVersion} · brand taste ranks rule-valid stock; it does not override hard compatibility checks.</small>
          <div className="stockPairingFeedback">
            <span>Does this specific pairing feel right for LLinen Earth?</span>
            <div>
              <button className={pairFeedback[selectedStockPairing.id] === "up" ? "active" : ""} onClick={() => void submitPairFeedback(selectedStockPairing,"up")} disabled={feedbackSync[selectedStockPairing.id] === "saving"} aria-pressed={pairFeedback[selectedStockPairing.id] === "up"}>Yes</button>
              <button className={pairFeedback[selectedStockPairing.id] === "down" ? "active" : ""} onClick={() => void submitPairFeedback(selectedStockPairing,"down")} disabled={feedbackSync[selectedStockPairing.id] === "saving"} aria-pressed={pairFeedback[selectedStockPairing.id] === "down"}>No</button>
            </div>
            {pairFeedback[selectedStockPairing.id] && <em>{feedbackSync[selectedStockPairing.id] === "saved" ? "Recorded for rule review." : feedbackSync[selectedStockPairing.id] === "saving" ? "Recording…" : "Kept for this session; cloud logging will activate when connected."}</em>}
          </div>
        </div>
      </section>}

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
              {candidate.fitGuidance.length > 0 && <div className="fitGuidance"><div className="fitGuidanceHead"><span>MEASUREMENT-AWARE FIT</span><b>{coverage.shirt}/8 shirt · {coverage.pants}/8 pants</b></div>{candidate.fitGuidance.map((note)=><p key={note}>{note}</p>)}</div>}
              <div className="directionPalette">{candidate.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
              <div className="whyBlock"><span>WHY IT WORKS</span>{candidate.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
              <div className="tradeoff"><span>TRADEOFF</span><p>{candidate.tradeoff}</p></div>
              <div className="scoreStrip"><div><span>Fabric</span><b>{candidate.scores.fabric}</b></div><div><span>Climate</span><b>{candidate.scores.climate}</b></div><div><span>Occasion</span><b>{candidate.scores.occasion}</b></div><div><span>Aesthetic</span><b>{candidate.scores.aesthetic}</b></div></div>
              <button className={active ? "selectDirection active" : "selectDirection"} onClick={() => { setSelectedId(candidate.id); const pair=rankedStockPairings.find((item)=>item.mode===candidate.tier); if(pair)setSelectedPairId(pair.id); }}>{active ? "Selected direction" : "Choose this direction"}<span>→</span></button>
            </article>
          );
        })}
      </div>

      {selected && <div className="selectedBar"><div><span className="micro">SELECTED</span><strong>{selected.name}</strong><p>{selected.tier} · {selected.aesthetic} · design {selected.scores.total}/100 · fabric {selected.fabricJudgement.overall}/100{coverage.total > 0 ? ` · fit profile ${coverage.total}/16` : ""}</p></div><button className="button light" onClick={() => onRefine(selected,selectedStockPairing)}>Compare & refine →</button></div>}
      <p className="engineNote">The Designer now combines visual fabric signals, confirmed fibre family, intended garment role, climate, formality, occasion and optional body measurements before deciding how the outfit should be built.</p>
    </section>
  );
}
