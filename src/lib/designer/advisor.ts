import { DESIGNER_STYLE_CHOICES, designerStyleForOccasion, evaluateDesignerCombo, type DesignerStyle, type OccasionTier, type DesignerContext } from "./engine.ts";
import { parseDesignerBrief, explicitDesignerStylePatch } from "./brief.ts";
import { designerFabricAllowedForBrief, searchDesignerCatalogue, type DesignerSearchInput, type DesignerSearchTier } from "./search.ts";
import { designerFabricBriefText, parseDesignerConstructionIntent } from "./construction-intent.ts";
import { assessFitConstruction } from "./fit-construction.ts";
import { buildDesignerNegotiation } from "./constraint-negotiation.ts";
import { fromLegacyStyle, type StyleSpecV2 } from "./style-spec-v2.ts";
import { designerFeedbackNeedsInstruction, isDesignerFeedbackReason, type DesignerFeedbackReason } from "./outcome-learning.ts";
import { legacyOptionByLabel, optionsFor } from "./options/library.ts";
import { compileDesignerIntent, completeDesignConstruction, designGoalPatch, scopeStyleLocks, DESIGN_GOALS } from "./design-intent.ts";
import { photoPreviewSupportForChoice } from "./photo-preview-support.ts";

export type DesignerTask="design"|"capsule"|"critique"|"compare"|"refine"|"fit"|"construction"|"material"|"production"|"clarify";
export type DesignerJudgement={recommendationId:string;rating:"up"|"down";reason?:DesignerFeedbackReason;note:string};
export type DesignerAdvice={
  version:"designer-advice-v1";
  task:DesignerTask;
  headline:string;
  answer:string;
  findings:Array<{kind:"strength"|"risk"|"missing";text:string}>;
  nextSteps:Array<{id:string;label:string;route?:"/measurements"}>;
  preserved:string[];
  revision:string|null;
  designPlan?:{scope:string;goals:string[];constraints:string[];notes:string[]};
};
export type DesignerAdviceOption={
  id:string;rank:number;title:string;tier:DesignerSearchTier;
  shirt:DesignerSearchInput["currentShirt"];pant:DesignerSearchInput["currentPant"];
  style:DesignerStyle;styleSpec:StyleSpecV2;
  recommendation:ReturnType<typeof evaluateDesignerCombo>;
  reasons:string[];tradeoffs:string[];fitAdaptation:string;
  changeSummary:string[];canApply:boolean;fitTargets:ReturnType<typeof assessFitConstruction>["shirtTargets"];
  occasion?:OccasionTier;context?:DesignerContext;
  previewNotes?:string[];
};
const unique=(values:string[])=>[...new Set(values.filter(Boolean))];
const choose=(key:keyof DesignerStyle,re:RegExp,fallback:string)=>DESIGNER_STYLE_CHOICES[key].find((value)=>re.test(value)) || fallback;

export function validDesignerStyle(value:unknown):value is DesignerStyle {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const v=value as Record<string,unknown>;
  return Object.entries(DESIGNER_STYLE_CHOICES).every(([key,choices])=>typeof v[key]==="string" && choices.includes(v[key] as string));
}
export function validDesignerOccasion(value:unknown):value is OccasionTier {
  return ["Casual","Smart-Casual","Semi-Formal","Formal"].includes(String(value));
}
export function validDesignerContext(value:unknown):value is DesignerContext {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const v=value as Record<string,unknown>;
  return ["Not specified","Hot / humid","Cool","Air-conditioned"].includes(String(v.climate)) && ["Understated","Balanced","Expressive"].includes(String(v.intention));
}
export function safeDesignerJudgement(value:unknown):DesignerJudgement|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const v=value as Record<string,unknown>;
  if(typeof v.recommendationId!=="string" || !v.recommendationId.trim() || v.recommendationId.length>160 || !["up","down"].includes(String(v.rating))) return null;
  if(v.reason!==undefined && !isDesignerFeedbackReason(String(v.reason))) return null;
  const note=typeof v.note==="string" ? v.note.replace(/\s+/g," ").trim().slice(0,300) : "";
  if(v.rating==="down" && designerFeedbackNeedsInstruction(v.reason as DesignerFeedbackReason|undefined) && note.length<5) return null;
  return {recommendationId:v.recommendationId,rating:v.rating as "up"|"down",...(v.reason?{reason:v.reason as DesignerFeedbackReason}:{}),note};
}

