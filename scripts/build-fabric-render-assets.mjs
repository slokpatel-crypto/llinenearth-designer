import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { measuredPalette, measurePattern } from "../src/lib/fabric-measurement-core.ts";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";

// Catalogue photos include folds, selvage and sometimes printed captions. The
// crop deliberately uses only the upper central cloth field. Mirroring gives
// a continuous tile but does not establish the textile's physical repeat.
const sourceDir=path.resolve("public/fabrics");
const outputDir=path.resolve("public/fabric-tiles");
const declaredScalePath=path.resolve("scripts/fabric-scales.json");
const version="fabric-tile-v1";

let declared={};
try { declared=JSON.parse(await fs.readFile(declaredScalePath,"utf8")); }
catch(error) { if(error?.code!=="ENOENT") throw error; }
await fs.mkdir(outputDir,{recursive:true});

const files=(await fs.readdir(sourceDir)).filter((name)=>name.endsWith(".webp")).sort();
const catalogue=new Map(FABRIC_STOCK.map((fabric)=>[path.basename(fabric.swatchImageUrl),fabric]));
const manifest={version,assets:{}};
for(const file of files) {
  const original=await fs.readFile(path.join(sourceDir,file));
  const image=sharp(original).rotate();
  const info=await image.metadata();
  const width=info.width||0,height=info.height||0;
  if(width<150||height<150) throw new Error(`Swatch too small: ${file}`);
  const cropWidth=Math.min(Math.round(width*.58),Math.round(height*.32));
  const cropHeight=cropWidth;
  const left=Math.max(0,Math.round((width-cropWidth)/2));
  const top=Math.max(0,Math.round(height*.18));
  let crop=await image.extract({left,top,width:cropWidth,height:cropHeight})
    .resize(128,128).removeAlpha().png().toBuffer();
  const cataloguePattern=(catalogue.get(file)?.pattern||"").toLowerCase();
  const isPlain=/plain|solid|jute feel/.test(cataloguePattern) && !/stripe|check|print/.test(cataloguePattern);
  if(isPlain) {
    // Remove broad lighting/fold shadows while retaining subtle weave texture.
    const raw=await sharp(crop).raw().toBuffer();
    const blur=await sharp(crop).blur(13).raw().toBuffer();
    const mean=[0,0,0];
    for(let i=0;i<raw.length;i+=3) for(let c=0;c<3;c++) mean[c]+=raw[i+c];
    for(let c=0;c<3;c++) mean[c]/=raw.length/3;
    for(let i=0;i<raw.length;i+=3) for(let c=0;c<3;c++) {
      raw[i+c]=Math.max(0,Math.min(255,Math.round(mean[c]+(raw[i+c]-blur[i+c])*.42)));
    }
    crop=await sharp(raw,{raw:{width:128,height:128,channels:3}}).png().toBuffer();
  }
  const [normal,flopped,flipped,both]=await Promise.all([
    crop,
    sharp(crop).flop().png().toBuffer(),
    sharp(crop).flip().png().toBuffer(),
    sharp(crop).flip().flop().png().toBuffer(),
  ]);
  const tile=await sharp({create:{width:256,height:256,channels:3,background:"#ffffff"}})
    .composite([
      {input:normal,left:0,top:0},{input:flopped,left:128,top:0},
      {input:flipped,left:0,top:128},{input:both,left:128,top:128},
    ]).webp({quality:83,effort:5}).toBuffer();
  const stem=file.slice(0,-5);
  await fs.writeFile(path.join(outputDir,`${stem}.webp`),tile);
  await sharp(crop).resize(24,24).webp({quality:60}).toFile(path.join(outputDir,`${stem}-placeholder.webp`));

  const {data}=await sharp(crop).resize(128,128).greyscale().raw().toBuffer({resolveWithObject:true});
  const {data:rgb}=await sharp(crop).resize(128,128).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const palette=measuredPalette(new Uint8Array(rgb),128,128,3,3);
  const scale=declared[stem]||{};
  const physical={
    ...(Number(scale.swatchRealWidthMm)>0?{swatchRealWidthMm:Number(scale.swatchRealWidthMm)*cropWidth/width}:{}),
    ...(Number(scale.repeatRealMm)>0?{repeatRealMm:Number(scale.repeatRealMm)}:{}),
    originalWidthPx:width,
  };
  const measured=measurePattern(new Uint8Array(data),128,128,palette.palette,physical);
  let orientation=measured.orientation;
  if(isPlain) orientation="none";
  else if(/stripe|pinstripe/.test(cataloguePattern)) {
    // Smooth the fine weave before comparing the large motif along each axis.
    const smooth=await sharp(crop).blur(1).greyscale().raw().toBuffer();
    const rows=Array(128).fill(0),cols=Array(128).fill(0);
    for(let y=0;y<128;y++) for(let x=0;x<128;x++) {rows[y]+=smooth[y*128+x];cols[x]+=smooth[y*128+x];}
    const spread=(arr)=>{const avg=arr.reduce((a,b)=>a+b,0)/arr.length;return arr.reduce((n,v)=>n+(v-avg)**2,0)/arr.length;};
    orientation=spread(rows)>spread(cols)?"horizontal":"vertical";
  } else if(/check|windowpane|plaid/.test(cataloguePattern)) orientation="grid";
  else orientation="uncertain";
  const repeatDetected=!isPlain && measured.repeatPeriodPx!==null && measured.repeatPeriodPx>=5 && /stripe|check/.test(cataloguePattern);
  const tileRealWidthMm=Number(scale.swatchRealWidthMm)>0
    ? Math.round(200*Number(scale.swatchRealWidthMm)*cropWidth/width)/100
    : Number(scale.repeatRealMm)>0 && repeatDetected && measured.repeatPeriodPx
      ? Math.round(200*128*Number(scale.repeatRealMm)/measured.repeatPeriodPx)/100
      : null;
  manifest.assets[stem]={
    tileUrl:`/fabric-tiles/${stem}.webp`,
    placeholderUrl:`/fabric-tiles/${stem}-placeholder.webp`,
    tileWidthPx:256,tileHeightPx:256,
    repeatDetected,
    repeatPeriodPx:repeatDetected?measured.repeatPeriodPx:null,
    orientation,
    dominantHex:palette.dominant.hex,
    scaleApproximate:tileRealWidthMm===null,
    physicalScaleStatus:measured.physicalScaleStatus,
    repeatRealMm:Number(scale.repeatRealMm)>0?Number(scale.repeatRealMm):null,
    swatchRealWidthMm:Number(scale.swatchRealWidthMm)>0?Number(scale.swatchRealWidthMm):null,
    tileRealWidthMm,
    renderAssetVersion:version,
  };
}
await fs.writeFile(path.join(outputDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(`Built ${files.length} fabric tiles; ${Object.values(manifest.assets).filter((a)=>a.scaleApproximate).length} need owner scale.`);
