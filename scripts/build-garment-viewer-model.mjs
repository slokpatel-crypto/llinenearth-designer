import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR=path.resolve(process.cwd(),"public/models");
const GLB_NAME="linen-earth-officewear-v1.glb";
const MANIFEST_NAME="linen-earth-officewear-v1.viewer.json";
const MODEL_ID="LE-OFFICEWEAR-V1";
const CONTRACT_VERSION="linen-earth-garment-viewer-v2";
const IDENTITY_ID="linen-earth-studio-model-v1";
const REFERENCE_IMAGE="/designer/studio-tucked.webp";
const REFERENCE_HEIGHT_MM=1727;
const WHITE_PIXEL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8////fwYGBgYmBigAAD34BADaOyqcAAAAAElFTkSuQmCC";
const NEUTRAL_NORMAL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNsaPj/n4GBgYGJAQoALZkDAqlaHJYAAAAASUVORK5CYII=";

const garmentPanels=[
  {material:"ShirtTorsoFabric",widthMm:600,heightMm:590,offsetU:0,offsetV:0,rotationDeg:0},
  {material:"ShirtSleeveLFabric",widthMm:225,heightMm:570,offsetU:0,offsetV:0,rotationDeg:0},
  {material:"ShirtSleeveRFabric",widthMm:225,heightMm:570,offsetU:0,offsetV:0,rotationDeg:0},
  {material:"TrouserWaistFabric",widthMm:570,heightMm:235,offsetU:0,offsetV:0,rotationDeg:0},
  {material:"TrouserLegLFabric",widthMm:285,heightMm:770,offsetU:0,offsetV:0,rotationDeg:0},
  {material:"TrouserLegRFabric",widthMm:285,heightMm:770,offsetU:0,offsetV:0,rotationDeg:0},
];

const normalize=(x,y,z)=>{const n=Math.hypot(x,y,z)||1;return [x/n,y/n,z/n];};
const align4=(n)=>(n+3)&~3;

function typedGeometry(positions,normals,uvs,indices){
  if(positions.length/3>65535) throw new Error("Geometry exceeds uint16 vertex limit.");
  return {
    positions:new Float32Array(positions),
    normals:new Float32Array(normals),
    uvs:new Float32Array(uvs),
    indices:new Uint16Array(indices),
  };
}

function profileGeometry({rings,segments=28,ripple=()=>0}){
  const positions=[],normals=[],uvs=[],indices=[];
  for(let r=0;r<rings.length;r++){
    const ring=rings[r];
    const v=r/(rings.length-1);
    for(let s=0;s<segments;s++){
      const theta=(s/segments)*Math.PI*2;
      const extra=ripple({theta,v,ringIndex:r});
      const width=ring.width*(1+extra);
      const depth=ring.depth*(1+extra*.65);
      positions.push(Math.cos(theta)*width,ring.y,Math.sin(theta)*depth+(ring.z||0));
      const [nx,ny,nz]=normalize(Math.cos(theta)/Math.max(width,1e-5),0,Math.sin(theta)/Math.max(depth,1e-5));
      normals.push(nx,ny,nz);
      uvs.push(s/segments,v);
    }
  }
  for(let r=0;r<rings.length-1;r++){
    for(let s=0;s<segments;s++){
      const n=(s+1)%segments;
      const a=r*segments+s,b=r*segments+n,c=(r+1)*segments+n,d=(r+1)*segments+s;
      indices.push(a,d,c,a,c,b);
    }
  }
  const bottomCenter=positions.length/3;
  positions.push(0,rings[0].y,rings[0].z||0);normals.push(0,-1,0);uvs.push(.5,.5);
  const topCenter=positions.length/3;
  positions.push(0,rings.at(-1).y,rings.at(-1).z||0);normals.push(0,1,0);uvs.push(.5,.5);
  for(let s=0;s<segments;s++){
    const n=(s+1)%segments;
    indices.push(bottomCenter,n,s);
    const base=(rings.length-1)*segments;
    indices.push(topCenter,base+s,base+n);
  }
  return typedGeometry(positions,normals,uvs,indices);
}

