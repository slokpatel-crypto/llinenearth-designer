import { deltaE2000, srgbRgbToLab, type LabColor } from "./vocab/color-distance.ts";
import { nearestColorFamily } from "./vocab/colors.ts";
import type { FabricImageQuality, FabricPatternMeasurement, MeasuredPaletteEntry } from "./fabric-measurement-types";

type Pixel={r:number;g:number;b:number;lab:LabColor};

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
function mean(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
function variance(values:number[]){const m=mean(values);return values.length?mean(values.map((v)=>(v-m)**2)):0;}
function rgbHex(r:number,g:number,b:number){return `#${[r,g,b].map((v)=>Math.round(clamp(v,0,255)).toString(16).padStart(2,"0")).join("").toUpperCase()}`;}
function luma(r:number,g:number,b:number){return .2126*r+.7152*g+.0722*b;}

export function sampleRgbPixels(data:Uint8Array,width:number,height:number,channels:number):Pixel[] {
  const out:Pixel[]=[];
  const x0=Math.floor(width*.04),x1=Math.max(x0+1,Math.ceil(width*.96));
  const y0=Math.floor(height*.04),y1=Math.max(y0+1,Math.ceil(height*.96));
  const step=Math.max(1,Math.floor(Math.sqrt((width*height)/6000)));
  for(let y=y0;y<y1;y+=step){
    for(let x=x0;x<x1;x+=step){
      const i=(y*width+x)*channels;
      const r=data[i]??0,g=data[i+1]??0,b=data[i+2]??0;
      const alpha=channels>=4?(data[i+3]??255):255;
      if(alpha<200) continue;
      // Specular clipping is not representative cloth colour.
      if(r>=252&&g>=252&&b>=252) continue;
      out.push({r,g,b,lab:srgbRgbToLab(r,g,b)});
    }
  }
  return out;
}

function seedCentroids(pixels:Pixel[],k:number):LabColor[] {
  const sorted=[...pixels].sort((a,b)=>a.lab.l-b.lab.l);
  return Array.from({length:k},(_,i)=>{
    const p=sorted[Math.min(sorted.length-1,Math.floor((i+.5)*sorted.length/k))] || sorted[0];
    return p?.lab || {l:50,a:0,b:0};
  });
}

export function measuredPalette(data:Uint8Array,width:number,height:number,channels:number,k=4) {
  const pixels=sampleRgbPixels(data,width,height,channels);
  if(!pixels.length) throw new Error("No usable fabric pixels were found.");
  k=Math.max(1,Math.min(k,pixels.length));
  let centroids=seedCentroids(pixels,k);
  let assignment=new Array<number>(pixels.length).fill(0);

  for(let iteration=0;iteration<8;iteration++){
    assignment=pixels.map((p)=>{
      let best=0,bestD=Infinity;
      centroids.forEach((c,i)=>{
        const d=(p.lab.l-c.l)**2+(p.lab.a-c.a)**2+(p.lab.b-c.b)**2;
        if(d<bestD){bestD=d;best=i;}
      });
      return best;
    });
    const next=centroids.map((old,i)=>{
      const members=pixels.filter((_,index)=>assignment[index]===i);
      if(!members.length) return old;
      return {
        l:mean(members.map((p)=>p.lab.l)),
        a:mean(members.map((p)=>p.lab.a)),
        b:mean(members.map((p)=>p.lab.b)),
      };
    });
    const shift=next.reduce((sum,c,i)=>sum+Math.abs(c.l-centroids[i].l)+Math.abs(c.a-centroids[i].a)+Math.abs(c.b-centroids[i].b),0);
    centroids=next;
    if(shift<.05) break;
  }

  const entries:MeasuredPaletteEntry[]=centroids.map((lab,i)=>{
    const members=pixels.filter((_,index)=>assignment[index]===i);
    const r=mean(members.map((p)=>p.r)),g=mean(members.map((p)=>p.g)),b=mean(members.map((p)=>p.b));
    return {hex:rgbHex(r,g,b),lab,coverage:members.length/pixels.length};
  }).sort((a,b)=>b.coverage-a.coverage);

  const dominant=entries[0];
  const nearest=nearestColorFamily(dominant.lab);
  if(!nearest) throw new Error("Measured colour could not be mapped to a colour family.");
  return {dominant,palette:entries,mappedColorFamily:nearest.id,deltaE:nearest.deltaE};
}

function laplacianVariance(gray:Uint8Array,width:number,height:number){
  const values:number[]=[];
  for(let y=1;y<height-1;y++){
    for(let x=1;x<width-1;x++){
      const i=y*width+x;
      const v=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-width]-gray[i+width];
      values.push(v);
    }
  }
  return variance(values);
}

