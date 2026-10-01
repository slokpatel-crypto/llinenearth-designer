import { deltaE2000, srgbHexToLab, type LabColor } from "./vocab/color-distance.ts";

export type FabricColorCheckMethod="spectrophotometer"|"colorimeter"|"calibrated_capture";

export type FabricPhysicalColorCheckDraft={
  fabricId:unknown;
  profileId?:unknown;
  digitalHex:unknown;
  method:unknown;
  physicalLab?:unknown;
  physicalHex?:unknown;
  illuminant?:unknown;
  device?:unknown;
  note?:unknown;
};

export type FabricPhysicalColorCheck={
  fabricId:string;
  profileId:string|null;
  digitalHex:string;
  method:FabricColorCheckMethod;
  physicalLab:LabColor;
  physicalHex:string|null;
  deltaE:number;
  illuminant:string;
  device:string;
  note:string;
};

function text(value:unknown,limit:number){
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}

function hex(value:unknown){
  const raw=text(value,16).toUpperCase();
  const normalized=raw.startsWith("#")?raw:`#${raw}`;
  return /^#[0-9A-F]{6}$/.test(normalized)?normalized:null;
}

function lab(value:unknown):LabColor|null{
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const item=value as Record<string,unknown>;
  const l=Number(item.l),a=Number(item.a),b=Number(item.b);
  if(!Number.isFinite(l)||!Number.isFinite(a)||!Number.isFinite(b)) return null;
  if(l<0||l>100||a<-160||a>160||b<-160||b>160) return null;
  return {l,a,b};
}

export function normalizeFabricPhysicalColorCheck(input:FabricPhysicalColorCheckDraft):FabricPhysicalColorCheck{
  const fabricId=text(input.fabricId,160);
  if(fabricId.length<2) throw new Error("A stock fabric ID is required.");

  const digitalHex=hex(input.digitalHex);
  if(!digitalHex) throw new Error("A valid digital fabric hex value is required.");
  const digitalLab=srgbHexToLab(digitalHex);
  if(!digitalLab) throw new Error("Digital colour could not be converted to LAB.");

  const method=text(input.method,40) as FabricColorCheckMethod;
  if(!["spectrophotometer","colorimeter","calibrated_capture"].includes(method)) {
    throw new Error("A controlled physical colour-check method is required.");
  }

  const physicalHex=hex(input.physicalHex);
  const physicalLab=lab(input.physicalLab)||(physicalHex?srgbHexToLab(physicalHex):null);
  if(!physicalLab) throw new Error("Physical LAB values or a calibrated physical hex measurement are required.");

  const illuminant=text(input.illuminant,80);
  const device=text(input.device,160);
  const note=text(input.note,800);
  if(method!=="calibrated_capture"&&!device) {
    throw new Error("Instrument/device identity is required for instrument colour checks.");
  }
  if(method==="calibrated_capture"&&!note) {
    throw new Error("Calibrated-capture checks require a short setup/evidence note.");
  }

  return {
    fabricId,
    profileId:text(input.profileId,100)||null,
    digitalHex,
    method,
    physicalLab,
    physicalHex,
    deltaE:Math.round(deltaE2000(digitalLab,physicalLab)*100)/100,
    illuminant,
    device,
    note,
  };
}

export function summarizeFabricPhysicalColorChecks(
  rows:Array<{fabric_id?:unknown;delta_e?:unknown}>,
  target=10,
){
  const latest=new Map<string,number>();
  for(const row of rows){
    const fabricId=text(row.fabric_id,160);
    const deltaE=Number(row.delta_e);
    if(!fabricId||!Number.isFinite(deltaE)||deltaE<0) continue;
    if(!latest.has(fabricId)) latest.set(fabricId,deltaE);
  }
  const values=[...latest.values()].sort((a,b)=>a-b);
  const average=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const median=values.length
    ? values.length%2 ? values[(values.length-1)/2] : (values[values.length/2-1]+values[values.length/2])/2
    : null;
  const safeTarget=Math.max(1,Math.round(target));
  return {
    target:safeTarget,
    uniqueFabrics:values.length,
    remaining:Math.max(0,safeTarget-values.length),
    evidenceGateComplete:values.length>=safeTarget,
    averageDeltaE:average===null?null:Math.round(average*100)/100,
    medianDeltaE:median===null?null:Math.round(median*100)/100,
  };
}
