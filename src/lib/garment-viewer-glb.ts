import {
  REQUIRED_GARMENT_VIEWER_MATERIALS,
  validateGarmentViewerModelContract,
} from "./garment-viewer-model-contract.ts";

type GlbMaterial={name?:string};
type GlbPrimitive={
  material?:number;
  attributes?:Record<string,number>;
};
type GlbMesh={name?:string;primitives?:GlbPrimitive[]};
type GlbImage={uri?:string};
type GlbBuffer={uri?:string};
type GlbJson={
  asset?:{version?:string;generator?:string};
  materials?:GlbMaterial[];
  meshes?:GlbMesh[];
  images?:GlbImage[];
  buffers?:GlbBuffer[];
};

export type GarmentViewerGlbPanelInspection={
  material:string;
  primitiveCount:number;
  position:boolean;
  normal:boolean;
  uv0:boolean;
};

export type GarmentViewerGlbInspection={
  modelId:string;
  gltfVersion:string|null;
  generator:string|null;
  materialNames:string[];
  contract:ReturnType<typeof validateGarmentViewerModelContract>;
  panels:GarmentViewerGlbPanelInspection[];
  uvReady:boolean;
  selfContained:boolean;
  remoteUris:string[];
  structuralReady:boolean;
  reasons:string[];
};

const GLB_MAGIC=0x46546c67;
const JSON_CHUNK=0x4e4f534a;

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

export function inspectGarmentViewerGlb(bytes:Uint8Array,modelId:string):GarmentViewerGlbInspection {
  const gltf=parseGarmentViewerGlbJson(bytes);
  const materialNames=(gltf.materials||[]).map((material)=>String(material.name||"").trim());
  const contract=validateGarmentViewerModelContract({modelId,materialNames});
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

  const panels=REQUIRED_GARMENT_VIEWER_MATERIALS.map((material)=>{
    const primitives=panelUse.get(material)||[];
    return {
      material,
      primitiveCount:primitives.length,
      position:primitives.length>0&&primitives.every((primitive)=>Number.isInteger(primitive.attributes?.POSITION)),
      normal:primitives.length>0&&primitives.every((primitive)=>Number.isInteger(primitive.attributes?.NORMAL)),
      uv0:primitives.length>0&&primitives.every((primitive)=>Number.isInteger(primitive.attributes?.TEXCOORD_0)),
    };
  });

  const remoteUris=[
    ...(gltf.images||[]).map((item)=>externalGlbUri(item.uri)),
    ...(gltf.buffers||[]).map((item)=>externalGlbUri(item.uri)),
  ].filter((value):value is string=>Boolean(value));
  const uvReady=panels.every((panel)=>panel.primitiveCount>0&&panel.position&&panel.normal&&panel.uv0);
  const selfContained=remoteUris.length===0;
  const reasons=[...contract.reasons];
  for(const panel of panels){
    if(panel.primitiveCount===0) reasons.push(`${panel.material} is not assigned to any mesh primitive.`);
    else {
      if(!panel.position) reasons.push(`${panel.material} primitive is missing POSITION.`);
      if(!panel.normal) reasons.push(`${panel.material} primitive is missing NORMAL.`);
      if(!panel.uv0) reasons.push(`${panel.material} primitive is missing TEXCOORD_0.`);
    }
  }
  if(!selfContained) reasons.push("Production GLB must be self-contained; external image or buffer URIs are not allowed.");

  return {
    modelId,
    gltfVersion:gltf.asset?.version?String(gltf.asset.version):null,
    generator:gltf.asset?.generator?String(gltf.asset.generator):null,
    materialNames,
    contract,
    panels,
    uvReady,
    selfContained,
    remoteUris,
    structuralReady:contract.readiness==="contract_ready"&&uvReady&&selfContained,
    reasons:[...new Set(reasons)],
  };
}
