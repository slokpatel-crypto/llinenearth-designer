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

export type FabricGroundTruthLabel={
  fabricId:string;
  profileId:string;
  analyzerVersion:string;
  original:FabricGroundTruthState;
  final:FabricGroundTruthState;
  note:string;
  at:string;
};

function same(a:string,b:string){
  return String(a??"").trim()===String(b??"").trim();
}

export function scoreFabricGroundTruth(labels:FabricGroundTruthLabel[]){
  const unique=new Map<string,FabricGroundTruthLabel>();
  for(const label of [...labels].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime())) {
    if(label.fabricId && !unique.has(label.fabricId)) unique.set(label.fabricId,label);
  }
  const latest=[...unique.values()];
  const perField=FABRIC_GROUND_TRUTH_FIELDS.map((field)=>{
    let matches=0;
    let total=0;
    for(const label of latest){
      const original=label.original[field];
      const final=label.final[field];
      if(final==="") continue;
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
  const exactLookMatches=latest.filter((label)=>FABRIC_GROUND_TRUTH_FIELDS.every((field)=>same(label.original[field],label.final[field]))).length;
  const corrected=latest.length-exactLookMatches;
  const fieldMatches=perField.reduce((sum,row)=>sum+row.matches,0);
  const fieldTotal=perField.reduce((sum,row)=>sum+row.total,0);
  return {
    uniqueFabrics:latest.length,
    correctedFabrics:corrected,
    exactProfileMatches:exactLookMatches,
    exactProfilePercent:latest.length?Math.round(exactLookMatches/latest.length*1000)/10:null,
    fieldAgreementPercent:fieldTotal?Math.round(fieldMatches/fieldTotal*1000)/10:null,
    fieldMatches,
    fieldTotal,
    perField,
  };
}
