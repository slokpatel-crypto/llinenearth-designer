import { PREVIEW_PERFORMANCE_TARGET_MS } from "./preview-performance-client.ts";

export const DEVICE_QA_EVIDENCE_VERSION="designer-device-qa-v2";
export const DEVICE_QA_MIN_SAMPLES=12;
export const DEVICE_QA_TARGET_P95_MS=PREVIEW_PERFORMANCE_TARGET_MS;
export const DEVICE_QA_CHECK_KEYS=[
  "fourViews",
  "controlsLegible",
  "noOverflow",
  "fabricReadable",
  "modelStable",
] as const;

export type DeviceQaClass="mobile"|"tablet"|"desktop";
export type DeviceQaEvaluation={
  versionValid:boolean;
  viewportValid:boolean;
  deviceClassValid:boolean;
  samples:number;
  p95Ms:number|null;
  performancePass:boolean;
  visualPass:boolean;
  accepted:boolean;
  deviceClass:DeviceQaClass|null;
  viewport:string;
  checks:Record<(typeof DEVICE_QA_CHECK_KEYS)[number],boolean>;
};

export type DeviceQaEvidenceReceipt={
  subtype:"designer_device_qa";
  version:typeof DEVICE_QA_EVIDENCE_VERSION;
  deviceClass:DeviceQaClass;
  status:"accepted"|"review";
  viewport:string;
  dpr:number;
  samples:number;
  sampleDurationsMs:number[];
  medianMs:number|null;
  p95Ms:number|null;
  maxMs:number|null;
  withinTarget:boolean|null;
  hardwareConcurrency:number;
  userAgent:string;
  checks:DeviceQaEvaluation["checks"];
  note:string;
};

function round(value:number){return Math.round(value*10)/10;}

export function classifyDeviceQaViewport(width:number):DeviceQaClass|null {
  if(!Number.isFinite(width)||width<=0) return null;
  return width<=720?"mobile":width<=1100?"tablet":"desktop";
}

export function parseDeviceQaViewport(value:unknown){
  const viewport=typeof value==="string"?value.trim():"";
  const match=viewport.match(/^(\d{2,5})x(\d{2,5})$/);
  if(!match) return {viewport,width:null,height:null,deviceClass:null as DeviceQaClass|null};
  const width=Number(match[1]),height=Number(match[2]);
  if(width<240||width>10000||height<240||height>10000){
    return {viewport,width:null,height:null,deviceClass:null as DeviceQaClass|null};
  }
  return {viewport,width,height,deviceClass:classifyDeviceQaViewport(width)};
}

export function summarizeDeviceQaDurations(values:unknown){
  // Reject the entire receipt: dropping invalid samples could turn a failing
  // physical-device session into an apparent 12-sample performance pass.
  if(!Array.isArray(values)||values.length>120||values.some((value)=>
    typeof value!=="number"||!Number.isFinite(value)||value<0||value>10000
  )) return {samples:0,p95Ms:null as number|null};
  const durations=[...values].sort((a,b)=>a-b);
  if(!durations.length) return {samples:0,p95Ms:null as number|null};
  const index=Math.min(durations.length-1,Math.floor((durations.length-1)*.95));
  return {samples:durations.length,p95Ms:round(durations[index])};
}

export function evaluateDeviceQaEvidence(payload:Record<string,unknown>):DeviceQaEvaluation {
  const versionValid=payload.version===DEVICE_QA_EVIDENCE_VERSION;
  const requestedClass=typeof payload.deviceClass==="string"?payload.deviceClass:"";
  const parsed=parseDeviceQaViewport(payload.viewport);
  const deviceClassValid=Boolean(parsed.deviceClass&&parsed.deviceClass===requestedClass);
  const performance=summarizeDeviceQaDurations(payload.sampleDurationsMs);
  const performancePass=
    performance.samples>=DEVICE_QA_MIN_SAMPLES&&
    performance.p95Ms!==null&&
    performance.p95Ms<DEVICE_QA_TARGET_P95_MS;

  const sourceChecks=payload.checks&&typeof payload.checks==="object"&&!Array.isArray(payload.checks)
    ? payload.checks as Record<string,unknown>
    : {};
  const checks=Object.fromEntries(
    DEVICE_QA_CHECK_KEYS.map((key)=>[key,sourceChecks[key]===true]),
  ) as DeviceQaEvaluation["checks"];
  const visualPass=DEVICE_QA_CHECK_KEYS.every((key)=>checks[key]);

  const accepted=Boolean(versionValid&&parsed.deviceClass&&deviceClassValid&&performancePass&&visualPass);
  return {
    versionValid,
    viewportValid:Boolean(parsed.deviceClass),
    deviceClassValid,
    samples:performance.samples,
    p95Ms:performance.p95Ms,
    performancePass,
    visualPass,
    accepted,
    deviceClass:parsed.deviceClass,
    viewport:parsed.viewport,
    checks,
  };
}

