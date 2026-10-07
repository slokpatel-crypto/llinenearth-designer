import {
  REQUIRED_GARMENT_VIEWER_MATERIALS,
  validateGarmentViewerModelContract,
} from "./garment-viewer-model-contract.ts";
import { garmentViewerStyleMaterialCoverage } from "./garment-viewer-style-materials.ts";

type GlbMaterial={
  name?:string;
  pbrMetallicRoughness?:{baseColorTexture?:{index?:number}};
  normalTexture?:{index?:number};
};
type GlbPrimitive={
  material?:number;
  indices?:number;
  mode?:number;
  attributes?:Record<string,number>;
};
type GlbMesh={name?:string;primitives?:GlbPrimitive[]};
type GlbNode={mesh?:number};
type GlbImage={uri?:string};
type GlbBuffer={uri?:string};
type GlbAccessor={count?:number;type?:string};
type GlbJson={
  asset?:{version?:string;generator?:string};
  materials?:GlbMaterial[];
  meshes?:GlbMesh[];
  nodes?:GlbNode[];
  images?:GlbImage[];
  buffers?:GlbBuffer[];
  accessors?:GlbAccessor[];
};

export type GarmentViewerGlbPanelInspection={
  material:string;
  primitiveCount:number;
  position:boolean;
  normal:boolean;
  uv0:boolean;
  baseColorTexture:boolean;
  normalTexture:boolean;
};

export type GarmentViewerGlbInspection={
  modelId:string;
  gltfVersion:string|null;
  generator:string|null;
  materialNames:string[];
  contract:ReturnType<typeof validateGarmentViewerModelContract>;
  styleVariantCoverage:ReturnType<typeof garmentViewerStyleMaterialCoverage>;
  panels:GarmentViewerGlbPanelInspection[];
  uvReady:boolean;
  textureSlotsReady:boolean;
  selfContained:boolean;
  remoteUris:string[];
  structuralReady:boolean;
  fileBytes:number;
  triangleCount:number;
  vertexCount:number;
  performanceBudgetReady:boolean;
  performanceWarnings:string[];
  reasons:string[];
};

const GLB_MAGIC=0x46546c67;
const JSON_CHUNK=0x4e4f534a;
export const GARMENT_VIEWER_ADVISORY_MAX_GLB_BYTES=24*1024*1024;
export const GARMENT_VIEWER_ADVISORY_MAX_TRIANGLES=220_000;
export const GARMENT_VIEWER_ADVISORY_MAX_VERTICES=280_000;

export function parseGarmentViewerGlbJson(bytes:Uint8Array):GlbJson {
  if(bytes.byteLength<20) throw new Error("GLB is too small.");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==GLB_MAGIC) throw new Error("File is not a GLB.");
  if(view.getUint32(4,true)!==2) throw new Error("Only GLB 2.0 is supported.");
  const declaredLength=view.getUint32(8,true);
  if(declaredLength!==bytes.byteLength) throw new Error("GLB declared length does not match file size.");
  const jsonLength=view.getUint32(12,true);
  if(view.getUint32(16,true)!==JSON_CHUNK) throw new Error("GLB first chunk must be JSON.");
  if(jsonLength<=0||20+jsonLength>bytes.byteLength) throw new Error("GLB JSON chunk is invalid.");
  const text=new TextDecoder().decode(bytes.slice(20,20+jsonLength)).trim();
  let parsed:unknown;
  try{parsed=JSON.parse(text);}catch{throw new Error("GLB JSON chunk cannot be parsed.");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) throw new Error("GLB JSON root must be an object.");
  return parsed as GlbJson;
}

export function externalGlbUri(uri:string|undefined){
  const value=String(uri||"").trim();
  if(!value || /^data:/i.test(value)) return null;
  return value;
}

function accessorCount(gltf:GlbJson,index:unknown){
  const value=Number(index);
  if(!Number.isInteger(value)||value<0) return 0;
  const count=Number(gltf.accessors?.[value]?.count);
  return Number.isFinite(count)&&count>0?count:0;
}

function primitiveTriangleCount(gltf:GlbJson,primitive:GlbPrimitive){
  const elementCount=primitive.indices!==undefined
    ? accessorCount(gltf,primitive.indices)
    : accessorCount(gltf,primitive.attributes?.POSITION);
  const mode=Number(primitive.mode ?? 4);
  if(mode===4) return Math.floor(elementCount/3);
  if(mode===5||mode===6) return Math.max(0,elementCount-2);
  return 0;
}

