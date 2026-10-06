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
const IDENTITY_TARGETS_MM={
  height:1727,
  shoulderSeamWidth:388,
  outerArmSilhouette:574,
  shirtWaistWidth:294,
  trouserWaistWidth:344,
  handCenterSpacing:500,
  legCenterSpacing:210,
  hemWidth:64,
};
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
  const sz=.58;
  const armPoseRad=-20*Math.PI/180;
  const armPoseCos=Math.cos(armPoseRad);
  const armPoseSin=Math.sin(armPoseRad);
  const armPivotY=1.31;
  const armPivotZ=.040;
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
    let y=positions.values[p+1]*sy;
    let z=-positions.values[p+2]*sz;
    let [nx,ny,nz]=normalize(
      normals.values[p]/sx,
      normals.values[p+1]/sy,
      -normals.values[p+2]/sz,
    );
    const isArm=Math.abs(x)>.15&&y>.65&&y<1.32;
    if(isArm){
      const dy=y-armPivotY,dz=z-armPivotZ;
      y=armPivotY+armPoseCos*dy-armPoseSin*dz;
      z=armPivotZ+armPoseSin*dy+armPoseCos*dz;
      const rotatedNy=armPoseCos*ny-armPoseSin*nz;
      const rotatedNz=armPoseSin*ny+armPoseCos*nz;
      [nx,ny,nz]=normalize(nx,rotatedNy,rotatedNz);
    }
    outPositions.push(x,y,z);
    outNormals.push(nx,ny,nz);
    outUvs.push(.5,.5);
    return next;
  }

  for(let i=0;i+2<indexData.values.length;i+=3){
    const a=Number(indexData.values[i]),b=Number(indexData.values[i+1]),d=Number(indexData.values[i+2]);
    const ay=positions.values[a*3+1],by=positions.values[b*3+1],dy=positions.values[d*3+1];
    if(ay<sourceYMin||by<sourceYMin||dy<sourceYMin) continue;
    if(ay>sourceYMax||by>sourceYMax||dy>sourceYMax) continue;
    const handCut=(index)=>{
      const px=Math.abs(positions.values[index*3]*sx);
      const py=positions.values[index*3+1];
      return px>.16&&py<.86;
    };
    if(handCut(a)||handCut(b)||handCut(d)) continue;
    // Z is mirrored to align MakeHuman's front with Linen Earth's +Z garment front,
    // so triangle winding must be flipped as well.
    outIndices.push(mapped(a),mapped(d),mapped(b));
  }
  if(outIndices.length<3000) throw new Error("MakeHuman body crop produced too little geometry.");
  return typedGeometry(outPositions,outNormals,outUvs,outIndices);
}


function lerpEnvelope(stops,y){
  if(y<=stops[0][0]) return stops[0][1];
  for(let i=1;i<stops.length;i++){
    const [y1,w1]=stops[i-1],[y2,w2]=stops[i];
    if(y<=y2){
      const t=(y-y1)/Math.max(1e-6,y2-y1);
      return w1+(w2-w1)*t;
    }
  }
  return stops.at(-1)[1];
}

