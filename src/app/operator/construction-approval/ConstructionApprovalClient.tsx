"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Review={
  optionId:string;
  status:"approved"|"rejected";
  note:string;
  reviewedAt:string;
};

type OptionRow={
  id:string;
  group:string;
  label:string;
  description:string;
  formality:number|null;
  climateTags:string[];
  parameters:Record<string,number|string|boolean>;
  renderSupport:{livePreview:"exact"|"approximate"|"none";aiRender:"exact"|"approximate"|"none"};
  review:Review|null;
};

type Payload={
  configured:boolean;
  total:number;
  approved:number;
  rejected:number;
  pending:number;
  options:OptionRow[];
};

type StatusFilter="pending"|"approved"|"rejected"|"all";

function niceGroup(value:string) {
  return value.replace("shirt.","Shirt · ").replace("pant.","Trouser · ").replaceAll("_"," ");
}

function parameterText(parameters:Record<string,number|string|boolean>) {
  const rows=Object.entries(parameters);
  if(!rows.length) return "No numeric construction parameters stored.";
  return rows.map(([key,value])=>`${key.replaceAll("_"," ")}: ${String(value)}`).join(" · ");
}

export default function ConstructionApprovalClient(){
  const [data,setData]=useState<Payload|null>(null);
  const [selectedId,setSelectedId]=useState("");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState<StatusFilter>("pending");
  const [group,setGroup]=useState("all");
  const [note,setNote]=useState("");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function load(keepSelection=true,preferNextPending=false) {
    const response=await fetch("/api/operator/construction-approval",{cache:"no-store"});
    if(response.status===401){
      window.location.href="/operator/login?next=/operator/construction-approval";
      return;
    }
    const next=await response.json() as Payload & {error?:string};
    if(!response.ok) throw new Error(next.error||"Construction approval data could not be loaded.");
    setData(next);
    const target=keepSelection && !preferNextPending
      ? next.options.find((item)=>item.id===selectedId)
      : null;
    const pending=next.options.find((item)=>!item.review && item.id!==selectedId);
    const fallback=(preferNextPending?pending:null) || target || next.options.find((item)=>!item.review) || next.options[0];
    if(fallback){
      setSelectedId(fallback.id);
      setNote(fallback.review?.note||"");
    }
  }

  useEffect(()=>{
    void load(false).catch((error)=>setMessage(error instanceof Error?error.message:"Unable to load construction approval."));
  },[]);

  const groups=useMemo(()=>{
    if(!data) return [];
    return [...new Set(data.options.map((item)=>item.group))].sort();
  },[data]);

  const filtered=useMemo(()=>{
    if(!data) return [];
    const q=search.trim().toLowerCase();
    return data.options.filter((item)=>{
      const status=item.review?.status||"pending";
      if(filter!=="all" && status!==filter) return false;
      if(group!=="all" && item.group!==group) return false;
      return !q || [item.label,item.description,item.group,item.id].some((value)=>value.toLowerCase().includes(q));
    });
  },[data,search,filter,group]);

  const selected=data?.options.find((item)=>item.id===selectedId)||null;

  function selectOption(item:OptionRow){
    setSelectedId(item.id);
    setNote(item.review?.note||"");
    setMessage("");
  }

  async function save(status:"approved"|"rejected") {
    if(!selected || saving || !data?.configured) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/memory/event",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          id:`EV-OPTION-${crypto.randomUUID()}`,
          sessionId:"DESIGNER-OPTION-REVIEW",
          type:"operator_note",
          at:new Date().toISOString(),
          payload:{
            subtype:"designer_option_review",
            optionId:selected.id,
            status,
            note,
          },
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok || !result.stored) throw new Error(result.error||"Construction review was not stored.");
      setMessage(status==="approved"?"Option approved for Linen Earth house offering.":"Option rejected from Linen Earth house offering.");
      await load(true,true);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Construction review could not be saved.");
    }finally{
      setSaving(false);
    }
  }

  if(!data) return <main className="constructionApproval"><div className="constructionLoading">Loading construction approval desk…</div></main>;

  return <main className="constructionApproval">
    <header className="constructionHeader">
      <div>
        <span>LINEN EARTH / PRIVATE OPERATOR</span>
        <h1>Construction Approval Desk</h1>
        <p>Review expanded shirt and trouser cuts before they become house-offered options. Approval records the merchandising/tailoring decision; it does not claim physical fit or drape accuracy.</p>
      </div>
      <nav>
        <b className={data.configured?"live":"offline"}>{data.configured?"CLOUD MEMORY LIVE":"CLOUD NOT CONFIGURED"}</b>
        <Link href="/operator/designer-evaluation">Designer Evaluation</Link>
        <Link href="/operator/designer-data">Designer Data</Link>
        <Link href="/operator">Operator Desk</Link>
      </nav>
    </header>

    <section className="constructionStats">
      <article><small>OWNER-PROVIDED OPTIONS</small><strong>{data.total}</strong></article>
      <article className="approved"><small>APPROVED</small><strong>{data.approved}</strong></article>
      <article className="pending"><small>PENDING</small><strong>{data.pending}</strong></article>
      <article className="rejected"><small>REJECTED</small><strong>{data.rejected}</strong></article>
      <div className="constructionProgress" aria-label="Construction decisions completed"><i style={{width:`${data.total?Math.round((data.approved+data.rejected)/data.total*100):0}%`}}/></div>
    </section>

    <section className="constructionLayout">
      <aside className="constructionBrowser">
        <div className="constructionFilters">
          {(["pending","approved","rejected","all"] as StatusFilter[]).map((value)=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}
        </div>
        <div className="constructionSearch">
          <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search option or construction detail" />
          <select value={group} onChange={(event)=>setGroup(event.target.value)}>
            <option value="all">All groups</option>
            {groups.map((value)=><option key={value} value={value}>{niceGroup(value)}</option>)}
          </select>
          <span>{filtered.length} options</span>
        </div>
        <div className="constructionList">
          {filtered.map((item)=><button key={item.id} type="button" className={item.id===selectedId?"active":""} onClick={()=>selectOption(item)}>
            <i data-status={item.review?.status||"pending"} />
            <span><strong>{item.label}</strong><small>{niceGroup(item.group)}</small><em>{item.review?.status||"pending"}</em></span>
          </button>)}
        </div>
      </aside>

      <section className="constructionEditor">
        {!selected ? <div className="constructionEmpty">Choose an option to review.</div> : <>
          <div className="constructionTitle">
            <div><span>{niceGroup(selected.group).toUpperCase()}</span><h2>{selected.label}</h2><p>{selected.description}</p></div>
            <b data-status={selected.review?.status||"pending"}>{selected.review?.status||"pending"}</b>
          </div>

          <div className="constructionFacts">
            <span><small>FORMALITY</small><b>{selected.formality??"Not scored"}</b></span>
            <span><small>LIVE PREVIEW</small><b>{selected.renderSupport.livePreview}</b></span>
            <span><small>AI RENDER</small><b>{selected.renderSupport.aiRender}</b></span>
            <span><small>CLIMATE</small><b>{selected.climateTags.join(", ")}</b></span>
          </div>

          <section className="constructionParameters">
            <small>CONSTRUCTION PARAMETERS</small>
            <p>{parameterText(selected.parameters)}</p>
          </section>

          <section className="constructionDecision">
            <div>
              <span>HOUSE OFFERING DECISION</span>
              <p><b>Approve</b> only if Linen Earth is willing to offer this cut and a tailor has accepted its basic construction direction. <b>Reject</b> keeps it visible as an experiment but clearly marks it as not offered.</p>
              {selected.review?.reviewedAt&&<small>Last reviewed {new Date(selected.review.reviewedAt).toLocaleString("en-IN")}</small>}
            </div>
            <label>Review note<textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Tailor/owner decision, proportion adjustment or reason for rejection…" /></label>
            <div className="constructionActions">
              <button className="reject" type="button" onClick={()=>void save("rejected")} disabled={saving||!data.configured}>{saving?"Saving…":"Reject house option"}</button>
              <button className="approve" type="button" onClick={()=>void save("approved")} disabled={saving||!data.configured}>{saving?"Saving…":"Approve house option"}</button>
            </div>
          </section>

          <div className="constructionGuardrail">
            <b>What approval means</b>
            <p>Approved = Linen Earth accepts this as an offered construction direction. It does not prove fit, finished measurements, physical drape, shrinkage or render accuracy; those remain separate checks.</p>
          </div>
        </>}
      </section>
    </section>

    {message&&<button className="constructionToast" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </main>;
}
