#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root=path.resolve(process.argv[2]||"artifacts/realistic-3d/review");
const views=["front","three-quarter","side","back"];

function clamp01(value){return Math.max(0,Math.min(1,value));}
function roiBounds(width,height,{x0,y0,x1,y1}){
  return {
    left:Math.floor(width*clamp01(x0)),
    top:Math.floor(height*clamp01(y0)),
    right:Math.ceil(width*clamp01(x1)),
    bottom:Math.ceil(height*clamp01(y1)),
  };
}
function luma(r,g,b){return .2126*r+.7152*g+.0722*b;}
function isTrouser(r,g,b){
  const y=luma(r,g,b);
  return y<175 && b-r>=7 && g-r>=3;
}
function isShoe(r,g,b){
  const y=luma(r,g,b);
  return y<105 && r-g>=3 && g-b>=2;
}
function statsForRoi(data,width,height,channels,roi,predicate){
  const box=roiBounds(width,height,roi);
  let total=0,matched=0,sumLuma=0;
  for(let y=box.top;y<box.bottom;y++){
    for(let x=box.left;x<box.right;x++){
      const i=(y*width+x)*channels;
      const r=data[i],g=data[i+1],b=data[i+2];
      total++;sumLuma+=luma(r,g,b);
      if(predicate(r,g,b)) matched++;
    }
  }
  return {
    pixels:total,
    matched,
    ratio:total?matched/total:0,
    meanLuma:total?sumLuma/total:0,
  };
}

const report={
  version:"linen-earth-realistic-review-visibility-v1",
  root,
  views:{},
  ready:true,
  reasons:[],
};

for(const view of views){
  const file=path.join(root,view+".png");
  if(!fs.existsSync(file)){
    report.ready=false;
    report.reasons.push(`${view}: review PNG is missing.`);
    continue;
  }
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width<480||info.height<640){
    report.ready=false;
    report.reasons.push(`${view}: review resolution ${info.width}x${info.height} is too small.`);
  }
  const trouser=statsForRoi(
    data,info.width,info.height,info.channels,
    {x0:.18,y0:.43,x1:.82,y1:.94},
    isTrouser,
  );
  const shoe=statsForRoi(
    data,info.width,info.height,info.channels,
    {x0:.18,y0:.82,x1:.82,y1:1},
    isShoe,
  );
  report.views[view]={
    width:info.width,
    height:info.height,
    trouserRatio:Number(trouser.ratio.toFixed(4)),
    shoeRatio:Number(shoe.ratio.toFixed(4)),
    lowerBodyMeanLuma:Number(trouser.meanLuma.toFixed(2)),
  };
  const trouserMin=view==="side"?.025:.04;
  const shoeMin=view==="side"?.002:.003;
  if(trouser.ratio<trouserMin){
    report.ready=false;
    report.reasons.push(`${view}: trousers are not visually separated enough from the model/background (${(trouser.ratio*100).toFixed(1)}%).`);
  }
  if(shoe.ratio<shoeMin){
    report.ready=false;
    report.reasons.push(`${view}: locked dress shoes are not visibly readable (${(shoe.ratio*100).toFixed(2)}%).`);
  }
}

const output=path.resolve(process.env.LINEN_REVIEW_VISIBILITY_REPORT||"artifacts/realistic-3d/review-visibility.json");
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");

const available=views.filter((view)=>fs.existsSync(path.join(root,view+".png")));
if(available.length===4){
  const tileWidth=360;
  const tileHeight=540;
  const tiles=await Promise.all(available.map(async(view)=>({
    input:await sharp(path.join(root,view+".png")).resize(tileWidth,tileHeight,{fit:"contain",background:"#F8F6F0"}).png().toBuffer(),
    view,
  })));
  const contact=sharp({
    create:{width:tileWidth*2,height:tileHeight*2,channels:3,background:"#F8F6F0"}
  });
  await contact.composite(tiles.map((tile,index)=>({
    input:tile.input,
    left:(index%2)*tileWidth,
    top:Math.floor(index/2)*tileHeight,
  }))).png().toFile(path.resolve(root,"review-contact-sheet.png"));
}

console.log(JSON.stringify(report,null,2));
if(!report.ready) process.exit(1);