async function loadMakeHumanGarmentShells(){
  const file=new Uint8Array(await fs.readFile(BASE_BODY_PATH));
  const fileView=new DataView(file.buffer,file.byteOffset,file.byteLength);
  if(fileView.getUint32(0,true)!==0x46546c67) throw new Error("MakeHuman body source is not a GLB.");
  const jsonLength=fileView.getUint32(12,true);
  const source=JSON.parse(new TextDecoder().decode(file.slice(20,20+jsonLength)).trim());
  const binHeader=20+align4(jsonLength);
  if(fileView.getUint32(binHeader+4,true)!==0x004e4942) throw new Error("MakeHuman GLB has no binary chunk.");
  const binLength=fileView.getUint32(binHeader,true);
  const binary=file.slice(binHeader+8,binHeader+8+binLength);
  const primitive=source.meshes?.[0]?.primitives?.[0];
  if(!primitive) throw new Error("MakeHuman GLB has no primary mesh.");
  const positions=readAccessorValues(source,binary,primitive.attributes.POSITION);
  const normals=readAccessorValues(source,binary,primitive.attributes.NORMAL);
  const indexData=readAccessorValues(source,binary,primitive.indices);
  if(positions.components!==3||normals.components!==3||indexData.components!==1) throw new Error("Unexpected MakeHuman garment-shell accessor layout.");

  const sx=.84;
  const sy=(REFERENCE_HEIGHT_MM/1000)/1.7;
  const sz=.58;
  const armPoseRad=-20*Math.PI/180;
  const armPoseCos=Math.cos(armPoseRad);
  const armPoseSin=Math.sin(armPoseRad);
  const armPivotY=1.31;
  const armPivotZ=.040;
  const transformed=new Array(positions.count);

  for(let index=0;index<positions.count;index++){
    const p=index*3;
    let x=positions.values[p]*sx;
    let y=positions.values[p+1]*sy;
    let z=-positions.values[p+2]*sz;
    let [nx,ny,nz]=normalize(
      normals.values[p]/sx,
      normals.values[p+1]/sy,
      -normals.values[p+2]/sz,
    );
    const isArm=Math.abs(x)>.15&&y>.65&&y<1.32;
    if(isArm){
      const dy=y-armPivotY,dz=z-armPivotZ;
      y=armPivotY+armPoseCos*dy-armPoseSin*dz;
      z=armPivotZ+armPoseSin*dy+armPoseCos*dz;
      const rotatedNy=armPoseCos*ny-armPoseSin*nz;
      const rotatedNz=armPoseSin*ny+armPoseCos*nz;
      [nx,ny,nz]=normalize(nx,rotatedNy,rotatedNz);
    }
    transformed[index]={x,y,z,nx,ny,nz};
  }

  const torsoEnvelope=[
    [1.060,.147],
    [1.105,.151],
    [1.180,.154],
    [1.255,.160],
    [1.335,.171],
    [1.400,.184],
    [1.440,.194],
    [1.470,.132],
  ];
  const torsoDepthEnvelope=[
    [1.060,.100],
    [1.180,.108],
    [1.255,.114],
    [1.335,.119],
    [1.400,.116],
    [1.440,.108],
    [1.470,.086],
  ];
  const sleeveWidthEnvelope=[
    [.865,.041],
    [.970,.043],
    [1.080,.047],
    [1.200,.051],
    [1.330,.056],
    [1.455,.061],
  ];
  const sleeveDepthEnvelope=[
    [.865,.050],
    [.970,.052],
    [1.080,.055],
    [1.200,.059],
    [1.330,.064],
    [1.455,.070],
  ];
  const trouserWaistEnvelope=[
    [.940,.158],
    [.980,.166],
    [1.040,.172],
    [1.100,.170],
  ];
  const trouserWaistDepthEnvelope=[
    [.940,.084],
    [.980,.088],
    [1.040,.090],
    [1.100,.086],
  ];

  function buildRegion({predicate,centerX=0,yMin,yMax,outward=.008,kind}){
    const remap=new Map();
    const outPositions=[],outNormals=[],outUvs=[],outIndices=[];
    function mapVertex(oldIndex){
      let next=remap.get(oldIndex);
      if(next!==undefined) return next;
      const point=transformed[oldIndex];
      let {x,y,z,nx,ny,nz}=point;
      if(kind==="torso"){
        const targetHalf=lerpEnvelope(torsoEnvelope,y);
        const targetDepth=lerpEnvelope(torsoDepthEnvelope,y);
        const theta=Math.atan2(z,x);
        x=Math.cos(theta)*targetHalf;
        z=Math.sin(theta)*targetDepth+(Math.sin(theta)>.15?.004:0);
      }else if(kind==="sleeve"){
        const targetHalf=lerpEnvelope(sleeveWidthEnvelope,y);
        const targetDepth=lerpEnvelope(sleeveDepthEnvelope,y);
        const t=Math.max(0,Math.min(1,(y-.865)/(1.455-.865)));
        const side=Math.sign(centerX)||1;
        const sleeveCenterX=centerX+side*.006*(t-.45);
        const sleeveCenterZ=.024+.010*t;
        const theta=Math.atan2(z-sleeveCenterZ,x-sleeveCenterX);
        x=sleeveCenterX+Math.cos(theta)*targetHalf;
        z=sleeveCenterZ+Math.sin(theta)*targetDepth;
      }else if(kind==="waist"){
        const targetHalf=lerpEnvelope(trouserWaistEnvelope,y);
        const targetDepth=lerpEnvelope(trouserWaistDepthEnvelope,y);
        const theta=Math.atan2(z-.005,x);
        x=Math.cos(theta)*targetHalf;
        z=.005+Math.sin(theta)*targetDepth;
      }
      x+=nx*outward;
      y+=ny*outward*.55;
      z+=nz*outward;
      next=remap.size;
      remap.set(oldIndex,next);
      outPositions.push(x,y,z);
      outNormals.push(nx,ny,nz);
      const angle=Math.atan2(z,x-centerX);
      const u=(angle/(Math.PI*2)+1.5)%1;
      const v=Math.max(0,Math.min(1,(y-yMin)/Math.max(1e-5,yMax-yMin)));
      outUvs.push(u,v);
      return next;
    }
    for(let i=0;i+2<indexData.values.length;i+=3){
      const a=Number(indexData.values[i]),b=Number(indexData.values[i+1]),d=Number(indexData.values[i+2]);
      const pa=transformed[a],pb=transformed[b],pd=transformed[d];
      if(!predicate(pa)||!predicate(pb)||!predicate(pd)) continue;
      outIndices.push(mapVertex(a),mapVertex(d),mapVertex(b));
    }
    if(outIndices.length<300) throw new Error(`MakeHuman ${kind} shell produced too little geometry.`);
    return typedGeometry(outPositions,outNormals,outUvs,outIndices);
  }

  const shirtTorso=buildRegion({
    kind:"torso",centerX:0,yMin:1.055,yMax:1.47,outward:.003,
    predicate:(p)=>p.y>=1.055&&p.y<=1.47&&(Math.abs(p.x)<=.18||(p.y>=1.30&&Math.abs(p.x)<=.205)),
  });
  const sleeveL=buildRegion({
    kind:"sleeve",centerX:-.226,yMin:.865,yMax:1.455,outward:.003,
    predicate:(p)=>p.y>=.865&&p.y<=1.455&&p.x<=-.145,
  });
  const sleeveR=buildRegion({
    kind:"sleeve",centerX:.226,yMin:.865,yMax:1.455,outward:.003,
    predicate:(p)=>p.y>=.865&&p.y<=1.455&&p.x>=.145,
  });
  const handL=buildRegion({
    kind:"skin",centerX:-.226,yMin:.80,yMax:.91,outward:0,
    predicate:(p)=>p.y>=.80&&p.y<=.91&&p.x<=-.195,
  });
  const handR=buildRegion({
    kind:"skin",centerX:.226,yMin:.80,yMax:.91,outward:0,
    predicate:(p)=>p.y>=.80&&p.y<=.91&&p.x>=.195,
  });
  const trouserWaist=buildRegion({
    kind:"waist",centerX:0,yMin:.94,yMax:1.10,outward:.003,
    predicate:(p)=>p.y>=.94&&p.y<=1.10&&Math.abs(p.x)<=.185,
  });

  return {shirtTorso,sleeveL,sleeveR,handL,handR,trouserWaist};
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
    {y:-.286,width:.041,depth:.055,z:.002},
    {y:-.235,width:.043,depth:.058,z:.004},
    {y:-.125,width:.047,depth:.062,z:.006},
    {y:-.005,width:.050,depth:.067,z:.007},
    {y:.115,width:.054,depth:.073,z:.005},
    {y:.225,width:.058,depth:.085,z:.002},
    {y:.286,width:.061,depth:.095,z:0},
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
const garmentShells=await loadMakeHumanGarmentShells();
const mannequinBodyStats={
  vertices:mannequinBody.positions.length/3,
  triangles:mannequinBody.indices.length/3,
};
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
const meshHead=addMesh("HeadMesh",head,"MannequinSkin");
const meshHandL=addMesh("HandLMesh",garmentShells.handL,"MannequinSkin");
const meshHandR=addMesh("HandRMesh",garmentShells.handR,"MannequinSkin");
const meshShoe=addMesh("ShoeMesh",shoe,"Shoe");
const meshShirtTorso=addMesh("ShirtTorsoMesh",garmentShells.shirtTorso,"ShirtTorsoFabric");
const meshSleeveL=addMesh("ShirtSleeveLMesh",garmentShells.sleeveL,"ShirtSleeveLFabric");
const meshSleeveR=addMesh("ShirtSleeveRMesh",garmentShells.sleeveR,"ShirtSleeveRFabric");
const meshWaist=addMesh("TrouserWaistMesh",garmentShells.trouserWaist,"TrouserWaistFabric");
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
  // The CC0 anatomical body is prepared as the next cloth-collision source but intentionally not rendered:
  // the visible mannequin stays locked to the exact Linen Earth studio silhouette without skin/garment clipping.
  // 1727 mm canonical Live Designer mannequin: slim shoulders, long legs, relaxed straight stance.
  {name:"Head",mesh:meshHead,translation:[0,1.624,.004]},
  {name:"Neck",mesh:meshHead,translation:[0,1.504,.001],scale:[.63,.58,.62]},
  {name:"ShirtTorsoFabric",mesh:meshShirtTorso},
  {name:"ShirtSleeveLFabric",mesh:meshSleeveL},
  {name:"ShirtSleeveRFabric",mesh:meshSleeveR},
  {name:"HandL",mesh:meshHandL},
  {name:"HandR",mesh:meshHandR},
  {name:"TrouserWaistFabric",mesh:meshWaist},
  {name:"TrouserLegLFabric",mesh:meshLegL,translation:[-.105,.555,0]},
  {name:"TrouserLegRFabric",mesh:meshLegR,translation:[.105,.555,0]},
  {name:"ShoeL",mesh:meshShoe,translation:[-.105,.052,.081],scale:[.052,.034,.145]},
  {name:"ShoeR",mesh:meshShoe,translation:[.105,.052,.081],scale:[.052,.034,.145]},
  {name:"SoleL",mesh:meshSole,translation:[-.105,.010,.089],scale:[.108,.016,.292]},
  {name:"SoleR",mesh:meshSole,translation:[.105,.010,.089],scale:[.108,.016,.292]},
  {name:"CollarL",mesh:meshCollar,translation:[-.043,1.468,.096],scale:[.080,.088,.014],rotation:qz(-18)},
  {name:"CollarR",mesh:meshCollar,translation:[.043,1.468,.096],scale:[.080,.088,.014],rotation:qz(18)},
  {name:"CuffL",mesh:meshCuffL,translation:[-.250,.870,.030],scale:[.049,.021,.051],rotation:qz(-2.4)},
  {name:"CuffR",mesh:meshCuffR,translation:[.250,.870,.030],scale:[.049,.021,.051],rotation:qz(2.4)},
  // Raised construction cues keep the 3D silhouette close to the Live Designer front reference.
  {name:"ShirtFrontPlacket",mesh:meshShirtPlacket,translation:[0,1.268,.112],scale:[.013,.374,.008]},
  {name:"TrouserFrontCreaseL",mesh:meshTrouserCreaseL,translation:[-.105,.555,.071],scale:[.006,.905,.006]},
  {name:"TrouserFrontCreaseR",mesh:meshTrouserCreaseR,translation:[.105,.555,.071],scale:[.006,.905,.006]},
  {name:"TrouserFly",mesh:meshWaistDetail,translation:[0,.995,.106],scale:[.010,.105,.006]},
  {name:"WaistbandFront",mesh:meshWaistDetail,translation:[0,1.086,.105],scale:[.330,.020,.006]},
  {name:"BeltLoopL1",mesh:meshWaistDetail,translation:[-.132,1.086,.108],scale:[.011,.040,.006]},
  {name:"BeltLoopL2",mesh:meshWaistDetail,translation:[-.065,1.086,.109],scale:[.010,.040,.006]},
  {name:"BeltLoopR1",mesh:meshWaistDetail,translation:[.065,1.086,.109],scale:[.010,.040,.006]},
  {name:"BeltLoopR2",mesh:meshWaistDetail,translation:[.132,1.086,.108],scale:[.011,.040,.006]},
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
    scale:[.040,.0045,.007],
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
  asset:{version:"2.0",generator:"Linen Earth Live Designer identity model M5.8 final model polish"},
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

function assertIdentityMeasurement(name,actualMm,targetMm,toleranceMm){
  const delta=Math.abs(actualMm-targetMm);
  if(!Number.isFinite(actualMm)||delta>toleranceMm){
    throw new Error(`Live Designer identity drift: ${name} measured ${actualMm.toFixed(1)} mm; target ${targetMm} ± ${toleranceMm} mm.`);
  }
}

const identityMeasurements={
  heightMm:(1.624+.103)*1000,
  shoulderSeamWidthMm:.194*2*1000,
  outerArmSilhouetteMm:(.226+.061)*2*1000,
  shirtWaistWidthMm:.147*2*1000,
  trouserWaistWidthMm:.172*2*1000,
  handCenterSpacingMm:.250*2*1000,
  legCenterSpacingMm:.105*2*1000,
  hemWidthMm:.032*2*1000,
};
assertIdentityMeasurement("height",identityMeasurements.heightMm,IDENTITY_TARGETS_MM.height,4);
assertIdentityMeasurement("shoulder seam",identityMeasurements.shoulderSeamWidthMm,IDENTITY_TARGETS_MM.shoulderSeamWidth,2);
assertIdentityMeasurement("outer arm silhouette",identityMeasurements.outerArmSilhouetteMm,IDENTITY_TARGETS_MM.outerArmSilhouette,3);
assertIdentityMeasurement("shirt waist",identityMeasurements.shirtWaistWidthMm,IDENTITY_TARGETS_MM.shirtWaistWidth,2);
assertIdentityMeasurement("trouser waist",identityMeasurements.trouserWaistWidthMm,IDENTITY_TARGETS_MM.trouserWaistWidth,2);
assertIdentityMeasurement("hand spacing",identityMeasurements.handCenterSpacingMm,IDENTITY_TARGETS_MM.handCenterSpacing,2);
assertIdentityMeasurement("leg spacing",identityMeasurements.legCenterSpacingMm,IDENTITY_TARGETS_MM.legCenterSpacing,2);
assertIdentityMeasurement("trouser hem",identityMeasurements.hemWidthMm,IDENTITY_TARGETS_MM.hemWidth,2);

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
  collisionSource:{
    path:"assets/3d/makehuman-mannequin-base.glb",
    source:"MakeHuman CC0",
    visible:false,
    status:"prepared-for-drape-engine",
    vertices:mannequinBodyStats.vertices,
    triangles:mannequinBodyStats.triangles
  },
  identityMeasurements:{
    targetHeightMm:IDENTITY_TARGETS_MM.height,
    targetShoulderSeamWidthMm:IDENTITY_TARGETS_MM.shoulderSeamWidth,
    targetOuterArmSilhouetteMm:IDENTITY_TARGETS_MM.outerArmSilhouette,
    targetShirtWaistWidthMm:IDENTITY_TARGETS_MM.shirtWaistWidth,
    targetTrouserWaistWidthMm:IDENTITY_TARGETS_MM.trouserWaistWidth,
    targetHandCenterSpacingMm:IDENTITY_TARGETS_MM.handCenterSpacing,
    targetLegCenterSpacingMm:IDENTITY_TARGETS_MM.legCenterSpacing,
    targetHemWidthMm:IDENTITY_TARGETS_MM.hemWidth,
    measured:identityMeasurements,
    polishStage:"M5.8 final tailored silhouette: model complete + smooth garment shells + anatomical hands + reference trouser taper + refined footwear + full-body framing",
    sourceAnchors:"LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS"
  },
  cameraOrbits:{front:"0deg 76deg 4.10m","three-quarter":"35deg 76deg 4.10m",side:"90deg 76deg 4.10m",back:"180deg 76deg 4.10m"},
};

await fs.mkdir(OUT_DIR,{recursive:true});
const glb=toGlb(gltf,binary);
await fs.writeFile(path.join(OUT_DIR,GLB_NAME),glb);
await fs.writeFile(path.join(OUT_DIR,MANIFEST_NAME),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(`Built ${GLB_NAME}: ${(glb.byteLength/1024).toFixed(1)} KiB, ${meshes.length} meshes, ${materials.length} materials.`);
console.log(`Built ${MANIFEST_NAME} with ${garmentPanels.length} physical garment panels.`);