function uvSphereGeometry(latSegments=14,lonSegments=24){
  const positions=[],normals=[],uvs=[],indices=[];
  for(let y=0;y<=latSegments;y++){
    const v=y/latSegments;
    const phi=v*Math.PI;
    const sy=Math.cos(phi),ring=Math.sin(phi);
    for(let x=0;x<=lonSegments;x++){
      const u=x/lonSegments,theta=u*Math.PI*2;
      const sx=Math.cos(theta)*ring,sz=Math.sin(theta)*ring;
      positions.push(sx,sy,sz);normals.push(sx,sy,sz);uvs.push(u,1-v);
    }
  }
  const row=lonSegments+1;
  for(let y=0;y<latSegments;y++){
    for(let x=0;x<lonSegments;x++){
      const a=y*row+x,b=a+1,c=a+row+1,d=a+row;
      indices.push(a,d,c,a,c,b);
    }
  }
  return typedGeometry(positions,normals,uvs,indices);
}

function boxGeometry(){
  const p=[],n=[],uv=[],idx=[];
  const faces=[
    {n:[0,0,1],v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
    {n:[0,0,-1],v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
    {n:[1,0,0],v:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]},
    {n:[-1,0,0],v:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]},
    {n:[0,1,0],v:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]},
    {n:[0,-1,0],v:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]},
  ];
  for(const face of faces){
    const start=p.length/3;
    for(const v of face.v){p.push(...v);n.push(...face.n);}
    uv.push(0,0,1,0,1,1,0,1);
    idx.push(start,start+1,start+2,start,start+2,start+3);
  }
  return typedGeometry(p,n,uv,idx);
}

const shirtTorso=profileGeometry({
  rings:[
    {y:-.295,width:.287,depth:.126,z:.006},{y:-.235,width:.292,depth:.132,z:.008},
    {y:-.145,width:.275,depth:.139,z:.010},{y:-.045,width:.265,depth:.145,z:.012},
    {y:.070,width:.279,depth:.150,z:.016},{y:.185,width:.305,depth:.146,z:.018},
    {y:.275,width:.293,depth:.133,z:.008},{y:.295,width:.252,depth:.118,z:0},
  ],
  ripple:({theta,v})=>.018*Math.sin(theta*6)*(1-v)+.008*Math.sin(theta*3+v*5),
});
const sleeve=profileGeometry({
  rings:[
    {y:-.285,width:.061,depth:.064},{y:-.22,width:.064,depth:.067,z:.004},
    {y:-.11,width:.069,depth:.072,z:.007},{y:.02,width:.074,depth:.078,z:.010},
    {y:.15,width:.083,depth:.086,z:.006},{y:.245,width:.092,depth:.092},
    {y:.285,width:.087,depth:.088},
  ],
  segments:22,
  ripple:({theta,v})=>.013*Math.sin(theta*5+v*4)*(1-v*.45),
});
const trouserWaist=profileGeometry({
  rings:[
    {y:-.115,width:.262,depth:.118,z:.003},{y:-.06,width:.270,depth:.125,z:.005},
    {y:.02,width:.278,depth:.132,z:.008},{y:.085,width:.274,depth:.128,z:.004},
    {y:.115,width:.267,depth:.120,z:0},
  ],
  ripple:({theta})=>.006*Math.sin(theta*4),
});
const trouserLeg=profileGeometry({
  rings:[
    {y:-.385,width:.087,depth:.094,z:.003},{y:-.285,width:.090,depth:.099,z:.004},
    {y:-.12,width:.098,depth:.107,z:.007},{y:.06,width:.106,depth:.114,z:.010},
    {y:.235,width:.116,depth:.120,z:.008},{y:.355,width:.123,depth:.124,z:.003},
    {y:.385,width:.119,depth:.121,z:0},
  ],
  segments:24,
  ripple:({theta,v})=>.009*Math.cos(theta*2)*(.35+v*.65)+.005*Math.sin(theta*6+v*3),
});
const head=uvSphereGeometry();
const hand=uvSphereGeometry(10,18);
const shoe=uvSphereGeometry(9,18);
const collar=boxGeometry();
const button=uvSphereGeometry(6,10);

const garmentMaterials=garmentPanels.map((panel,i)=>({
  name:panel.material,
  pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:i<3?.84:.79},
  normalTexture:{index:1,scale:i<3?.34:.29},
}));
const materials=[
  {name:"MannequinSkin",pbrMetallicRoughness:{baseColorFactor:[.47,.38,.31,1],metallicFactor:0,roughnessFactor:.78}},
  ...garmentMaterials,
  {name:"Shoe",pbrMetallicRoughness:{baseColorFactor:[.055,.047,.041,1],metallicFactor:0,roughnessFactor:.48}},
  {name:"ButtonAccent",pbrMetallicRoughness:{baseColorFactor:[.09,.075,.06,1],metallicFactor:.05,roughnessFactor:.42}},
];
const materialIndex=Object.fromEntries(materials.map((m,i)=>[m.name,i]));

