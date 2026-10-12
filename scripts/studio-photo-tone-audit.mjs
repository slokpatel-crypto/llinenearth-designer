import fs from "node:fs/promises";
import sharp from "sharp";

// These are fixed, centrally located cloth/skin samples from the ORIGINAL
// tucked full-sleeve officewear fixture. The candidate is a separate, wider
// Chromium canvas; matching normalized X coordinates would sample background
// instead of the real left trouser leg. This is a photometric DIAGNOSTIC, not
// pixel-wise face recognition, cloth measurement, or a studio match approval.
const PHOTO_REGION_VERSION="linen-earth-studio-photo-tone-diagnostic-v1";
const regions={
  head:{reference:[.47,.53,.07,.13],candidate:[.47,.53,.07,.13]},
  shirtChest:{reference:[.46,.54,.29,.39],candidate:[.46,.54,.29,.39]},
  trouserLeft:{reference:[.405,.45,.56,.76],candidate:[.448,.47,.56,.76]},
};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

async function pixels(pathname){
  const {data,info}=await sharp(pathname).resize({height:512}).removeAlpha()
    .raw().toBuffer({resolveWithObject:true});
  if(info.width<250||info.height<500||info.channels!==3)
    throw new Error("Unusable full-body photo/Chromium candidate pixels.");
  return {data,width:info.width,height:info.height};
}
function swatch(image,roi){
  const [x0,x1,y0,y1]=roi;
  const left=Math.floor(x0*image.width),right=Math.ceil(x1*image.width);
  const top=Math.floor(y0*image.height),bottom=Math.ceil(y1*image.height);
  const sums=[0,0,0];let sumY=0,sumY2=0,count=0;
  for(let y=clamp(top,0,image.height-1);y<clamp(bottom,1,image.height);y++){
    for(let x=clamp(left,0,image.width-1);x<clamp(right,1,image.width);x++){
      const offset=(y*image.width+x)*3;
      const values=[image.data[offset],image.data[offset+1],image.data[offset+2]];
      for(let k=0;k<3;k++) sums[k]+=values[k];
      const luma=.2126*values[0]+.7152*values[1]+.0722*values[2];
      sumY+=luma;sumY2+=luma*luma;count++;
    }
  }
  if(count<70)throw new Error("Studio material review region too small.");
  return {
    rgb:sums.map(v=>Math.round(v/count*10)/10),
    luma:Math.round(sumY/count*10)/10,
    lumaStd:Math.round(Math.sqrt(Math.max(0,sumY2/count-(sumY/count)**2))*10)/10,
    pixels:count,
  };
}

export async function evaluateStudioPhotoTone(referencePath,candidatePath){
  const [original,actual]=await Promise.all([pixels(referencePath),pixels(candidatePath)]);
  const samples={};
  for(const [name,region] of Object.entries(regions)){
    const reference=swatch(original,region.reference),candidate=swatch(actual,region.candidate);
    const rmsColourDelta=Math.sqrt(reference.rgb.reduce((sum,v,index)=>
      sum+(v-candidate.rgb[index])**2,0)/3);
    samples[name]={
      reference,candidate,
      rgbRmsDifference:Math.round(rmsColourDelta*10)/10,
      lumaDifference:Math.round((candidate.luma-reference.luma)*10)/10,
      candidateDetailStdRatio:reference.lumaStd>0
        ?Math.round(candidate.lumaStd/reference.lumaStd*100)/100:null,
    };
  }
  const symptoms=[];
  if(Math.abs(samples.head.lumaDifference)>25)
    symptoms.push("Head luminance diverges from original ivory studio model.");
  if(samples.trouserLeft.rgbRmsDifference>30)
    symptoms.push("Stock trouser tone differs substantially from original styling.");
  if(samples.shirtChest.rgbRmsDifference>28)
    symptoms.push("Shirt tone differs substantially from original styling.");
  if(samples.shirtChest.candidateDetailStdRatio!==null
    &&samples.shirtChest.candidateDetailStdRatio<.50)
    symptoms.push("Chest surface has much less tonal detail than the studio photograph.");
  return {
    version:PHOTO_REGION_VERSION,
    status:"unapproved-appearance-diagnostic",
    source:"actual original photo and genuine Chromium-rendered screenshot",
    obviousReferenceToneSymptoms:symptoms,
    requiresIndependentStudioVisualReview:true,
    visualMatchApproved:false,
    measuredPhysicalColourOrDrape:false,
    sameClothingCameraAndLightingCertified:false,
    samples,
  };
}

export async function writeStudioPhotoToneAudit(referencePath,candidatePath,outputPath){
  const result=await evaluateStudioPhotoTone(referencePath,candidatePath);
  await fs.writeFile(outputPath,JSON.stringify(result,null,2)+"\n");
  return result;
}
