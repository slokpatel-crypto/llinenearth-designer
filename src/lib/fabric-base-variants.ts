import { normalizeFabricPhysicalEvidenceProvenance } from "./fabric-physical-provenance.ts";
import type { FabricPhysicalEvidenceProvenance } from "./fabric-physical-provenance.ts";
import { colorFamilies } from "./vocab/colors.ts";
import { patternFamilies } from "./vocab/patterns.ts";

/** Pure, lot-scoped candidate resolution. An authenticated external review ledger is required. */
export const FABRIC_BASE_FIELDS=["gsm","widthMm","composition","weave","yarnCount"] as const;
export const FABRIC_VARIANT_FIELDS=["repeatXmm","repeatYmm","grainDirection"] as const;
export type FabricPhysicalField=typeof FABRIC_BASE_FIELDS[number]|typeof FABRIC_VARIANT_FIELDS[number];
export type FabricEvidenceOrigin="measured"|"supplier_declared"|"estimated"|"unknown";
export type FabricClaimValue=number|string|null|{system:string;count:number;resolution:number}|{fiber:string;percent:number}[];
export type FabricVariantIdentity={variantId:string;lotId:string;colorFamily:string;patternFamily:string;photoId:string;photoSha256:string};
export type FabricPhysicalClaim={
  claimId:string;baseId:string;field:FabricPhysicalField;value:FabricClaimValue;origin:FabricEvidenceOrigin;
  resolution?:number;
  scope:{kind:"base";covers:{variantId:string;lotId:string}[]}|{kind:"variant";variantId:string;lotId:string};
  source?:FabricPhysicalEvidenceProvenance;
  calibration?:{photoSha256:string;widthPx:number;heightPx:number;axis:"x"|"y";repeatPx:number;pixelsPerMm:number};
};
export type FabricClaimApproval={claimId:string;snapshot:string;status:"approved"|"rejected"|"pending";reviewedBy:string};
/**
 * Inject only from a trusted server-side review ledger that independently
 * authenticates the reviewer and validates this precise canonical snapshot.
 * Never pass a verifier built from request-body approval data.
 */
export type FabricApprovalVerifier=(approved:Readonly<FabricClaimApproval>)=>boolean;
export type ResolvedFabricClaim={
  value:FabricClaimValue;origin:FabricEvidenceOrigin;
  approval:"approved"|"rejected"|"pending"|"stale"|"missing"|"untrusted";usable:boolean;claimId:string|null;
};
export type FabricVariantResolution={
  identity:FabricVariantIdentity;
  physical:Record<FabricPhysicalField,ResolvedFabricClaim>;
  calibratedAxes:{x:number|null;y:number|null};issues:string[];
};
const fields:readonly string[]=[...FABRIC_BASE_FIELDS,...FABRIC_VARIANT_FIELDS];
const origins=["measured","supplier_declared","estimated","unknown"];
const weaves=["plain","twill","satin","basket","dobby","jacquard","other"];
const grains=["warp","weft","bias"];
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const num=(v:unknown,min:number,max:number):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
const grid=(v:number,step:number)=>Number.isSafeInteger(Math.round(v/step))&&Math.abs(v/step-Math.round(v/step))<1e-7;

function validValue(field:FabricPhysicalField,value:unknown,resolution:unknown):boolean {
  if(["gsm","widthMm","repeatXmm","repeatYmm"].includes(field)){
    const min=field==="gsm"?20:field==="widthMm"?100:0.1;
    const step=field==="gsm"||field==="widthMm"?1:0.1;
    return num(value,min,field==="gsm"?1000:5000)&&num(resolution,step,100)
      &&grid(resolution,step)&&grid(value,resolution);
  }
  if(resolution!==undefined)return false;
  if(field==="weave")return typeof value==="string"&&weaves.includes(value);
  if(field==="grainDirection")return typeof value==="string"&&grains.includes(value);
  if(field==="yarnCount")return obj(value)&&keys(value,["system","count","resolution"])
    &&typeof value.system==="string"&&["lea","ne","tex","denier"].includes(value.system)
    &&num(value.count,1,5000)&&num(value.resolution,0.1,10)
    &&grid(value.resolution,0.1)&&grid(value.count,value.resolution);
  if(!Array.isArray(value)||!value.length||value.length>12)return false;
  const seen=new Set<string>();let sum=0;
  for(const part of value){
    if(!obj(part)||!keys(part,["fiber","percent"])||typeof part.fiber!=="string"
      ||!/^[a-z][a-z -]{0,39}$/.test(part.fiber)||seen.has(part.fiber)
      ||!num(part.percent,0.1,100)||!grid(part.percent,0.1))return false;
    seen.add(part.fiber);sum+=part.percent;
  }
  return Math.abs(sum-100)<1e-7;
}

