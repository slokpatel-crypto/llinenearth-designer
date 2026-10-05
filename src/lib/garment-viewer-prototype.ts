export const PROTOTYPE_MODEL_ID = "LE-GARMENT-M1";

export type GarmentPanelSpec = {
  material:string;
  garment:"shirt"|"trouser";
  widthMm:number;
  heightMm:number;
  normalScale:number;
  offsetU?:number;
  offsetV?:number;
  rotationDeg?:number;
};

export const GARMENT_PANEL_SPECS:GarmentPanelSpec[]=[
  {material:"ShirtTorsoFabric",garment:"shirt",widthMm:580,heightMm:780,normalScale:.32},
  {material:"ShirtSleeveLFabric",garment:"shirt",widthMm:180,heightMm:540,normalScale:.30},
  {material:"ShirtSleeveRFabric",garment:"shirt",widthMm:180,heightMm:540,normalScale:.30},
  {material:"TrouserWaistFabric",garment:"trouser",widthMm:540,heightMm:260,normalScale:.24},
  {material:"TrouserLegLFabric",garment:"trouser",widthMm:240,heightMm:760,normalScale:.26},
  {material:"TrouserLegRFabric",garment:"trouser",widthMm:240,heightMm:760,normalScale:.26},
];

const WHITE_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8////fwYGBgYmBigAAD34BADaOyqcAAAAAElFTkSuQmCC";
const NEUTRAL_NORMAL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNsaPj/n4GBgYGJAQoALZkDAqlaHJYAAAAASUVORK5CYII=";

function cubeGeometry() {
  const positions:number[]=[];
  const normals:number[]=[];
  const uvs:number[]=[];
  const indices:number[]=[];
  const faces=[
    {n:[0,0,1],v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
    {n:[0,0,-1],v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
    {n:[1,0,0],v:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]},
    {n:[-1,0,0],v:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]},
    {n:[0,1,0],v:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]},
    {n:[0,-1,0],v:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]},
  ] as const;
  for(const face of faces) {
    const start=positions.length/3;
    for(const vertex of face.v) {
      positions.push(...vertex);
      normals.push(...face.n);
    }
    uvs.push(0,0,1,0,1,1,0,1);
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  return {
    positions:new Float32Array(positions),
    normals:new Float32Array(normals),
    uvs:new Float32Array(uvs),
    indices:new Uint16Array(indices),
  };
}

function bytes(view:ArrayBufferView) {
  return new Uint8Array(view.buffer,view.byteOffset,view.byteLength);
}

function align4(value:number) {
  return (value+3)&~3;
}

function buildBinaryParts() {
  const geometry=cubeGeometry();
  const parts=[
    {name:"positions",data:bytes(geometry.positions),target:34962},
    {name:"normals",data:bytes(geometry.normals),target:34962},
    {name:"uvs",data:bytes(geometry.uvs),target:34962},
    {name:"indices",data:bytes(geometry.indices),target:34963},
  ];
  let offset=0;
  const views=parts.map((part)=>{
    offset=align4(offset);
    const view={name:part.name,byteOffset:offset,byteLength:part.data.byteLength,target:part.target};
    offset+=part.data.byteLength;
    return view;
  });
  const binary=new Uint8Array(align4(offset));
  for(let i=0;i<parts.length;i++) binary.set(parts[i].data,views[i].byteOffset);
  return {geometry,views,binary};
}

function boxNode(name:string,mesh:number,translation:[number,number,number],scale:[number,number,number]) {
  return {name,mesh,translation,scale};
}

function clothMaterial(name:string,roughness:number,normalScale:number) {
  return {
    name,
    pbrMetallicRoughness:{
      baseColorFactor:[1,1,1,1],
      baseColorTexture:{index:0},
      metallicFactor:0,
      roughnessFactor:roughness,
    },
    normalTexture:{index:2,scale:normalScale},
  };
}