export function designerTaskFor(question:string,judgement?:DesignerJudgement|null):DesignerTask {
  const text=question.toLowerCase();
  if(/\b(jacket|blazer|suit jacket|saree|sari|dress|hoodie|sneaker|logo|embroidery|kurta|sherwani)\b/.test(text)) return "clarify";
  if(judgement?.rating==="down") return "refine";
  if(/\b(capsule|wardrobe|collection|three occasions|3 occasions)\b/.test(text)) return "capsule";
  if(/\b(compare|versus|vs\.?|difference between|which .* better)\b/.test(text)) return "compare";
  if(/\b(tech pack|production|cutting|ready to cut|manufactur|tailor handoff)\b/.test(text)) return "production";
  // Outfit requirements supplement the primary design task.
  if(/\b(design|suggest|recommend|create|build|put together|plan)\b/.test(text) && /\b(outfit|look|wear|shirts?|trousers?|pants|wedding|meeting|office|party|resort)\b/.test(text) && !/\b(suggest|recommend)\b.*\b(collar|cuff|placket|button|waistband|rise|break)\b/.test(text)) return "design";
  if(/\b(change|make|refine|improve|replace|switch|reduce|fix|hide|set|use)\b/.test(text) && Object.keys(parseDesignerConstructionIntent(text).patch).length) return "refine";
  if(/\b(fit|tight|loose|ease|mobility|seat|shoulder|posture|measurement|comfortable|comfort)\b/.test(text)) return "fit";
  if(/\b(gsm|weight|weave|texture|drape|shrink|shrinkage|opacity|sheer|fibre|fiber|composition|wash|care)\b/.test(text)) return "material";
  if(/\b(change|make|refine|improve|replace|switch|reduce|keep|fix)\b/.test(text)) return "refine";
  if(/\b(collar|cuff|placket|waistband|rise|break|button|construction|pleat)\b/.test(text)) return "construction";
  if(/\b(critique|review|judge|why|explain|does|would|suit|look right|what.*wrong|what.*think)\b|\bworks?\s+(?:together|for|with)\b/.test(text)) return "critique";
  if(/\b(design|outfit|look|wear|suggest|recommend|business|meeting|office|wedding|formal|casual|party|date|travel|resort)\b/.test(text)) return "design";
  return "clarify";
}

