"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { DesignerFabric } from "@/lib/designer/engine";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import { CREATIVE_FEEDBACK_REASONS, type CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import { CRAFT_MOTIFS, CRAFT_NOVELTIES, CRAFT_SURFACES, CRAFT_ZONES, DEFAULT_CRAFT_PREFERENCES, reviseCreativeCraft, type CraftPreferences, type CreativeCraftRequest } from "@/lib/designer/creative-spec";
import { creativePlacementSvg } from "@/lib/designer/creative-placement";

type Personal={authenticated:boolean;owner:string|null;configured:boolean;preferences:CraftPreferences;reviewCount:number;error?:string};
export default function CreativeStudioPanel(props:{request:CreativeCraftRequest;onRequest:(r:CreativeCraftRequest)=>void;directions:CreativeDirection[];onDirections:(d:CreativeDirection[])=>void;onGenerate:()=>void;onApply:(d:CreativeDirection)=>void;activeId?:string;busy:boolean;note:string;shirt?:DesignerFabric;pant?:DesignerFabric;fabrics:DesignerFabric[]}) {
  const uid=useId(),[personal,setPersonal]=useState<Personal|null>(null),[message,setMessage]=useState(""),[saving,setSaving]=useState(false),[reasons,setReasons]=useState<Record<string,CreativeFeedbackReason>>({});
  const mounted=useRef(true),generation=useRef(0),savingRef=useRef(false);
  useEffect(()=>{mounted.current=true;const refresh=()=>{const stamp=++generation.current;void fetch("/api/designer/creative-profile",{cache:"no-store"}).then(async response=>{const data=await response.json() as Personal;if(!response.ok)throw Error(data.error||"Memory unavailable");if(mounted.current&&stamp===generation.current)setPersonal(data);}).catch(()=>{if(mounted.current&&stamp===generation.current)setPersonal(null);});};refresh();window.addEventListener("focus",refresh);return()=>{mounted.current=false;generation.current++;window.removeEventListener("focus",refresh);};},[]);
  const update=(patch:Partial<CreativeCraftRequest>)=>props.onRequest({...props.request,...patch});
  async function remember(action:string,extra:Record<string,unknown>={}){
    if(!personal?.authenticated||!personal.owner){setMessage("Your judgement revises this session. Sign in and enable memory to keep preferences on your account.");return;}
    if(savingRef.current)return;
    savingRef.current=true;setSaving(true);const stamp=++generation.current;
    try{const response=await fetch("/api/designer/creative-profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,owner:personal.owner,...extra})});const data=await response.json() as Personal;if(!response.ok)throw Error(data.error||"Memory could not be saved");if(mounted.current&&stamp===generation.current){setPersonal(data);setMessage(action==="reset"?"Personal creative learning reset. Historical audit records remain.":"Saved to your creative memory.");}}catch(e){if(mounted.current&&stamp===generation.current)setMessage(e instanceof Error?e.message:"Memory unavailable");}finally{savingRef.current=false;if(mounted.current)setSaving(false);}
  }
  function judge(direction:CreativeDirection,rating:"up"|"down"){
    const reason=reasons[direction.id]||"visual_balance";
    if(personal?.preferences.enabled&&direction.craft)void remember("review",{conceptId:direction.id,rating,reason,craft:direction.craft});
    else setMessage("Judgement applied in this session. Enable personal memory to learn across visits.");
    if(rating==="down"){
      const revised=reviseCreativeCraft(direction,reason);
      props.onDirections([revised,...props.directions.filter(d=>d.id!==direction.id)].slice(0,5));
      if(reason==="render_mismatch")setMessage("The recipe is preserved. Request a final render and review its execution.");
    }
  }
  function download(direction:CreativeDirection){if(!direction.craft||!props.shirt||!props.pant)return;const svg=creativePlacementSvg(direction.craft,{shirt:props.shirt,pant:props.pant},"export"),blob=new Blob([svg],{type:"image/svg+xml"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="linen-earth-craft-placement.svg";a.click();URL.revokeObjectURL(url);}
  const garment=["waistband","pleat","trouser-leg"].includes(props.request.zone)?"pant":"shirt";
  return <section id="designerCreativeLab" className="newDesignerCreative creativeStudio" aria-label="Creative Designer Lab">
    <div className="newDesignerSimpleHead"><div><span>03 / CREATE</span><strong>Design your own details.</strong><small>Fabric combinations, thread patterns and embroidery. Reviewed references guide new ideas.</small></div><button type="button" onClick={props.onGenerate} disabled={!props.shirt||!props.pant||props.busy}>{props.busy?"Creating…":"Create ideas ✦"}</button></div>
    <label className="creativeBrief">Your creative brief<textarea aria-label="Creative design brief" value={props.request.brief} maxLength={900} onChange={e=>update({brief:e.target.value})} placeholder="A subtle leaf embroidery on the cuffs with a contrasting linen panel…"/></label>
    <div className="creativeControls">
      <label>Placement<select aria-label="Craft placement" value={props.request.zone} onChange={e=>update({zone:e.target.value as CreativeCraftRequest["zone"],accentId:""})}>{CRAFT_ZONES.map(z=><option key={z} value={z}>{z.replaceAll("-"," ")}</option>)}</select></label>
      <label>Accent fabric<select aria-label="Accent fabric" value={props.request.accentId} onChange={e=>update({accentId:e.target.value})}><option value="auto">Designer chooses</option><option value="">Self fabric / no panel</option>{props.fabrics.filter(f=>f.allowedGarments.includes(garment as "shirt"|"pant")).map(f=><option key={f.id} value={f.id}>{f.name} · {f.line}</option>)}</select></label>
      <label>Surface<select aria-label="Craft surface" value={props.request.surface} onChange={e=>update({surface:e.target.value as CreativeCraftRequest["surface"]})}>{CRAFT_SURFACES.map(s=><option key={s} value={s}>{s==="auto"?"Designer chooses":s}</option>)}</select></label>
      <label>Motif<select aria-label="Craft motif" value={props.request.motif} onChange={e=>update({motif:e.target.value as CreativeCraftRequest["motif"]})}>{["auto",...CRAFT_MOTIFS].map(m=><option key={m} value={m}>{m==="auto"?"Designer chooses":m}</option>)}</select></label>
      <label>Expression<select aria-label="Craft expression" value={props.request.novelty} onChange={e=>update({novelty:e.target.value as CreativeCraftRequest["novelty"]})}>{CRAFT_NOVELTIES.map(n=><option key={n} value={n}>{n==="auto"?"Designer chooses":n}</option>)}</select></label>
      <label>Thread colour<input aria-label="Thread colour" type="color" value={props.request.threadColour} onChange={e=>update({threadColour:e.target.value})}/></label>
    </div>
    <details className="newDesignerTechnicalDrawer creativeMemory"><summary>My creative preferences · {personal?.reviewCount||0} judgements</summary>{personal?.authenticated?<><label><input type="checkbox" checked={personal.preferences?.enabled||false} disabled={saving||!personal.configured} onChange={e=>void remember("preferences",{preferences:{...personal.preferences,enabled:e.target.checked}})}/> Learn from my human judgements across visits</label><div className="creativeControls">{(["surface","motif","novelty"] as const).map(key=><label key={key}>Preferred {key}<select aria-label={`Preferred ${key}`} disabled={saving||!personal.configured} value={personal.preferences?.[key]||"auto"} onChange={e=>void remember("preferences",{preferences:{...personal.preferences,[key]:e.target.value}})}>{(key==="surface"?CRAFT_SURFACES:key==="motif"?["auto",...CRAFT_MOTIFS]:CRAFT_NOVELTIES).map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}</div><p>Briefs take priority. Learning influences suggestions after at least three independent judgements. Automatic image checks do not train your taste.</p><button type="button" disabled={saving||!personal.configured} onClick={()=>void remember("reset")}>Reset creative learning</button></>:<p><Link href="/account">Sign in</Link> to keep creative preferences. Guest judgements stay in this session.</p>}</details>
    {(props.note||message)&&<p role="status" className="creativeStatus">{props.note||message}</p>}
    {!props.directions.length&&<p>Describe a design or let the designer explore. New photos can be added later.</p>}
    <div className="creativeCards">{props.directions.slice(0,5).map((d,index)=><article key={d.id} data-active={props.activeId===d.id}>
      {d.craft&&props.shirt&&props.pant&&<div className="creativePlacement" dangerouslySetInnerHTML={{__html:creativePlacementSvg(d.craft,{shirt:props.shirt,pant:props.pant},`${uid}-${index}`)}}/>}
      <small>PLACEMENT ILLUSTRATION · SCALE PROPOSED</small><h3>{d.name}</h3><p>{d.craft?.decoration?`${d.craft.decoration.motif} ${d.craft.decoration.technique} · ${d.craft.decoration.zone}`:"Quiet surface"}{d.craft?.panels.length?` · ${d.craft.panels[0].fabric.name} panel`:""}</p>
      <button type="button" onClick={()=>props.onApply(d)}>{props.activeId===d.id?"Selected":"Try this"}</button>
      <div className="creativeJudgement"><button type="button" disabled={saving} onClick={()=>judge(d,"up")}>I like this</button><select aria-label={`Improve ${d.name}`} value={reasons[d.id]||"visual_balance"} onChange={e=>setReasons({...reasons,[d.id]:e.target.value as CreativeFeedbackReason})}>{CREATIVE_FEEDBACK_REASONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button type="button" disabled={saving} onClick={()=>judge(d,"down")}>Improve this</button></div>
      <details><summary>Reasoning and sample checks</summary><p>{d.thesis}</p><p>{d.refinement.at(-1)}</p>{d.craft?.checks.map(c=><p key={c}>{c}</p>)}{d.research.slice(0,2).map(r=><p key={r.id}><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{r.sourceTitle}</a> · {r.transformedInto}</p>)}<button type="button" onClick={()=>download(d)}>Download placement</button></details>
    </article>)}</div>
    <p className="creativeSampleNote">Illustrations show placement and colour intent. Fabric scale, exact drape and embroidery execution need your references and a sample. Apply a concept before locking its recipe or requesting a final render.</p>
  </section>;
}