const assets=[];
function addMesh(name,geometry,material){assets.push({name,geometry,material});return assets.length-1;}
const meshHead=addMesh("HeadMesh",head,"MannequinSkin");
const meshHand=addMesh("HandMesh",hand,"MannequinSkin");
const meshShoe=addMesh("ShoeMesh",shoe,"Shoe");
const meshShirtTorso=addMesh("ShirtTorsoMesh",shirtTorso,"ShirtTorsoFabric");
const meshSleeveL=addMesh("ShirtSleeveLMesh",sleeve,"ShirtSleeveLFabric");
const meshSleeveR=addMesh("ShirtSleeveRMesh",sleeve,"ShirtSleeveRFabric");
const meshWaist=addMesh("TrouserWaistMesh",trouserWaist,"TrouserWaistFabric");
const meshLegL=addMesh("TrouserLegLMesh",trouserLeg,"TrouserLegLFabric");
const meshLegR=addMesh("TrouserLegRMesh",trouserLeg,"TrouserLegRFabric");
const meshCollar=addMesh("CollarMesh",collar,"ShirtTorsoFabric");
const meshCuffL=addMesh("CuffLMesh",collar,"ShirtSleeveLFabric");
const meshCuffR=addMesh("CuffRMesh",collar,"ShirtSleeveRFabric");
const meshButton=addMesh("ButtonMesh",button,"ButtonAccent");

const qz=(deg)=>{const r=deg*Math.PI/180/2;return [0,0,Math.sin(r),Math.cos(r)];};
const nodes=[
  {name:"Head",mesh:meshHead,translation:[0,1.605,0],scale:[.165,.122,.148]},
  {name:"Neck",mesh:meshHead,translation:[0,1.472,0],scale:[.075,.074,.072]},
  {name:"ShirtTorsoFabric",mesh:meshShirtTorso,translation:[0,1.185,0]},
  {name:"ShirtSleeveLFabric",mesh:meshSleeveL,translation:[-.365,1.115,0],rotation:qz(-4)},
  {name:"ShirtSleeveRFabric",mesh:meshSleeveR,translation:[.365,1.115,0],rotation:qz(4)},
  {name:"HandL",mesh:meshHand,translation:[-.405,.765,.008],scale:[.061,.088,.063]},
  {name:"HandR",mesh:meshHand,translation:[.405,.765,.008],scale:[.061,.088,.063]},
  {name:"TrouserWaistFabric",mesh:meshWaist,translation:[0,.880,0]},
  {name:"TrouserLegLFabric",mesh:meshLegL,translation:[-.137,.505,0]},
  {name:"TrouserLegRFabric",mesh:meshLegR,translation:[.137,.505,0]},
  {name:"ShoeL",mesh:meshShoe,translation:[-.137,.060,.082],scale:[.125,.060,.210]},
  {name:"ShoeR",mesh:meshShoe,translation:[.137,.060,.082],scale:[.125,.060,.210]},
  {name:"CollarL",mesh:meshCollar,translation:[-.050,1.465,.113],scale:[.064,.020,.010],rotation:qz(-26)},
  {name:"CollarR",mesh:meshCollar,translation:[.050,1.465,.113],scale:[.064,.020,.010],rotation:qz(26)},
  {name:"CuffL",mesh:meshCuffL,translation:[-.405,.822,.002],scale:[.078,.025,.078],rotation:qz(-4)},
  {name:"CuffR",mesh:meshCuffR,translation:[.405,.822,.002],scale:[.078,.025,.078],rotation:qz(4)},
];
for(let i=0;i<6;i++) nodes.push({name:`ShirtButton${i+1}`,mesh:meshButton,translation:[0,1.405-i*.085,.145],scale:[.012,.012,.008]});

