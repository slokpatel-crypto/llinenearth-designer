export const MEASUREMENT_CALIBRATION_TARGET_CASES=10;
export const MEASUREMENT_CHEST_MEDIAN_TARGET_CM=1.5;
export const MEASUREMENT_SLEEVE_MEDIAN_TARGET_CM=1;

export type MeasurementCalibrationCaseRow={
  case_id:string;
  self_chest_cm:number;
  tailor_chest_cm:number;
  self_sleeve_cm:number;
  tailor_sleeve_cm:number;
  evidence_source:string;
  checked_by:string;
  note:string;
  created_at:string;
};

// Physical tape readings must arrive as actual JSON numbers. Number(null),
// Number(false), Number("") and Number("100") previously converted malformed
// evidence into apparently successful real-world calibration cases.
function finite(value:unknown){
  return typeof value==="number"&&Number.isFinite(value)?value:null;
}

function validCaseId(value:unknown):value is string {
  return typeof value==="string"&&/^[A-Za-z0-9._-]{3,80}$/.test(value.trim());
}

function evidenceText(value:unknown,min:number,max:number):string|null {
  if(typeof value!=="string") return null;
  const clean=value.trim();
  return clean.length>=min&&clean.length<=max?clean:null;
}

// PostgreSQL timestamptz may be Z or an explicit offset. Reject impossible
// calendar dates and 24:00 instead of relying on Date.parse normalization.
function validEvidenceTimestamp(value:unknown):value is string {
  if(typeof value!=="string") return false;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match) return false;
  const [,yy,mm,dd,hh,mi,ss,zone]=match;
  const year=Number(yy),month=Number(mm),day=Number(dd);
  if(year<2000||month<1||month>12||day<1||day>31||
    Number(hh)>23||Number(mi)>59||Number(ss)>59) return false;
  const check=new Date(Date.UTC(year,month-1,day));
  if(check.getUTCFullYear()!==year||check.getUTCMonth()+1!==month||check.getUTCDate()!==day) return false;
  if(zone!=="Z"){
    const offsetHour=Number(zone.slice(1,3)),offsetMin=Number(zone.slice(4,6));
    if(offsetHour>14||offsetMin>59||(offsetHour===14&&offsetMin!==0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function validRecordedCase(row:MeasurementCalibrationCaseRow):boolean {
  return validCaseId(row.case_id)&&
    [row.self_chest_cm,row.tailor_chest_cm].every(v=>finite(v)!==null&&v>=50&&v<=200)&&
    [row.self_sleeve_cm,row.tailor_sleeve_cm].every(v=>finite(v)!==null&&v>=30&&v<=100)&&
    evidenceText(row.evidence_source,3,240)!==null&&
    evidenceText(row.checked_by,2,120)!==null&&
    validEvidenceTimestamp(row.created_at);
}

function median(values:number[]){
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(ordered.length/2);
  const value=ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;
  return Math.round(value*100)/100;
}

export function normalizeMeasurementCalibrationDraft(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Measurement calibration evidence is required.");
  const source=input as Record<string,unknown>;
  const caseId=validCaseId(source.caseId)?source.caseId.trim():"";
  if(!caseId) throw new Error("Anonymous case ID is required.");
  const selfChestCm=finite(source.selfChestCm);
  const tailorChestCm=finite(source.tailorChestCm);
  const selfSleeveCm=finite(source.selfSleeveCm);
  const tailorSleeveCm=finite(source.tailorSleeveCm);
  if(selfChestCm===null||selfChestCm<50||selfChestCm>200) throw new Error("Self chest must be between 50 and 200 cm.");
  if(tailorChestCm===null||tailorChestCm<50||tailorChestCm>200) throw new Error("Tailor chest must be between 50 and 200 cm.");
  if(selfSleeveCm===null||selfSleeveCm<30||selfSleeveCm>100) throw new Error("Self sleeve must be between 30 and 100 cm.");
  if(tailorSleeveCm===null||tailorSleeveCm<30||tailorSleeveCm>100) throw new Error("Tailor sleeve must be between 30 and 100 cm.");
  const evidenceSource=evidenceText(source.evidenceSource,3,240);
  if(!evidenceSource) throw new Error("Physical comparison evidence source is required.");
  const checkedBy=evidenceText(source.checkedBy,2,120);
  if(!checkedBy) throw new Error("Named checker/tailor is required.");
  if(source.note!==undefined&&source.note!==null&&typeof source.note!=="string")
    throw new Error("Calibration note must be text.");
  const note=(source.note??"").replace(/\s+/g," ").trim().slice(0,1200);
  return {caseId,selfChestCm,tailorChestCm,selfSleeveCm,tailorSleeveCm,evidenceSource,checkedBy,note};
}

export function summarizeMeasurementCalibration(rows:MeasurementCalibrationCaseRow[]){
  // A malformed latest row must not silently restore an older passing case.
  // Unknown, duplicate and corrupt records are not evidence of a real tape session.
  const latest=new Map<string,MeasurementCalibrationCaseRow>();
  const blocked=new Set<string>();
  if(Array.isArray(rows)) for(const raw of rows){
    if(!raw||typeof raw!=="object"||Array.isArray(raw)) continue;
    const row=raw as MeasurementCalibrationCaseRow;
    if(!validCaseId(row.case_id)) continue;
    const key=row.case_id.trim();
    if(!validEvidenceTimestamp(row.created_at)){
      blocked.add(key);
      continue;
    }
    const prior=latest.get(key);
    const instant=Date.parse(row.created_at);
    if(prior&&instant===Date.parse(prior.created_at)&&
      JSON.stringify(row)!==JSON.stringify(prior)){
      // Equal-time conflicting writes have no provable latest revision.
      // Refuse to pick whichever the API happened to return first.
      blocked.add(key);
    }else if(!prior||instant>Date.parse(prior.created_at)) latest.set(key,row);
  }
  const cases=[...latest.entries()].flatMap(([key,row])=>{
    if(blocked.has(key)||!validRecordedCase(row)) return [];
    const selfChest=row.self_chest_cm,tailorChest=row.tailor_chest_cm;
    const selfSleeve=row.self_sleeve_cm,tailorSleeve=row.tailor_sleeve_cm;
    return [{
      at:row.created_at,
      caseId:key,
      selfChestCm:selfChest,
      tailorChestCm:tailorChest,
      chestErrorCm:Math.round(Math.abs(selfChest-tailorChest)*100)/100,
      selfSleeveCm:selfSleeve,
      tailorSleeveCm:tailorSleeve,
      sleeveErrorCm:Math.round(Math.abs(selfSleeve-tailorSleeve)*100)/100,
      evidenceSource:row.evidence_source.trim(),
      checkedBy:row.checked_by.trim(),
      note:typeof row.note==="string"?row.note:"",
    }];
  });
  const medianChestErrorCm=median(cases.map((item)=>item.chestErrorCm));
  const medianSleeveErrorCm=median(cases.map((item)=>item.sleeveErrorCm));
  const enoughCases=cases.length>=MEASUREMENT_CALIBRATION_TARGET_CASES;
  const chestPass=enoughCases&&medianChestErrorCm!==null&&medianChestErrorCm<MEASUREMENT_CHEST_MEDIAN_TARGET_CM;
  const sleevePass=enoughCases&&medianSleeveErrorCm!==null&&medianSleeveErrorCm<MEASUREMENT_SLEEVE_MEDIAN_TARGET_CM;
  return {
    target:MEASUREMENT_CALIBRATION_TARGET_CASES,
    total:cases.length,
    cases,
    medianChestErrorCm,
    medianSleeveErrorCm,
    chestPass,
    sleevePass,
    complete:chestPass&&sleevePass,
  };
}
