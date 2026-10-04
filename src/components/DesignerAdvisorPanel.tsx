"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { StyleDirectorRealModelPreview } from "@/components/PhotoOutfitPreview";
import { createPreviewRequestScope } from "@/lib/designer/preview-request-scope";
import { DESIGNER_FEEDBACK_REASONS, designerFeedbackNeedsInstruction, type DesignerFeedbackReason } from "@/lib/designer/outcome-learning";
import { createStyleSessionId, readLocalDesignerTasteProfile, recordStyleMemoryEvent } from "@/lib/browser-style-memory";
import type { DesignerAdvice, DesignerAdviceOption, DesignerJudgement } from "@/lib/designer/advisor";
import type { DesignerContext, DesignerFabric, DesignerStyle, OccasionTier } from "@/lib/designer/engine";
import type { MeasurementProfile } from "@/lib/measurements";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";
import type { LocalDesignerTasteProfile } from "@/lib/designer/taste-profile";
import { designerDirectionBasis, designerQuestionBasis, designerQuestionPreferenceOccasion, type DesignerQuestionBasis } from "@/lib/designer/question-basis";
import { AtelierButtonIcon } from "@/components/AtelierButtonIcon";

export type DesignerBriefInterpretation={brief:string;occasion:OccasionTier;context:DesignerContext;notes:string[]};
type AdviceResponse={requestId:string;interpretation:DesignerBriefInterpretation;results:DesignerAdviceOption[];advice:DesignerAdvice};
type WorkingDirection={title:string;fabrics:string;sourceRequestId:string;basis:DesignerQuestionBasis};
type Props={onCreativeBrief?:(brief:string)=>void;shirt:DesignerFabric;pant:DesignerFabric;style:DesignerStyle;occasion:OccasionTier;context:DesignerContext;measurements:MeasurementProfile|null;observations:TailorObservationProfile|null;sessionId:()=>string;onApply:(option:DesignerAdviceOption,interpretation:DesignerBriefInterpretation)=>void};

