const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{performance}=require("node:perf_hooks");
const {load}=require("./designer-test-loader.cjs"),engine=load("src/lib/designer/engine.ts"),{answerDesignerQuestion}=load("src/lib/designer/advisor.ts");
const input={shirts:engine.DESIGNER_SHIRTS,pants:engine.DESIGNER_PANTS,currentShirt:engine.DESIGNER_SHIRTS.find(f=>f.id===engine.DESIGNER_REVIEWED_PAIRING.shirtId),currentPant:engine.DESIGNER_PANTS.find(f=>f.id===engine.DESIGNER_REVIEWED_PAIRING.pantId),chosenStyle:engine.designerStyleForOccasion("Semi-Formal"),occasion:"Semi-Formal",context:{climate:"Air-conditioned",intention:"Balanced"}};
const cases=[
  ["Design a business outfit with no blue and a tucked shirt","design"],
  ["Critique my current outfit","critique"],
  ["Compare pleated trousers vs flat-front trousers","compare"],
  ["Compare point vs spread collar","compare"],
  ["Compare charcoal grey vs beige trouser cloth","compare"],
  ["Keep both fabrics. Make the shirt relaxed. Keep my collar.","refine"],
  ["Check fit and movement","fit"],
  ["Explain my collar construction","construction"],
  ["What is the exact GSM, drape and wash care?","material"],
  ["Prepare the tailor tech pack","production"],
  ["Design a sherwani","clarify"],
  ["Design a comfortable summer wedding outfit with a mandarin collar and horn buttons","design"],
  ["Keep both fabrics. Make the collar mandarin, hide the placket and use horn buttons.","refine"],
  ["Compare mandarin vs camp collar","compare"],
  ["Design a resort outfit, not bold and no prints or checks","design"],
  ["Make the trousers slim. Keep the shirt fit.","clarify"],
  ["Use point collar and spread collar","clarify"],
  ["Use white contrast collar and cuffs","refine"],
  ["Use a soft button-down collar and extra-high rise with two-button barrel cuffs","refine"],
  ["Create a capsule for office, dinner and weekend","capsule"],
  ["Design two relaxed summer dinner outfits with a blue shirt and beige trousers","design"],
  ["Design a shirt only with clean tailoring","design"],
  ["Design trousers only with modern volume","design"],
  ["Design a casual outfit with no blue shirt and blue trousers","design"],
  ["Design a cropped trouser","design"],
  ["Design an outfit with a linen shirt under 180 gsm","design"],
  ["Design a formal look with a camp collar and French cuffs","design"],
  ["Design a British collar shirt","design"],
  ["Design five outfit directions","design"],
];
const timings=[],tasks=[];
for(let round=0;round<5;round++)for(const [brief,task] of cases){
  const start=performance.now(),answer=answerDesignerQuestion({...input,brief});timings.push(performance.now()-start);
  assert.equal(answer.advice.task,task);assert.ok(answer.results.length<=3);assert.equal(answer.advice.version,"designer-advice-v1");
  for(const option of answer.results){assert.ok(input.shirts.some(f=>f.id===option.shirt.id));assert.ok(input.pants.some(f=>f.id===option.pant.id));assert.equal(option.styleSpec.styleSchemaVersion,2);}
  if(round===0)tasks.push({brief,task,proposals:answer.results.length,physicalAcceptance:false});
}
timings.sort((a,b)=>a-b);const p95=timings[Math.ceil(timings.length*.95)-1],max=timings.at(-1);
assert.ok(p95<500,"Pure rule engine p95 exceeded 500ms: "+p95);assert.ok(max<2000,"Pure rule engine task exceeded 2 seconds: "+max);
const report={version:"designer-advisor-evaluation-v1",evaluatedTasks:tasks,requests:timings.length,pureEngineOnly:true,includesAPIOrImageLatency:false,physicalOrDeviceAcceptance:false,p95Ms:+p95.toFixed(2),maxMs:+max.toFixed(2)};
fs.mkdirSync("evals/reports",{recursive:true});fs.writeFileSync(path.join("evals/reports","designer-advisor.json"),JSON.stringify(report,null,2));console.log(`Designer task evaluation passed: ${tasks.length} task scenarios, ${timings.length} requests; pure-engine p95 ${report.p95Ms}ms, max ${report.maxMs}ms. API/image latency and physical acceptance excluded.`);
