export const LAUNCH_BETA_TARGET=5;

export const LAUNCH_CHECKLIST_ITEMS=[
  {id:"privacy_notice",label:"Privacy notice reviewed",detail:"Customer-facing privacy wording matches the data actually collected and retained."},
  {id:"terms_refunds",label:"Terms, returns and refund policy reviewed",detail:"Commercial terms shown to customers match the intended store process."},
  {id:"measurement_handling",label:"Measurement-data handling reviewed",detail:"Collection, recovery, access and deletion paths for measurement data were checked."},
  {id:"third_party_processing",label:"Third-party processing documented",detail:"External providers used by the live flow are documented with the intended data boundary."},
  {id:"operator_access",label:"Operator access and secret handling reviewed",detail:"Private operator routes, production secrets and recovery credentials were checked before launch."},
  {id:"incident_contact",label:"Customer support / incident contact confirmed",detail:"A real contact path exists for order, privacy or technical issues after launch."},
] as const;

export type LaunchChecklistItemId=typeof LAUNCH_CHECKLIST_ITEMS[number]["id"];
export type LaunchDeviceClass="mobile"|"tablet"|"desktop";

type UnknownRecord=Record<string,unknown>;
function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}

export function normalizeBetaAttempt(input:unknown){
  const source=record(input);
  const caseId=String(source.caseId||"").trim();
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous beta case ID is required.");
  const deviceClass=String(source.deviceClass||"") as LaunchDeviceClass;
  if(!["mobile","tablet","desktop"].includes(deviceClass)) throw new Error("Beta device class is required.");
  if(typeof source.designLocked!=="boolean"||typeof source.shareOrEnquiryCompleted!=="boolean"||typeof source.blockingBug!=="boolean"){
    throw new Error("Design-lock, share/enquiry and blocking-bug results must all be recorded.");
  }
  if(source.shareOrEnquiryCompleted&&!source.designLocked){
    throw new Error("Share/enquiry completion requires a locked design first.");
  }
  const note=String(source.note||"").trim().slice(0,1200);
  if(source.blockingBug&&note.length<3) throw new Error("Blocking beta bugs require a short note.");
  return {
    caseId,
    deviceClass,
    designLocked:source.designLocked,
    shareOrEnquiryCompleted:source.shareOrEnquiryCompleted,
    coreFlowCompleted:source.designLocked&&source.shareOrEnquiryCompleted,
    blockingBug:source.blockingBug,
    note,
  };
}

export function normalizeVerifiedBetaAttempt(input:unknown){
  const source=record(input);
  const caseId=String(source.caseId||"").trim();
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous beta case ID is required.");
  const deviceClass=String(source.deviceClass||"") as LaunchDeviceClass;
  if(!["mobile","tablet","desktop"].includes(deviceClass)) throw new Error("Beta device class is required.");
  const revisionId=String(source.revisionId||"").trim();
  if(revisionId.length<3||revisionId.length>180) throw new Error("Locked revision ID must be 3–180 characters, without truncation.");
  const evidenceKind=String(source.evidenceKind||"share").trim();
  if(!["share","enquiry"].includes(evidenceKind)) throw new Error("Verified beta evidence must be share or enquiry.");
  if(typeof source.blockingBug!=="boolean") throw new Error("Blocking-bug result must be recorded.");
  const note=String(source.note||"").trim().slice(0,1200);
  if(source.blockingBug&&note.length<3) throw new Error("Blocking beta bugs require a short note.");
  return {caseId,deviceClass,revisionId,evidenceKind:evidenceKind as "share"|"enquiry",blockingBug:source.blockingBug,note};
}

export function normalizeLaunchChecklistDecision(input:unknown){
  const source=record(input);
  const known=new Set(LAUNCH_CHECKLIST_ITEMS.map((item)=>item.id));
  const itemId=String(source.itemId||"") as LaunchChecklistItemId;
  if(!known.has(itemId)) throw new Error("Unknown launch checklist item.");
  const status=String(source.status||"");
  if(status!=="approved"&&status!=="review") throw new Error("Checklist status must be approved or review.");
  const signedBy=String(source.signedBy||"").trim();
  if(signedBy.length<2||signedBy.length>120) throw new Error("Named human sign-off (2–120 characters) is required.");
  const note=String(source.note||"").trim().slice(0,1200);
  if(status==="review"&&note.length<3) throw new Error("Review status requires a short note.");
  return {itemId,status,signedBy,note};
}

export type LaunchBetaAttempt={
  case_id:string;
  device_class:string;
  core_flow_completed:boolean;
  design_locked?:boolean;
  share_or_enquiry_completed?:boolean;
  blocking_bug:boolean;
  revision_id?:string|null;
  recipe_hash?:string|null;
  evidence_kind?:string|null;
  share_audit_confirmed?:boolean;
  enquiry_audit_confirmed?:boolean;
  created_at:string;
};

export type LaunchChecklistEvent={
  item_id:string;
  status:string;
  created_at:string;
};

/** Unverifiable, forged or future-dated audit rows must never approve launch. */
function validLaunchRecordedAt(value:unknown):value is string {
  if(typeof value!=="string"||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(value)) return false;
  const at=Date.parse(value);
  return Number.isFinite(at)&&at<=Date.now()+10*60_000;
}

