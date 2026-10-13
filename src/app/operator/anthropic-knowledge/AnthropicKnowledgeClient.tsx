"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Proposal={
  id:string;domain:string;claim:string;rationale:string;
  constraints:string[];evidenceNeeded:string[];
  reviewStatus:string;provenance:string;
};
type KnowledgeGroup={domain:string;model?:string;source?:string;reviewNotes?:string[];proposals:Proposal[]};
type KnowledgeLedger={
  configured:boolean;audited:KnowledgeGroup[];archive:KnowledgeGroup[];
  reviews:Array<{id:string;payload:{proposalId?:string;task?:string;decision?:string;signedBy?:string;note?:string}}>;
};
type Tier="audited"|"archive";
const domains=["fabric","shirt","trouser","cross-garment","style-recipe","quality"] as const;

export default function AnthropicKnowledgeClient(){
 const [data,setData]=useState<KnowledgeLedger|null>(null);
 const [error,setError]=useState("");
 const [tier,setTier]=useState<Tier>("audited");
 const [domain,setDomain]=useState<string>("fabric");
 const [active,setActive]=useState<string|null>(null);
 const [signedBy,setSignedBy]=useState("");
 const [note,setNote]=useState("");
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const reload=useCallback(async()=>{
   try{
     const response=await fetch("/api/operator/anthropic-knowledge",{cache:"no-store",credentials:"same-origin"});
     if(!response.ok)throw Error("Review ledger could not be loaded.");
     setData(await response.json() as KnowledgeLedger);
     setError("");
   }catch(e){setError(e instanceof Error?e.message:"Review ledger unavailable.");}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 const groups=tier==="audited" ? data?.audited||[] : data?.archive||[];
 const selected=useMemo(()=>groups.find(g=>g.domain===domain),[groups,domain]);
 const count=groups.reduce((n,g)=>n+g.proposals.length,0);
 const reviewFor=(proposalId:string)=>{
   return data?.reviews?.find(r=>r.payload.proposalId===proposalId&&r.payload.task===domain)?.payload;
 };
 async function review(proposalId:string,decision:"approved_as_proposal"|"rejected"){
   if(!data?.configured)return;
   if(signedBy.trim().length<2||note.trim().length<8){
     setMessage("Enter a reviewer name and a reason of at least 8 characters.");
     return;
   }
   setSaving(true);setMessage("");
   try{
     const response=await fetch("/api/operator/anthropic-knowledge",{
       method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
       body:JSON.stringify({task:domain,proposalId,decision,signedBy:signedBy.trim(),note:note.trim()})
     });
     if(!response.ok)throw Error("Could not save this human review.");
     setActive(null);setNote("");setMessage("Review recorded. Live garment rules were not changed.");
     await reload();
   }catch(e){setMessage(e instanceof Error?e.message:"Review request failed.");}
   finally{setSaving(false);}
 }
 return <main className="leIntelligence">
   <header className="leIntelTop">
     <div className="leIntelBrand">LINEN EARTH <span>DEEP ENGINE</span></div>
     <a href="/operator/designer-research">Research Desk ↗</a>
   </header>
   <section className="leIntelIntro">
     <p className="leIntelEyebrow">PRIVATE OPERATOR / INTELLIGENCE</p>
     <h1>Fashion knowledge review</h1>
     <p>Archive of the October 13 Claude intelligence sprint. These suggestions are not certified supplier facts, measured fabrics or tailor-approved rules. Nothing here automatically changes customer recommendations.</p>
   </section>
   <section className="leIntelToolbar">
     <div className="leIntelSegment" aria-label="Knowledge quality tier">
       <button type="button" className={tier==="audited"?"selected":""} onClick={()=>{setTier("audited");setActive(null);}}>AI-audited</button>
       <button type="button" className={tier==="archive"?"selected":""} onClick={()=>{setTier("archive");setActive(null);}}>Original proposals</button>
     </div>
     <span className="leIntelCount">{count} unapproved items · {data?.configured?"Review ledger connected":"Read-only archive"}</span>
   </section>
   <nav className="leIntelDomains" aria-label="Knowledge domain">
     {domains.map(item=><button key={item} type="button" className={item===domain?"selected":""}
       onClick={()=>{setDomain(item);setActive(null);setMessage("");}}>
       {item.replace(/-/g," ")} <span>{groups.find(g=>g.domain===item)?.proposals.length??0}</span>
     </button>)}
   </nav>
   {error&&<p className="leIntelWarning">{error}</p>}
   {!data&&!error&&<p className="leIntelPending">Loading operator knowledge…</p>}
   <section className="leIntelMain">
     <div className="leIntelHeading">
       <h2>{domain.replace(/-/g," ")} recommendations</h2>
       <p>{tier==="audited"?"Second-model critique; still requires human approval":"Original raw AI output; inspect critically"}</p>
     </div>
     {(selected?.proposals||[]).map(p=>{
       const existing=reviewFor(p.id);
       return <article className="leIntelCard" key={p.id}>
         <div className="leIntelCardHead"><span>{p.id}</span><span>{existing?.decision?"REVIEW RECORDED":"HUMAN REVIEW PENDING"}</span></div>
         <h3>{p.claim}</h3>
         <p>{p.rationale}</p>
         <div className="leIntelDetails">
           <div><strong>Conditions</strong>{p.constraints?.length ? <ul>{p.constraints.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>Not supplied.</p>}</div>
           <div><strong>Evidence needed</strong>{p.evidenceNeeded?.length ? <ul>{p.evidenceNeeded.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>Not supplied.</p>}</div>
         </div>
         {existing&&<p className="leIntelReviewed">Previous review: {existing.decision} · {existing.signedBy||"operator"}</p>}
         {data?.configured&&<>
           <button type="button" className="leIntelReviewToggle" onClick={()=>{setActive(active===p.id?null:p.id);setMessage("");}}>
             {active===p.id?"Close review":"Review this proposal"}
           </button>
           {active===p.id&&<div className="leIntelForm">
             <label>Reviewer name<input value={signedBy} onChange={e=>setSignedBy(e.target.value)} maxLength={100}/></label>
             <label>Review rationale<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={750} rows={3}/></label>
             <div className="leIntelFormActions">
               <button type="button" disabled={saving} onClick={()=>void review(p.id,"approved_as_proposal")}>Keep for design review</button>
               <button type="button" disabled={saving} onClick={()=>void review(p.id,"rejected")}>Reject suggestion</button>
             </div>
             <small>Keeping a proposal does not certify fabric measurements or activate it in the live engine.</small>
           </div>}
         </>}
       </article>;
     })}
     {message&&<p className="leIntelNotice">{message}</p>}
   </section>
 </main>;
}