export function inspectGarmentViewerGlb(bytes:Uint8Array,modelId:string):GarmentViewerGlbInspection {
  const gltf=parseGarmentViewerGlbJson(bytes);
  const materialNames=(gltf.materials||[]).map((material)=>String(material.name||"").trim());
  let triangleCount=0;
  let vertexCount=0;
  const contract=validateGarmentViewerModelContract({modelId,materialNames});
  const styleVariantCoverage=garmentViewerStyleMaterialCoverage(materialNames);
  const panelUse=new Map<string,GlbPrimitive[]>();
  for(const name of REQUIRED_GARMENT_VIEWER_MATERIALS) panelUse.set(name,[]);

  for(const mesh of gltf.meshes||[]){
    for(const primitive of mesh.primitives||[]){
      const index=Number(primitive.material);
      if(!Number.isInteger(index)||index<0||index>=materialNames.length) continue;
      const name=materialNames[index];
      if(panelUse.has(name)) panelUse.get(name)!.push(primitive);
    }
  }

  const meshMetrics=(gltf.meshes||[]).map((mesh)=>({
    triangles:(mesh.primitives||[]).reduce((sum,primitive)=>sum+primitiveTriangleCount(gltf,primitive),0),
    vertices:(mesh.primitives||[]).reduce((sum,primitive)=>sum+accessorCount(gltf,primitive.attributes?.POSITION),0),
  }));
  const meshInstances=(gltf.nodes||[]).flatMap((node)=>{
    const index=Number(node.mesh);
    return Number.isInteger(index)&&index>=0&&index<meshMetrics.length?[index]:[];
  });
  const countedMeshes=meshInstances.length?meshInstances:meshMetrics.map((_,index)=>index);
  triangleCount=countedMeshes.reduce((sum,index)=>sum+(meshMetrics[index]?.triangles||0),0);
  vertexCount=countedMeshes.reduce((sum,index)=>sum+(meshMetrics[index]?.vertices||0),0);

  const panels=REQUIRED_GARMENT_VIEWER_MATERIALS.map((material)=>{
    const primitives=panelUse.get(material)||[];
    const materialIndex=materialNames.findIndex((name)=>name===material);
    const glbMaterial=materialIndex>=0?gltf.materials?.[materialIndex]:undefined;
    return {
      material,
      primitiveCount:primitives.length,
      position:primitives.length>0&&primitives.every((primitive)=>Number.isInteger(primitive.attributes?.POSITION)),
      normal:primitives.length>0&&primitives.every((primitive)=>Number.isInteger(primitive.attributes?.NORMAL)),
      uv0:primitives.length>0&&primitives.every((primitive)=>Number.isInteger(primitive.attributes?.TEXCOORD_0)),
      baseColorTexture:Number.isInteger(glbMaterial?.pbrMetallicRoughness?.baseColorTexture?.index),
      normalTexture:Number.isInteger(glbMaterial?.normalTexture?.index),
    };
  });

  const remoteUris=[
    ...(gltf.images||[]).map((item)=>externalGlbUri(item.uri)),
    ...(gltf.buffers||[]).map((item)=>externalGlbUri(item.uri)),
  ].filter((value):value is string=>Boolean(value));
  const uvReady=panels.every((panel)=>panel.primitiveCount>0&&panel.position&&panel.normal&&panel.uv0);
  const textureSlotsReady=panels.every((panel)=>panel.baseColorTexture&&panel.normalTexture);
  const selfContained=remoteUris.length===0;
  const performanceWarnings:string[]=[];
  if(bytes.byteLength>GARMENT_VIEWER_ADVISORY_MAX_GLB_BYTES) performanceWarnings.push(`GLB is ${Math.round(bytes.byteLength/1024/1024*10)/10} MB; advisory mobile budget is 24 MB.`);
  if(triangleCount>GARMENT_VIEWER_ADVISORY_MAX_TRIANGLES) performanceWarnings.push(`GLB has ${triangleCount.toLocaleString()} triangles; advisory mobile budget is 220,000.`);
  if(vertexCount>GARMENT_VIEWER_ADVISORY_MAX_VERTICES) performanceWarnings.push(`GLB has ${vertexCount.toLocaleString()} rendered vertices; advisory mobile budget is 280,000.`);
  const performanceBudgetReady=performanceWarnings.length===0;
  const reasons=[...contract.reasons];
  for(const panel of panels){
    if(panel.primitiveCount===0) reasons.push(`${panel.material} is not assigned to any mesh primitive.`);
    else {
      if(!panel.position) reasons.push(`${panel.material} primitive is missing POSITION.`);
      if(!panel.normal) reasons.push(`${panel.material} primitive is missing NORMAL.`);
      if(!panel.uv0) reasons.push(`${panel.material} primitive is missing TEXCOORD_0.`);
      if(!panel.baseColorTexture) reasons.push(`${panel.material} is missing a replaceable base-color texture slot.`);
      if(!panel.normalTexture) reasons.push(`${panel.material} is missing a replaceable normal texture slot.`);
    }
  }
  if(!selfContained) reasons.push("Production GLB must be self-contained; external image or buffer URIs are not allowed.");

  return {
    modelId,
    gltfVersion:gltf.asset?.version?String(gltf.asset.version):null,
    generator:gltf.asset?.generator?String(gltf.asset.generator):null,
    materialNames,
    contract,
    styleVariantCoverage,
    panels,
    uvReady,
    textureSlotsReady,
    selfContained,
    remoteUris,
    structuralReady:contract.readiness==="contract_ready"&&uvReady&&textureSlotsReady&&selfContained,
    fileBytes:bytes.byteLength,
    triangleCount,
    vertexCount,
    performanceBudgetReady,
    performanceWarnings,
    reasons:[...new Set(reasons)],
  };
}