function exactSummary(values:number[]){
  if(!values.length) return {medianMs:null,p95Ms:null,maxMs:null,withinTarget:null};
  const sorted=[...values].sort((a,b)=>a-b);
  const at=(fraction:number)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*fraction))];
  const p95Ms=round(at(.95));
  return {
    medianMs:round(at(.5)),
    p95Ms,
    maxMs:round(sorted.at(-1)!),
    withinTarget:p95Ms<DEVICE_QA_TARGET_P95_MS,
  };
}

/** Canonicalize a complete device receipt without coercing or truncating any
 * audit field. Client summaries must exactly match the raw samples so a valid
 * acceptance cannot be stored beside contradictory forensic metadata.
 */
export function normalizeDeviceQaEvidenceReceipt(payload:Record<string,unknown>):DeviceQaEvidenceReceipt|null{
  if(payload.subtype!=="designer_device_qa" || payload.version!==DEVICE_QA_EVIDENCE_VERSION) return null;
  if(payload.deviceClass!=="mobile"&&payload.deviceClass!=="tablet"&&payload.deviceClass!=="desktop") return null;
  if(payload.status!=="accepted"&&payload.status!=="review") return null;
  const parsed=parseDeviceQaViewport(payload.viewport);
  if(!parsed.deviceClass||parsed.deviceClass!==payload.deviceClass) return null;
  if(!Array.isArray(payload.sampleDurationsMs)||payload.sampleDurationsMs.length>120||payload.sampleDurationsMs.some((value)=>
    typeof value!=="number"||!Number.isFinite(value)||value<0||value>10000
  )) return null;
  const sampleDurationsMs=payload.sampleDurationsMs.map(round);
  if(typeof payload.samples!=="number"||!Number.isSafeInteger(payload.samples)||payload.samples!==sampleDurationsMs.length) return null;
  const summary=exactSummary(sampleDurationsMs);
  for(const key of ["medianMs","p95Ms","maxMs"] as const){
    if(payload[key]!==summary[key]) return null;
  }
  if(payload.withinTarget!==summary.withinTarget) return null;
  if(typeof payload.dpr!=="number"||!Number.isFinite(payload.dpr)||payload.dpr<.5||payload.dpr>8) return null;
  if(typeof payload.hardwareConcurrency!=="number"||!Number.isSafeInteger(payload.hardwareConcurrency)||payload.hardwareConcurrency<0||payload.hardwareConcurrency>256) return null;
  if(typeof payload.userAgent!=="string"||!payload.userAgent.trim()||payload.userAgent.trim().length>1000) return null;
  if(payload.note!==undefined&&(typeof payload.note!=="string"||payload.note.trim().length>600)) return null;
  const evaluation=evaluateDeviceQaEvidence({...payload,sampleDurationsMs});
  if(payload.status==="accepted"&&!evaluation.accepted) return null;
  return {
    subtype:"designer_device_qa",version:DEVICE_QA_EVIDENCE_VERSION,
    deviceClass:payload.deviceClass,status:payload.status,viewport:parsed.viewport,
    dpr:payload.dpr,samples:sampleDurationsMs.length,sampleDurationsMs,...summary,
    hardwareConcurrency:payload.hardwareConcurrency,userAgent:payload.userAgent.trim(),
    checks:evaluation.checks,note:typeof payload.note==="string"?payload.note.trim():"",
  };
}
