"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DesignerFabricMetadata } from "@/lib/designer-fabric-metadata-types";

type FabricRow = {
  id:string;
  colorName:string;
  line:string;
  family:string;
  pattern:string;
  suitableFor:string[];
  swatchImageUrl:string;
  yarnCountLea:number[];
  metadata:DesignerFabricMetadata;
};

type Payload = { configured:boolean; fabrics:FabricRow[] };

const SEASONS = ["Spring","Summer","Autumn","Winter","All-season"] as const;
const ROLE_TAGS = ["base_safe","accent_safe"] as const;

function emptyMetadata(fabricId:string):DesignerFabricMetadata {
  return {fabricId,availability:"unknown"};
}

export default function DesignerDataClient() {
  const [data,setData] = useState<Payload|null>(null);
  const [selectedId,setSelectedId] = useState("");
  const [search,setSearch] = useState("");
  const [editor,setEditor] = useState<DesignerFabricMetadata|null>(null);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");

  async function load(selectCurrent=true) {
    const response = await fetch("/api/operator/designer-data",{cache:"no-store"});
    if (response.status === 401) {
      window.location.href = "/operator/login?next=/operator/designer-data";
      return;
    }
    const next = await response.json() as Payload & {error?:string};
    if (!response.ok) throw new Error(next.error || "Designer data could not be loaded.");
    setData(next);
    const target = selectCurrent && selectedId
      ? next.fabrics.find((item)=>item.id===selectedId)
      : next.fabrics[0];
    if (target) {
      setSelectedId(target.id);
      setEditor(target.metadata || emptyMetadata(target.id));
    }
  }

  useEffect(()=>{ void load(false).catch((error)=>setMessage(error instanceof Error?error.message:"Unable to load Designer data.")); },[]);

  const filtered = useMemo(()=>{
    const q=search.trim().toLowerCase();
    if (!data) return [];
    return data.fabrics.filter((fabric)=>!q || [fabric.colorName,fabric.line,fabric.pattern,fabric.id].some((value)=>value.toLowerCase().includes(q)));
  },[data,search]);

  const selected = data?.fabrics.find((item)=>item.id===selectedId) || null;

  function selectFabric(fabric:FabricRow) {
    setSelectedId(fabric.id);
    setEditor(fabric.metadata || emptyMetadata(fabric.id));
    setMessage("");
  }

  function toggleList(field:"seasonTags"|"roleTags",value:string) {
    if (!editor) return;
    const current = (editor[field] || []) as string[];
    const next = current.includes(value) ? current.filter((item)=>item!==value) : [...current,value];
    setEditor({...editor,[field]:next});
  }

  async function save() {
    if (!editor || !selected || !data?.configured) return;
    setSaving(true); setMessage("");
    try {
      const event = {
        id:`EV-DESIGNER-DATA-${crypto.randomUUID()}`,
        sessionId:"DESIGNER-DATA",
        type:"operator_note",
        at:new Date().toISOString(),
        payload:{
          subtype:"designer_fabric_metadata",
          fabricId:selected.id,
          availability:editor.availability || "unknown",
          weightGsm:editor.weightGsm,
          weightClass:editor.weightClass,
          weave:editor.weave || "",
          texture:editor.texture || "",
          drape:editor.drape,
          seasonTags:editor.seasonTags || [],
          formalityScore:editor.formalityScore,
          roleTags:editor.roleTags || [],
          note:editor.note || "",
        },
      };
      const response = await fetch("/api/memory/event",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(event),
      });
      const result = await response.json() as {stored?:boolean;error?:string};
      if (!response.ok || !result.stored) throw new Error(result.error || "Verified metadata was not stored.");
      await load(true);
      setMessage("Verified fabric metadata saved. New Designer requests will use it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save verified metadata.");
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <main className="designerData"><div className="dataLoading">Loading Designer Data Desk…</div></main>;

  return <main className="designerData">
    <header className="dataHeader">
      <div><span>LINEN EARTH / OPERATOR</span><h1>Designer Data Desk</h1><p>Only enter facts you have verified from supplier records, the cloth itself or your own merchandising decision.</p></div>
      <div><b className={data.configured?"live":"offline"}>{data.configured?"CLOUD MEMORY LIVE":"CLOUD NOT CONFIGURED"}</b><Link href="/operator/designer-research">Creative Research</Link><Link href="/operator">Back to Operator Desk</Link></div>
    </header>

    <section className="dataLayout">
      <aside className="dataBrowser">
        <div className="dataSearch"><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search fabric, collection or pattern" /><span>{filtered.length} fabrics</span></div>
        <div className="dataFabricList">
          {filtered.map((fabric)=><button key={fabric.id} className={selectedId===fabric.id?"active":""} onClick={()=>selectFabric(fabric)}>
            <Image width={62} height={72} src={fabric.swatchImageUrl} alt="" />
            <span><strong>{fabric.colorName}</strong><small>{fabric.line}</small><em>{fabric.pattern} · {fabric.metadata.availability || "unknown"}</em></span>
          </button>)}
        </div>
      </aside>

      <section className="dataEditor">
        {selected && editor ? <>
          <div className="dataEditorHead">
            <div><span>VERIFIED FABRIC RECORD</span><h2>{selected.colorName}</h2><p>{selected.line} · {selected.pattern} · {selected.suitableFor.join(" / ")}</p></div>
            <Image width={132} height={152} src={selected.swatchImageUrl} alt={selected.colorName} />
          </div>

          <div className="sourceFacts">
            <span><small>CATALOGUE ID</small><b>{selected.id}</b></span>
            <span><small>YARN COUNT</small><b>{selected.yarnCountLea.length ? `${selected.yarnCountLea.join("/")} Lea` : "Not recorded"}</b></span>
            <span><small>LAST VERIFIED</small><b>{editor.verifiedAt ? new Date(editor.verifiedAt).toLocaleString("en-IN") : "Never"}</b></span>
          </div>

          <div className="dataForm">
            <label><span>Physical availability</span><select value={editor.availability || "unknown"} onChange={(e)=>setEditor({...editor,availability:e.target.value as DesignerFabricMetadata["availability"]})}><option value="unknown">Not verified</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select><small>Unavailable fabrics are removed from future Designer recommendations.</small></label>
            <label><span>Verified GSM</span><input type="number" min="40" max="1000" value={editor.weightGsm ?? ""} onChange={(e)=>setEditor({...editor,weightGsm:e.target.value?Number(e.target.value):undefined})} placeholder="e.g. 155" /><small>Do not convert Lea yarn count into GSM.</small></label>
            <label><span>Weight class</span><select value={editor.weightClass || ""} onChange={(e)=>setEditor({...editor,weightClass:e.target.value ? e.target.value as DesignerFabricMetadata["weightClass"] : undefined})}><option value="">Unknown</option><option>Light</option><option>Medium</option><option>Heavy</option></select></label>
            <label><span>Formality score · 1–5</span><input type="number" min="1" max="5" step=".1" value={editor.formalityScore ?? ""} onChange={(e)=>setEditor({...editor,formalityScore:e.target.value?Number(e.target.value):undefined})} placeholder="e.g. 3.6" /><small>This replaces the provisional default for this exact swatch.</small></label>
            <label><span>Weave</span><input value={editor.weave || ""} onChange={(e)=>setEditor({...editor,weave:e.target.value})} placeholder="e.g. plain weave" /></label>
            <label><span>Texture</span><input value={editor.texture || ""} onChange={(e)=>setEditor({...editor,texture:e.target.value})} placeholder="e.g. dry slub, smooth" /></label>
            <label><span>Drape</span><select value={editor.drape || ""} onChange={(e)=>setEditor({...editor,drape:e.target.value ? e.target.value as DesignerFabricMetadata["drape"] : undefined})}><option value="">Unknown</option><option value="fluid">Fluid</option><option value="soft">Soft</option><option value="medium">Medium</option><option value="structured">Structured</option></select></label>

            <fieldset><legend>Season tags</legend><div className="checkGrid">{SEASONS.map((season)=><label key={season}><input type="checkbox" checked={editor.seasonTags?.includes(season) || false} onChange={()=>toggleList("seasonTags",season)} /><span>{season}</span></label>)}</div></fieldset>
            <fieldset><legend>Designer role</legend><div className="checkGrid">{ROLE_TAGS.map((role)=><label key={role}><input type="checkbox" checked={editor.roleTags?.includes(role) || false} onChange={()=>toggleList("roleTags",role)} /><span>{role === "base_safe" ? "Base safe" : "Accent safe"}</span></label>)}</div></fieldset>
            <label className="wide"><span>Verification note</span><textarea value={editor.note || ""} onChange={(e)=>setEditor({...editor,note:e.target.value})} placeholder="Source or reason: supplier sheet, physical roll checked, owner taste decision…" /></label>
          </div>

          <div className="dataSave">
            <p>{data.configured ? "Saving creates a new auditable metadata version; the original catalogue record stays unchanged." : "Connect the production Supabase project before verified metadata can be activated."}</p>
            <button onClick={()=>void save()} disabled={saving || !data.configured}>{saving?"Saving verified record…":"Save verified metadata"}</button>
          </div>
          {message && <div className="dataMessage">{message}</div>}
        </> : <div className="dataEmpty">Choose a fabric to calibrate.</div>}
      </section>
    </section>
  </main>;
}
