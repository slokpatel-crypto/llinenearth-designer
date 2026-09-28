import type { CreativePattern, CreativeTreatment, CreativeZone } from "@/lib/designer/creative-engine";

export type CreativeResearchPatternFamily = CreativePattern["family"] | "none";

export type CreativeResearchSignal = {
  id:string;
  title:string;
  sourceUrl:string;
  sourceType:"museum"|"designer"|"runway"|"tailoring"|"archive"|"operator";
  principle:string;
  transformedIdea:string;
  zone:CreativeZone;
  secondaryZone?:CreativeZone;
  treatmentLabel:string;
  treatmentInstruction:string;
  visualPurpose:string;
  intensity:number;
  buildability:CreativeTreatment["buildability"];
  patternFamily:CreativeResearchPatternFamily;
  patternName?:string;
  patternLayout?:string;
  patternPlacement?:string;
  patternScale?:"micro"|"fine"|"medium";
  patternCoverage?:number;
  active:boolean;
  note?:string;
  createdAt?:string;
};

export type CreativeResearchLibrary = {
  version:"designer-creative-research-v1";
  total:number;
  active:number;
  signals:CreativeResearchSignal[];
};

type EventLike={type:string;source?:string;payload?:Record<string,unknown>};

function text(value:unknown,max=700){return String(value??"").trim().slice(0,max);}
function number(value:unknown,min:number,max:number,fallback:number){
  const n=Number(value);
  return Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : fallback;
}

const ZONES=new Set<CreativeZone>(["collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"]);
const BUILDABILITY=new Set<CreativeTreatment["buildability"]>(["supported","atelier","experimental"]);
const PATTERNS=new Set<CreativeResearchPatternFamily>(["none","stripe","geometric","border","tonal","placement"]);
const SOURCES=new Set<CreativeResearchSignal["sourceType"]>(["museum","designer","runway","tailoring","archive","operator"]);
const SCALES=new Set<NonNullable<CreativeResearchSignal["patternScale"]>>(["micro","fine","medium"]);

export function aggregateCreativeResearch(events:EventLike[]):CreativeResearchLibrary {
  const latest=new Map<string,CreativeResearchSignal>();
  for(const event of events) {
    if(event.type!=="operator_note") continue;
    const p=event.payload || {};
    if(text(p.subtype,80)!=="designer_creative_research") continue;
    const id=text(p.researchId,140);
    const title=text(p.title,180);
    const principle=text(p.principle,700);
    const transformedIdea=text(p.transformedIdea,700);
    const zone=text(p.zone,40) as CreativeZone;
    const secondaryZone=text(p.secondaryZone,40) as CreativeZone;
    const treatmentLabel=text(p.treatmentLabel,140);
    const treatmentInstruction=text(p.treatmentInstruction,700);
    const visualPurpose=text(p.visualPurpose,500);
    const buildability=text(p.buildability,30) as CreativeTreatment["buildability"];
    const patternFamily=text(p.patternFamily,30) as CreativeResearchPatternFamily;
    const sourceType=text(p.sourceType,30) as CreativeResearchSignal["sourceType"];
    const patternScale=text(p.patternScale,30) as NonNullable<CreativeResearchSignal["patternScale"]>;
    if(!id || !title || !principle || !transformedIdea || !ZONEs(zone) || !treatmentLabel || !treatmentInstruction || !visualPurpose) continue;
    latest.set(id,{
      id,title,
      sourceUrl:text(p.sourceUrl,500),
      sourceType:SOURCES.has(sourceType)?sourceType:"operator",
      principle,transformedIdea,zone,
      ...(ZONES.has(secondaryZone)?{secondaryZone}:{}),
      treatmentLabel,treatmentInstruction,visualPurpose,
      intensity:number(p.intensity,1,100,50),
      buildability:BUILDABILITY.has(buildability)?buildability:"atelier",
      patternFamily:PATTERNS.has(patternFamily)?patternFamily:"none",
      patternName:text(p.patternName,140) || undefined,
      patternLayout:text(p.patternLayout,700) || undefined,
      patternPlacement:text(p.patternPlacement,400) || undefined,
      patternScale:SCALES.has(patternScale)?patternScale:undefined,
      patternCoverage:number(p.patternCoverage,0,60,24),
      active:Boolean(p.active),
      note:text(p.note,600) || undefined,
      createdAt:text(p.createdAt,80) || undefined,
    });
  }
  const signals=[...latest.values()].sort((a,b)=>(Number(b.active)-Number(a.active)) || a.title.localeCompare(b.title));
  return {version:"designer-creative-research-v1",total:signals.length,active:signals.filter((x)=>x.active).length,signals};
}

function ZONEs(value:unknown): value is CreativeZone {
  return typeof value==="string" && ZONES.has(value as CreativeZone);
}
