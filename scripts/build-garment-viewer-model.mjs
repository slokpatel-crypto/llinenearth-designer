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

// Identity-first proportions tuned against /designer/studio-tucked.webp.
const shirtTorso=profileGeometry({
  rings:[
    {y:-.295,width:.205,depth:.112,z:.004},
    {y:-.240,width:.198,depth:.116,z:.006},
    {y:-.155,width:.190,depth:.120,z:.009},
    {y:-.060,width:.188,depth:.124,z:.011},
    {y:.055,width:.202,depth:.128,z:.014},
    {y:.165,width:.235,depth:.130,z:.016},
    {y:.245,width:.248,depth:.124,z:.010},
    {y:.285,width:.232,depth:.112,z:.004},
    {y:.305,width:.215,depth:.104,z:0},
  ],
  segments:32,
  ripple:({theta,v})=>.010*Math.sin(theta*6)*(1-v)+.005*Math.sin(theta*3+v*4),
});
const sleeve=profileGeometry({
  rings:[
    {y:-.300,width:.048,depth:.052,z:.002},
    {y:-.245,width:.050,depth:.055,z:.004},
    {y:-.135,width:.054,depth:.060,z:.006},
    {y:-.010,width:.058,depth:.064,z:.008},
    {y:.120,width:.064,depth:.069,z:.006},
    {y:.235,width:.073,depth:.076,z:.002},
    {y:.295,width:.078,depth:.080,z:0},
  ],
  segments:24,
  ripple:({theta,v})=>.008*Math.sin(theta*5+v*3)*(1-v*.35),
});
const trouserWaist=profileGeometry({
  rings:[
    {y:-.115,width:.207,depth:.111,z:.003},
    {y:-.060,width:.213,depth:.116,z:.004},
    {y:.015,width:.222,depth:.122,z:.006},
    {y:.080,width:.224,depth:.121,z:.003},
    {y:.115,width:.218,depth:.116,z:0},
  ],
  segments:30,
  ripple:({theta})=>.004*Math.sin(theta*4),
});
const trouserLeg=profileGeometry({
  rings:[
    {y:-.405,width:.066,depth:.075,z:.002},
    {y:-.315,width:.069,depth:.079,z:.003},
    {y:-.160,width:.074,depth:.084,z:.005},
    {y:.020,width:.082,depth:.091,z:.008},
    {y:.190,width:.093,depth:.099,z:.007},
    {y:.335,width:.103,depth:.106,z:.003},
    {y:.405,width:.108,depth:.109,z:0},
  ],
  segments:26,
  ripple:({theta,v})=>.006*Math.cos(theta*2)*(.35+v*.65)+.0035*Math.sin(theta*6+v*3),
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
  // 1727 mm canonical Live Designer mannequin: slim shoulders, long legs, relaxed straight stance.
  {name:"Head",mesh:meshHead,translation:[0,1.610,.002],scale:[.142,.117,.132]},
  {name:"Neck",mesh:meshHead,translation:[0,1.477,.004],scale:[.060,.072,.058]},
  {name:"ShirtTorsoFabric",mesh:meshShirtTorso,translation:[0,1.177,0]},
  {name:"ShirtSleeveLFabric",mesh:meshSleeveL,translation:[-.278,1.120,.002],rotation:qz(-3.2)},
  {name:"ShirtSleeveRFabric",mesh:meshSleeveR,translation:[.278,1.120,.002],rotation:qz(3.2)},
  {name:"HandL",mesh:meshHand,translation:[-.312,.770,.012],scale:[.049,.083,.052]},
  {name:"HandR",mesh:meshHand,translation:[.312,.770,.012],scale:[.049,.083,.052]},
  {name:"TrouserWaistFabric",mesh:meshWaist,translation:[0,.870,0]},
  {name:"TrouserLegLFabric",mesh:meshLegL,translation:[-.112,.475,0]},
  {name:"TrouserLegRFabric",mesh:meshLegR,translation:[.112,.475,0]},
  {name:"ShoeL",mesh:meshShoe,translation:[-.112,.055,.082],scale:[.104,.055,.195]},
  {name:"ShoeR",mesh:meshShoe,translation:[.112,.055,.082],scale:[.104,.055,.195]},
  {name:"CollarL",mesh:meshCollar,translation:[-.043,1.469,.101],scale:[.055,.018,.009],rotation:qz(-25)},
  {name:"CollarR",mesh:meshCollar,translation:[.043,1.469,.101],scale:[.055,.018,.009],rotation:qz(25)},
  {name:"CuffL",mesh:meshCuffL,translation:[-.312,.832,.004],scale:[.061,.022,.061],rotation:qz(-3.2)},
  {name:"CuffR",mesh:meshCuffR,translation:[.312,.832,.004],scale:[.061,.022,.061],rotation:qz(3.2)},
];
for(let i=0;i<7;i++) nodes.push({name:`ShirtButton${i+1}`,mesh:meshButton,translation:[0,1.400-i*.075,.127],scale:[.0095,.0095,.0065]});

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
  source:{name:"Linen Earth Live Designer identity-matched parametric baseline",license:"Linen Earth generated asset",verifiedAt:"2026-10-06"},
  panels:Object.fromEntries(garmentPanels.map(p=>[p.material,{widthMm:p.widthMm,heightMm:p.heightMm,offsetU:p.offsetU,offsetV:p.offsetV,rotationDeg:p.rotationDeg}])),
  identityMeasurements:{
    targetHeightMm:1727,
    targetShoulderWidthMm:455,
    targetShirtWaistWidthMm:376,
    targetTrouserWaistWidthMm:436,
    targetSleeveHandCenterMm:624,
    targetLegCenterSpacingMm:224,
    sourceAnchors:"LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS"
  },
  cameraOrbits:{front:"0deg 76deg 2.72m","three-quarter":"35deg 76deg 2.72m",side:"90deg 76deg 2.72m",back:"180deg 76deg 2.72m"},
};

await fs.mkdir(OUT_DIR,{recursive:true});
const glb=toGlb(gltf,binary);
await fs.writeFile(path.join(OUT_DIR,GLB_NAME),glb);
await fs.writeFile(path.join(OUT_DIR,MANIFEST_NAME),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(`Built ${GLB_NAME}: ${(glb.byteLength/1024).toFixed(1)} KiB, ${meshes.length} meshes, ${materials.length} materials.`);
console.log(`Built ${MANIFEST_NAME} with ${garmentPanels.length} physical garment panels.`);
