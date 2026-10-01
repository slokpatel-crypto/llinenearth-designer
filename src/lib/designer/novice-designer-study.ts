export type NoviceDesignerDevice="mobile"|"tablet"|"desktop";

type UnknownRecord=Record<string,unknown>;
function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}
function clean(value:unknown,limit:number){
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}
function finite(value:unknown){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

export function normalizeNoviceDesignerAttempt(input:unknown){
  const source=record(input);
  const caseId=clean(source.caseId,80);
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous novice-test case ID is required.");
  const deviceClass=clean(source.deviceClass,20) as NoviceDesignerDevice;
  if(!["mobile","tablet","desktop"].includes(deviceClass)) throw new Error("A device class is required.");
  const durationSeconds=finite(source.durationSeconds);
  if(durationSeconds===null||durationSeconds<=0||durationSeconds>7200) throw new Error("Observed completion time must be between 1 second and 2 hours.");
  if(typeof source.noviceConfirmed!=="boolean"||typeof source.likedDesignCompleted!=="boolean"||typeof source.blockingIssue!=="boolean"){
    throw new Error("Novice status, liked-design completion and blocking result must all be recorded.");
  }
  const note=clean(source.note,1200);
  if(source.blockingIssue&&note.length<3) throw new Error("Blocking issues require a short note.");
  return {
    caseId,
    deviceClass,
    durationSeconds:Math.round(durationSeconds),
    noviceConfirmed:source.noviceConfirmed,
    likedDesignCompleted:source.likedDesignCompleted,
    blockingIssue:source.blockingIssue,
    note,
  };
}

export function normalizeNoviceStudyDecision(input:unknown){
  const source=record(input);
  const status=clean(source.status,20);
  if(status!=="approved"&&status!=="review") throw new Error("Study decision must be approved or review.");
  const targetSeconds=finite(source.targetSeconds);
  if(targetSeconds===null||targetSeconds<=0||targetSeconds>7200) throw new Error("Enter the documented roadmap target time in seconds.");
  const signedBy=clean(source.signedBy,120);
  if(signedBy.length<2) throw new Error("Named owner/reviewer sign-off is required.");
  const note=clean(source.note,1200);
  if(status==="review"&&note.length<3) throw new Error("Review status requires a short note.");
  return {
    status:status as "approved"|"review",
    targetSeconds:Math.round(targetSeconds),
    signedBy,
    note,
  };
}

export type NoviceDesignerAttemptRow={
  case_id:string;
  device_class:string;
  duration_seconds:number;
  novice_confirmed:boolean;
  liked_design_completed:boolean;
  blocking_issue:boolean;
  timing_session_id?:string|null;
  created_at:string;
};

export type NoviceDesignerDecisionRow={
  status:string;
  target_seconds:number;
  signed_by:string;
  created_at:string;
};

function median(values:number[]){
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b);
  const mid=Math.floor(ordered.length/2);
  return ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;
}

export function summarizeNoviceDesignerStudy(
  attempts:NoviceDesignerAttemptRow[],
  decisions:NoviceDesignerDecisionRow[],
){
  const latestByCase=new Map<string,NoviceDesignerAttemptRow>();
  for(const row of [...attempts].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
    if(!latestByCase.has(row.case_id)) latestByCase.set(row.case_id,row);
  }
  const latest=[...latestByCase.values()];
  const latestDecision=[...decisions].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]||null;
  const targetSeconds=latestDecision?.target_seconds||null;
  const eligible=latest.filter((row)=>row.novice_confirmed&&row.liked_design_completed&&!row.blocking_issue);
  const serverTimed=eligible.filter((row)=>Boolean(row.timing_session_id));
  const withinTarget=targetSeconds===null?[]:serverTimed.filter((row)=>row.duration_seconds<=targetSeconds);
  return {
    uniqueCases:latest.length,
    noviceCases:latest.filter((row)=>row.novice_confirmed).length,
    likedDesignCases:eligible.length,
    serverTimedLikedCases:serverTimed.length,
    blockingCases:latest.filter((row)=>row.blocking_issue).length,
    medianLikedDesignSeconds:median(eligible.map((row)=>Number(row.duration_seconds))),
    targetSeconds,
    withinTargetCases:withinTarget.length,
    latestDecisionStatus:latestDecision?.status||"pending",
    latestSignedBy:latestDecision?.signed_by||null,
    evidenceReady:serverTimed.length>=5,
    gateComplete:Boolean(targetSeconds&&withinTarget.length>=5&&latestDecision?.status==="approved"),
  };
}
