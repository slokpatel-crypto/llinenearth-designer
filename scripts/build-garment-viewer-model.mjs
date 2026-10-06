import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR=path.resolve(process.cwd(),"public/models");
const BASE_BODY_PATH=path.resolve(process.cwd(),"assets/3d/makehuman-mannequin-base.glb");
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


function accessorComponentCount(type){
  if(type==="SCALAR") return 1;
  if(type==="VEC2") return 2;
  if(type==="VEC3") return 3;
  if(type==="VEC4") return 4;
  throw new Error(`Unsupported accessor type: ${type}`);
}

function readAccessorValues(gltf,binary,accessorIndex){
  const accessor=gltf.accessors?.[accessorIndex];
  if(!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  const view=gltf.bufferViews?.[accessor.bufferView];
  if(!view) throw new Error(`Missing bufferView for accessor ${accessorIndex}`);
  const count=Number(accessor.count)||0;
  const components=accessorComponentCount(accessor.type);
  const bytesPerComponent=accessor.componentType===5126||accessor.componentType===5125?4
    : accessor.componentType===5123||accessor.componentType===5122?2
      : 1;
  const stride=Number(view.byteStride)||components*bytesPerComponent;
  const start=(Number(view.byteOffset)||0)+(Number(accessor.byteOffset)||0);
  const data=new DataView(binary.buffer,binary.byteOffset,binary.byteLength);
  const values=new Array(count*components);
  function read(offset){
    if(accessor.componentType===5126) return data.getFloat32(offset,true);
    if(accessor.componentType===5125) return data.getUint32(offset,true);
    if(accessor.componentType===5123) return data.getUint16(offset,true);
    if(accessor.componentType===5122) return data.getInt16(offset,true);
    if(accessor.componentType===5121) return data.getUint8(offset);
    if(accessor.componentType===5120) return data.getInt8(offset);
    throw new Error(`Unsupported component type: ${accessor.componentType}`);
  }
  for(let i=0;i<count;i++){
    const base=start+i*stride;
    for(let j=0;j<components;j++) values[i*components+j]=read(base+j*bytesPerComponent);
  }
  return {values,count,components};
}

async function loadMakeHumanBodyGeometry(){
  const file=new Uint8Array(await fs.readFile(BASE_BODY_PATH));
  const fileView=new DataView(file.buffer,file.byteOffset,file.byteLength);
  if(fileView.getUint32(0,true)!==0x46546c67) throw new Error("MakeHuman body source is not a GLB.");
  const jsonLength=fileView.getUint32(12,true);
  const jsonText=new TextDecoder().decode(file.slice(20,20+jsonLength)).trim();
  const source=JSON.parse(jsonText);
  const binHeader=20+align4(jsonLength);
  if(fileView.getUint32(binHeader+4,true)!==0x004e4942) throw new Error("MakeHuman GLB has no binary chunk.");
  const binLength=fileView.getUint32(binHeader,true);
  const binary=file.slice(binHeader+8,binHeader+8+binLength);
  const primitive=source.meshes?.[0]?.primitives?.[0];
  if(!primitive) throw new Error("MakeHuman GLB has no primary mesh.");
  const positions=readAccessorValues(source,binary,primitive.attributes.POSITION);
  const normals=readAccessorValues(source,binary,primitive.attributes.NORMAL);
  const indexData=readAccessorValues(source,binary,primitive.indices);
  if(positions.components!==3||normals.components!==3||indexData.components!==1) throw new Error("Unexpected MakeHuman body accessor layout.");

  // Slightly inset the anatomical source under the tailored shells so skin never clips through cloth.
  // The transformed hand centres still land almost exactly on the Live Designer reference.
  const sx=.84;
  const sy=(REFERENCE_HEIGHT_MM/1000)/1.7;
  const sz=.64;
  const sourceYMin=.10;
  const sourceYMax=1.44;
  const remap=new Map();
  const outPositions=[],outNormals=[],outUvs=[],outIndices=[];

  function mapped(oldIndex){
    let next=remap.get(oldIndex);
    if(next!==undefined) return next;
    next=remap.size;
    remap.set(oldIndex,next);
    const p=oldIndex*3;
    const x=positions.values[p]*sx;
    const y=positions.values[p+1]*sy;
    const z=-positions.values[p+2]*sz;
    outPositions.push(x,y,z);
    const [nx,ny,nz]=normalize(
      normals.values[p]/sx,
      normals.values[p+1]/sy,
      -normals.values[p+2]/sz,
    );
    outNormals.push(nx,ny,nz);
    outUvs.push(.5,.5);
    return next;
  }

  for(let i=0;i+2<indexData.values.length;i+=3){
    const a=Number(indexData.values[i]),b=Number(indexData.values[i+1]),d=Number(indexData.values[i+2]);
    const ay=positions.values[a*3+1],by=positions.values[b*3+1],dy=positions.values[d*3+1];
    if(ay<sourceYMin||by<sourceYMin||dy<sourceYMin) continue;
    if(ay>sourceYMax||by>sourceYMax||dy>sourceYMax) continue;
    // Z is mirrored to align MakeHuman's front with Linen Earth's +Z garment front,
    // so triangle winding must be flipped as well.
    outIndices.push(mapped(a),mapped(d),mapped(b));
  }
  if(outIndices.length<3000) throw new Error("MakeHuman body crop produced too little geometry.");
  return typedGeometry(outPositions,outNormals,outUvs,outIndices);
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

function collarPointGeometry(){
  const p=[],n=[],uv=[],idx=[];
  const front=[[-.5,.5,.5],[.5,.5,.5],[0,-.5,.5]];
  const back=[[-.5,.5,-.5],[0,-.5,-.5],[.5,.5,-.5]];
  const faces=[
    {n:[0,0,1],v:front},
    {n:[0,0,-1],v:back},
    {n:[0,1,0],v:[[-.5,.5,-.5],[.5,.5,-.5],[.5,.5,.5],[-.5,.5,.5]]},
    {n:[-.7,-.7,0],v:[[-.5,.5,-.5],[-.5,.5,.5],[0,-.5,.5],[0,-.5,-.5]]},
    {n:[.7,-.7,0],v:[[.5,.5,.5],[.5,.5,-.5],[0,-.5,-.5],[0,-.5,.5]]},
  ];
  for(const face of faces){
    const start=p.length/3;
    for(const v of face.v){p.push(...v);n.push(...face.n);}
    if(face.v.length===3){
      uv.push(0,1,1,1,.5,0);
      idx.push(start,start+1,start+2);
    }else{
      uv.push(0,0,1,0,1,1,0,1);
      idx.push(start,start+1,start+2,start,start+2,start+3);
    }
  }
  return typedGeometry(p,n,uv,idx);
}

// Identity-first proportions tuned against /designer/studio-tucked.webp.
const shirtTorso=profileGeometry({
  rings:[
    {y:-.205,width:.147,depth:.102,z:.004},
    {y:-.160,width:.151,depth:.106,z:.006},
    {y:-.085,width:.154,depth:.112,z:.009},
    {y:-.010,width:.160,depth:.118,z:.012},
    {y:.070,width:.171,depth:.122,z:.014},
    {y:.135,width:.184,depth:.121,z:.012},
    {y:.175,width:.194,depth:.116,z:.008},
    {y:.205,width:.132,depth:.096,z:0},
  ],
  segments:34,
  ripple:({theta,v})=>.008*Math.sin(theta*6)*(1-v)+.004*Math.sin(theta*3+v*4),
});
const sleeve=profileGeometry({
  rings:[
    {y:-.286,width:.041,depth:.046,z:.002},
    {y:-.235,width:.043,depth:.049,z:.004},
    {y:-.125,width:.047,depth:.053,z:.006},
    {y:-.005,width:.050,depth:.057,z:.007},
    {y:.115,width:.054,depth:.061,z:.005},
    {y:.225,width:.058,depth:.064,z:.002},
    {y:.286,width:.061,depth:.066,z:0},
  ],
  segments:26,
  ripple:({theta,v})=>.006*Math.sin(theta*5+v*3)*(1-v*.35),
});
const trouserWaist=profileGeometry({
  rings:[
    {y:-.075,width:.168,depth:.103,z:.002},
    {y:-.035,width:.170,depth:.106,z:.003},
    {y:.010,width:.172,depth:.108,z:.004},
    {y:.050,width:.173,depth:.106,z:.002},
    {y:.075,width:.172,depth:.102,z:0},
  ],
  segments:32,
  ripple:({theta})=>.003*Math.sin(theta*4),
});
const trouserLeg=profileGeometry({
  rings:[
    {y:-.492,width:.032,depth:.054,z:.004},
    {y:-.438,width:.033,depth:.055,z:-.002},
    {y:-.365,width:.035,depth:.057,z:.003},
    {y:-.255,width:.040,depth:.061,z:.002},
    {y:-.105,width:.047,depth:.068,z:.005},
    {y:.060,width:.056,depth:.075,z:.007},
    {y:.220,width:.070,depth:.085,z:.005},
    {y:.365,width:.081,depth:.094,z:.002},
    {y:.492,width:.087,depth:.100,z:0},
  ],
  segments:30,
  ripple:({theta,v})=>.004*Math.cos(theta*2)*(.35+v*.65)+.002*Math.sin(theta*6+v*3),
});
const head=profileGeometry({
  rings:[
    {y:-.102,width:.044,depth:.052,z:.006},
    {y:-.080,width:.060,depth:.068,z:.009},
    {y:-.045,width:.071,depth:.078,z:.010},
    {y:.000,width:.076,depth:.082,z:.008},
    {y:.045,width:.074,depth:.080,z:.004},
    {y:.082,width:.062,depth:.070,z:0},
    {y:.103,width:.038,depth:.048,z:-.003},
  ],
  segments:34,
});
const hand=profileGeometry({
  rings:[
    {y:-.036,width:.022,depth:.016,z:.004},
    {y:-.020,width:.026,depth:.019,z:.006},
    {y:.010,width:.028,depth:.020,z:.006},
    {y:.032,width:.025,depth:.018,z:.003},
    {y:.038,width:.020,depth:.015,z:0},
  ],
  segments:24,
});
const finger=profileGeometry({
  rings:[
    {y:-.030,width:.0048,depth:.0056,z:.001},
    {y:-.020,width:.0058,depth:.0065,z:.002},
    {y:.010,width:.0060,depth:.0068,z:.002},
    {y:.026,width:.0054,depth:.0061,z:0},
    {y:.030,width:.0042,depth:.0050,z:-.001},
  ],
  segments:16,
});
const thumb=profileGeometry({
  rings:[
    {y:-.025,width:.0060,depth:.0070,z:.001},
    {y:-.010,width:.0070,depth:.0080,z:.002},
    {y:.014,width:.0073,depth:.0080,z:.001},
    {y:.025,width:.0058,depth:.0065,z:0},
  ],
  segments:16,
});
const mannequinBody=await loadMakeHumanBodyGeometry();
const shoe=uvSphereGeometry(10,20);
const collar=collarPointGeometry();
const detailBox=boxGeometry();
const button=uvSphereGeometry(6,10);

const garmentMaterials=garmentPanels.map((panel,i)=>({
  name:panel.material,
  pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:i<3?.84:.79},
  normalTexture:{index:1,scale:i<3?.34:.29},
}));
const materials=[
  {name:"MannequinSkin",pbrMetallicRoughness:{baseColorFactor:[.94,.93,.90,1],metallicFactor:0,roughnessFactor:.90}},
  ...garmentMaterials,
  {name:"Shoe",pbrMetallicRoughness:{baseColorFactor:[.91,.90,.87,1],metallicFactor:0,roughnessFactor:.58}},
  {name:"ButtonAccent",pbrMetallicRoughness:{baseColorFactor:[.09,.075,.06,1],metallicFactor:.05,roughnessFactor:.42}},
];
const materialIndex=Object.fromEntries(materials.map((m,i)=>[m.name,i]));

const assets=[];
function addMesh(name,geometry,material){assets.push({name,geometry,material});return assets.length-1;}
const meshBody=addMesh("MakeHumanBodyMesh",mannequinBody,"MannequinSkin");
const meshHead=addMesh("HeadMesh",head,"MannequinSkin");
const meshHand=addMesh("HandPalmMesh",hand,"MannequinSkin");
const meshFinger=addMesh("HandFingerMesh",finger,"MannequinSkin");
const meshThumb=addMesh("HandThumbMesh",thumb,"MannequinSkin");
const meshShoe=addMesh("ShoeMesh",shoe,"Shoe");
const meshShirtTorso=addMesh("ShirtTorsoMesh",shirtTorso,"ShirtTorsoFabric");
const meshSleeveL=addMesh("ShirtSleeveLMesh",sleeve,"ShirtSleeveLFabric");
const meshSleeveR=addMesh("ShirtSleeveRMesh",sleeve,"ShirtSleeveRFabric");
const meshWaist=addMesh("TrouserWaistMesh",trouserWaist,"TrouserWaistFabric");
const meshLegL=addMesh("TrouserLegLMesh",trouserLeg,"TrouserLegLFabric");
const meshLegR=addMesh("TrouserLegRMesh",trouserLeg,"TrouserLegRFabric");
const meshCollar=addMesh("CollarMesh",collar,"ShirtTorsoFabric");
const meshCuffL=addMesh("CuffLMesh",detailBox,"ShirtSleeveLFabric");
const meshCuffR=addMesh("CuffRMesh",detailBox,"ShirtSleeveRFabric");
const meshButton=addMesh("ButtonMesh",button,"ButtonAccent");
const meshShirtPlacket=addMesh("ShirtPlacketMesh",detailBox,"ShirtTorsoFabric");
const meshTrouserCreaseL=addMesh("TrouserCreaseLMesh",detailBox,"TrouserLegLFabric");
const meshTrouserCreaseR=addMesh("TrouserCreaseRMesh",detailBox,"TrouserLegRFabric");
const meshWaistDetail=addMesh("TrouserWaistDetailMesh",detailBox,"TrouserWaistFabric");
const meshSole=addMesh("SoleMesh",detailBox,"Shoe");
const meshShoeDetail=addMesh("ShoeDetailMesh",detailBox,"Shoe");

const qz=(deg)=>{const r=deg*Math.PI/180/2;return [0,0,Math.sin(r),Math.cos(r)];};
const nodes=[
  // CC0 anatomical body sits under the garments; the customer-facing head remains the locked faceless studio identity.
  {name:"MannequinBody",mesh:meshBody},
  // 1727 mm canonical Live Designer mannequin: slim shoulders, long legs, relaxed straight stance.
  {name:"Head",mesh:meshHead,translation:[0,1.620,.004]},
  {name:"Neck",mesh:meshHead,translation:[0,1.500,.001],scale:[.63,.58,.62]},
  {name:"ShirtTorsoFabric",mesh:meshShirtTorso,translation:[0,1.265,0]},
  {name:"ShirtSleeveLFabric",mesh:meshSleeveL,translation:[-.226,1.155,.002],rotation:qz(-2.4)},
  {name:"ShirtSleeveRFabric",mesh:meshSleeveR,translation:[.226,1.155,.002],rotation:qz(2.4)},
  {name:"TrouserWaistFabric",mesh:meshWaist,translation:[0,1.025,0]},
  {name:"TrouserLegLFabric",mesh:meshLegL,translation:[-.105,.555,0]},
  {name:"TrouserLegRFabric",mesh:meshLegR,translation:[.105,.555,0]},
  {name:"ShoeL",mesh:meshShoe,translation:[-.105,.056,.081],scale:[.068,.041,.150]},
  {name:"ShoeR",mesh:meshShoe,translation:[.105,.056,.081],scale:[.068,.041,.150]},
  {name:"SoleL",mesh:meshSole,translation:[-.105,.016,.089],scale:[.140,.021,.300]},
  {name:"SoleR",mesh:meshSole,translation:[.105,.016,.089],scale:[.140,.021,.300]},
  {name:"CollarL",mesh:meshCollar,translation:[-.043,1.468,.096],scale:[.080,.088,.014],rotation:qz(-18)},
  {name:"CollarR",mesh:meshCollar,translation:[.043,1.468,.096],scale:[.080,.088,.014],rotation:qz(18)},
  {name:"CuffL",mesh:meshCuffL,translation:[-.250,.870,.004],scale:[.049,.021,.051],rotation:qz(-2.4)},
  {name:"CuffR",mesh:meshCuffR,translation:[.250,.870,.004],scale:[.049,.021,.051],rotation:qz(2.4)},
  // Raised construction cues keep the 3D silhouette close to the Live Designer front reference.
  {name:"ShirtFrontPlacket",mesh:meshShirtPlacket,translation:[0,1.268,.112],scale:[.013,.374,.008]},
  {name:"TrouserFrontCreaseL",mesh:meshTrouserCreaseL,translation:[-.105,.555,.071],scale:[.006,.905,.006]},
  {name:"TrouserFrontCreaseR",mesh:meshTrouserCreaseR,translation:[.105,.555,.071],scale:[.006,.905,.006]},
  {name:"TrouserFly",mesh:meshWaistDetail,translation:[0,.995,.106],scale:[.010,.105,.006]},
  {name:"WaistbandFront",mesh:meshWaistDetail,translation:[0,1.088,.105],scale:[.330,.026,.006]},
  {name:"BeltLoopL1",mesh:meshWaistDetail,translation:[-.132,1.092,.108],scale:[.013,.072,.006]},
  {name:"BeltLoopL2",mesh:meshWaistDetail,translation:[-.065,1.092,.109],scale:[.012,.072,.006]},
  {name:"BeltLoopR1",mesh:meshWaistDetail,translation:[.065,1.092,.109],scale:[.012,.072,.006]},
  {name:"BeltLoopR2",mesh:meshWaistDetail,translation:[.132,1.092,.108],scale:[.013,.072,.006]},
];
for(let i=0;i<7;i++) nodes.push({name:`ShirtButton${i+1}`,mesh:meshButton,translation:[0,1.430-i*.055,.119],scale:[.006,.006,.004]});
nodes.push({name:"TrouserButton",mesh:meshButton,translation:[0,1.100,.113],scale:[.0068,.0068,.0048]});
nodes.push({name:"CuffButtonL",mesh:meshButton,translation:[-.250,.870,.057],scale:[.0048,.0048,.0035]});
nodes.push({name:"CuffButtonR",mesh:meshButton,translation:[.250,.870,.057],scale:[.0048,.0048,.0035]});
for(const side of [-1,1]){
  for(let i=0;i<3;i++) nodes.push({
    name:`ShoeLace${side<0?"L":"R"}${i+1}`,
    mesh:meshShoeDetail,
    translation:[side*.105,.083,.135+i*.022],
    scale:[.050,.005,.008],
  });
}

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
  asset:{version:"2.0",generator:"Linen Earth Live Designer identity model M5 anatomical"},
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
  source:{
    name:"MakeHuman CC0 body + Linen Earth identity-matched officewear M5",
    license:"CC0 1.0 body source + Linen Earth generated garment geometry",
    verifiedAt:"2026-10-06",
    sourceUrl:"https://github.com/jeromydarling/rezene/blob/main/public/models/README.md",
    licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/"
  },
  panels:Object.fromEntries(garmentPanels.map(p=>[p.material,{widthMm:p.widthMm,heightMm:p.heightMm,offsetU:p.offsetU,offsetV:p.offsetV,rotationDeg:p.rotationDeg}])),
  identityMeasurements:{
    targetHeightMm:1727,
    targetShoulderSeamWidthMm:388,
    targetOuterArmSilhouetteMm:574,
    targetShirtWaistWidthMm:294,
    targetTrouserWaistWidthMm:344,
    targetHandCenterSpacingMm:500,
    targetLegCenterSpacingMm:210,
    targetHemWidthMm:64,
    polishStage:"M5 anatomical body + Live Designer identity polish complete",
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
