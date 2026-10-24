"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createHandoff, type AtelierHandoff } from "@/lib/handoff";
import { judgeFabricForBrief } from "@/lib/fashion-intelligence";
import type { SavedDesign } from "@/lib/saved-designs";

export function AtelierHandoffPanel({ design }: { design: SavedDesign }) {
  const [note,setNote]=useState("");
  const [sent,setSent]=useState<AtelierHandoff|null>(null);
  const [error,setError]=useState("");
  const assessment=useMemo(()=>judgeFabricForBrief(design.brief,design.version.candidate.fabricJudgement?.garmentRole),[design]);

  function send(){
    try { setSent(createHandoff(design,note.trim())); setError(""); }
    catch { setError("This browser could not save the handoff. Check browser storage and try again."); }
  }

  return <section className="handoffPanel">
    <div className="handoffHead"><div><span>ATELIER HANDOFF</span><h3>Prepare a local handoff for a human designer.</h3></div><strong>{assessment.overall}/100</strong></div>
    <p className="handoffIntro">The packet preserves the exact specification hash, garment choices, palette, occasion brief and fabric judgement in this browser. It has not been sent to store staff.</p>
    <div className="handoffAssessment"><div><span>UPLOADED FABRIC</span><strong>{assessment.resolvedFabric?.name||"Needs composition confirmation"}</strong></div><div><span>BEST ROLE</span><strong>{assessment.garmentRole}</strong></div><div><span>VERDICT</span><strong>{assessment.verdict}</strong></div></div>
    {!sent?<><label><span>Optional note for the atelier</span><textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="e.g. I want to see this in-store next Saturday; keep the jacket soft and prioritize breathable options."/></label><button className="handoffCta" onClick={send}><span>Save to local atelier queue</span><strong>Preserve {design.version.specHash} →</strong></button>{error&&<p role="alert">{error}</p>}</>:<div className="handoffSent"><span>LOCAL PACKET SAVED</span><strong>{sent.id}</strong><p>The design is saved only to this browser’s local Atelier queue. It has not been transmitted to Linen Earth staff.</p><Link href="/atelier">Open atelier queue →</Link></div>}
  </section>;
}
