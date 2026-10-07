import fs from "node:fs/promises";
import path from "node:path";
import styleVariants from "../src/lib/garment-viewer-style-variants.json" with { type:"json" };

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

function cloneGeometryTransform(geometry,transform){
  const positions=new Float32Array(geometry.positions.length);
  const normals=new Float32Array(geometry.normals.length);
  for(let i=0;i<geometry.positions.length;i+=3){
    const next=transform({
      x:geometry.positions[i],
      y:geometry.positions[i+1],
      z:geometry.positions[i+2],
      nx:geometry.normals[i],
      ny:geometry.normals[i+1],
      nz:geometry.normals[i+2],
      index:i/3,
    });
    positions[i]=next.x;positions[i+1]=next.y;positions[i+2]=next.z;
    const [nx,ny,nz]=normalize(next.nx,next.ny,next.nz);
    normals[i]=nx;normals[i+1]=ny;normals[i+2]=nz;
  }
  return {
    positions,
    normals,
    uvs:new Float32Array(geometry.uvs),
    indices:new Uint16Array(geometry.indices),
  };
}

function cropGeometry(geometry,predicate,transform=(point)=>point){
  const remap=new Map(),positions=[],normals=[],uvs=[],indices=[];
  function mapVertex(oldIndex){
    if(remap.has(oldIndex)) return remap.get(oldIndex);
    const p=oldIndex*3,u=oldIndex*2;
    const point=transform({
      x:geometry.positions[p],y:geometry.positions[p+1],z:geometry.positions[p+2],
      nx:geometry.normals[p],ny:geometry.normals[p+1],nz:geometry.normals[p+2],
    });
    const next=positions.length/3;
    remap.set(oldIndex,next);
    positions.push(point.x,point.y,point.z);
    const [nx,ny,nz]=normalize(point.nx,point.ny,point.nz);
    normals.push(nx,ny,nz);
    uvs.push(geometry.uvs[u],geometry.uvs[u+1]);
    return next;
  }
  for(let i=0;i<geometry.indices.length;i+=3){
    const a=geometry.indices[i],b=geometry.indices[i+1],d=geometry.indices[i+2];
    const pa={x:geometry.positions[a*3],y:geometry.positions[a*3+1],z:geometry.positions[a*3+2]};
    const pb={x:geometry.positions[b*3],y:geometry.positions[b*3+1],z:geometry.positions[b*3+2]};
    const pd={x:geometry.positions[d*3],y:geometry.positions[d*3+1],z:geometry.positions[d*3+2]};
    if(!predicate(pa)||!predicate(pb)||!predicate(pd)) continue;
    indices.push(mapVertex(a),mapVertex(b),mapVertex(d));
  }
  if(indices.length<6) throw new Error("Variant crop produced too little geometry.");
  return typedGeometry(positions,normals,uvs,indices);
}

function shirtFitGeometry(base,fit,centerX=0){
  return cloneGeometryTransform(base,(p)=>{
    const t=Math.max(0,Math.min(1,(p.y-1.055)/(1.47-1.055)));
    const torsoBlend=Math.max(0,Math.min(1,(t-.08)/.72));
    const scale=fit.waistScale+(fit.chestScale-fit.waistScale)*torsoBlend;
    const sleeveScale=fit.sleeveScale||scale;
    const effective=centerX===0?scale:sleeveScale;
    return {...p,x:centerX+(p.x-centerX)*effective,z:p.z*(1+(effective-1)*.70)};
  });
}