function regionMean(data:Uint8Array,width:number,height:number,channels:number,which:"border"|"center"){
  const acc=[0,0,0],counts=[0,0,0];
  const mx=Math.floor(width*.18),my=Math.floor(height*.18);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const inCenter=x>=mx&&x<width-mx&&y>=my&&y<height-my;
      if((which==="center")!==inCenter) continue;
      const i=(y*width+x)*channels;
      for(let c=0;c<3;c++){acc[c]+=data[i+c]??0;counts[c]++;}
    }
  }
  return acc.map((v,i)=>counts[i]?v/counts[i]:0);
}

export function assessImageQuality(
  rgb:Uint8Array,
  gray:Uint8Array,
  width:number,
  height:number,
  channels:number,
  originalWidth=width,
  originalHeight=height,
):FabricImageQuality {
  let glare=0,total=0;
  const channelMeans=[0,0,0];
  for(let i=0;i<rgb.length;i+=channels){
    const r=rgb[i]??0,g=rgb[i+1]??0,b=rgb[i+2]??0;
    if(r>248&&g>248&&b>248) glare++;
    channelMeans[0]+=r;channelMeans[1]+=g;channelMeans[2]+=b;total++;
  }
  const means=channelMeans.map((v)=>total?v/total:0);
  const meanLuma=mean(Array.from(gray));
  const blurVariance=laplacianVariance(gray,width,height);
  const glarePct=total?glare/total*100:100;
  const colorCast=Math.max(...means)-Math.min(...means);
  const border=regionMean(rgb,width,height,channels,"border");
  const center=regionMean(rgb,width,height,channels,"center");
  const borderCenterDelta=Math.sqrt(border.reduce((sum,v,i)=>sum+(v-center[i])**2,0));

  const issues:string[]=[];
  let score=100;
  if(Math.min(originalWidth,originalHeight)<400){issues.push("resolution_low");score-=30;}
  if(blurVariance<18){issues.push("blur_high");score-=35;}
  else if(blurVariance<45){issues.push("blur_soft");score-=15;}
  if(glarePct>12){issues.push("glare_high");score-=30;}
  else if(glarePct>5){issues.push("glare_present");score-=12;}
  if(meanLuma<30){issues.push("underexposed");score-=25;}
  else if(meanLuma>230){issues.push("overexposed");score-=25;}
  if(colorCast>95){issues.push("strong_color_cast");score-=12;}
  if(borderCenterDelta>115){issues.push("swatch_may_not_fill_frame");score-=18;}

  return {
    score:Math.round(clamp(score,0,100)),
    issues,
    widthPx:originalWidth,
    heightPx:originalHeight,
    blurVariance:Math.round(blurVariance*10)/10,
    glarePct:Math.round(glarePct*10)/10,
    meanLuma:Math.round(meanLuma*10)/10,
    colorCast:Math.round(colorCast*10)/10,
    borderCenterDelta:Math.round(borderCenterDelta*10)/10,
  };
}

function rowColMeans(gray:Uint8Array,width:number,height:number){
  const cols=Array.from({length:width},(_,x)=>{
    let s=0;for(let y=0;y<height;y++)s+=gray[y*width+x];return s/height;
  });
  const rows=Array.from({length:height},(_,y)=>{
    let s=0;for(let x=0;x<width;x++)s+=gray[y*width+x];return s/width;
  });
  return {rows,cols};
}

function autocorrPeriod(series:number[]){
  const m=mean(series),centered=series.map((v)=>v-m);
  const denom=centered.reduce((s,v)=>s+v*v,0);
  if(denom<1e-6) return null;
  let best:{lag:number;score:number}|null=null;
  for(let lag=2;lag<=Math.floor(series.length/2);lag++){
    let num=0,left=0,right=0;
    for(let i=0;i<series.length-lag;i++){
      const a=centered[i],b=centered[i+lag];
      num+=a*b;left+=a*a;right+=b*b;
    }
    const score=num/Math.sqrt(Math.max(1e-9,left*right));
    if(score>.28 && (!best || score>best.score)) best={lag,score};
  }
  return best?.lag ?? null;
}

function averageRunWidth(series:number[]){
  if(series.length<3) return null;
  const threshold=mean(series);
  const states=series.map((v)=>v>=threshold);
  const runs:number[]=[];
  let run=1;
  for(let i=1;i<states.length;i++){
    if(states[i]===states[i-1]) run++;
    else {runs.push(run);run=1;}
  }
  runs.push(run);
  return runs.length>=2?mean(runs):null;
}

