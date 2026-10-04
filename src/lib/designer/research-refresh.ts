import type { FashionResearchSource } from "@/lib/designer/fashion-research-source-pool";
import type { CreativeResearchSignal } from "@/lib/designer/creative-research";

export const RESEARCH_DAILY_LIMIT=2;
export function researchRunKey(date=new Date()){
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  return `EV-RESEARCH-DAILY-${day}`;
}
export function researchRefreshSources(sources:FashionResearchSource[],date=new Date()){
  const primary=sources.filter(s=>s.authority==="primary"&&["museum","menswear","materials","university"].includes(s.category)),day=Math.floor(date.getTime()/86400000);
  return Array.from({length:Math.min(RESEARCH_DAILY_LIMIT,primary.length)},(_,i)=>primary[(day*RESEARCH_DAILY_LIMIT+i)%primary.length]);
}
export function researchPageHypothesis(source:FashionResearchSource,page:{url:string;text:string},provenance:{contentHash:string;fetchedAt:string}):CreativeResearchSignal|null {
  const text=page.text.toLowerCase(),kind=/embroider|stitch|thread/.test(text)?"stitch":/pleat|fold|drape/.test(text)?"fold":/weave|woven|textile/.test(text)?"texture":null;
  if(!kind)return null;
  const principle=kind==="stitch"?"Review whether stitch rhythm and restrained placement can provide a focal detail.":kind==="fold"?"Review how a single repeated fold or seam can organise garment volume.":"Review whether material contrast can carry a design while silhouette remains quiet.";
  return {id:`daily-${source.id}-${provenance.contentHash.slice(0,18)}`,title:`${source.name} · ${kind} hypothesis`,sourceUrl:page.url,sourceType:source.category==="museum"?"museum":"archive",principle,transformedIdea:kind==="stitch"?"Develop an original sparse cuff motif with quiet space around it; verify the principle against the source.":kind==="fold"?"Develop a restrained pleat rhythm; sample the exact cloth before interpreting drape.":"Develop a small contrasting fabric panel using stocked cloth, with a shrinkage sample.",zone:kind==="fold"?"pleat":"cuff",treatmentLabel:`Reviewed ${kind} study`,treatmentInstruction:"Operator must read the linked source, rewrite this hypothesis into a specific original design instruction, and approve a sample check before activation.",visualPurpose:"One focal mechanism with quiet surrounding cloth",intensity:35,buildability:"atelier",patternFamily:"none",active:false,createdAt:provenance.fetchedAt,note:"Automatic keyword hypothesis; not a source finding or physical fabric fact. Human review required.",provenance:{...provenance,method:"keyword_hypothesis",reviewRequired:true}};
}
