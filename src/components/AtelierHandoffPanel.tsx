"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createHandoff, type AtelierHandoff } from "@/lib/handoff";
import { judgeFabricForBrief } from "@/lib/fashion-intelligence";
import type { SavedDesign } from "@/lib/saved-designs";

export function AtelierHandoffPanel({ design }: { design: SavedDesign }) {
  const [note,setNote]=useState("");
  const [sent,setSent]=useState<AtelierHandoff|null>(null);
  const assessment=useMemo(()=>judgeFabricForBrief(design.brief,design.version.candidate.fabricJudgement?.garmentRole),[design]);

  function send(){ setSent(createHandoff(design,note.trim())); }

  return <section className="handoffPanel">
    <div className="handoffHead"><div><span>ATELIER HANDOFF</span><h3>Take this digital design to a human designer.</h3></div><strong>{assessment.overall}/100</strong></div>
    <p className="handoffIntro">The packet carries the exact specification hash, garment choices, palette, occasion brief and fabric judgement. Store staff can review it without rebuilding the customer's intent from memory.</p>
    <div className="handoffAssessment"><div><span>UPLOADED FABRIC</span><strong>{assessment.resolvedFabric?.name||"Needs composition confirmation"}</strong></div><div><span>BEST ROLE</span><strong>{assessment.garmentRole}</strong></div><div><span>VERDICT</span><strong>{assessment.verdict}</strong></div></div>
    {!sent?<><label><span>Optional note for the atelier</span><textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="e.g. I want to see this in-store next Saturday; keep the jacket soft and prioritize breathable options."/></label><button className="handoffCta" onClick={send}><span>Send to LLinen Earth atelier</span><strong>Preserve {design.version.specHash} →</strong></button></>:<div className="handoffSent"><span>REQUEST CREATED</span><strong>{sent.id}</strong><p>The design is now in the local Phase 8 atelier queue with status “requested”.</p><Link href="/atelier">Open atelier queue →</Link></div>}
  </section>;
}
