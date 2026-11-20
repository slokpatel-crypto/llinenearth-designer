import { colorFamilies } from "./vocab/colors.ts";
import { patternFamilies } from "./vocab/patterns.ts";

export const FABRIC_GROUND_TRUTH_VERSION="fabric-ground-truth-v1" as const;

export const FABRIC_GROUND_TRUTH_FIELDS=[
  "colorFamily",
  "patternFamily",
  "patternScale",
  "patternDensity",
  "orientation",
  "sheen",
  "visualWeight",
  "formality",
  "statementLevel",
] as const;

export type FabricGroundTruthField=typeof FABRIC_GROUND_TRUTH_FIELDS[number];
export type FabricGroundTruthState=Record<FabricGroundTruthField,string>;

const GROUND_TRUTH_CHOICES:Record<
  Exclude<FabricGroundTruthField,"formality"|"statementLevel">,ReadonlySet<string>
>={
  colorFamily:new Set(colorFamilies.map((family)=>family.id)),
  patternFamily:new Set(patternFamilies.map((family)=>family.id)),
  patternScale:new Set(["none","fine","medium","bold"]),
  patternDensity:new Set(["none","sparse","balanced","dense"]),
  orientation:new Set(["none","vertical","horizontal","grid","all-over","directional","uncertain"]),
  sheen:new Set(["matte","low","medium","high","uncertain"]),
  visualWeight:new Set(["light-looking","medium-looking","heavy-looking","uncertain"]),
};

/** Only actual active stock identifiers may enter owner-labelled accuracy. */
export function isStockBoundFabricGroundTruthId(
  value:unknown, eligibleStockIds:ReadonlySet<string>,
):value is string {
  return typeof value==="string" && value.length>0 && eligibleStockIds.has(value);
}

/**
 * Normalize the independent operator's explicit comparison, not a reconstructed
 * Analyzer result. Reject coercible arrays/objects and overlong persisted JSON
 * instead of turning them into plausible classification labels.
 */
export function normalizeExplicitFabricGroundTruthState(value:unknown):FabricGroundTruthState|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const raw=value as Record<string,unknown>;
  const state={} as FabricGroundTruthState;
  for(const field of FABRIC_GROUND_TRUTH_FIELDS){
    const given=raw[field];
    if(given===undefined || given===null){state[field]="";continue;}
    const ordinal=field==="formality" || field==="statementLevel";
    if(ordinal && typeof given==="number"
      && Number.isInteger(given) && given>=1 && given<=5){
      state[field]=String(given);
      continue;
    }
    if(typeof given!=="string" || given.length>80) return null;
    const normalized=given.trim();
    if(ordinal){
      if(normalized && !/^[1-5]$/.test(normalized)) return null;
    } else if(normalized && !GROUND_TRUTH_CHOICES[field].has(normalized)){
      // Reject aliases, typos and impossible classifier outputs rather than
      // counting an arbitrary label as an independent accuracy comparison.
      return null;
    }
    state[field]=normalized;
  }
  return FABRIC_GROUND_TRUTH_FIELDS.some((field)=>state[field]!=="") ? state : null;
}

export type FabricGroundTruthLabel={
  fabricId:string;
  profileId:string;
  analyzerVersion:string;
  original:FabricGroundTruthState;
  final:FabricGroundTruthState;
  note:string;
  at:string;
  // Historical approved/corrected profiles are useful context but are not
  // independently labelled Analyzer-versus-truth comparisons. Keep them
  // visible without manufacturing 100% agreement from profile self-matches.
  eligibleForAccuracy?:boolean;
};

const PATH_TO_FIELD:Record<string,FabricGroundTruthField>={
  "observed.colorFamily":"colorFamily",
  "observed.patternFamily":"patternFamily",
  "observed.patternScale":"patternScale",
  "observed.patternDensity":"patternDensity",
  "observed.orientation":"orientation",
  "observed.sheen":"sheen",
  "observed.visualWeight":"visualWeight",
  "inferredStyle.formality":"formality",
  "inferredStyle.statementLevel":"statementLevel",
};