export default function DesignerAdvisorPanel(props:Props) {
  const [question,setQuestion]=useState("");
  const [answer,setAnswer]=useState<AdviceResponse|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [target,setTarget]=useState<DesignerAdviceOption|null>(null);
  const [reason,setReason]=useState<DesignerFeedbackReason>("other");
  const [note,setNote]=useState("");
  const [feedback,setFeedback]=useState("");
  const [ratings,setRatings]=useState<Record<string,"up"|"down">>({});
  const [revision,setRevision]=useState(0);
  const [history,setHistory]=useState<Array<{answer:AdviceResponse;revision:number}>>([]);
  const [taste,setTaste]=useState<LocalDesignerTasteProfile|null>(null);
  const [useTaste,setUseTaste]=useState(true);
  const [workingDirection,setWorkingDirection]=useState<WorkingDirection|null>(null);
  const [followUpOrigin,setFollowUpOrigin]=useState<{question:string;direction:WorkingDirection|null}|null>(null);
  const questionInput=useRef<HTMLTextAreaElement>(null);
  const needsInstruction=designerFeedbackNeedsInstruction(reason);
  const currentBasis:DesignerQuestionBasis={currentShirtId:props.shirt.id,currentPantId:props.pant.id,currentStyle:props.style,occasion:props.occasion,context:props.context};
  const activeBasis=designerQuestionBasis(currentBasis,workingDirection?.basis);
  const tasteOccasion=designerQuestionPreferenceOccasion(question,activeBasis);
  const designSignature=JSON.stringify([currentBasis,props.measurements,props.observations]);
  const signature=JSON.stringify([designSignature,activeBasis,workingDirection?.sourceRequestId,question,useTaste]);
  const scope=useMemo(()=>createPreviewRequestScope(),[signature]);
  useLayoutEffect(()=>{setWorkingDirection(null);setFollowUpOrigin(null);},[designSignature]);
  useLayoutEffect(()=>{if(workingDirection)questionInput.current?.focus();},[workingDirection]);
  useLayoutEffect(()=>{
    scope.activate();setLoading(false);setAnswer(null);setTarget(null);setError("");setFeedback("");setRatings({});setRevision(0);setHistory([]);
    setTaste(readLocalDesignerTasteProfile(tasteOccasion));
    return ()=>scope.invalidate();
  },[scope]);

  function recordJudgement(option:DesignerAdviceOption,rating:"up"|"down",feedbackReason?:DesignerFeedbackReason,feedbackNote="") {
    if(!answer) return;
    const recommendationId=`${answer.requestId}:${option.id}`;
    try {
      recordStyleMemoryEvent(props.sessionId() || createStyleSessionId(),"designer_feedback",{
        recommendationId,rating,...(feedbackReason?{reason:feedbackReason}:{}),note:feedbackNote,
        shirtId:option.shirt.id,pantId:option.pant.id,occasion:option.occasion || answer.interpretation.occasion,style:option.style,
      });
      const learned=readLocalDesignerTasteProfile(option.occasion || answer.interpretation.occasion);setTaste(readLocalDesignerTasteProfile(tasteOccasion));
      const evidence=learned.evidence;
      setFeedback(`${evidence} distinct human judgement${evidence===1?"":"s"} recorded for ${(option.occasion || answer.interpretation.occasion).toLowerCase()}. Your next revision uses this feedback immediately.`);
    } catch { setFeedback("This revision uses your feedback, but the judgement could not be saved."); }
    setRatings((current)=>({...current,[option.id]:rating}));
  }

  async function askDesigner(judgement?:DesignerJudgement,option?:DesignerAdviceOption) {
    if(question.trim().length<5) return;
    if(!judgement&&props.onCreativeBrief&&/embroid|thread|motif|contrast panel|fabric combination/i.test(question)){props.onCreativeBrief(question);return;}
    const request=scope.begin();if(!request) return;
    const priorRevision=revision;
    setLoading(true);setError("");
    try {
      const basis=designerQuestionBasis(currentBasis,workingDirection?.basis,answer && option ? designerDirectionBasis(option,answer.interpretation) : null);
      const response=await fetch("/api/designer/brief",{
        method:"POST",signal:request.signal,headers:{"content-type":"application/json"},
        body:JSON.stringify({brief:question,...basis,
          measurements:props.measurements,observations:props.observations,
          ...(useTaste?{tasteProfile:readLocalDesignerTasteProfile(designerQuestionPreferenceOccasion(judgement?.note || question,basis))}:{}),...(judgement?{judgement}:{})}),
      });
      const data=await response.json() as Partial<AdviceResponse> & {error?:string};
      if(!request.isCurrent()) return;
      if(!response.ok || data.advice?.version!=="designer-advice-v1" || !data.interpretation || !data.requestId || !Array.isArray(data.results)) throw new Error(data.error || "Designer could not assess this question. Try a specific fabric, cut or occasion task.");
      if(judgement && answer) setHistory(current=>[...current,{answer,revision:priorRevision}].slice(-6));
      setAnswer(data as AdviceResponse);setTarget(null);setRatings({});setNote("");setReason("other");
      setFollowUpOrigin(null);
      setRevision(judgement ? priorRevision+1 : 0);
      try { recordStyleMemoryEvent(props.sessionId(),"designer_override",{recommendationId:data.requestId,reason:`Designer ${data.advice.task}; ${data.results.length} checked proposals${judgement?"; human-judgement revision":""}.`}); } catch { /* The answer remains usable offline. */ }
    } catch(err) {
      if(request.isCurrent()) setError(err instanceof Error?err.message:"Designer is temporarily unavailable.");
    } finally { if(request.isCurrent()) setLoading(false);request.finish(); }
  }

  function revise() {
    if(!target || !answer || loading || needsInstruction && note.trim().length<5) return;
    const judgement:DesignerJudgement={recommendationId:`${answer.requestId}:${target.id}`,rating:"down",reason,note};
    recordJudgement(target,"down",reason,note);
    void askDesigner(judgement,target);
  }

  return <section className="newDesignerBrief newDesignerAdvisor" aria-label="Ask Designer">
    <div className="newDesignerBriefHead">
      <div><span>00 / ASK DESIGNER</span><strong>Give your designer a brief or task.</strong><small>Create a look, design one garment, plan a small wardrobe, compare choices or improve a direction.</small></div>
      <button className="atelierControl" type="button" onClick={()=>void askDesigner()} disabled={loading || question.trim().length<5}><AtelierButtonIcon kind="direction" /><span className="atelierButtonText">{loading?"Designing…":"Ask Designer"}</span></button>
    </div>
    {workingDirection && <div className="designerWorkingDirection" aria-label="Designer starting point">
      <div><strong>Developing: {workingDirection.title}</strong><small>{workingDirection.fabrics} · {activeBasis.occasion}</small><small>Your current outfit changes only when you apply a direction.</small></div>
      <button type="button" onClick={()=>{setWorkingDirection(null);setFollowUpOrigin(null);setQuestion("");}}>Use my current outfit</button>
    </div>}
    <textarea ref={questionInput} aria-label="Designer question or task" value={question} maxLength={500} onChange={(event)=>setQuestion(event.target.value)} placeholder="e.g. Keep both fabrics. Compare pleated vs flat-front trousers for my business meeting." rows={3} />
    {followUpOrigin && <div className="designerClarificationDraft" aria-label="Clarification follow-up draft">
      <p>Review or edit this new question, then ask Designer. Your outfit has not changed.</p>
      <details><summary>Original question</summary><p>{followUpOrigin.question}</p></details>
      <button type="button" onClick={()=>{setWorkingDirection(followUpOrigin.direction);setQuestion(followUpOrigin.question);setFollowUpOrigin(null);questionInput.current?.focus();}}>Restore original question</button>
    </div>}
    <div className="designerQuestionExamples" aria-label="Example designer tasks">
      {["Design a relaxed summer dinner outfit with quiet texture","Design a shirt only with clean tailoring","Create a capsule for office, dinner and weekend","Critique my current outfit","Compare pleated trousers vs flat-front trousers","Check fit and movement"].map((example)=><button type="button" key={example} onClick={()=>setQuestion(example)}>{example}</button>)}
    </div>
    <details className="designerTaste"><summary>Your design preferences{taste?.evidence?` · ${taste.evidence} distinct judgements`:""}</summary>
      <p>For {tasteOccasion.toLowerCase()} looks.</p>
      <label><input type="checkbox" checked={useTaste} onChange={event=>setUseTaste(event.target.checked)}/>Use my preferences for new directions</label>
      <p>{taste?.signals?.length?"Learned from your reviewed looks: "+taste.signals.map(signal=>signal.value+" ("+signal.support+" supporting reviews)").join(" · "):"Four distinct judgements are needed before a stable preference is used. Your instructions always take priority."}</p>
      <small>Preferences are remembered in this browser. They guide your suggestions and do not train a global model.</small>
    </details>
    {error && <p className="newDesignerSearchError" role="alert">{error}</p>}
    {props.onCreativeBrief && /embroid|thread|motif|contrast panel|fabric combination/i.test(question) && <button type="button" onClick={()=>props.onCreativeBrief?.(question)}>Develop craft details in Creative Lab</button>}
    {answer && <>
      <div className="designerAdvice" aria-live="polite" aria-busy={loading}>
        <span>{answer.advice.task.toUpperCase()}{revision>0?` · REVISION ${revision}`:""}</span>
        <h3>{answer.advice.headline}</h3><p>{answer.advice.answer}</p>
        {answer.advice.clarification && <div className="designerClarification" aria-label="Designer clarification choices">
          <p>{answer.advice.clarification.question}</p>
          <div>{answer.advice.clarification.choices.map(choice=><button type="button" key={choice.id} disabled={loading} onClick={()=>{
            setFollowUpOrigin({question,direction:workingDirection});
            setWorkingDirection({title:"Clarifying your request",fabrics:workingDirection?.fabrics || props.shirt.name+" + "+props.pant.name,sourceRequestId:answer.requestId,basis:{...activeBasis,occasion:answer.interpretation.occasion,context:answer.interpretation.context}});
            setQuestion(choice.brief);questionInput.current?.focus();
          }}>{choice.label}</button>)}</div>
        </div>}
        <p><strong>Design context:</strong> {answer.interpretation.occasion} · {answer.interpretation.context.climate} · {answer.interpretation.context.intention}</p>
        {answer.advice.revision && <p className="designerRevisionReason">{answer.advice.revision}</p>}
        {answer.advice.preserved.length>0 && <p><strong>Preserved:</strong> {answer.advice.preserved.join(" · ")}</p>}
        {answer.advice.designPlan && (answer.advice.designPlan.goals.length>0 || answer.advice.designPlan.constraints.length>0 || answer.advice.designPlan.notes.length>0) && <details><summary>Design brief and constraints</summary>
          <p>{answer.advice.designPlan.goals.join(" · ")}</p><ul>{[...answer.advice.designPlan.constraints,...answer.advice.designPlan.notes].map((item,index)=><li key={index}>{item}</li>)}</ul>
        </details>}
        <ul>{answer.advice.findings.slice(0,3).map((finding,index)=><li key={index}><b>{finding.kind==="strength"?"Supports the choice":finding.kind==="risk"?"Review":"Evidence needed"}</b> {finding.text}</li>)}</ul>
        {(answer.advice.findings.length>3 || answer.advice.nextSteps.length>0) && <details><summary>Evidence and next steps</summary>
          <ul>{answer.advice.findings.slice(3).map((finding,index)=><li key={index}><b>{finding.kind}</b> {finding.text}</li>)}</ul>
          <ol>{answer.advice.nextSteps.map((step)=><li key={step.id}>{step.route?<Link href={step.route}>{step.label}</Link>:step.label}</li>)}</ol>
        </details>}
      </div>
      {answer.results.length>0 && <div className="newDesignerBriefResults">
        {answer.results.map((result)=><article key={result.id}>
          <div className="newDesignerBriefModel"><StyleDirectorRealModelPreview shirt={result.shirt} pant={result.pant} style={result.style} /><span>SAME LINEN EARTH MODEL</span></div>
          <div className="newDesignerBriefPair" aria-label="Selected fabric references"><img src={result.shirt.image} alt={`${result.shirt.name} shirt fabric`} loading="lazy" decoding="async"/><img src={result.pant.image} alt={`${result.pant.name} trouser fabric`} loading="lazy" decoding="async"/></div>
          <div className="newDesignerBriefCopy"><span>0{result.rank} · {result.tier.toUpperCase()}</span><strong>{result.title}</strong><p>{result.shirt.name} + {result.pant.name}</p>
            <div className="newDesignerBriefCut"><b>{result.style.shirtWear}</b><b>{result.style.collar}</b><b>{result.style.trouser}</b></div>
            {result.fitAdaptation && <em className="newDesignerBriefFit">FIT-AWARE · {result.fitAdaptation.replace(/^Fit-aware adjustment:\s*/,"")}</em>}
            <p className="designerChanges">{result.changeSummary.length ? result.changeSummary.join("; ") : "Retains your selected construction."}</p>
            {result.occasion && <p className="designerOptionOccasion">{result.occasion}</p>}
            <details><summary>Why and tradeoffs</summary><ul>{result.reasons.map((item,index)=><li key={"r"+index}>{item}</li>)}{result.tradeoffs.map((item,index)=><li key={"t"+index}><b>Review:</b> {item}</li>)}{result.fitTargets.map((item,index)=><li key={"f"+index}>{item.label}: provisional finished {item.finishedCm.min}–{item.finishedCm.max} cm.</li>)}</ul></details>
            {!!result.previewNotes?.length && <details><summary>What the preview shows</summary><p>The selected cloth is shown on our studio model. These construction details remain approximate:</p><ul>{result.previewNotes.map((item,index)=><li key={index}>{item}</li>)}</ul></details>}
          </div>
          <button type="button" disabled={loading || !result.canApply} onClick={()=>{setWorkingDirection(null);props.onApply(result,{...answer.interpretation,occasion:result.occasion || answer.interpretation.occasion,context:result.context || answer.interpretation.context});}}>{result.canApply?"Apply direction":"Resolve conflict first"}</button>
          <button type="button" className="designerDevelopDirection" disabled={loading} onClick={()=>{setFollowUpOrigin(null);setWorkingDirection({title:result.title,fabrics:result.shirt.name+" + "+result.pant.name,sourceRequestId:answer.requestId,basis:designerDirectionBasis(result,answer.interpretation)});setQuestion("");}}>Develop this direction</button>
          <div className="designerJudgement" aria-label={`Judge ${result.title}`}><button type="button" disabled={loading} aria-pressed={ratings[result.id]==="up"} onClick={()=>recordJudgement(result,"up")}>Works for me</button><button type="button" disabled={loading} aria-pressed={target?.id===result.id} onClick={()=>{setTarget(result);setNote("");setReason("other");}}>Improve this</button></div>
        </article>)}
      </div>}
      {target && <div className="designerRevision" aria-label="Revise judged direction">
        <strong>Improve: {target.title}</strong>
        <label>What should improve?<select aria-label="What should improve?" disabled={loading} value={reason} onChange={(event)=>setReason(event.target.value as DesignerFeedbackReason)}>{DESIGNER_FEEDBACK_REASONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label>Your judgement or instruction{needsInstruction && <small>Tell Designer which colour, cloth or detail you prefer, or how the formality should change.</small>}<textarea aria-label="Your judgement or instruction" disabled={loading} value={note} maxLength={300} onChange={(event)=>setNote(event.target.value)} placeholder="e.g. Keep the fabric and collar. Give the shirt more room for movement." rows={2}/></label>
        <button type="button" disabled={loading || needsInstruction && note.trim().length<5} onClick={revise}>{loading?"Revising…":"Revise this direction"}</button>
      </div>}
    </>}
    {history.length>0 && <button className="designerPreviousRevision" type="button" disabled={loading} onClick={()=>{const previous=history.at(-1)!;setAnswer(previous.answer);setRevision(previous.revision);setHistory(current=>current.slice(0,-1));setTarget(null);setRatings({});setFeedback("");setNote("");}}>Previous revision</button>}
    {feedback && <p className="designerFeedbackStatus" role="status">{feedback}</p>}
  </section>;
}
