export const DEVICE_QA_EVIDENCE_VERSION="designer-device-qa-v2";
export const DEVICE_QA_MIN_SAMPLES=12;
export const DEVICE_QA_TARGET_P95_MS=100;
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

function round(value:number){return Math.round(value*10)/10;}

export function classifyDeviceQaViewport(width:number):DeviceQaClass|null {
  if(!Number.isFinite(width)||width<=0) return null;
  return width<=720?"mobile":width<=1100?"tablet":"desktop";
}

export function parseDeviceQaViewport(value:unknown){
  const viewport=String(value||"").trim();
  const match=viewport.match(/^(\d{2,5})x(\d{2,5})$/);
  if(!match) return {viewport,width:null,height:null,deviceClass:null as DeviceQaClass|null};
  const width=Number(match[1]),height=Number(match[2]);
  if(width<240||width>10000||height<240||height>10000){
    return {viewport,width:null,height:null,deviceClass:null as DeviceQaClass|null};
  }
  return {viewport,width,height,deviceClass:classifyDeviceQaViewport(width)};
}

export function summarizeDeviceQaDurations(values:unknown){
  const durations=Array.isArray(values)
    ? values.map(Number).filter((value)=>Number.isFinite(value)&&value>=0&&value<=10000).slice(-120).sort((a,b)=>a-b)
    : [];
  if(!durations.length) return {samples:0,p95Ms:null as number|null};
  const index=Math.min(durations.length-1,Math.floor((durations.length-1)*.95));
  return {samples:durations.length,p95Ms:round(durations[index])};
}

export function evaluateDeviceQaEvidence(payload:Record<string,unknown>):DeviceQaEvaluation {
  const versionValid=String(payload.version||"")===DEVICE_QA_EVIDENCE_VERSION;
  const requestedClass=String(payload.deviceClass||"");
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
