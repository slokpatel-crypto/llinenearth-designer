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
  checkedBy?:unknown;
  evidenceReference?:unknown;
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
  checkedBy:string;
  evidenceReference:string;
  note:string;
};

function text(value:unknown,limit:number){
  return typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
}
function literalText(value:unknown,limit:number,label:string){
  if(value===undefined||value===null) return "";
  if(typeof value!=="string") throw new Error(label+" must be literal text.");
  const normalized=value.replace(/\s+/g," ").trim();
  if(normalized.length>limit) throw new Error(label+" is too long; physical evidence must not be truncated.");
  return normalized;
}

function hex(value:unknown){
  const raw=literalText(value,16,"Colour hex").toUpperCase();
  const normalized=raw.startsWith("#")?raw:`#${raw}`;
  return /^#[0-9A-F]{6}$/.test(normalized)?normalized:null;
}

function lab(value:unknown):LabColor|null{
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const item=value as Record<string,unknown>;
  const l=item.l,a=item.a,b=item.b;
  if(typeof l!=="number"||typeof a!=="number"||typeof b!=="number"||
     !Number.isFinite(l)||!Number.isFinite(a)||!Number.isFinite(b)) return null;
  if(l<0||l>100||a<-160||a>160||b<-160||b>160) return null;
  return {l,a,b};
}

export function normalizeFabricPhysicalColorCheck(input:FabricPhysicalColorCheckDraft):FabricPhysicalColorCheck{
  const fabricId=literalText(input.fabricId,160,"Stock fabric ID");
  if(fabricId.length<2) throw new Error("A stock fabric ID is required.");

  const digitalHex=hex(input.digitalHex);
  if(!digitalHex) throw new Error("A valid digital fabric hex value is required.");
  const digitalLab=srgbHexToLab(digitalHex);
  if(!digitalLab) throw new Error("Digital colour could not be converted to LAB.");

  const method=literalText(input.method,40,"Physical colour-check method") as FabricColorCheckMethod;
  if(!["spectrophotometer","colorimeter","calibrated_capture"].includes(method)) {
    throw new Error("A controlled physical colour-check method is required.");
  }

  const physicalHex=hex(input.physicalHex);
  const suppliedLab=input.physicalLab!==undefined&&input.physicalLab!==null;
  const measuredLab=lab(input.physicalLab);
  if(suppliedLab&&!measuredLab) throw new Error("Supplied physical LAB values must be literal finite measurements.");
  const physicalLab=measuredLab||(physicalHex?srgbHexToLab(physicalHex):null);
  if(!physicalLab) throw new Error("Physical LAB values or a calibrated physical hex measurement are required.");

  const illuminant=literalText(input.illuminant,80,"Illuminant");
  const device=literalText(input.device,160,"Instrument/device");
  const checkedBy=literalText(input.checkedBy,120,"Named checker");
  const evidenceReference=literalText(input.evidenceReference,240,"Physical colour evidence reference");
  const note=literalText(input.note,800,"Physical colour note");
  if(illuminant.length<2) throw new Error("Controlled illuminant / lighting condition is required.");
  if(method!=="calibrated_capture"&&!device) {
    throw new Error("Instrument/device identity is required for instrument colour checks.");
  }
  if(method==="calibrated_capture"&&!note) {
    throw new Error("Calibrated-capture checks require a short setup/evidence note.");
  }
  if(checkedBy.length<2) throw new Error("Named checker is required for physical colour evidence.");
  if(evidenceReference.length<3) throw new Error("Physical colour evidence reference is required.");

  return {
    fabricId,
    profileId:literalText(input.profileId,100,"Reviewed Analyzer profile ID")||null,
    digitalHex,
    method,
    physicalLab,
    physicalHex,
    deltaE:Math.round(deltaE2000(digitalLab,physicalLab)*100)/100,
    illuminant,
    device,
    checkedBy,
    evidenceReference,
    note,
  };
}

export function summarizeFabricPhysicalColorChecks(
  rows:Array<{fabric_id?:unknown;delta_e?:unknown;checked_by?:unknown;evidence_reference?:unknown;illuminant?:unknown}>,
  target=10,
){
  const latest=new Map<string,number>();
  let legacyUnverified=0;
  for(const row of rows){
    const fabricId=text(row.fabric_id,160);
    const deltaE=typeof row.delta_e==="number"&&Number.isFinite(row.delta_e)?row.delta_e:null;
    if(!fabricId||deltaE===null||deltaE<0) continue;
    const provenanceReady=text(row.checked_by,120).length>=2
      && text(row.evidence_reference,240).length>=3
      && text(row.illuminant,80).length>=2;
    if(!provenanceReady){legacyUnverified+=1;continue;}
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
    legacyUnverified,
    averageDeltaE:average===null?null:Math.round(average*100)/100,
    medianDeltaE:median===null?null:Math.round(median*100)/100,
  };
}