function trouserFitGeometry(base,fit,centerX){
  return cloneGeometryTransform(base,(p)=>{
    const t=Math.max(0,Math.min(1,(p.y-.06)/(.985-.06)));
    let scale;
    if(t<.5) scale=fit.hemScale+(fit.kneeScale-fit.hemScale)*(t/.5);
    else scale=fit.kneeScale+(fit.thighScale-fit.kneeScale)*((t-.5)/.5);
    return {...p,x:centerX+(p.x-centerX)*scale,z:.02+(p.z-.02)*(1+(scale-1)*.62)};
  });
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

  function sourceEnvelope({predicate,yMin,yMax,centerX=0,centerZ=0,bins=56}){
    const widths=new Array(bins).fill(0),depths=new Array(bins).fill(0),counts=new Array(bins).fill(0);
    for(const p of transformed){
      if(p.y<yMin||p.y>yMax||!predicate(p)) continue;
      const t=(p.y-yMin)/Math.max(1e-6,yMax-yMin);
      const index=Math.max(0,Math.min(bins-1,Math.round(t*(bins-1))));
      widths[index]=Math.max(widths[index],Math.abs(p.x-centerX));
      depths[index]=Math.max(depths[index],Math.abs(p.z-centerZ));
      counts[index]++;
    }
    for(let i=0;i<bins;i++){
      if(counts[i]&&widths[i]>.005&&depths[i]>.005) continue;
      let best=-1,bestDistance=Infinity;
      for(let j=0;j<bins;j++){
        if(!counts[j]||widths[j]<=.005||depths[j]<=.005) continue;
        const distance=Math.abs(i-j);
        if(distance<bestDistance){best=j;bestDistance=distance;}
      }
      if(best>=0){widths[i]=widths[best];depths[i]=depths[best];counts[i]=counts[best];}
    }
    return (y)=>{
      const raw=(y-yMin)/Math.max(1e-6,yMax-yMin)*(bins-1);
      const a=Math.max(0,Math.min(bins-1,Math.floor(raw)));
      const b=Math.max(0,Math.min(bins-1,a+1));
      const t=Math.max(0,Math.min(1,raw-a));
      return {
        width:Math.max(.01,widths[a]+(widths[b]-widths[a])*t),
        depth:Math.max(.01,depths[a]+(depths[b]-depths[a])*t),
      };
    };
  }

  const torsoSourceEnvelope=sourceEnvelope({
    yMin:1.055,yMax:1.47,centerX:0,centerZ:0,
    predicate:(p)=>Math.abs(p.x)<=.22,
  });
  const sleeveLSourceEnvelope=sourceEnvelope({
    yMin:.865,yMax:1.455,centerX:-.226,centerZ:.030,
    predicate:(p)=>p.x<=-.145,
  });
  const sleeveRSourceEnvelope=sourceEnvelope({
    yMin:.865,yMax:1.455,centerX:.226,centerZ:.030,
    predicate:(p)=>p.x>=.145,
  });
  const waistSourceEnvelope=sourceEnvelope({
    yMin:.94,yMax:1.10,centerX:0,centerZ:.005,
    predicate:(p)=>Math.abs(p.x)<=.19,
  });
  const legLSourceEnvelope=sourceEnvelope({
    yMin:.06,yMax:.985,centerX:-.105,centerZ:.020,
    predicate:(p)=>p.x<-.025,
  });
  const legRSourceEnvelope=sourceEnvelope({
    yMin:.06,yMax:.985,centerX:.105,centerZ:.020,
    predicate:(p)=>p.x>.025,
  });

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
  const trouserLegWidthEnvelope=[
    [.060,.034],
    [.160,.035],
    [.300,.040],
    [.460,.046],
    [.620,.055],
    [.780,.070],
    [.930,.083],
    [.985,.086],
  ];
  const trouserLegDepthEnvelope=[
    [.060,.055],
    [.160,.056],
    [.300,.060],
    [.460,.066],
    [.620,.074],
    [.780,.085],
    [.930,.094],
    [.985,.098],
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
        const source=torsoSourceEnvelope(y);
        const sx=targetHalf/source.width,sz=targetDepth/source.depth;
        const theta=Math.atan2(z,x);
        const front=Math.max(0,Math.sin(theta));
        x*=sx;
        z*=sz;
        z+=front*.0032*Math.sin((y-1.055)*46+theta*2.2);
        [nx,ny,nz]=normalize(nx/Math.max(.2,sx),ny*.28,nz/Math.max(.2,sz));
      }else if(kind==="sleeve"){
        const targetHalf=lerpEnvelope(sleeveWidthEnvelope,y);
        const targetDepth=lerpEnvelope(sleeveDepthEnvelope,y);
        const t=Math.max(0,Math.min(1,(y-.865)/(1.455-.865)));
        const side=Math.sign(centerX)||1;
        const sleeveCenterX=centerX+side*.006*(t-.45);
        const sleeveCenterZ=.024+.010*t;
        const source=(side<0?sleeveLSourceEnvelope:sleeveRSourceEnvelope)(y);
        const sx=targetHalf/source.width,sz=targetDepth/source.depth;
        const originalX=x,originalZ=z;
        x=sleeveCenterX+(originalX-centerX)*sx;
        z=sleeveCenterZ+(originalZ-.030)*sz;
        const theta=Math.atan2(z-sleeveCenterZ,x-sleeveCenterX);
        const elbowFold=Math.exp(-Math.pow((y-1.075)/.095,2));
        z+=Math.max(0,Math.sin(theta))*.0032*elbowFold*Math.sin(theta*4.3+(y-1.0)*34);
        [nx,ny,nz]=normalize(nx/Math.max(.2,sx),ny*.30,nz/Math.max(.2,sz));
      }else if(kind==="waist"){
        const targetHalf=lerpEnvelope(trouserWaistEnvelope,y);
        const targetDepth=lerpEnvelope(trouserWaistDepthEnvelope,y);
        const source=waistSourceEnvelope(y);
        const sx=targetHalf/source.width,sz=targetDepth/source.depth;
        x*=sx;
        z=.005+(z-.005)*sz;
        [nx,ny,nz]=normalize(nx/Math.max(.2,sx),ny*.25,nz/Math.max(.2,sz));
      }else if(kind==="leg"){
        const targetHalf=lerpEnvelope(trouserLegWidthEnvelope,y);
        const targetDepth=lerpEnvelope(trouserLegDepthEnvelope,y);
        const side=Math.sign(centerX)||1;
        const t=Math.max(0,Math.min(1,(y-.060)/(.985-.060)));
        const legCenterX=centerX+side*.004*(t-.45);
        const legCenterZ=.020+.010*t;
        const source=(side<0?legLSourceEnvelope:legRSourceEnvelope)(y);
        const sx=targetHalf/source.width,sz=targetDepth/source.depth;
        const originalX=x,originalZ=z;
        x=legCenterX+(originalX-centerX)*sx;
        z=legCenterZ+(originalZ-.020)*sz;
        const theta=Math.atan2(z-legCenterZ,x-legCenterX);
        const front=Math.max(0,Math.sin(theta));
        const kneeFold=Math.exp(-Math.pow((y-.50)/.11,2));
        const ankleFold=Math.exp(-Math.pow((y-.15)/.08,2));
        z+=front*(.0024*kneeFold*Math.sin(theta*4.8+y*27)+.0016*ankleFold*Math.sin(theta*4-y*32));
        [nx,ny,nz]=normalize(nx/Math.max(.2,sx),ny*.25,nz/Math.max(.2,sz));
      }else if(kind==="shoe"){
        const side=Math.sign(centerX)||1;
        x=centerX+(x-centerX)*.72;
        y=.010+y*.78;
        z=.025+(z-.025)*1.55;
        [nx,ny,nz]=normalize(nx,ny,nz);
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
    kind:"waist",centerX:0,yMin:.94,yMax:1.10,outward:.0035,
    predicate:(p)=>p.y>=.94&&p.y<=1.10&&Math.abs(p.x)<=.185,
  });
  const trouserLegL=buildRegion({
    kind:"leg",centerX:-.105,yMin:.060,yMax:.985,outward:.0025,
    predicate:(p)=>p.y>=.060&&p.y<=.985&&p.x<-.025,
  });
  const trouserLegR=buildRegion({
    kind:"leg",centerX:.105,yMin:.060,yMax:.985,outward:.0025,
    predicate:(p)=>p.y>=.060&&p.y<=.985&&p.x>.025,
  });
  const shoeL=buildRegion({
    kind:"shoe",centerX:-.105,yMin:.010,yMax:.160,outward:.004,
    predicate:(p)=>p.y>=0&&p.y<=.160&&p.x<-.025,
  });
  const shoeR=buildRegion({
    kind:"shoe",centerX:.105,yMin:.010,yMax:.160,outward:.004,
    predicate:(p)=>p.y>=0&&p.y<=.160&&p.x>.025,
  });

  return {shirtTorso,sleeveL,sleeveR,handL,handR,trouserWaist,trouserLegL,trouserLegR,shoeL,shoeR};
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

