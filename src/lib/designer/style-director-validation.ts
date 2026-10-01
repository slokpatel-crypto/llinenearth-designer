export type StyleDirectorValidationDevice="mobile"|"tablet"|"desktop";

type UnknownRecord=Record<string,unknown>;
function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}
function clean(value:unknown,limit:number){
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}

export function normalizeStyleDirectorUserTest(input:unknown){
  const source=record(input);
  const caseId=clean(source.caseId,80);
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous user-test case ID is required.");
  const deviceClass=clean(source.deviceClass,20) as StyleDirectorValidationDevice;
  if(!["mobile","tablet","desktop"].includes(deviceClass)) throw new Error("A device class is required.");
  const flags=["directionsUnderstandable","directionsDistinct","stockHandoffWorked","blockingIssue"] as const;
  for(const key of flags) if(typeof source[key]!=="boolean") throw new Error("Every Style Director validation result must be recorded.");
  const note=clean(source.note,1200);
  if(source.blockingIssue&&note.length<3) throw new Error("Blocking issues require a short note.");
  return {
    caseId,
    deviceClass,
    directionsUnderstandable:source.directionsUnderstandable as boolean,
    directionsDistinct:source.directionsDistinct as boolean,
    stockHandoffWorked:source.stockHandoffWorked as boolean,
    blockingIssue:source.blockingIssue as boolean,
    note,
  };
}

export function normalizeStyleDirectorValidationSignoff(input:unknown){
  const source=record(input);
  const status=clean(source.status,20);
  if(status!=="approved"&&status!=="review") throw new Error("Validation sign-off must be approved or review.");
  const signedBy=clean(source.signedBy,120);
  if(signedBy.length<2) throw new Error("Named owner/reviewer sign-off is required.");
  const note=clean(source.note,1200);
  if(status==="review"&&note.length<3) throw new Error("Review status requires a short note.");
  return {status,statusTyped:status as "approved"|"review",signedBy,note};
}

export type StyleDirectorUserTestRow={
  case_id:string;
  device_class:string;
  directions_understandable:boolean;
  directions_distinct:boolean;
  stock_handoff_worked:boolean;
  blocking_issue:boolean;
  created_at:string;
};

export type StyleDirectorValidationSignoffRow={
  status:string;
  signed_by:string;
  created_at:string;
};

export function summarizeStyleDirectorValidation(
  tests:StyleDirectorUserTestRow[],
  signoffs:StyleDirectorValidationSignoffRow[],
){
  const latestByCase=new Map<string,StyleDirectorUserTestRow>();
  for(const row of [...tests].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
    if(!latestByCase.has(row.case_id)) latestByCase.set(row.case_id,row);
  }
  const latest=[...latestByCase.values()];
  const positive=latest.filter((row)=>
    row.directions_understandable&&row.directions_distinct&&row.stock_handoff_worked&&!row.blocking_issue
  );
  const latestSignoff=[...signoffs].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]||null;
  return {
    uniqueCases:latest.length,
    positiveCases:positive.length,
    blockingCases:latest.filter((row)=>row.blocking_issue).length,
    understandableCases:latest.filter((row)=>row.directions_understandable).length,
    distinctCases:latest.filter((row)=>row.directions_distinct).length,
    handoffCases:latest.filter((row)=>row.stock_handoff_worked).length,
    deviceCoverage:[...new Set(latest.map((row)=>row.device_class))],
    latestSignoffStatus:latestSignoff?.status||"pending",
    latestSignedBy:latestSignoff?.signed_by||null,
    evidenceRecorded:latest.length>0,
    validationComplete:latest.length>0&&latestSignoff?.status==="approved",
  };
}