export function buildPrototypeGarmentGlb() {
  const {geometry,views,binary}=buildBinaryParts();
  const positionView=0, normalView=1, uvView=2, indexView=3;
  const mesh=(name:string,material:number)=>({
    name,
    primitives:[{
      attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},
      indices:3,
      material,
      mode:4,
    }],
  });

  const nodes=[
    boxNode("Head",0,[0,1.67,0],[.18,.22,.16]),
    boxNode("Neck",0,[0,1.48,0],[.075,.08,.075]),
    boxNode("ShirtTorso",1,[0,1.18,0],[.29,.39,.12]),
    boxNode("ShirtSleeveL",2,[-.37,1.20,0],[.09,.27,.11]),
    boxNode("ShirtSleeveR",3,[.37,1.20,0],[.09,.27,.11]),
    boxNode("ForearmL",0,[-.37,.87,0],[.06,.16,.07]),
    boxNode("ForearmR",0,[.37,.87,0],[.06,.16,.07]),
    boxNode("HandL",0,[-.37,.67,0],[.07,.09,.075]),
    boxNode("HandR",0,[.37,.67,0],[.07,.09,.075]),
    boxNode("TrouserWaist",4,[0,.72,0],[.27,.13,.12]),
    boxNode("TrouserLegL",5,[-.14,.27,0],[.12,.38,.11]),
    boxNode("TrouserLegR",6,[.14,.27,0],[.12,.38,.11]),
    boxNode("ShoeL",7,[-.14,-.18,.06],[.13,.07,.22]),
    boxNode("ShoeR",7,[.14,-.18,.06],[.13,.07,.22]),
  ];

  const materials=[
    {name:"Skin",pbrMetallicRoughness:{baseColorFactor:[.56,.37,.25,1],metallicFactor:0,roughnessFactor:.72}},
    ...GARMENT_PANEL_SPECS.map((panel)=>clothMaterial(panel.material,panel.garment==="shirt"?.86:.8,panel.normalScale)),
    {name:"Shoe",pbrMetallicRoughness:{baseColorFactor:[.06,.045,.035,1],metallicFactor:0,roughnessFactor:.48}},
  ];

  const gltf={
    asset:{version:"2.0",generator:"Linen Earth GarmentViewer M1"},
    scene:0,
    scenes:[{name:"Linen Earth M1",nodes:nodes.map((_,index)=>index)}],
    nodes,
    buffers:[{byteLength:binary.byteLength}],
    bufferViews:views.map((view)=>({
      buffer:0,
      byteOffset:view.byteOffset,
      byteLength:view.byteLength,
      target:view.target,
    })),
    accessors:[
      {bufferView:positionView,componentType:5126,count:geometry.positions.length/3,type:"VEC3",min:[-.5,-.5,-.5],max:[.5,.5,.5]},
      {bufferView:normalView,componentType:5126,count:geometry.normals.length/3,type:"VEC3"},
      {bufferView:uvView,componentType:5126,count:geometry.uvs.length/2,type:"VEC2",min:[0,0],max:[1,1]},
      {bufferView:indexView,componentType:5123,count:geometry.indices.length,type:"SCALAR",min:[0],max:[23]},
    ],
    samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
    images:[
      {uri:WHITE_PIXEL,name:"Base placeholder"},
      {uri:NEUTRAL_NORMAL,name:"Neutral normal"},
    ],
    textures:[
      {sampler:0,source:0,name:"Fabric placeholder"},
      {sampler:0,source:0,name:"Unused compatibility placeholder"},
      {sampler:0,source:1,name:"Neutral linen normal"},
    ],
    materials,
    meshes:[
      mesh("BodyCube",0),
      ...GARMENT_PANEL_SPECS.map((panel,index)=>mesh(panel.material.replace("Fabric","Mesh"),index+1)),
      mesh("ShoeCube",GARMENT_PANEL_SPECS.length+1),
    ],
  };

  const encoder=new TextEncoder();
  const jsonBytes=encoder.encode(JSON.stringify(gltf));
  const jsonLength=align4(jsonBytes.byteLength);
  const binLength=align4(binary.byteLength);
  const totalLength=12+8+jsonLength+8+binLength;
  const out=new Uint8Array(totalLength);
  const data=new DataView(out.buffer);
  data.setUint32(0,0x46546c67,true);
  data.setUint32(4,2,true);
  data.setUint32(8,totalLength,true);
  data.setUint32(12,jsonLength,true);
  data.setUint32(16,0x4e4f534a,true);
  out.fill(0x20,20,20+jsonLength);
  out.set(jsonBytes,20);
  const binHeader=20+jsonLength;
  data.setUint32(binHeader,binLength,true);
  data.setUint32(binHeader+4,0x004e4942,true);
  out.set(binary,binHeader+8);
  return out;
}

export function createPrototypeGarmentGlbUrl() {
  const bytes=buildPrototypeGarmentGlb();
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
  return URL.createObjectURL(new Blob([buffer],{type:"model/gltf-binary"}));
}