function fabricRestrictions(text:string,task:DesignerTask,reason?:DesignerFeedbackReason) {
  text=designerFabricBriefText(text);
  const keepBoth=/\bkeep\s+(?:(?:my|the|these|both|current|selected)\s+)*(?:fabrics?|cloth|fabric pair)\b|\b(?:same|unchanged)\s+(?:fabrics?|cloth)\b|\b(?:do not|don't)\s+change\s+(?:the\s+)?fabrics?\b/i.test(text);
  const keepShirt=keepBoth || /\bkeep\s+(?:(?:my|the|current|selected)\s+)*(?:shirt|shirting)(?:\s+(?:fabric|cloth))?\b/i.test(text);
  const keepPant=keepBoth || /\bkeep\s+(?:(?:my|the|current|selected)\s+)*(?:pants?|trousers?)(?:\s+(?:fabric|cloth))?\b/i.test(text);
  const changeFabric=/\b(?:change|replace|switch|different|new|choose|recommend|suggest|compare)\b.{0,45}\b(?:fabrics?|cloth|colou?r)\b|\b(?:navy|blue|white|beige|black|olive|green|cream|stripe|check|print|plain)\b/i.test(text) || reason==="fabric" || reason==="color";
  const preserveByDefault=task!=="design" && !changeFabric;
  return {keepShirt:keepShirt||preserveByDefault,keepPant:keepPant||preserveByDefault};
}

function judgementStyle(style:DesignerStyle,reason:DesignerFeedbackReason|undefined,note=""):Partial<DesignerStyle> {
  if(reason==="too_bold") return {collarFinish:"Self-fabric",collar:choose("collar",/point/i,style.collar),cuff:choose("cuff",/barrel.*1/i,style.cuff)};
  if(reason==="too_safe") return {collar:choose("collar",/spread/i,style.collar),waistband:choose("waistband",/side.*adjuster/i,style.waistband)};
  if(reason==="fit_cut") return {shirtFit:choose("shirtFit",/regular|classic/i.test(style.shirtFit)?/relaxed/i:/regular|classic/i,style.shirtFit)};
  if(reason==="trouser_shape") return {trouser:choose("trouser",/pleated/i.test(style.trouser)?/flat[- ]front/i:/pleated/i,style.trouser)};
  if(reason==="formality" && /too formal|less formal|more casual|dress down/i.test(note)) return {collarFinish:"Self-fabric",collar:choose("collar",/point/i,style.collar),cuff:choose("cuff",/barrel.*1/i,style.cuff)};
  if(reason==="formality" && /more formal|too casual|dress up/i.test(note)) return {shirtWear:"Tucked",collar:choose("collar",/spread/i,style.collar),cuff:choose("cuff",/barrel.*2/i,style.cuff)};
  if(reason==="construction") return {collarFinish:"Self-fabric",cuff:choose("cuff",/barrel.*1/i,style.cuff)};
  return {};
}

const TASK_NAMES:Record<DesignerTask,string>={design:"Outfit directions",capsule:"A small wardrobe with a purpose",critique:"Critique of your selected outfit",compare:"Compare the design choices",refine:"A revision of your direction",fit:"Fit and movement review",construction:"Construction review",material:"Read the selected cloth",production:"Tailor preparation",clarify:"Let’s make the task specific"};

export function answerDesignerQuestion(input:DesignerSearchInput & {brief:string;judgement?:DesignerJudgement|null;parsed?:ReturnType<typeof parseDesignerBrief>}) {
  const text=input.brief+(input.judgement?.note ? " "+input.judgement.note : "");
  const intent=compileDesignerIntent(input.judgement ? input.judgement.note : text);
  let task=designerTaskFor(text,input.judgement);
  const constructionIntent=parseDesignerConstructionIntent(input.judgement ? input.judgement.note : text);
  if(constructionIntent.issues.length && task!=="compare") task="clarify";
  if(intent.issues.length) task="clarify";
  let parsed=input.parsed || parseDesignerBrief(input.judgement ? input.judgement.note || "Revise this direction" : text,{occasion:input.occasion,context:input.context,style:input.chosenStyle});
  if(!input.parsed && ["design","capsule"].includes(task) && !/\b(?:keep|preserve|same|unchanged)\b/i.test(text)) parsed={...parsed,style:{...designerStyleForOccasion(parsed.occasion),...explicitDesignerStylePatch(text)}};
  const explicit=explicitDesignerStylePatch(input.judgement ? input.judgement.note : text);
  const restrictions=fabricRestrictions(text,task,input.judgement?.reason);
  const retained:Partial<DesignerStyle>=scopeStyleLocks(intent.scope,input.chosenStyle);
  if(intent.scope==="shirt") restrictions.keepPant=true;
  if(intent.scope==="trouser") restrictions.keepShirt=true;
  const nouns:Partial<Record<keyof DesignerStyle,string>>={collar:"collar",collarFinish:"collar finish",cuff:"cuffs?",placket:"placket",shirtFit:"(?:shirt )?fit",shirtWear:"(?:shirt )?wear",trouser:"trouser (?:shape|cut)",rise:"rise",waistband:"waistband",break:"break",button:"buttons?"};
  for(const [key,noun] of Object.entries(nouns)) if(new RegExp("\\b(?:keep|preserve|do not change|don't change)\\s+(?:(?:my|the|current|selected)\\s+)*"+noun+"\\b","i").test(text) && !(input.judgement && Object.hasOwn(explicit,key))) retained[key as keyof DesignerStyle]=input.chosenStyle[key as keyof DesignerStyle];
  if(input.judgement && /\b(?:change|replace|switch)\b.{0,20}\bshirt (?:fabric|cloth)\b/i.test(input.judgement.note)) restrictions.keepShirt=false;
  if(input.judgement && /\b(?:change|replace|switch)\b.{0,20}\b(?:trouser|pant) (?:fabric|cloth)\b/i.test(input.judgement.note)) restrictions.keepPant=false;
  const goals=designGoalPatch(intent,parsed.occasion);
  const style={...parsed.style,...goals,...judgementStyle(input.chosenStyle,input.judgement?.reason,input.judgement?.note),...explicit,...retained};
  const baseInput={...input,occasion:parsed.occasion,context:parsed.context,chosenStyle:style};
  const assess=(shirt=input.currentShirt,pant=input.currentPant,candidateStyle=style,candidateOccasion=parsed.occasion,candidateContext=parsed.context)=>{
    const recommendation=evaluateDesignerCombo(shirt,pant,candidateOccasion,candidateStyle,undefined,candidateContext);
    const fit=assessFitConstruction(input.measurements,candidateStyle,{climate:candidateContext.climate,shirtFabric:shirt,trouserFabric:pant,observations:input.observations,easeModel:input.easeModel});
    return {recommendation,fit,negotiation:buildDesignerNegotiation(recommendation,fit)};
  };
  const current=assess(input.currentShirt,input.currentPant,input.chosenStyle);
  const proposed=assess();
  const advice:DesignerAdvice={
    version:"designer-advice-v1",task,headline:TASK_NAMES[task],
    answer:task==="clarify" ? [...constructionIntent.issues,...intent.issues].join(" ") || "I can design, critique, compare and refine Linen Earth shirts and trousers. Ask about the selected cloth, cut, occasion, fit or construction; other garment categories need a supported block and material brief." : `${current.recommendation.shortReason} ${current.negotiation.headline}`,
    findings:[],nextSteps:[],preserved:[...(restrictions.keepShirt?[input.currentShirt.name+" shirt fabric"]:[]),...(restrictions.keepPant?[input.currentPant.name+" trouser fabric"]:[])],
    revision:input.judgement?.rating==="down" ? `Revising your judged direction for ${input.judgement.reason?.replace(/_/g," ") || input.judgement.note}. Your explicit instructions take priority.` : null,
    designPlan:{scope:intent.scope,goals:intent.goals.map(goal=>DESIGN_GOALS[goal].label),constraints:[...Object.entries(intent.roles).map(([role,brief])=>`${role}: ${[...brief.wantedTokens,...brief.avoidTokens.map(token=>"avoid "+token),brief.pattern,brief.material,brief.gsm?"recorded GSM "+(brief.gsm.min ?? "any")+"–"+(brief.gsm.max ?? "any"):"",brief.lea?brief.lea+" Lea catalogue label":""].filter(Boolean).join(", ")}`),...Object.entries(explicit).map(([key,value])=>`${key}: ${value}`)],notes:intent.notes},
  };
  const addFinding=(kind:"strength"|"risk"|"missing",message:string)=>{
    if(message && !advice.findings.some((item)=>item.text===message)) advice.findings.push({kind,text:message});
  };
  if(task!=="clarify") {
    for(const issue of current.negotiation.blockers) addFinding("risk",issue.message);
    for(const issue of [...current.negotiation.reviews,...current.negotiation.tradeoffs].slice(0,3)) addFinding("risk",issue.message);
    for(const issue of current.negotiation.missingFacts.slice(0,2)) addFinding("missing",issue.message);
    for(const rule of current.recommendation.rules.filter((item)=>item.status==="pass").slice(0,2)) addFinding("strength",rule.explanation);
    advice.nextSteps=current.negotiation.actions.filter((action)=>!action.patch).map(({id,label,route})=>({id,label,...(route?{route}:{})}));
  }
  if(task==="fit" || task==="production") {
    advice.answer=task==="fit" ? "Fit follows your recorded measurements and manual tailoring observations. Review the targets and conflicts below before approving the cut." : "The selected direction needs a locked, verified specification before production. These are the current checks and preparation tasks.";
    advice.findings=[];
    addFinding("missing",current.fit.caveats[0]);
    for(const check of current.fit.checks) addFinding(check.severity==="info"?"strength":check.severity==="warning"?"risk":"missing",check.message);
    for(const target of [...current.fit.shirtTargets,...current.fit.trouserTargets]) addFinding("strength",`${target.label}: body ${target.bodyCm} cm; provisional finished range ${target.finishedCm.min}–${target.finishedCm.max} cm (${target.basis.replace(/_/g," ")}).`);
    for(const issue of current.negotiation.blockers) addFinding("risk",issue.message);
    for(const issue of current.negotiation.missingFacts) addFinding("missing",issue.message);
    if(!advice.nextSteps.some((item)=>item.route==="/measurements")) advice.nextSteps.unshift({id:"record-measurements",label:"Review body measurements and desired garment lengths",route:"/measurements"});
    if(task==="production") advice.nextSteps.push({id:"lock-and-handoff",label:"Apply the direction, resolve the review checks, then lock and export its tailor specification below."});
  }
  if(task==="material") {
    advice.answer="The photograph carries surface texture and colour appearance. Material behaviour must come from the recorded cloth evidence; the live model retains its photographed fold geometry.";
    advice.findings=[];
    for(const [role,fabric] of [["Shirt",input.currentShirt],["Trouser",input.currentPant]] as const) {
      addFinding("strength",`${role} · ${fabric.name}: weave ${fabric.weave || "unrecorded"}; texture ${fabric.texture || "unrecorded"}; fibre ${fabric.fiberContent || "unrecorded"}. Source: ${fabric.source}.`);
      addFinding(fabric.weightGsm===null?"missing":"strength",`${role} GSM: ${fabric.weightGsm===null?"not recorded; do not infer from a photograph":fabric.weightGsm+" (recorded catalogue value)"}.`);
      addFinding(fabric.drape?"strength":"missing",`${role} drape: ${fabric.drape || "not verified; check a physical hanging/fold sample"}. Exact mechanical drape is not recovered from a flat swatch.`);
      if(!fabric.colorVerified || !fabric.patternScaleVerified || !fabric.fiberContentVerified) addFinding("missing",`${role}: ${[!fabric.colorVerified?"controlled colour":null,!fabric.patternScaleVerified?"physical repeat/scale":null,!fabric.fiberContentVerified?"fibre verification":null].filter(Boolean).join(", ")} still requires evidence.`);
    }
    if(/wash|care|shrink/i.test(text)) addFinding("missing","Use the supplier’s care and shrinkage test for this roll; no wash temperature or shrinkage allowance is recorded here.");
    advice.nextSteps=[{id:"physical-drape-check",label:"Check hanging drape, repeat, colour and opacity on the actual selected roll before final approval."}];
  }
  if(task==="construction") advice.answer=`Your current construction is ${input.chosenStyle.collar}, ${input.chosenStyle.cuff}, ${input.chosenStyle.placket}; ${input.chosenStyle.trouser}, ${input.chosenStyle.rise}, ${input.chosenStyle.waistband}, ${input.chosenStyle.break}. The proposals below change only supported options and are checked against the same cloth and occasion.`;

  const results:DesignerAdviceOption[]=[];
  const optionPreference=task==="compare"?{...parsed.preference,roles:undefined}:parsed.preference;
  const addOption=(title:string,shirt=input.currentShirt,pant=input.currentPant,candidateStyle=style,tier:DesignerSearchTier="Elevated",reasons:string[]=[],fitAdaptation="",candidateOccasion=parsed.occasion,candidateContext=parsed.context)=>{
    if(restrictions.keepShirt && shirt.id!==input.currentShirt.id || restrictions.keepPant && pant.id!==input.currentPant.id) return;
    if(!designerFabricAllowedForBrief(shirt,optionPreference,"shirt") || !designerFabricAllowedForBrief(pant,optionPreference,"pant")) return;
    if(Object.entries(constructionIntent.excluded).some(([key,values])=>values?.includes(candidateStyle[key as keyof DesignerStyle]))) return;
    if(results.some((result)=>result.shirt.id===shirt.id && result.pant.id===pant.id && JSON.stringify(result.style)===JSON.stringify(candidateStyle))) return;
    const read=assess(shirt,pant,candidateStyle,candidateOccasion,candidateContext);
    const changes=Object.keys(candidateStyle).filter((key)=>candidateStyle[key as keyof DesignerStyle]!==input.chosenStyle[key as keyof DesignerStyle]).map((key)=>`${key}: ${input.chosenStyle[key as keyof DesignerStyle]} → ${candidateStyle[key as keyof DesignerStyle]}`);
    if(shirt.id!==input.currentShirt.id) changes.unshift("Shirt fabric: "+shirt.name);
    if(pant.id!==input.currentPant.id) changes.unshift("Trouser fabric: "+pant.name);
    const groups={collar:"shirt.collar",cuff:"shirt.cuff",placket:"shirt.placket",shirtFit:"shirt.fit",shirtWear:"shirt.wear",trouser:"pant.type",rise:"pant.rise",waistband:"pant.waistband",break:"pant.break",button:"shirt.button"} as const;
    const guidanceKeys=unique([...Object.keys(candidateStyle).filter((key)=>candidateStyle[key as keyof DesignerStyle]!==input.chosenStyle[key as keyof DesignerStyle]),"collar","cuff","shirtFit","trouser"]) as Array<keyof typeof groups>;
    const constructionNotes=guidanceKeys.filter((key)=>key in groups).map((key)=>legacyOptionByLabel(groups[key],candidateStyle[key]) || optionsFor(groups[key]).find((option)=>option.label===candidateStyle[key])).filter((option)=>option && option.description!==option.label).map((option)=>option!.label+": "+option!.description+" (recorded option guidance; "+option!.reviewStatus+").");
    results.push({id:`advice-option-${results.length+1}`,rank:results.length+1,title,tier,shirt,pant,style:candidateStyle,styleSpec:fromLegacyStyle(candidateStyle),recommendation:read.recommendation,
      reasons:unique([...intent.goals.map(goal=>DESIGN_GOALS[goal].why),...constructionNotes,...reasons,read.recommendation.shortReason,...read.recommendation.rules.filter((rule)=>rule.status==="pass").slice(0,2).map((rule)=>rule.explanation)]).slice(0,7),
      tradeoffs:unique([...read.negotiation.blockers,...read.negotiation.reviews,...read.negotiation.tradeoffs,...read.negotiation.missingFacts].map((issue)=>issue.message)).slice(0,4),fitAdaptation,changeSummary:changes,canApply:read.negotiation.blockers.length===0,fitTargets:[...read.fit.shirtTargets,...read.fit.trouserTargets],occasion:candidateOccasion,context:candidateContext,
      previewNotes:Object.entries(candidateStyle).filter(([key,value])=>photoPreviewSupportForChoice(key as keyof DesignerStyle,value).status!=="exact").map(([key,value])=>`${value}: ${photoPreviewSupportForChoice(key as keyof DesignerStyle,value).reason}`)});
  };

  if(task==="compare") {
    const parts=text.split(/\b(?:versus|vs\.?|or)\b/i);
    if(parts.length===2) {
      const noun=text.match(/\b(collars?|cuffs?|trousers?|shirt fit|rise|break)\b/i)?.[0] || "";
      const a=explicitDesignerStylePatch(parts[0]+" "+noun),b=explicitDesignerStylePatch(parts[1]+" "+noun);
      const keys=Object.keys(a).filter((key)=>Object.hasOwn(b,key)) as Array<keyof DesignerStyle>;
      if(keys.length) {
        const key=keys[0];
        addOption(a[key]!,input.currentShirt,input.currentPant,{...input.chosenStyle,...a,...retained});
        addOption(b[key]!,input.currentShirt,input.currentPant,{...input.chosenStyle,...b,...retained});
      }
      if(!results.length && /fabric|cloth|colou?r|navy|blue|white|beige|black|olive|green|cream|stripe|print|plain/i.test(text)) {
        const trouserQuestion=/trouser|pants/i.test(text);
        for(const part of parts) {
          const preference=parseDesignerBrief(part).preference;
          const tokens=preference.roles?.[trouserQuestion?"pant":"shirt"]?.wantedTokens || preference.wantedTokens;
          const pool=trouserQuestion?input.pants:input.shirts;
          const fabric=pool.find((item)=>{
            const hay=`${item.name} ${item.colorFamily || ""} ${item.tone || ""}`.toLowerCase();
            return tokens.length>0 && tokens.every((token)=>new RegExp("\\b"+token+"\\b").test(hay));
          });
          if(fabric) addOption(fabric.name,trouserQuestion?input.currentShirt:fabric,trouserQuestion?fabric:input.currentPant,{...input.chosenStyle,...retained});
        }
      }
    }
    if(parts.length!==2 && results.length<2 && /pleat|flat[- ]front|trouser|pants/i.test(text)) {
      for(const matcher of [/pleated/i,/flat[- ]front/i]) addOption(choose("trouser",matcher,style.trouser),input.currentShirt,input.currentPant,{...input.chosenStyle,trouser:choose("trouser",matcher,style.trouser)});
    } else if(parts.length!==2 && results.length<2 && /collar/i.test(text)) {
      for(const matcher of [/point/i,/spread/i]) addOption(choose("collar",matcher,style.collar),input.currentShirt,input.currentPant,{...input.chosenStyle,collar:choose("collar",matcher,style.collar)});
    }
    if(results.length>=2) {
      const preferred=[...results].sort((a,b)=>Number(b.canApply)-Number(a.canApply) || b.recommendation.designFitScore-a.recommendation.designFitScore)[0];
      advice.answer=`For ${parsed.occasion.toLowerCase()}, ${preferred.title} has the stronger current rule fit (${preferred.recommendation.designFitScore}/100). Compare the recorded option guidance, actual cloth references, provisional fit targets and tradeoffs below before choosing. Physical fabric and fit verification still apply.`;
    } else advice.answer="Name two available cloth colours or supported construction choices, for example ‘navy vs beige shirt fabric’, ‘pleated trousers vs flat-front trousers’ or ‘point collar vs spread collar’.";
    if(results.length<2) results.length=0;
  } else if(task==="design" || task==="capsule" || task==="refine" && (!restrictions.keepShirt || !restrictions.keepPant)) {
    const shirts=restrictions.keepShirt?[input.currentShirt]:input.shirts;
    const pants=restrictions.keepPant?[input.currentPant]:input.pants;
    const preference={...parsed.preference,...(input.judgement?.reason==="too_bold"?{preferredTier:"Safe" as const}:input.judgement?.reason==="too_safe"?{preferredTier:"Statement" as const}:{})};
    const order=preference.preferredTier==="Safe"?["Safe","Elevated","Statement"]:preference.preferredTier==="Statement"?["Statement","Elevated","Safe"]:["Elevated","Safe","Statement"];
    const slots=task==="capsule"?intent.capsule:[{label:"",occasion:parsed.occasion}];
    for(const slot of slots) {
      const slotGoals=designGoalPatch(intent,slot.occasion);
      const requestedPatch=task==="refine"?{...style,...retained}:{...parsed.personalStylePatch,...slotGoals,...explicit,...retained};
      const stylePatch=task==="refine"?requestedPatch:completeDesignConstruction(requestedPatch,style);
      const searchInput={...baseInput,occasion:slot.occasion,shirts,pants,scope:"open" as const,preference,excludedStyle:constructionIntent.excluded};
      let matches=searchDesignerCatalogue({...searchInput,stylePatch});
      if(!matches.length && (Object.keys(slotGoals).length || Object.keys(parsed.personalStylePatch || {}).length)) {
        const hardPatch=task==="refine"?{...style,...retained}:completeDesignConstruction({...explicit,...retained},style);
        matches=searchDesignerCatalogue({...searchInput,stylePatch:hardPatch});
        if(matches.length) addFinding("risk","Some creative-goal or learned details were relaxed to preserve your explicit instructions and the compatibility checks. Review the actual construction shown in each proposal.");
      }
      for(const candidate of [...matches].sort((a,b)=>order.indexOf(a.tier)-order.indexOf(b.tier))) {
        const before=results.length;
        addOption(slot.label?slot.label+" direction":candidate.tier+" direction",candidate.shirt,candidate.pant,candidate.style,candidate.tier,candidate.reasons,candidate.fitAdaptation || "",slot.occasion);
        if(task==="capsule" && results.length>before || results.length>=intent.directionCount) break;
      }
      if(task!=="capsule" || results.length>=3) break;
    }
    advice.answer=results.length ? task==="capsule"?`These ${results.length} occasion directions form a small shirt-and-trouser wardrobe from current stock. Each keeps its own occasion and checked construction when you apply or revise it.`:`These ${results.length} directions use current stock and the brief’s garment, occasion, material and fit checks. Review their concrete changes before applying one.` : "No current stock direction satisfies the retained fabrics and exclusions. Relax a constraint or ask for a cut-only revision; I have kept your selected outfit.";
    if(task==="capsule" && results.length<intent.capsule.length) addFinding("missing","Some requested occasions have no supported stock direction under this brief; the wardrobe is incomplete.");
    if(!results.length) {
      for(const [role,brief] of Object.entries(intent.roles)) if(brief.gsm || brief.lea) addFinding("missing",`${role}: a matching recorded GSM or Lea value is required. Missing values are not inferred from a photo or from yarn count.`);
      for(const issue of proposed.negotiation.blockers) addFinding("risk",issue.message);
    }
  } else if(task!=="clarify" && task!=="material" && task!=="production") {
    if(JSON.stringify(style)!==JSON.stringify(input.chosenStyle)) addOption("Requested revision");
    if(task==="refine" && !results.length && !input.judgement?.reason) {
      advice.answer="Tell me what should improve: colour, expression, shirt fit, trouser shape, formality or a construction detail. I’ll preserve the selected cloth while checking the change.";
    } else {
      if(task!=="refine" || !results.length) for(const action of proposed.negotiation.actions.filter((item)=>item.patch).slice(0,2)) addOption(action.label,input.currentShirt,input.currentPant,{...style,...action.patch,...explicit,...retained});
      if(task==="refine" && !results.length) advice.answer="The retained construction already uses this treatment. Specify the detail you want changed or allow a fabric change; I have kept the current outfit.";
      else if(!results.length) addOption("Keep the current direction",input.currentShirt,input.currentPant,input.chosenStyle);
    }
  }
  if(task==="refine" && results[0]?.changeSummary.length) {
    advice.answer=`Changed ${results[0].changeSummary.join("; ")}. ${results[0].recommendation.shortReason} ${results[0].canApply?"Review the tradeoffs, then apply or judge the revision.":"Resolve the blocking conflict before applying this revision."}`;
    advice.findings=results[0].tradeoffs.map((message)=>({kind:"risk" as const,text:message}));
  }
  advice.findings=advice.findings.slice(0,12);
  return {interpretation:{brief:parsed.original,occasion:parsed.occasion,context:parsed.context,notes:unique([...parsed.interpretation,...advice.preserved.map((item)=>"preserve: "+item)])},results:results.slice(0,3),advice};
}
