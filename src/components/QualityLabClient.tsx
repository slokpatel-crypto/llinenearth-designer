"use client";

import { useMemo, useState } from "react";
import { listSavedDesigns } from "@/lib/saved-designs";
import { listHandoffs } from "@/lib/handoff";
import { listFeedback, markFeedbackReviewed } from "@/lib/feedback";
import { runQualityBenchmarks } from "@/lib/quality-lab";

export function QualityLabClient() {
  const [refreshKey,setRefreshKey] = useState(0);
  const data = useMemo(() => {
    const benchmark = runQualityBenchmarks();
    const saved = listSavedDesigns();
    const handoffs = listHandoffs();
    const feedback = listFeedback();
    return { benchmark, saved, handoffs, feedback };
  }, [refreshKey]);

  const pending = data.feedback.filter((x)=>x.reviewStatus === "pending_review");
  const ready = data.benchmark.passed === data.benchmark.total;

  function review(id:string) {
    markFeedbackReviewed(id);
    setRefreshKey((x)=>x+1);
  }

  return <section className="qualityStudio">
    <div className="qualityHero">
      <div><p className="eyebrow">PHASE 9 · QUALITY, SCALE & LEARNING</p><h1>Make the system better without letting it learn blindly.</h1></div>
      <div className={ready?"qualityBadge pass":"qualityBadge review"}><span>{ready?"QUALITY GATE PASS":"REVIEW REQUIRED"}</span><strong>{data.benchmark.passed}/{data.benchmark.total}</strong><p>deterministic fashion benchmarks passing</p></div>
    </div>

    <div className="qualityStats">
      <article><span>WEAR TYPES</span><strong>{data.benchmark.wearCount}</strong><p>Structured menswear archetypes in the Fashion Brain.</p></article>
      <article><span>FABRIC FAMILIES</span><strong>{data.benchmark.fabricCount}</strong><p>Material families with climate, drape and garment suitability.</p></article>
      <article><span>SAVED DESIGNS</span><strong>{data.saved.length}</strong><p>Customer-approved concepts currently preserved in this browser.</p></article>
      <article><span>ATELIER HANDOFFS</span><strong>{data.handoffs.length}</strong><p>Designs passed from digital atelier to human review.</p></article>
    </div>

    <div className="qualityGrid">
      <article className="benchmarkPanel">
        <div className="qualityPanelHead"><span className="micro">REGRESSION SUITE</span><h2>Fashion judgement benchmarks.</h2><p>Known-good and known-bad fabric / occasion combinations must remain sensible as the Designer evolves.</p></div>
        <div className="benchmarkList">{data.benchmark.results.map((test)=><div className={test.pass?"benchmarkRow pass":"benchmarkRow fail"} key={test.id}><div><span>{test.pass?"PASS":"FAIL"}</span><strong>{test.label}</strong><p>{test.role} · expected {test.expected}</p></div><div><strong>{test.score}</strong><span>{test.verdict}</span></div></div>)}</div>
      </article>

      <aside className="learningPanel">
        <div className="qualityPanelHead"><span className="micro">HUMAN-IN-THE-LOOP LEARNING</span><h2>Feedback is evidence, not an automatic rule.</h2><p>Customer and atelier feedback is queued for review. Nothing changes the Fashion Brain automatically from a click.</p></div>
        {!data.feedback.length ? <div className="learningEmpty"><strong>No feedback yet.</strong><p>Saved-design reactions will appear here once customers rate an outfit.</p></div> : <div className="feedbackQueue">{data.feedback.slice(0,8).map((item)=><div key={item.id} className="feedbackItem"><div><span>{item.rating.replace("_"," ")}</span><strong>{item.specHash}</strong><p>{item.reasons.join(" · ") || item.note || "No written note"}</p></div>{item.reviewStatus === "pending_review"?<button onClick={()=>review(item.id)}>Mark reviewed</button>:<em>Reviewed</em>}</div>)}</div>}
        <div className="learningGuard"><span>{pending.length}</span><p>feedback item{pending.length===1?"":"s"} awaiting human review</p></div>
      </aside>
    </div>

    <div className="scaleRail">
      <article><span>01</span><h3>Measure</h3><p>Track judgement quality, saved designs, handoffs and customer feedback.</p></article>
      <article><span>02</span><h3>Review</h3><p>Human fashion experts inspect failures and recurring feedback patterns.</p></article>
      <article><span>03</span><h3>Change deliberately</h3><p>Knowledge updates are versioned and tested against the benchmark suite.</p></article>
      <article><span>04</span><h3>Scale providers</h3><p>Vision, image generation, inventory and persistence adapters can be replaced without changing the design contract.</p></article>
    </div>
  </section>;
}