function object(value:unknown):Record<string,unknown>{
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
}

function scalar(value:unknown){
  return value===null || value===undefined ? "" : String(value).trim().slice(0,80);
}

export function fabricGroundTruthStateFromProfile(profile:unknown):FabricGroundTruthState{
  const root=object(profile);
  const observed=object(root.observed);
  const inferred=object(root.inferredStyle);
  return {
    colorFamily:scalar(observed.colorFamily),
    patternFamily:scalar(observed.patternFamily),
    patternScale:scalar(observed.patternScale),
    patternDensity:scalar(observed.patternDensity),
    orientation:scalar(observed.orientation),
    sheen:scalar(observed.sheen),
    visualWeight:scalar(observed.visualWeight),
    formality:scalar(inferred.formality),
    statementLevel:scalar(inferred.statementLevel),
  };
}

export function reconstructOriginalFabricGroundTruthState(
  finalState:FabricGroundTruthState,
  feedback:Array<{fieldPath:string;previousValue:unknown}>,
):FabricGroundTruthState{
  const original={...finalState};
  const restored=new Set<FabricGroundTruthField>();
  for(const correction of feedback){
    const field=PATH_TO_FIELD[String(correction.fieldPath||"")];
    if(!field || restored.has(field)) continue;
    original[field]=scalar(correction.previousValue);
    restored.add(field);
  }
  return original;
}

function same(a:string,b:string){
  return String(a??"").trim()===String(b??"").trim();
}

export function scoreFabricGroundTruth(labels:FabricGroundTruthLabel[]){
  const unique=new Map<string,FabricGroundTruthLabel>();
  for(const label of labels.filter((item)=>item.eligibleForAccuracy!==false)
    .sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime())) {
    if(label.fabricId && !unique.has(label.fabricId)) unique.set(label.fabricId,label);
  }
  const latest=[...unique.values()];
  const perField=FABRIC_GROUND_TRUTH_FIELDS.map((field)=>{
    let matches=0;
    let total=0;
    for(const label of latest){
      const original=label.original[field];
      const final=label.final[field];
      // A missing initial or final classification is unknown, not a
      // disagreement. Do not inflate a correction count from absent evidence.
      if(original==="" || final==="") continue;
      total+=1;
      if(same(original,final)) matches+=1;
    }
    return {
      field,
      matches,
      total,
      percent:total?Math.round(matches/total*1000)/10:null,
    };
  });
  const complete=latest.filter((label)=>FABRIC_GROUND_TRUTH_FIELDS.every((field)=>
    label.original[field]!=="" && label.final[field]!==""));
  const exactLookMatches=complete.filter((label)=>FABRIC_GROUND_TRUTH_FIELDS.every((field)=>
    same(label.original[field],label.final[field]))).length;
  // A partially labelled fabric is not automatically "corrected": only an
  // actual, comparable field change is evidence of an operator correction.
  const corrected=latest.filter((label)=>FABRIC_GROUND_TRUTH_FIELDS.some((field)=>
    label.original[field]!=="" && label.final[field]!=="" &&
    !same(label.original[field],label.final[field]))).length;
  const fieldMatches=perField.reduce((sum,row)=>sum+row.matches,0);
  const fieldTotal=perField.reduce((sum,row)=>sum+row.total,0);
  return {
    uniqueFabrics:latest.length,
    completeFabrics:complete.length,
    incompleteFabrics:latest.length-complete.length,
    correctedFabrics:corrected,
    exactProfileMatches:exactLookMatches,
    // The desk displays exact matches / unique fabrics. If any owner label
    // is incomplete, hide the aggregate exact-match rate instead of assigning
    // an invented failure or a mismatched denominator.
    exactProfilePercent:complete.length===latest.length && complete.length>0
      ? Math.round(exactLookMatches/complete.length*1000)/10 : null,
    fieldAgreementPercent:fieldTotal?Math.round(fieldMatches/fieldTotal*1000)/10:null,
    fieldMatches,
    fieldTotal,
    perField,
  };
}