/** Do not let caller-owned JSON mutate a reviewed nested value after the snapshot check. */
function copyClaimValue(value:FabricClaimValue):FabricClaimValue {
  if(Array.isArray(value))return value.map(part=>Object.freeze({fiber:part.fiber,percent:part.percent}));
  if(value!==null&&typeof value==="object"){
    return Object.freeze({system:value.system,count:value.count,resolution:value.resolution});
  }
  return value;
}

function normalizeClaim(raw:unknown):FabricPhysicalClaim|null {
  if(!obj(raw)||!keys(raw,["claimId","baseId","field","value","origin","resolution","scope","source","calibration"])
    ||!id(raw.claimId)||!id(raw.baseId)||typeof raw.field!=="string"||!fields.includes(raw.field)
    ||typeof raw.origin!=="string"||!origins.includes(raw.origin)||!obj(raw.scope))return null;
  const field=raw.field as FabricPhysicalField,origin=raw.origin as FabricEvidenceOrigin;
  if(!keys(raw.scope,["kind","covers","variantId","lotId"]))return null;
  let scope:FabricPhysicalClaim["scope"];
  if(raw.scope.kind==="base"){
    if(!FABRIC_BASE_FIELDS.includes(field as typeof FABRIC_BASE_FIELDS[number])
      ||!Array.isArray(raw.scope.covers)||!raw.scope.covers.length||raw.scope.covers.length>100
      ||raw.scope.variantId!==undefined||raw.scope.lotId!==undefined)return null;
    const covers:{variantId:string;lotId:string}[]=[];const seen=new Set<string>();
    for(const c of raw.scope.covers){
      if(!obj(c)||!keys(c,["variantId","lotId"])||!id(c.variantId)||!id(c.lotId))return null;
      const k=c.variantId+":"+c.lotId;
      if(seen.has(k))return null;
      seen.add(k);covers.push({variantId:c.variantId,lotId:c.lotId});
    }
    covers.sort((a,b)=>a.variantId.localeCompare(b.variantId)||a.lotId.localeCompare(b.lotId));
    scope={kind:"base",covers};
  }else if(raw.scope.kind==="variant"){
    if(raw.scope.covers!==undefined||!id(raw.scope.variantId)||!id(raw.scope.lotId))return null;
    scope={kind:"variant",variantId:raw.scope.variantId,lotId:raw.scope.lotId};
  }else return null;
  if(origin==="unknown"?(raw.value!==null||raw.resolution!==undefined):!validValue(field,raw.value,raw.resolution))return null;
  const source=raw.source===undefined?undefined:normalizeFabricPhysicalEvidenceProvenance(raw.source);
  if(raw.source!==undefined&&!source)return null;
  if(origin==="measured"&&!["physical_roll","owner_measurement","lab_report"].includes(source?.sourceType??""))return null;
  if(origin==="supplier_declared"&&source?.sourceType!=="supplier_document")return null;
  if((origin==="estimated"||origin==="unknown")&&source!==undefined)return null;
  let calibration:FabricPhysicalClaim["calibration"];
  if(raw.calibration!==undefined){
    const c=raw.calibration;
    if(!["repeatXmm","repeatYmm"].includes(field)||!obj(c)
      ||!keys(c,["photoSha256","widthPx","heightPx","axis","repeatPx","pixelsPerMm"])
      ||!hash(c.photoSha256)||!Number.isSafeInteger(c.widthPx)||!Number.isSafeInteger(c.heightPx)
      ||!num(c.widthPx,400,100000)||!num(c.heightPx,400,100000)
      ||c.axis!==(field==="repeatXmm"?"x":"y")
      ||!num(c.repeatPx,2,c.axis==="x"?c.widthPx:c.heightPx)
      ||!num(c.pixelsPerMm,0.01,10000)
      ||typeof raw.value!=="number"||typeof raw.resolution!=="number"
      ||Math.abs(c.repeatPx/c.pixelsPerMm-raw.value)>raw.resolution/2+1e-9)return null;
    calibration={photoSha256:c.photoSha256,widthPx:c.widthPx,heightPx:c.heightPx,
      axis:c.axis as "x"|"y",repeatPx:c.repeatPx,pixelsPerMm:c.pixelsPerMm};
  }
  return {claimId:raw.claimId,baseId:raw.baseId,field,value:copyClaimValue(raw.value as FabricClaimValue),origin,
    ...(raw.resolution===undefined?{}:{resolution:raw.resolution as number}),
    scope,...(source?{source}:{}),...(calibration?{calibration}:{})};
}
/** Snapshot must be stored separately with an access-controlled approval, not supplier JSON. */
export function snapshotFabricPhysicalClaim(input:unknown):string|null {
  const claim=normalizeClaim(input);
  return claim?JSON.stringify(claim):null;
}
function normalizeVariant(v:unknown):FabricVariantIdentity|null {
  if(!obj(v)||!keys(v,["variantId","lotId","colorFamily","patternFamily","photoId","photoSha256"])
    ||!id(v.variantId)||!id(v.lotId)||!id(v.photoId)||!hash(v.photoSha256)
    ||typeof v.colorFamily!=="string"||!colorFamilies.some(c=>c.id===v.colorFamily)
    ||typeof v.patternFamily!=="string"||!patternFamilies.some(p=>p.id===v.patternFamily))return null;
  return {variantId:v.variantId,lotId:v.lotId,colorFamily:v.colorFamily,
    patternFamily:v.patternFamily,photoId:v.photoId,photoSha256:v.photoSha256};
}
const empty=():ResolvedFabricClaim=>({value:null,origin:"unknown",approval:"missing",usable:false,claimId:null});

