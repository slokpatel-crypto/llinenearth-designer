import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { fromLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";
import { GARMENT_OPTION_LIBRARY } from "../src/lib/designer/options/library.ts";
import { modelGeometry } from "../src/lib/designer/live-preview.ts";
import { evaluateCrossGarmentRules } from "../src/lib/designer/rules/evaluator.ts";

const baseline=fromLegacyStyle({
  collar:"Point (Standard) Collar",
  collarFinish:"Self-fabric",
  cuff:"Barrel Cuff (1-button)",
  placket:"Standard (visible stitch)",
  shirtFit:"Regular / Classic Fit",
  shirtWear:"Tucked",
  trouser:"Pleated Trouser",
  rise:"Mid Rise",
  waistband:"Belt Loops",
  break:"Slight Break",
  button:"Plastic / Resin",
});

const sideFor=(group)=>group.startsWith("shirt.")?"shirt":"pant";
const keyFor=(group)=>group.split(".")[1];
const samples=[];
const cohortSamples=new Map();

function run(spec,view,build){
  const started=performance.now();
  const geometry=modelGeometry(spec,view,build);
  const rules=evaluateCrossGarmentRules({
    spec,
    occasion:"Semi-Formal",
    climate:"Air-conditioned",
    pantDrapeVerified:false,
  });
  // Consume outputs so the benchmark cannot be optimized into a no-op.
  if(!geometry.parts.length) throw new Error("Preview geometry produced no garment parts.");
  if(!Array.isArray(rules)) throw new Error("Cross-garment rules did not return an array.");
  const elapsedMs=performance.now()-started;
  samples.push(elapsedMs);
  const key=`${view}/${build}`;
  if(!cohortSamples.has(key)) cohortSamples.set(key,[]);
  cohortSamples.get(key).push(elapsedMs);
}

for(const option of GARMENT_OPTION_LIBRARY){
  if(option.renderSupport.livePreview==="none") continue;
  const side=sideFor(option.group);
  const key=keyFor(option.group);
  const spec={
    ...baseline,
    shirt:{...baseline.shirt},
    pant:{...baseline.pant},
    legacy:{...baseline.legacy},
  };
  if(key in spec[side]) spec[side][key]=option.id;
  for(const view of ["front","back"]){
    for(const build of ["slim","regular","athletic","broad"]) run(spec,view,build);
  }
}

// Warm baseline loops approximate rapid customer option switching.
for(let i=0;i<1200;i++) run(baseline,i%2?"front":"back",["slim","regular","athletic","broad"][i%4]);

const sorted=[...samples].sort((a,b)=>a-b);
const percentile=(p)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]||0;
// Aggregate p95 can hide a regression affecting just one view/body build.
// Require each well-sampled cohort to pass the SAME 100-ms CPU-only budget.
const expectedCohorts=["front","back"].flatMap((view)=>
  ["slim","regular","athletic","broad"].map((build)=>`${view}/${build}`));
const cohorts=Object.fromEntries(expectedCohorts.map((key)=>{
  const sortedSamples=[...(cohortSamples.get(key)||[])].sort((a,b)=>a-b);
  const p95=sortedSamples[Math.min(sortedSamples.length-1,Math.floor((sortedSamples.length-1)*.95))];
  return [key,{
    sampleCount:sortedSamples.length,
    p95Ms:p95===undefined?null:Number(p95.toFixed(3)),
  }];
}));
const slowCohorts=expectedCohorts.filter((key)=>
  cohorts[key].sampleCount<20 || cohorts[key].p95Ms===null || cohorts[key].p95Ms>=100);
const report={
  kind:"designer-preview-engine-performance",
  generatedAt:new Date().toISOString(),
  scope:"Node deterministic geometry + cross-garment rule compute only; excludes browser paint, image decode and device UI latency.",
  targetMs:100,
  sampleCount:samples.length,
  medianMs:Number(percentile(.5).toFixed(3)),
  p95Ms:Number(percentile(.95).toFixed(3)),
  p99Ms:Number(percentile(.99).toFixed(3)),
  maxMs:Number((sorted.at(-1)||0).toFixed(3)),
  cohorts,
  slowCohorts,
  status:percentile(.95)<100&&slowCohorts.length===0?"pass":"fail",
};
const dir=path.resolve("evals/reports");
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,"preview-performance.json"),JSON.stringify(report,null,2)+"\n");
console.log(`preview engine performance: p95=${report.p95Ms}ms, p99=${report.p99Ms}ms, max=${report.maxMs}ms across ${report.sampleCount} samples`);
console.log(`per-view/body preview cohorts: ${slowCohorts.length} over limit or under-sampled`);
console.log("Browser/device paint remains a separate owner acceptance check.");
if(report.status!=="pass") process.exit(1);
