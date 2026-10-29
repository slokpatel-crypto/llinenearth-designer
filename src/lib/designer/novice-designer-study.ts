export type NoviceDesignerDevice="mobile"|"tablet"|"desktop";

type UnknownRecord=Record<string,unknown>;
function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}
function literalText(value:unknown,limit:number,label:string,min=0){
  if(value===undefined||value===null){
    if(min>0) throw new Error(label+" is required.");
    return "";
  }
  if(typeof value!=="string") throw new Error(label+" must be text.");
  const cleaned=value.replace(/\s+/g," ").trim();
  if(cleaned.length>limit) throw new Error(label+" is too long.");
  if(cleaned.length<min) throw new Error(label+" is required.");
  return cleaned;
}
function literalSeconds(value:unknown,label:string){
  if(typeof value!=="number"||!Number.isFinite(value)||value<1||value>7200)
    throw new Error(label+" must be a number between 1 second and 2 hours.");
  return Math.round(value);
}
function caseIdentity(value:unknown){
  const caseId=literalText(value,80,"Anonymous novice-test case ID",3);
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId))
    throw new Error("Anonymous novice-test case ID is required.");
  return caseId;
}
function deviceIdentity(value:unknown):NoviceDesignerDevice{
  if(value!=="mobile"&&value!=="tablet"&&value!=="desktop")
    throw new Error("A valid literal device class is required.");
  return value;
}
function outcomes(source:UnknownRecord){
  if(typeof source.noviceConfirmed!=="boolean"||typeof source.likedDesignCompleted!=="boolean"||typeof source.blockingIssue!=="boolean")
    throw new Error("Novice status, liked-design completion and blocking result must all be recorded.");
  const note=literalText(source.note,1200,"Novice study note");
  if(source.blockingIssue&&note.length<3) throw new Error("Blocking issues require a short note.");
  return {
    noviceConfirmed:source.noviceConfirmed,
    likedDesignCompleted:source.likedDesignCompleted,
    blockingIssue:source.blockingIssue,
    note,
  };
}

/** Physical/beta acceptance requires literal evidence, never JSON-coerced values or truncated notes. */
export function normalizeNoviceTimerStart(input:unknown){
  const source=record(input);
  return {caseId:caseIdentity(source.caseId),deviceClass:deviceIdentity(source.deviceClass)};
}

export function normalizeNoviceTimedAttempt(input:unknown){
  const source=record(input);
  if(typeof source.timingSessionId!=="string") throw new Error("A valid server timing session is required.");
  return {timingSessionId:source.timingSessionId,...outcomes(source)};
}

export function normalizeNoviceDesignerAttempt(input:unknown){
  const source=record(input);
  return {
    caseId:caseIdentity(source.caseId),
    deviceClass:deviceIdentity(source.deviceClass),
    durationSeconds:literalSeconds(source.durationSeconds,"Observed completion time"),
    ...outcomes(source),
  };
}

export function normalizeNoviceStudyDecision(input:unknown){
  const source=record(input);
  if(source.status!=="approved"&&source.status!=="review")
    throw new Error("Study decision must be approved or review.");
  const status=source.status;
  const targetSeconds=literalSeconds(source.targetSeconds,"Enter the documented roadmap target time in seconds");
  const signedBy=literalText(source.signedBy,120,"Named owner/reviewer sign-off",2);
  const note=literalText(source.note,1200,"Study decision note");
  if(status==="review"&&note.length<3) throw new Error("Review status requires a short note.");
  return {status,targetSeconds,signedBy,note};
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
  const targetSeconds=typeof latestDecision?.target_seconds==="number"&&
    Number.isFinite(latestDecision.target_seconds)&&latestDecision.target_seconds>=1&&latestDecision.target_seconds<=7200
      ?latestDecision.target_seconds:null;
  const eligible=latest.filter((row)=>row.novice_confirmed===true&&row.liked_design_completed===true&&
    row.blocking_issue===false&&typeof row.duration_seconds==="number"&&
    Number.isFinite(row.duration_seconds)&&row.duration_seconds>=1&&row.duration_seconds<=7200);
  // One genuine server timer cannot count as five independent novice cases.
  const seenTimers=new Set<string>();
  const serverTimed=eligible.filter((row)=>{
    const id=row.timing_session_id;
    if(typeof id!=="string"||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||
       seenTimers.has(id.toLowerCase())) return false;
    seenTimers.add(id.toLowerCase());
    return true;
  });
  const withinTarget=targetSeconds===null?[]:serverTimed.filter((row)=>row.duration_seconds<=targetSeconds);
  return {
    uniqueCases:latest.length,
    noviceCases:latest.filter((row)=>row.novice_confirmed).length,
    likedDesignCases:eligible.length,
    serverTimedLikedCases:serverTimed.length,
    blockingCases:latest.filter((row)=>row.blocking_issue).length,
    medianLikedDesignSeconds:median(eligible.map((row)=>row.duration_seconds)),
    targetSeconds,
    withinTargetCases:withinTarget.length,
    latestDecisionStatus:latestDecision?.status||"pending",
    latestSignedBy:latestDecision?.signed_by||null,
    evidenceReady:serverTimed.length>=5,
    gateComplete:Boolean(targetSeconds!==null&&withinTarget.length>=5&&latestDecision?.status==="approved"&&
      typeof latestDecision.signed_by==="string"&&latestDecision.signed_by.trim().length>=2),
  };
}
