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

function finite(value:unknown){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
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
  const caseId=String(source.caseId||"").trim().slice(0,80);
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous case ID is required.");
  const selfChestCm=finite(source.selfChestCm);
  const tailorChestCm=finite(source.tailorChestCm);
  const selfSleeveCm=finite(source.selfSleeveCm);
  const tailorSleeveCm=finite(source.tailorSleeveCm);
  if(selfChestCm===null||selfChestCm<50||selfChestCm>200) throw new Error("Self chest must be between 50 and 200 cm.");
  if(tailorChestCm===null||tailorChestCm<50||tailorChestCm>200) throw new Error("Tailor chest must be between 50 and 200 cm.");
  if(selfSleeveCm===null||selfSleeveCm<30||selfSleeveCm>100) throw new Error("Self sleeve must be between 30 and 100 cm.");
  if(tailorSleeveCm===null||tailorSleeveCm<30||tailorSleeveCm>100) throw new Error("Tailor sleeve must be between 30 and 100 cm.");
  const evidenceSource=String(source.evidenceSource||"").trim().slice(0,240);
  if(evidenceSource.length<3) throw new Error("Physical comparison evidence source is required.");
  const checkedBy=String(source.checkedBy||"").trim().slice(0,120);
  if(checkedBy.length<2) throw new Error("Named checker/tailor is required.");
  const note=String(source.note||"").replace(/\s+/g," ").trim().slice(0,1200);
  return {caseId,selfChestCm,tailorChestCm,selfSleeveCm,tailorSleeveCm,evidenceSource,checkedBy,note};
}

export function summarizeMeasurementCalibration(rows:MeasurementCalibrationCaseRow[]){
  const latest=new Map<string,MeasurementCalibrationCaseRow>();
  for(const row of [...rows].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
    const key=String(row.case_id||"").trim();
    if(key&&!latest.has(key)) latest.set(key,row);
  }
  const cases=[...latest.values()].flatMap((row)=>{
    const selfChest=finite(row.self_chest_cm),tailorChest=finite(row.tailor_chest_cm);
    const selfSleeve=finite(row.self_sleeve_cm),tailorSleeve=finite(row.tailor_sleeve_cm);
    if(selfChest===null||tailorChest===null||selfSleeve===null||tailorSleeve===null) return [];
    return [{
      at:row.created_at,
      caseId:row.case_id,
      selfChestCm:selfChest,
      tailorChestCm:tailorChest,
      chestErrorCm:Math.round(Math.abs(selfChest-tailorChest)*100)/100,
      selfSleeveCm:selfSleeve,
      tailorSleeveCm:tailorSleeve,
      sleeveErrorCm:Math.round(Math.abs(selfSleeve-tailorSleeve)*100)/100,
      evidenceSource:String(row.evidence_source||""),
      checkedBy:String(row.checked_by||""),
      note:String(row.note||""),
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