const parts=[],views=[],accessors=[];
let byteOffset=0;
function pushArray(typed,target,type,componentType,count,min,max){
  byteOffset=align4(byteOffset);
  const bytes=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength);
  const viewIndex=views.length;
  views.push({buffer:0,byteOffset,byteLength:bytes.byteLength,target});
  parts.push({byteOffset,bytes});
  byteOffset+=bytes.byteLength;
  const accessor={bufferView:viewIndex,componentType,count,type};
  if(min) accessor.min=min;
  if(max) accessor.max=max;
  accessors.push(accessor);
  return accessors.length-1;
}
function bounds3(a){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<a.length;i+=3){
    for(let k=0;k<3;k++){min[k]=Math.min(min[k],a[i+k]);max[k]=Math.max(max[k],a[i+k]);}
  }
  return {min,max};
}
const meshes=[];
for(const asset of assets){
  const g=asset.geometry,b=bounds3(g.positions);
  const pos=pushArray(g.positions,34962,"VEC3",5126,g.positions.length/3,b.min,b.max);
  const nor=pushArray(g.normals,34962,"VEC3",5126,g.normals.length/3);
  const uv=pushArray(g.uvs,34962,"VEC2",5126,g.uvs.length/2,[0,0],[1,1]);
  const ind=pushArray(g.indices,34963,"SCALAR",5123,g.indices.length,undefined,[g.positions.length/3-1]);
  meshes.push({name:asset.name,primitives:[{attributes:{POSITION:pos,NORMAL:nor,TEXCOORD_0:uv},indices:ind,material:materialIndex[asset.material],mode:4}]});
}
const binary=new Uint8Array(align4(byteOffset));
for(const p of parts) binary.set(p.bytes,p.byteOffset);

const gltf={
  asset:{version:"2.0",generator:"Linen Earth parametric officewear M2"},
  scene:0,
  scenes:[{name:"Linen Earth Officewear V1",nodes:nodes.map((_,i)=>i)}],
  nodes,
  buffers:[{byteLength:binary.byteLength}],
  bufferViews:views,
  accessors,
  samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
  images:[{uri:WHITE_PIXEL,name:"Fabric base placeholder"},{uri:NEUTRAL_NORMAL,name:"Neutral linen normal"}],
  textures:[{sampler:0,source:0,name:"Fabric placeholder"},{sampler:0,source:1,name:"Neutral normal"}],
  materials,
  meshes,
};

function toGlb(json,binary){
  const encoder=new TextEncoder();
  const jsonBytes=encoder.encode(JSON.stringify(json));
  const jsonLength=align4(jsonBytes.byteLength),binLength=align4(binary.byteLength);
  const totalLength=12+8+jsonLength+8+binLength;
  const out=new Uint8Array(totalLength),dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,totalLength,true);
  dv.setUint32(12,jsonLength,true);dv.setUint32(16,0x4e4f534a,true);
  out.fill(0x20,20,20+jsonLength);out.set(jsonBytes,20);
  const bh=20+jsonLength;
  dv.setUint32(bh,binLength,true);dv.setUint32(bh+4,0x004e4942,true);out.set(binary,bh+8);
  return out;
}

const manifest={
  version:CONTRACT_VERSION,
  modelId:MODEL_ID,
  referenceHeightMm:REFERENCE_HEIGHT_MM,
  modelIdentity:{id:IDENTITY_ID,referenceImage:REFERENCE_IMAGE},
  source:{name:"Linen Earth parametric officewear baseline",license:"Linen Earth generated asset",verifiedAt:"2026-10-06"},
  panels:Object.fromEntries(garmentPanels.map(p=>[p.material,{widthMm:p.widthMm,heightMm:p.heightMm,offsetU:p.offsetU,offsetV:p.offsetV,rotationDeg:p.rotationDeg}])),
  cameraOrbits:{front:"0deg 76deg 2.58m","three-quarter":"35deg 76deg 2.58m",side:"90deg 76deg 2.58m",back:"180deg 76deg 2.58m"},
};

await fs.mkdir(OUT_DIR,{recursive:true});
const glb=toGlb(gltf,binary);
await fs.writeFile(path.join(OUT_DIR,GLB_NAME),glb);
await fs.writeFile(path.join(OUT_DIR,MANIFEST_NAME),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(`Built ${GLB_NAME}: ${(glb.byteLength/1024).toFixed(1)} KiB, ${meshes.length} meshes, ${materials.length} materials.`);
console.log(`Built ${MANIFEST_NAME} with ${garmentPanels.length} physical garment panels.`);
