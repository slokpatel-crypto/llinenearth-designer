"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";

type Review={id:string;status:"approved"|"rejected";note:string;reviewedAt:string};
type Row={
  id:string;styleKey:string;label:string;group:string;
  livePreview:"exact"|"approximate"|"none";
  aiRender:"exact"|"approximate"|"none";
  provenance:string;
  constructionStatus:"approved"|"rejected"|"pending"|"not_required";
  previewReview:Review|null;
};
type Summary={
  total:number;previewApproved:number;previewRejected:number;previewPending:number;
  noPreviewSupport:number;constructionBlocked:number;constructionPending:number;
  fullyCleared:number;coveragePercent:number;gateComplete:boolean;
};

const panel:React.CSSProperties={background:"#fff",border:"1px solid #ddd7cc",borderRadius:18,padding:20};
const button:React.CSSProperties={border:0,borderRadius:9,padding:"9px 12px",background:"#1a1a1a",color:"#fff",fontWeight:700,cursor:"pointer"};

export default function PreviewOptionCoverageClient(){
  const [rows,setRows]=useState<Row[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [configured,setConfigured]=useState(true);
  const [filter,setFilter]=useState<"pending"|"approved"|"rejected"|"all">("pending");
  const [styleKey,setStyleKey]=useState("all");
  const [selectedId,setSelectedId]=useState("");
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(preferredId?:string){
    const response=await fetch("/api/operator/preview-option-coverage",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/preview-option-coverage";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Preview coverage could not be loaded.");return;}
    const nextRows=Array.isArray(data.rows)?data.rows:[];
    setRows(nextRows);setSummary(data.summary||null);setConfigured(data.configured!==false);
    const current=nextRows.find((row:Row)=>row.id===(preferredId||selectedId));
    const fallback=current||nextRows.find((row:Row)=>!row.previewReview)||nextRows[0];
    if(fallback){setSelectedId(fallback.id);setNote(fallback.previewReview?.note||"");}
  }
  useEffect(()=>{void load();},[]);

  const keys=useMemo(()=>[...new Set(rows.map((row)=>row.styleKey))].sort(),[rows]);
  const filtered=useMemo(()=>rows.filter((row)=>{
    if(styleKey!=="all"&&row.styleKey!==styleKey) return false;
    const status=row.previewReview?.status||"pending";
    return filter==="all"||status===filter;
  }),[rows,styleKey,filter]);
  const selected=rows.find((row)=>row.id===selectedId)||null;

  async function save(status:"approved"|"rejected"){
    if(!selected||busy||!configured) return;
    if(status==="approved"&&(selected.livePreview==="none"||selected.constructionStatus==="rejected")){
      setMessage("This option cannot be approved while preview support is none or construction is rejected.");
      return;
    }
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/memory/event",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          id:"EV-PREVIEW-"+crypto.randomUUID(),
          sessionId:"DESIGNER-PREVIEW-OPTION-REVIEW",
          type:"operator_note",
          at:new Date().toISOString(),
          payload:{
            subtype:"designer_preview_option_review",
            previewOptionId:selected.id,
            styleKey:selected.styleKey,
            label:selected.label,
            status,
            note,
          },
        }),
      });
      const result=await response.json();
      if(!response.ok||!result.stored) throw new Error(result.error||"Preview review could not be stored.");
      setMessage(status==="approved"?"Customer preview option approved.":"Customer preview option rejected; coverage gate remains open.");
      await load(selected.id);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Preview review could not be stored.");
    }finally{setBusy(false);}
  }

  return <main style={{minHeight:"100vh",background:"#f8f6f0",color:"#1a1a1a",padding:"34px 18px"}}>
    <div style={{maxWidth:1120,margin:"0 auto",display:"grid",gap:18}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:20,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>LINEN EARTH / ROADMAP V2 / PHASE 3</p>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,5vw,56px)",lineHeight:1,margin:"0 0 10px"}}>Customer Preview Coverage</h1>
          <p style={{maxWidth:760,lineHeight:1.6,opacity:.72}}>Audit the exact options customers can choose in Designer. Preview approval is separate from construction approval and never upgrades physical fit, drape or colour claims.</p>
        </div>
        <nav style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/designer-studio">Open customer Designer</Link><Link href="/operator/construction-approval">Construction Approval</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
      </header>

      {!configured&&<section style={{...panel,background:"#fff4df"}}>Cloud memory is not configured, so review decisions cannot be stored.</section>}
      {message&&<section style={{...panel,background:"#ece8df"}}>{message}</section>}

      <section style={{...panel,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <article><small>CUSTOMER CHOICES</small><div style={{fontSize:34,fontWeight:800}}>{summary?.total??0}</div></article>
        <article><small>FULLY CLEARED</small><div style={{fontSize:34,fontWeight:800}}>{summary?.fullyCleared??0}</div></article>
        <article><small>PREVIEW PENDING</small><div style={{fontSize:34,fontWeight:800}}>{summary?.previewPending??0}</div></article>
        <article><small>CONSTRUCTION PENDING</small><div style={{fontSize:34,fontWeight:800}}>{summary?.constructionPending??0}</div></article>
        <article><small>COVERAGE</small><div style={{fontSize:30,fontWeight:800}}>{summary?.coveragePercent??0}%</div></article>
        <article><small>GATE</small><div style={{fontSize:24,fontWeight:800}}>{summary?.gateComplete?"COMPLETE":"OPEN"}</div></article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"minmax(300px,.72fr) minmax(360px,1.28fr)",gap:18}}>
        <aside style={panel}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <select value={filter} onChange={(e)=>setFilter(e.target.value as typeof filter)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select>
            <select value={styleKey} onChange={(e)=>setStyleKey(e.target.value)}><option value="all">All style groups</option>{keys.map((key)=><option key={key} value={key}>{key}</option>)}</select>
          </div>
          <div style={{display:"grid",gap:7,maxHeight:650,overflow:"auto"}}>
            {filtered.map((row)=><button key={row.id} onClick={()=>{setSelectedId(row.id);setNote(row.previewReview?.note||"");setMessage("");}} style={{textAlign:"left",border:row.id===selectedId?"2px solid #1a1a1a":"1px solid #e2ddd3",borderRadius:10,padding:10,background:"#fff",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong>{row.label}</strong><span style={{fontSize:11,textTransform:"uppercase"}}>{row.previewReview?.status||"pending"}</span></div>
              <small style={{opacity:.6}}>{row.styleKey} · live {row.livePreview} · construction {row.constructionStatus}</small>
            </button>)}
          </div>
        </aside>

        <article style={panel}>
          {!selected?<p>Choose an option to review.</p>:<>
            <p style={{fontSize:12,letterSpacing:1.4,textTransform:"uppercase"}}>{selected.styleKey}</p>
            <h2 style={{fontFamily:"Georgia,serif",fontSize:34,margin:"4px 0 12px"}}>{selected.label}</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              <Fact label="Instant preview" value={selected.livePreview}/>
              <Fact label="Final render support" value={selected.aiRender}/>
              <Fact label="Construction" value={selected.constructionStatus}/>
              <Fact label="Source" value={selected.provenance}/>
            </div>
            <section style={{marginTop:18,padding:14,background:"#f3f0ea",borderRadius:10}}>
              <strong>Approval rule</strong>
              <p style={{fontSize:13,lineHeight:1.55,opacity:.72}}>Inspect this exact choice in the customer Designer. Approve only if its instant preview communicates the intended construction well enough for design selection. “Approximate” is allowed only when the UI remains honest about the limitation. A construction-rejected or non-renderable option cannot be preview-approved.</p>
            </section>
            <label style={{display:"grid",gap:6,marginTop:14}}>Review note<textarea rows={5} value={note} onChange={(e)=>setNote(e.target.value.slice(0,800))} placeholder="What was visually checked, what remains approximate, or why it should be removed."/></label>
            {selected.previewReview&&<p style={{fontSize:12,opacity:.62}}>Last review: {selected.previewReview.status} · {new Date(selected.previewReview.reviewedAt).toLocaleString("en-IN")}</p>}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
              <button style={{...button,background:"#fff",color:"#7a2f2f",border:"1px solid #d8c6c1"}} disabled={busy} onClick={()=>void save("rejected")}>Reject preview support</button>
              <button style={button} disabled={busy||selected.livePreview==="none"||selected.constructionStatus==="rejected"} onClick={()=>void save("approved")}>Approve customer preview</button>
            </div>
          </>}
        </article>
      </section>
    </div>
  </main>;
}

function Fact({label,value}:{label:string;value:string}){
  return <div style={{border:"1px solid #e7e0d5",borderRadius:10,padding:12}}><small style={{opacity:.58}}>{label.toUpperCase()}</small><div style={{fontWeight:800,textTransform:"capitalize",marginTop:4}}>{value.replaceAll("_"," ")}</div></div>;
}