export function measurePattern(
  gray:Uint8Array,
  width:number,
  height:number,
  palette:MeasuredPaletteEntry[],
  physical?:{swatchRealWidthMm?:number;repeatRealMm?:number;originalWidthPx?:number},
):FabricPatternMeasurement {
  const {rows,cols}=rowColMeans(gray,width,height);
  const colVar=variance(cols),rowVar=variance(rows);
  const signal=Math.max(colVar,rowVar);
  let orientation:FabricPatternMeasurement["orientation"]="uncertain";
  if(signal<8) orientation="none";
  else if(colVar>rowVar*1.35) orientation="vertical";
  else if(rowVar>colVar*1.35) orientation="horizontal";
  else orientation="grid";

  const axis=orientation==="vertical"?cols:orientation==="horizontal"?rows:colVar>=rowVar?cols:rows;
  const repeatPeriodPx=orientation==="none"?null:autocorrPeriod(axis);
  const stripeWidthPx=(orientation==="vertical"||orientation==="horizontal")?averageRunWidth(axis):null;

  let contrastDeltaE:number|null=null;
  if(palette.length>=2) contrastDeltaE=deltaE2000(palette[0].lab,palette[1].lab);
  const lum=palette.slice(0,2).map((p)=>{
    const hex=p.hex.replace("#","");
    return luma(Number.parseInt(hex.slice(0,2),16),Number.parseInt(hex.slice(2,4),16),Number.parseInt(hex.slice(4,6),16))+5;
  });
  const luminanceRatio=lum.length>=2?Math.max(...lum)/Math.min(...lum):null;

  const transitions=axis.slice(1).reduce((n,v,i)=>n+(Math.abs(v-axis[i])>12?1:0),0);
  const rate=axis.length>1?transitions/(axis.length-1):0;
  const density:FabricPatternMeasurement["density"]=orientation==="none"?"none":rate<.08?"sparse":rate<.28?"balanced":"dense";
  const fraction=repeatPeriodPx ? repeatPeriodPx/axis.length : 0;
  const scale:FabricPatternMeasurement["scale"]=orientation==="none"?"none":fraction>0&&fraction<.06?"fine":fraction<.2?"medium":"bold";

  let repeatMm:number|null=null,stripeWidthMm:number|null=null;
  let physicalScaleStatus:FabricPatternMeasurement["physicalScaleStatus"]="unknown";
  if(physical?.repeatRealMm && physical.repeatRealMm>0){
    repeatMm=physical.repeatRealMm;
    physicalScaleStatus="declared_repeat";
    if(repeatPeriodPx && stripeWidthPx) stripeWidthMm=physical.repeatRealMm*(stripeWidthPx/repeatPeriodPx);
  } else if(physical?.swatchRealWidthMm && physical.swatchRealWidthMm>0 && physical.originalWidthPx && physical.originalWidthPx>0) {
    const mmPerMeasuredPx=physical.swatchRealWidthMm/width;
    if(repeatPeriodPx) repeatMm=repeatPeriodPx*mmPerMeasuredPx;
    if(stripeWidthPx) stripeWidthMm=stripeWidthPx*mmPerMeasuredPx;
    physicalScaleStatus="declared_swatch_width";
  }

  return {
    orientation,
    repeatPeriodPx:repeatPeriodPx?Math.round(repeatPeriodPx*10)/10:null,
    stripeWidthPx:stripeWidthPx?Math.round(stripeWidthPx*10)/10:null,
    repeatMm:repeatMm?Math.round(repeatMm*10)/10:null,
    stripeWidthMm:stripeWidthMm?Math.round(stripeWidthMm*10)/10:null,
    contrastDeltaE:contrastDeltaE===null?null:Math.round(contrastDeltaE*10)/10,
    luminanceRatio:luminanceRatio===null?null:Math.round(luminanceRatio*100)/100,
    density,
    scale,
    physicalScaleStatus,
  };
}

export function averageHash(gray:Uint8Array,width:number,height:number) {
  const target=8;
  const samples:number[]=[];
  for(let gy=0;gy<target;gy++) for(let gx=0;gx<target;gx++){
    const x=Math.min(width-1,Math.floor((gx+.5)*width/target));
    const y=Math.min(height-1,Math.floor((gy+.5)*height/target));
    samples.push(gray[y*width+x]);
  }
  const m=mean(samples);
  let bits="";
  for(const v of samples) bits+=v>=m?"1":"0";
  let hex="";
  for(let i=0;i<bits.length;i+=4) hex+=Number.parseInt(bits.slice(i,i+4),2).toString(16);
  return hex.padStart(16,"0");
}