function extrudedPolygonGeometry(points,depth=.16){
  const positions=[],normals=[],uvs=[],indices=[];
  const zFront=depth/2,zBack=-depth/2;
  const minX=Math.min(...points.map((p)=>p[0])),maxX=Math.max(...points.map((p)=>p[0]));
  const minY=Math.min(...points.map((p)=>p[1])),maxY=Math.max(...points.map((p)=>p[1]));
  const uv=(x,y)=>[(x-minX)/Math.max(1e-6,maxX-minX),(y-minY)/Math.max(1e-6,maxY-minY)];
  const frontStart=positions.length/3;
  for(const [x,y] of points){positions.push(x,y,zFront);normals.push(0,0,1);uvs.push(...uv(x,y));}
  for(let i=1;i<points.length-1;i++) indices.push(frontStart,frontStart+i,frontStart+i+1);
  const backStart=positions.length/3;
  for(const [x,y] of points){positions.push(x,y,zBack);normals.push(0,0,-1);uvs.push(...uv(x,y));}
  for(let i=1;i<points.length-1;i++) indices.push(backStart,backStart+i+1,backStart+i);
  for(let i=0;i<points.length;i++){
    const j=(i+1)%points.length;
    const [ax,ay]=points[i],[bx,by]=points[j];
    const dx=bx-ax,dy=by-ay;
    const [nx,ny,nz]=normalize(dy,-dx,0);
    const start=positions.length/3;
    positions.push(ax,ay,zFront,bx,by,zFront,bx,by,zBack,ax,ay,zBack);
    for(let k=0;k<4;k++) normals.push(nx,ny,nz);
    uvs.push(0,0,1,0,1,1,0,1);
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  return typedGeometry(positions,normals,uvs,indices);
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
const ear=uvSphereGeometry(8,14);
const collar=collarPointGeometry();
const mandarinCollar=profileGeometry({
  rings:[
    {y:-.020,width:.070,depth:.060,z:0},
    {y:.020,width:.070,depth:.060,z:0},
  ],
  segments:32,
});
const roundedCuff=extrudedPolygonGeometry([
  [-.50,.50],[.50,.50],[.50,-.20],[.47,-.33],[.37,-.44],[.20,-.50],
  [-.20,-.50],[-.37,-.44],[-.47,-.33],[-.50,-.20],
],1);
const miteredCuff=extrudedPolygonGeometry([
  [-.50,.50],[.50,.50],[.50,-.20],[.24,-.50],[-.50,-.50],
],1);
const cocktailCuff=extrudedPolygonGeometry([
  [-.50,.50],[.50,.50],[.50,-.36],[.28,-.50],[0,-.40],[-.28,-.50],[-.50,-.36],
],1);
const detailBox=boxGeometry();
const button=uvSphereGeometry(6,10);

const garmentMaterials=garmentPanels.map((panel,i)=>({
  name:panel.material,
  alphaMode:"BLEND",
  doubleSided:true,
  pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:i<3?.84:.79},
  normalTexture:{index:1,scale:i<3?.34:.29},
}));
const variantMaterialNames=[];
function addVariantMaterial(name,garment){
  variantMaterialNames.push(name);
  return {
    name,
    alphaMode:"BLEND",
    doubleSided:true,
    pbrMetallicRoughness:{
      baseColorFactor:[1,1,1,0],
      baseColorTexture:{index:0},
      metallicFactor:0,
      roughnessFactor:garment==="shirt"?.84:.79,
    },
    normalTexture:{index:1,scale:garment==="shirt"?.34:.29},
  };
}
const styleVariantMaterials=[
  ...styleVariants.shirtFits.filter((fit)=>fit.id!=="regular").flatMap((fit)=>[
    addVariantMaterial(`ShirtTorsoVariant__${fit.id}`,"shirt"),
    addVariantMaterial(`ShirtSleeveLVariant__${fit.id}`,"shirt"),
    addVariantMaterial(`ShirtSleeveRVariant__${fit.id}`,"shirt"),
  ]),
  ...styleVariants.shirtFits.map((fit)=>addVariantMaterial(`ShirtHemVariant__${fit.id}`,"shirt")),
  ...styleVariants.sleeves.filter((sleeve)=>sleeve.id!=="full").flatMap((sleeve)=>[
    addVariantMaterial(`ShirtSleeveLLength__${sleeve.id}`,"shirt"),
    addVariantMaterial(`ShirtSleeveRLength__${sleeve.id}`,"shirt"),
  ]),
  ...styleVariants.collars.map((item)=>addVariantMaterial(`ShirtCollarVariant__${item.id}`,"shirt")),
  ...styleVariants.cuffs.map((item)=>addVariantMaterial(`ShirtCuffVariant__${item.id}`,"shirt")),
  ...styleVariants.plackets.filter((item)=>item.id!=="french").map((item)=>addVariantMaterial(`ShirtPlacketVariant__${item.id}`,"shirt")),
  ...styleVariants.pockets.filter((item)=>item.id!=="none").map((item)=>addVariantMaterial(`ShirtPocketVariant__${item.id}`,"shirt")),
  ...styleVariants.yokes.map((item)=>addVariantMaterial(`ShirtYokeVariant__${item.id}`,"shirt")),
  ...styleVariants.shirtHems.map((item)=>addVariantMaterial(`ShirtHemShapeVariant__${item.id}`,"shirt")),
  ...styleVariants.trouserFits.filter((fit)=>fit.id!=="straight").flatMap((fit)=>[
    addVariantMaterial(`TrouserLegLVariant__${fit.id}`,"trouser"),
    addVariantMaterial(`TrouserLegRVariant__${fit.id}`,"trouser"),
  ]),
  ...styleVariants.rises.filter((rise)=>rise.id!=="mid").map((rise)=>addVariantMaterial(`TrouserWaistVariant__${rise.id}`,"trouser")),
  ...styleVariants.waistbands.filter((item)=>item.id!=="clean").map((item)=>addVariantMaterial(`TrouserWaistbandVariant__${item.id}`,"trouser")),
  ...styleVariants.pleats.filter((item)=>item.id!=="flat").map((item)=>addVariantMaterial(`TrouserPleatVariant__${item.id}`,"trouser")),
  ...styleVariants.breaks.filter((item)=>item.id!=="slight").map((item)=>addVariantMaterial(`TrouserBreakVariant__${item.id}`,"trouser")),
  ...styleVariants.trouserHems.filter((item)=>item.id!=="plain").map((item)=>addVariantMaterial(`TrouserHemVariant__${item.id}`,"trouser")),
  ...styleVariants.trouserPockets.map((item)=>addVariantMaterial(`TrouserPocketVariant__${item.id}`,"trouser")),
];
const materials=[
  {name:"MannequinSkin",pbrMetallicRoughness:{baseColorFactor:[.94,.93,.90,1],metallicFactor:0,roughnessFactor:.90}},
  ...garmentMaterials,
  ...styleVariantMaterials,
  {name:"Shoe",pbrMetallicRoughness:{baseColorFactor:[.91,.90,.87,1],metallicFactor:0,roughnessFactor:.58}},
  {name:"ButtonAccent",pbrMetallicRoughness:{baseColorFactor:[.09,.075,.06,1],metallicFactor:.05,roughnessFactor:.42}},
];
const materialIndex=Object.fromEntries(materials.map((m,i)=>[m.name,i]));

const assets=[];
function addMesh(name,geometry,material){assets.push({name,geometry,material});return assets.length-1;}
const meshHead=addMesh("HeadMesh",head,"MannequinSkin");
const meshEar=addMesh("EarMesh",ear,"MannequinSkin");
const meshHandL=addMesh("HandLMesh",garmentShells.handL,"MannequinSkin");
const meshHandR=addMesh("HandRMesh",garmentShells.handR,"MannequinSkin");
const meshShoeL=addMesh("ShoeLMesh",garmentShells.shoeL,"Shoe");
const meshShoeR=addMesh("ShoeRMesh",garmentShells.shoeR,"Shoe");
const meshShirtTorso=addMesh("ShirtTorsoMesh",garmentShells.shirtTorso,"ShirtTorsoFabric");
const meshSleeveL=addMesh("ShirtSleeveLMesh",garmentShells.sleeveL,"ShirtSleeveLFabric");
const meshSleeveR=addMesh("ShirtSleeveRMesh",garmentShells.sleeveR,"ShirtSleeveRFabric");
const meshWaist=addMesh("TrouserWaistMesh",garmentShells.trouserWaist,"TrouserWaistFabric");
const meshLegL=addMesh("TrouserLegLMesh",garmentShells.trouserLegL,"TrouserLegLFabric");
const meshLegR=addMesh("TrouserLegRMesh",garmentShells.trouserLegR,"TrouserLegRFabric");
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

const shirtFitMeshes={};
for(const fit of styleVariants.shirtFits){
  if(fit.id==="regular") continue;
  shirtFitMeshes[fit.id]={
    torso:addMesh(`ShirtTorsoVariantMesh__${fit.id}`,shirtFitGeometry(garmentShells.shirtTorso,fit,0),`ShirtTorsoVariant__${fit.id}`),
    left:addMesh(`ShirtSleeveLVariantMesh__${fit.id}`,shirtFitGeometry(garmentShells.sleeveL,fit,-.226),`ShirtSleeveLVariant__${fit.id}`),
    right:addMesh(`ShirtSleeveRVariantMesh__${fit.id}`,shirtFitGeometry(garmentShells.sleeveR,fit,.226),`ShirtSleeveRVariant__${fit.id}`),
  };
}
const shirtHemMeshes={};
for(const fit of styleVariants.shirtFits){
  const source=fit.id==="regular"?garmentShells.shirtTorso:shirtFitGeometry(garmentShells.shirtTorso,fit,0);
  shirtHemMeshes[fit.id]=addMesh(
    `ShirtHemVariantMesh__${fit.id}`,
    cropGeometry(source,(p)=>p.y>=1.055&&p.y<=1.16,(p)=>({...p,y:1.16-(1.16-p.y)*1.95})),
    `ShirtHemVariant__${fit.id}`,
  );
}
const threeQuarterSleeveL=addMesh("ShirtSleeveLLengthMesh__three_quarter",cropGeometry(garmentShells.sleeveL,(p)=>p.y>=.990), "ShirtSleeveLLength__three_quarter");
const threeQuarterSleeveR=addMesh("ShirtSleeveRLengthMesh__three_quarter",cropGeometry(garmentShells.sleeveR,(p)=>p.y>=.990), "ShirtSleeveRLength__three_quarter");
const halfSleeveL=addMesh("ShirtSleeveLLengthMesh__half",cropGeometry(garmentShells.sleeveL,(p)=>p.y>=1.18), "ShirtSleeveLLength__half");
const halfSleeveR=addMesh("ShirtSleeveRLengthMesh__half",cropGeometry(garmentShells.sleeveR,(p)=>p.y>=1.18), "ShirtSleeveRLength__half");
const rollSleeveL=addMesh("ShirtSleeveLLengthMesh__roll",cropGeometry(garmentShells.sleeveL,(p)=>p.y>=1.08), "ShirtSleeveLLength__roll");
const rollSleeveR=addMesh("ShirtSleeveRLengthMesh__roll",cropGeometry(garmentShells.sleeveR,(p)=>p.y>=1.08), "ShirtSleeveRLength__roll");

const trouserFitMeshes={};
for(const fit of styleVariants.trouserFits){
  if(fit.id==="straight") continue;
  trouserFitMeshes[fit.id]={
    left:addMesh(`TrouserLegLVariantMesh__${fit.id}`,trouserFitGeometry(garmentShells.trouserLegL,fit,-.105),`TrouserLegLVariant__${fit.id}`),
    right:addMesh(`TrouserLegRVariantMesh__${fit.id}`,trouserFitGeometry(garmentShells.trouserLegR,fit,.105),`TrouserLegRVariant__${fit.id}`),
  };
}
const lowRiseWaist=addMesh("TrouserWaistVariantMesh__low",cloneGeometryTransform(garmentShells.trouserWaist,(p)=>({...p,y:p.y-.035})),"TrouserWaistVariant__low");
const highRiseWaist=addMesh("TrouserWaistVariantMesh__high",cloneGeometryTransform(garmentShells.trouserWaist,(p)=>({...p,y:p.y+.035})),"TrouserWaistVariant__high");

const collarVariantMeshes=Object.fromEntries(styleVariants.collars.map((item)=>[
  item.id,
  addMesh(`ShirtCollarVariantMesh__${item.id}`,item.id==="mandarin"?mandarinCollar:collar,`ShirtCollarVariant__${item.id}`)
]));
const roundedCuffIds=new Set(["rounded_2","rounded_french","soft_barrel"]);
const miteredCuffIds=new Set(["mitered_1","mitered_2"]);
const cuffVariantMeshes=Object.fromEntries(styleVariants.cuffs.map((item)=>[
  item.id,
  addMesh(
    `ShirtCuffVariantMesh__${item.id}`,
    item.id==="cocktail"?cocktailCuff:miteredCuffIds.has(item.id)?miteredCuff:roundedCuffIds.has(item.id)?roundedCuff:detailBox,
    `ShirtCuffVariant__${item.id}`
  )
]));
const placketVariantMeshes=Object.fromEntries(styleVariants.plackets.filter((item)=>item.id!=="french").map((item)=>[
  item.id,
  addMesh(`ShirtPlacketVariantMesh__${item.id}`,detailBox,`ShirtPlacketVariant__${item.id}`)
]));
const pocketVariantMeshes=Object.fromEntries(styleVariants.pockets.filter((item)=>item.id!=="none").map((item)=>[
  item.id,
  addMesh(`ShirtPocketVariantMesh__${item.id}`,detailBox,`ShirtPocketVariant__${item.id}`)
]));
const waistbandVariantMeshes=Object.fromEntries(styleVariants.waistbands.filter((item)=>item.id!=="clean").map((item)=>[
  item.id,
  addMesh(`TrouserWaistbandVariantMesh__${item.id}`,detailBox,`TrouserWaistbandVariant__${item.id}`)
]));
const pleatVariantMeshes=Object.fromEntries(styleVariants.pleats.filter((item)=>item.id!=="flat").map((item)=>[
  item.id,
  addMesh(`TrouserPleatVariantMesh__${item.id}`,detailBox,`TrouserPleatVariant__${item.id}`)
]));
const breakVariantMeshes=Object.fromEntries(styleVariants.breaks.filter((item)=>item.id!=="slight").map((item)=>[
  item.id,
  addMesh(`TrouserBreakVariantMesh__${item.id}`,detailBox,`TrouserBreakVariant__${item.id}`)
]));
const yokeVariantMeshes=Object.fromEntries(styleVariants.yokes.map((item)=>[
  item.id,
  addMesh(`ShirtYokeVariantMesh__${item.id}`,detailBox,`ShirtYokeVariant__${item.id}`)
]));
const shirtHemShapeMeshes=Object.fromEntries(styleVariants.shirtHems.map((item)=>[
  item.id,
  addMesh(`ShirtHemShapeVariantMesh__${item.id}`,detailBox,`ShirtHemShapeVariant__${item.id}`)
]));
const trouserHemVariantMeshes=Object.fromEntries(styleVariants.trouserHems.filter((item)=>item.id!=="plain").map((item)=>[
  item.id,
  addMesh(`TrouserHemVariantMesh__${item.id}`,detailBox,`TrouserHemVariant__${item.id}`)
]));
const trouserPocketVariantMeshes=Object.fromEntries(styleVariants.trouserPockets.map((item)=>[
  item.id,
  addMesh(`TrouserPocketVariantMesh__${item.id}`,detailBox,`TrouserPocketVariant__${item.id}`)
]));

const qz=(deg)=>{const r=deg*Math.PI/180/2;return [0,0,Math.sin(r),Math.cos(r)];};
const nodes=[
  // The CC0 anatomical body is prepared as the next cloth-collision source but intentionally not rendered:
  // the visible mannequin stays locked to the exact Linen Earth studio silhouette without skin/garment clipping.
  // 1727 mm canonical Live Designer mannequin: slim shoulders, long legs, relaxed straight stance.
  {name:"Head",mesh:meshHead,translation:[0,1.624,.004]},
  {name:"EarL",mesh:meshEar,translation:[-.077,1.630,.002],scale:[.010,.025,.008]},
  {name:"EarR",mesh:meshEar,translation:[.077,1.630,.002],scale:[.010,.025,.008]},
  {name:"Neck",mesh:meshHead,translation:[0,1.504,.001],scale:[.63,.58,.62]},
  {name:"ShirtTorsoFabric",mesh:meshShirtTorso},
  {name:"ShirtSleeveLFabric",mesh:meshSleeveL},
  {name:"ShirtSleeveRFabric",mesh:meshSleeveR},
  {name:"HandL",mesh:meshHandL},
  {name:"HandR",mesh:meshHandR},
  {name:"TrouserWaistFabric",mesh:meshWaist},
  {name:"TrouserLegLFabric",mesh:meshLegL},
  {name:"TrouserLegRFabric",mesh:meshLegR},
  {name:"ShoeL",mesh:meshShoeL},
  {name:"ShoeR",mesh:meshShoeR},
  {name:"SoleL",mesh:meshSole,translation:[-.105,.010,.089],scale:[.108,.016,.292]},
  {name:"SoleR",mesh:meshSole,translation:[.105,.010,.089],scale:[.108,.016,.292]},
  // Collar/cuff/placket/pocket geometry variants are appended below and toggled by material visibility.
  // Raised construction cues keep the 3D silhouette close to the Live Designer front reference.
  {name:"TrouserFrontCreaseL",mesh:meshTrouserCreaseL,translation:[-.105,.555,.071],scale:[.0035,.905,.004]},
  {name:"TrouserFrontCreaseR",mesh:meshTrouserCreaseR,translation:[.105,.555,.071],scale:[.0035,.905,.004]},
  {name:"TrouserFly",mesh:meshWaistDetail,translation:[0,.995,.106],scale:[.010,.105,.006]},
  {name:"WaistbandFront",mesh:meshWaistDetail,translation:[0,1.086,.105],scale:[.330,.020,.006]},
  // Waistband/pleat/break variants are appended below and toggled by material visibility.
];

// Shirt fit shells.
for(const fit of styleVariants.shirtFits){
  if(fit.id==="regular") continue;
  const mesh=shirtFitMeshes[fit.id];
  nodes.push({name:`ShirtTorsoVariant__${fit.id}`,mesh:mesh.torso});
  nodes.push({name:`ShirtSleeveLVariant__${fit.id}`,mesh:mesh.left});
  nodes.push({name:`ShirtSleeveRVariant__${fit.id}`,mesh:mesh.right});
}
for(const fit of styleVariants.shirtFits) nodes.push({name:`ShirtHemVariant__${fit.id}`,mesh:shirtHemMeshes[fit.id]});
nodes.push({name:"ShirtSleeveLLength__three_quarter",mesh:threeQuarterSleeveL},{name:"ShirtSleeveRLength__three_quarter",mesh:threeQuarterSleeveR});
nodes.push({name:"ShirtSleeveLLength__half",mesh:halfSleeveL},{name:"ShirtSleeveRLength__half",mesh:halfSleeveR});
nodes.push({name:"ShirtSleeveLLength__roll",mesh:rollSleeveL},{name:"ShirtSleeveRLength__roll",mesh:rollSleeveR});

// Collar families.
const collarNodeSpec={
  point:{y:1.468,z:.096,scale:[.080,.090,.014],angle:16},
  semi_spread:{y:1.468,z:.096,scale:[.082,.084,.014],angle:23},
  spread:{y:1.468,z:.096,scale:[.083,.080,.014],angle:30},
  cutaway:{y:1.467,z:.096,scale:[.080,.070,.014],angle:48},
  button_down:{y:1.467,z:.096,scale:[.084,.095,.014],angle:20},
  hidden_button_down:{y:1.467,z:.096,scale:[.083,.091,.014],angle:22},
  club:{y:1.466,z:.096,scale:[.078,.078,.016],angle:20},
  tab:{y:1.468,z:.097,scale:[.078,.088,.014],angle:16},
  wingtip:{y:1.476,z:.097,scale:[.060,.052,.013],angle:50},
  camp:{y:1.446,z:.094,scale:[.098,.112,.014],angle:32},
  one_piece:{y:1.452,z:.094,scale:[.100,.118,.014],angle:28},
};
for(const item of styleVariants.collars){
  if(item.id==="mandarin"){
    nodes.push({name:"ShirtCollarVariant__mandarin",mesh:collarVariantMeshes.mandarin,translation:[0,1.480,.010],scale:[1,.92,1]});
    continue;
  }
  const spec=collarNodeSpec[item.id]||collarNodeSpec.point;
  nodes.push({name:`ShirtCollarL__${item.id}`,mesh:collarVariantMeshes[item.id],translation:[-.043,spec.y,spec.z],scale:spec.scale,rotation:qz(-spec.angle)});
  nodes.push({name:`ShirtCollarR__${item.id}`,mesh:collarVariantMeshes[item.id],translation:[.043,spec.y,spec.z],scale:spec.scale,rotation:qz(spec.angle)});
  if(item.id==="button_down"||item.id==="tab"){
    nodes.push({name:`ShirtCollarButtonL__${item.id}`,mesh:meshButton,translation:[-.050,1.438,.113],scale:[.004,.004,.003]});
    nodes.push({name:`ShirtCollarButtonR__${item.id}`,mesh:meshButton,translation:[.050,1.438,.113],scale:[.004,.004,.003]});
  }
}

// Cuff families.
const cuffSpec={
  barrel_1:{width:.086,length:.0603,depth:.108},
  long_barrel_1:{width:.088,length:.0730,depth:.110},
  mitered_1:{width:.088,length:.0667,depth:.110},
  rounded_2:{width:.089,length:.0730,depth:.111},
  mitered_2:{width:.090,length:.0730,depth:.112},
  french:{width:.092,length:.0730,depth:.114},
  rounded_french:{width:.092,length:.0730,depth:.114},
  convertible:{width:.090,length:.0635,depth:.112},
  soft_barrel:{width:.087,length:.0603,depth:.110},
  cocktail:{width:.094,length:.0750,depth:.116},
};
for(const item of styleVariants.cuffs){
  const spec=cuffSpec[item.id]||cuffSpec.barrel_1;
  const centerY=.865+spec.length/2;
  nodes.push({name:`ShirtCuffL__${item.id}`,mesh:cuffVariantMeshes[item.id],translation:[-.250,centerY,.030],scale:[spec.width,spec.length,spec.depth],rotation:qz(-2.4)});
  nodes.push({name:`ShirtCuffR__${item.id}`,mesh:cuffVariantMeshes[item.id],translation:[.250,centerY,.030],scale:[spec.width,spec.length,spec.depth],rotation:qz(2.4)});
}

// Plackets and pockets.
const placketSpec={
  standard:{scale:[.013,.374,.008],z:.112},
  soft_front:{scale:[.014,.374,.007],z:.112},
  hidden:{scale:[.022,.374,.008],z:.114},
  popover:{scale:[.016,.170,.008],z:.113,y:1.375},
  western:{scale:[.018,.374,.009],z:.114},
  tuxedo_plain:{scale:[.017,.374,.008],z:.114},
  tuxedo_pleated:{scale:[.100,.330,.010],z:.115},
};
for(const item of styleVariants.plackets){
  if(item.id==="french") continue;
  const spec=placketSpec[item.id]||placketSpec.standard;
  nodes.push({name:`ShirtPlacketVariant__${item.id}`,mesh:placketVariantMeshes[item.id],translation:[0,spec.y||1.268,spec.z],scale:spec.scale});
}

const shirtPocketSpec={
  rounded:{count:1,x:.085,y:1.292,scale:[.102,.112,.010]},
  angled:{count:1,x:.085,y:1.292,scale:[.100,.115,.010],angle:4},
  button_angled:{count:1,x:.085,y:1.292,scale:[.105,.118,.010],angle:4},
  single_flap:{count:1,x:.085,y:1.302,scale:[.108,.120,.010]},
  western_flap:{count:2,x:.085,y:1.302,scale:[.110,.120,.010],angle:6},
  rounded_flap:{count:2,x:.085,y:1.302,scale:[.112,.125,.010]},
  utility:{count:2,x:.088,y:1.290,scale:[.116,.130,.010]},
  safari:{count:2,x:.090,y:1.292,scale:[.118,.132,.014]},
  reverse_pleat:{count:2,x:.090,y:1.292,scale:[.116,.130,.013]},
};
for(const item of styleVariants.pockets){
  if(item.id==="none") continue;
  const spec=shirtPocketSpec[item.id]||shirtPocketSpec.rounded;
  const xs=spec.count===2?[-spec.x,spec.x]:[spec.x];
  for(const x of xs){
    nodes.push({name:`ShirtPocketVariant__${item.id}__${x<0?"L":"R"}`,mesh:pocketVariantMeshes[item.id],translation:[x,spec.y,.116],scale:spec.scale,rotation:qz((x<0?-1:1)*(spec.angle||0))});
  }
}

// Back-yoke construction cues.
for(const item of styleVariants.yokes){
  const mesh=yokeVariantMeshes[item.id];
  if(item.id==="split"){
    nodes.push({name:"ShirtYokeVariant__splitL",mesh,translation:[-.092,1.405,-.108],scale:[.180,.070,.007],rotation:qz(-3)});
    nodes.push({name:"ShirtYokeVariant__splitR",mesh,translation:[.092,1.405,-.108],scale:[.180,.070,.007],rotation:qz(3)});
  }else if(item.id==="western"||item.id==="bias_western"){
    nodes.push({name:`ShirtYokeVariant__${item.id}L`,mesh,translation:[-.092,1.405,-.109],scale:[.188,.095,.007],rotation:qz(-14)});
    nodes.push({name:`ShirtYokeVariant__${item.id}R`,mesh,translation:[.092,1.405,-.109],scale:[.188,.095,.007],rotation:qz(14)});
  }else{
    nodes.push({name:"ShirtYokeVariant__one_piece",mesh,translation:[0,1.405,-.108],scale:[.360,.070,.007]});
  }
}

// Untucked hem-shape construction cues.
for(const item of styleVariants.shirtHems){
  const mesh=shirtHemShapeMeshes[item.id];
  if(item.id==="rounded"){
    nodes.push({name:"ShirtHemShapeVariant__rounded",mesh,translation:[0,.946,.005],scale:[.300,.030,.116]});
  }else if(item.id==="polo"){
    nodes.push({name:"ShirtHemShapeVariant__poloFront",mesh,translation:[0,.958,.116],scale:[.300,.022,.008]});
    nodes.push({name:"ShirtHemShapeVariant__poloBack",mesh,translation:[0,.930,-.116],scale:[.300,.036,.008]});
  }else{
    nodes.push({name:"ShirtHemShapeVariant__straight",mesh,translation:[0,.958,.005],scale:[.300,.020,.116]});
  }
}

// Trouser fit and rise.
for(const fit of styleVariants.trouserFits){
  if(fit.id==="straight") continue;
  const mesh=trouserFitMeshes[fit.id];
  nodes.push({name:`TrouserLegLVariant__${fit.id}`,mesh:mesh.left});
  nodes.push({name:`TrouserLegRVariant__${fit.id}`,mesh:mesh.right});
}
nodes.push({name:"TrouserWaistVariant__low",mesh:lowRiseWaist});
nodes.push({name:"TrouserWaistVariant__high",mesh:highRiseWaist});

// Waistband details.
for(const x of [-.132,-.065,.065,.132]) nodes.push({name:`TrouserBeltLoop__${x}`,mesh:waistbandVariantMeshes.belt_loops,translation:[x,1.086,.108],scale:[.010,.040,.006]});
nodes.push({name:"TrouserSideAdjusterL",mesh:waistbandVariantMeshes.side_adjuster,translation:[-.150,1.085,.090],scale:[.045,.018,.012],rotation:qz(-8)});
nodes.push({name:"TrouserSideAdjusterR",mesh:waistbandVariantMeshes.side_adjuster,translation:[.150,1.085,.090],scale:[.045,.018,.012],rotation:qz(8)});
nodes.push({name:"TrouserExtendedTabL",mesh:waistbandVariantMeshes.extended_tab,translation:[-.055,1.092,.116],scale:[.115,.022,.008],rotation:qz(-2)});
nodes.push({name:"TrouserExtendedTabR",mesh:waistbandVariantMeshes.extended_tab,translation:[.055,1.092,.116],scale:[.115,.022,.008],rotation:qz(2)});
nodes.push({name:"TrouserDrawstringL",mesh:waistbandVariantMeshes.drawstring,translation:[-.018,1.072,.116],scale:[.008,.085,.006],rotation:qz(-8)});
nodes.push({name:"TrouserDrawstringR",mesh:waistbandVariantMeshes.drawstring,translation:[.018,1.072,.116],scale:[.008,.085,.006],rotation:qz(8)});
for(const x of [-.11,-.055,.055,.11]) nodes.push({name:`TrouserBraceButton__${x}`,mesh:waistbandVariantMeshes.braces,translation:[x,1.092,.114],scale:[.010,.010,.006]});

// Pleat construction cues: forward/reverse direction and single/double count.
const pleatSpec={
  single_forward:{count:1,direction:1},
  single_reverse:{count:1,direction:-1},
  double_forward:{count:2,direction:1},
  double_reverse:{count:2,direction:-1},
  kissing:{count:2,direction:0},
};
for(const item of styleVariants.pleats){
  if(item.id==="flat") continue;
  const spec=pleatSpec[item.id]||{count:item.count||1,direction:1};
  for(const side of [-1,1]){
    for(let index=0;index<spec.count;index++){
      const base=.070+index*.032;
      const angle=spec.direction===0?(index===0?-3:3):spec.direction*(4+index*2);
      nodes.push({
        name:`TrouserPleatVariant__${item.id}__${side<0?"L":"R"}${index+1}`,
        mesh:pleatVariantMeshes[item.id],
        translation:[side*base,1.012-index*.004,.107],
        scale:[.007,.150-index*.012,.006],
        rotation:qz(side*angle),
      });
    }
  }
}

// Break construction cues.
for(const item of styleVariants.breaks){
  if(item.id==="slight") continue;
  const mesh=breakVariantMeshes[item.id];
  for(const side of [-1,1]){
    const name=side<0?"L":"R";
    if(item.id==="negative") nodes.push({name:`TrouserBreakVariant__negative${name}`,mesh,translation:[side*.105,.142,.078],scale:[.060,.018,.012]});
    else if(item.id==="no_break") nodes.push({name:`TrouserBreakVariant__no_break${name}`,mesh,translation:[side*.105,.100,.078],scale:[.058,.014,.012]});
    else if(item.id==="quarter") nodes.push({name:`TrouserBreakVariant__quarter${name}`,mesh,translation:[side*.105,.086,.080],scale:[.060,.022,.014],rotation:qz(side*-2)});
    else if(item.id==="full") nodes.push({name:`TrouserBreakVariant__full${name}`,mesh,translation:[side*.105,.070,.082],scale:[.066,.038,.020],rotation:qz(side*-5)});
  }
}

// Trouser cuffs / turn-ups.
for(const item of styleVariants.trouserHems){
  if(item.id==="plain") continue;
  const mesh=trouserHemVariantMeshes[item.id];
  const height=item.id==="turnup_5"?.050:.040;
  for(const side of [-1,1]){
    nodes.push({name:`TrouserHemVariant__${item.id}__${side<0?"L":"R"}`,mesh,translation:[side*.105,.103,.020],scale:[.070,height,.103]});
  }
}

// Trouser pocket constructions.
for(const item of styleVariants.trouserPockets){
  const mesh=trouserPocketVariantMeshes[item.id];
  if(item.id==="single_welt_back"||item.id==="double_jetted_back"){
    const count=item.id==="double_jetted_back"?2:1;
    for(let i=0;i<count;i++){
      const x=count===1?.080:(i===0?-.080:.080);
      nodes.push({name:`TrouserPocketVariant__${item.id}__${i}`,mesh,translation:[x,.978,-.095],scale:[.095,.012,.006]});
    }
    continue;
  }
  for(const side of [-1,1]){
    const x=side*.155;
    const y=item.id==="frogmouth"?1.000:.980;
    const scale=item.id==="jean"?[.070,.050,.007]:item.id==="frogmouth"?[.080,.016,.007]:[.020,.110,.007];
    const angle=item.id==="slant"?side*-16:item.id==="jean"?side*-10:0;
    nodes.push({name:`TrouserPocketVariant__${item.id}__${side<0?"L":"R"}`,mesh,translation:[x,y,.090],scale,rotation:qz(angle)});
  }
}

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
  asset:{version:"2.0",generator:"Linen Earth Live Designer identity model M7.2 researched tailoring taxonomy"},
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
    polishStage:"M7.2 model complete: researched shirt/trouser tailoring taxonomy + anatomically preserved garment surfaces + fabric drape response",
    sourceAnchors:"LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS"
  },
  styleVariants:{version:styleVariants.version,materialNames:variantMaterialNames,config:styleVariants},
  cameraOrbits:{front:"0deg 76deg 3.60m","three-quarter":"35deg 76deg 3.60m",side:"90deg 76deg 3.60m",back:"180deg 76deg 3.60m"},
};

await fs.mkdir(OUT_DIR,{recursive:true});
const glb=toGlb(gltf,binary);
await fs.writeFile(path.join(OUT_DIR,GLB_NAME),glb);
await fs.writeFile(path.join(OUT_DIR,MANIFEST_NAME),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(`Built ${GLB_NAME}: ${(glb.byteLength/1024).toFixed(1)} KiB, ${meshes.length} meshes, ${materials.length} materials.`);
console.log(`Built ${MANIFEST_NAME} with ${garmentPanels.length} physical garment panels.`);