/**
 * A source receipt and matching review are traceability gates, NOT cryptographic
 * authentication or proof of a real swatch. Unknown/estimated claims never go live.
 */
export function resolveFabricBaseVariants(input:{baseId:unknown;variants:unknown;claims:unknown;approvals:unknown;
  verifyApproval?:FabricApprovalVerifier}):
  {baseId:string|null;variants:FabricVariantResolution[];issues:string[]} {
  if(!id(input.baseId))return {baseId:null,variants:[],issues:["invalid base fabric identity"]};
  if(!Array.isArray(input.variants)||!Array.isArray(input.claims)||!Array.isArray(input.approvals)
    ||input.variants.length>100||input.claims.length>1000||input.approvals.length>1000)
    return {baseId:input.baseId,variants:[],issues:["invalid or oversized input collection"]};
  const issues:string[]=[];
  const repeated=new Set<string>(),seen=new Set<string>();
  for(const row of input.variants)if(obj(row)&&id(row.variantId)){
    if(seen.has(row.variantId))repeated.add(row.variantId);seen.add(row.variantId);
  }
  const variants:FabricVariantResolution[]=[];
  for(const row of input.variants){
    const identity=normalizeVariant(row);
    if(!identity||repeated.has(identity.variantId)){
      issues.push("invalid or duplicate variant identity");continue;
    }
    variants.push({identity,physical:Object.fromEntries(fields.map(f=>[f,empty()])) as Record<FabricPhysicalField,ResolvedFabricClaim>,
      calibratedAxes:{x:null,y:null},issues:[]});
  }
  // Even a malformed or foreign-base claimant must not be able to shadow an
  // approved ID and then disappear during validation. Reject every duplicate.
  const seenClaimIds=new Set<string>(),duplicateClaimIds=new Set<string>();
  for(const raw of input.claims)if(obj(raw)&&id(raw.claimId)){
    if(seenClaimIds.has(raw.claimId))duplicateClaimIds.add(raw.claimId);
    seenClaimIds.add(raw.claimId);
  }
  const byId=new Map<string,FabricPhysicalClaim[]>();
  for(const raw of input.claims){
    const c=normalizeClaim(raw);
    if(!c||c.baseId!==input.baseId){issues.push("invalid or foreign-base physical claim rejected");continue;}
    byId.set(c.claimId,[...(byId.get(c.claimId)??[]),c]);
  }
  const reviews=new Map<string,unknown[]>();
  for(const a of input.approvals){
    if(!obj(a)||!id(a.claimId)){issues.push("invalid approval identity");continue;}
    reviews.set(a.claimId,[...(reviews.get(a.claimId)??[]),a]);
  }
  const claims=[...byId.values()].flat();
  for(const variant of variants)for(const field of fields as FabricPhysicalField[]){
    const applicable=claims.filter(c=>c.field===field&&(c.scope.kind==="base"
      ?c.scope.covers.some(k=>k.variantId===variant.identity.variantId&&k.lotId===variant.identity.lotId)
      :c.scope.variantId===variant.identity.variantId&&c.scope.lotId===variant.identity.lotId));
    const own=applicable.filter(c=>c.scope.kind==="variant");
    const base=applicable.filter(c=>c.scope.kind==="base");
    if(own.length>1||base.length>1){variant.issues.push(field+": ambiguous competing claims");continue;}
    const c=own[0]??base[0];
    if(!c)continue;
    if(duplicateClaimIds.has(c.claimId)||byId.get(c.claimId)?.length!==1){
      variant.issues.push(field+": duplicate claim ID");continue;
    }
    const rows=reviews.get(c.claimId)??[],row=rows[0];
    let approval:ResolvedFabricClaim["approval"]="missing";
    if(rows.length>1)approval="stale";
    else if(obj(row)&&keys(row,["claimId","snapshot","status","reviewedBy"])
      &&typeof row.reviewedBy==="string"&&row.reviewedBy.trim()===row.reviewedBy
      &&row.reviewedBy.length>=2&&row.reviewedBy.length<=120
      &&row.snapshot===snapshotFabricPhysicalClaim(c)
      &&["approved","pending","rejected"].includes(row.status as string))
      approval=row.status as ResolvedFabricClaim["approval"];
    else if(rows.length)approval="stale";
    // A correct-looking JSON approval is not independent authorization.
    // No injected trusted verifier => fail closed, even for exact snapshots.
    // The verifier must independently consult an authenticated review ledger.
    if(approval==="approved" && obj(row)){
      let authenticated=false;
      if(typeof input.verifyApproval==="function"){
        try{
          const review=Object.freeze({
            claimId:c.claimId,
            snapshot:row.snapshot as string,
            status:"approved" as const,
            reviewedBy:row.reviewedBy as string,
          });
          authenticated=input.verifyApproval(review)===true;
        }catch{
          authenticated=false;
        }
      }
      if(!authenticated){
        approval="untrusted";
        variant.issues.push(field+": no independently authenticated reviewer approval");
      }
    }
    const mismatch=!!c.calibration&&c.calibration.photoSha256!==variant.identity.photoSha256;
    if(mismatch)variant.issues.push(field+": incompatible photo calibration");
    const conflict=own.length===1&&base.length===1
      &&JSON.stringify(own[0].value)!==JSON.stringify(base[0].value);
    if(conflict)variant.issues.push(field+": conflicting base and lot facts require adjudication");
    const usable=approval==="approved"&&(c.origin==="measured"||c.origin==="supplier_declared")
      &&!mismatch&&!conflict;
    if(!usable&&c.origin!=="unknown")variant.issues.push(field+": unapproved or disputed physical evidence");
    variant.physical[field]={value:usable?c.value:null,origin:c.origin,approval,usable,claimId:c.claimId};
    if(usable&&c.calibration)variant.calibratedAxes[c.calibration.axis]=c.calibration.pixelsPerMm;
  }
  // Return detached, immutable approval projections rather than mutable aliases.
  // This is a defense against accidental post-review mutation, not authentication.
  for(const variant of variants){
    for(const field of fields as FabricPhysicalField[]){
      const value=variant.physical[field].value;
      if(Array.isArray(value))Object.freeze(value);
      Object.freeze(variant.physical[field]);
    }
    Object.freeze(variant.identity);
    Object.freeze(variant.physical);
    Object.freeze(variant.calibratedAxes);
    Object.freeze(variant.issues);
    Object.freeze(variant);
  }
  Object.freeze(variants);
  Object.freeze(issues);
  return {baseId:input.baseId,variants,issues};
}