export function summarizeLaunchReadiness(
  betaAttempts:LaunchBetaAttempt[],
  checklistEvents:LaunchChecklistEvent[],
){
  const invalidBetaKeys=new Set<string>();
  const betaSignatureAt=new Map<string,string>();
  for(const row of betaAttempts){
    const key=typeof row?.case_id==="string"?row.case_id.trim().toLowerCase():"";
    if(!key) continue;
    if(!validLaunchRecordedAt(row.created_at)||!/^[a-z0-9._-]{3,80}$/.test(key)){
      invalidBetaKeys.add(key);
      continue;
    }
    const stamp=key+"|"+Date.parse(row.created_at);
    const signature=JSON.stringify([
      row.core_flow_completed,row.design_locked,row.share_or_enquiry_completed,
      row.revision_id,row.blocking_bug,row.share_audit_confirmed,row.enquiry_audit_confirmed,
    ]);
    const previous=betaSignatureAt.get(stamp);
    if(previous!==undefined&&previous!==signature) invalidBetaKeys.add(key);
    else betaSignatureAt.set(stamp,signature);
  }
  const latestBeta=new Map<string,LaunchBetaAttempt>();
  for(const row of [...betaAttempts].filter((item)=>item&&validLaunchRecordedAt(item.created_at))
      .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
    const key=typeof row.case_id==="string"?row.case_id.trim().toLowerCase():"";
    if(key&&!invalidBetaKeys.has(key)&&!latestBeta.has(key)) latestBeta.set(key,row);
  }
  const beta=[...latestBeta.values()];
  const successfulRows=beta.filter((row)=>
    row.core_flow_completed===true
    && row.design_locked===true
    && row.share_or_enquiry_completed===true
    && typeof row.revision_id==="string"&&row.revision_id.trim().length>=3
    && row.revision_id.trim().length<=180
    && (row.share_audit_confirmed===true||row.enquiry_audit_confirmed===true)
    && row.blocking_bug===false
  );
  const uniqueSuccessfulByRevision=new Map<string,LaunchBetaAttempt>();
  for(const row of successfulRows){
    const revisionId=(row.revision_id as string).trim().toLowerCase();
    if(!uniqueSuccessfulByRevision.has(revisionId)) uniqueSuccessfulByRevision.set(revisionId,row);
  }
  const successfulBeta=[...uniqueSuccessfulByRevision.values()];
  const deviceCoverage=new Set(successfulBeta.map((row)=>row.device_class));

  const invalidChecklistIds=new Set<string>();
  const knownChecklistIds=new Set<string>(LAUNCH_CHECKLIST_ITEMS.map((item)=>item.id));
  const checklistStatusAt=new Map<string,string>();
  for(const row of checklistEvents){
    if(!knownChecklistIds.has(row?.item_id)) continue;
    if(!validLaunchRecordedAt(row.created_at)){
      invalidChecklistIds.add(row.item_id);
      continue;
    }
    const stamp=row.item_id+"|"+Date.parse(row.created_at);
    const previous=checklistStatusAt.get(stamp);
    if(previous!==undefined&&previous!==row.status) invalidChecklistIds.add(row.item_id);
    else checklistStatusAt.set(stamp,row.status);
  }
  const latestChecklist=new Map<string,LaunchChecklistEvent>();
  for(const row of [...checklistEvents].filter((item)=>item&&validLaunchRecordedAt(item.created_at))
      .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
    if(knownChecklistIds.has(row.item_id)&&!invalidChecklistIds.has(row.item_id)&&!latestChecklist.has(row.item_id))
      latestChecklist.set(row.item_id,row);
  }
  const checklistApproved=LAUNCH_CHECKLIST_ITEMS.filter((item)=>
    latestChecklist.get(item.id)?.status==="approved").length;
  return {
    betaTarget:LAUNCH_BETA_TARGET,
    uniqueBetaCases:beta.length,
    successfulBetaCases:successfulBeta.length,
    blockingBetaCases:beta.filter((row)=>row.blocking_bug===true).length,
    verifiedShareCases:beta.filter((row)=>row.share_audit_confirmed===true).length,
    verifiedEnquiryCases:beta.filter((row)=>row.enquiry_audit_confirmed===true).length,
    verifiedFlowCases:beta.filter((row)=>row.share_audit_confirmed===true||row.enquiry_audit_confirmed===true).length,
    distinctVerifiedRevisions:successfulBeta.length,
    invalidBetaEvidenceCases:invalidBetaKeys.size,
    invalidChecklistEvidenceItems:invalidChecklistIds.size,
    deviceCoverage:[...deviceCoverage],
    checklistApproved,
    checklistTotal:LAUNCH_CHECKLIST_ITEMS.length,
    betaGateComplete:successfulBeta.length>=LAUNCH_BETA_TARGET,
    checklistGateComplete:checklistApproved===LAUNCH_CHECKLIST_ITEMS.length,
    launchEvidenceComplete:successfulBeta.length>=LAUNCH_BETA_TARGET&&checklistApproved===LAUNCH_CHECKLIST_ITEMS.length,
  };
}
