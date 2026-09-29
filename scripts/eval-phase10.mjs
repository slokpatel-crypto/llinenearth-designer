import fs from "node:fs";
import path from "node:path";
import { deltaE2000, srgbRgbToLab } from "../src/lib/vocab/color-distance.ts";

const kind=process.argv[2];
if(!["analyzer","designer"].includes(kind)) throw new Error("Usage: eval-phase10.mjs analyzer|designer");
const root=path.resolve("evals");
const reportDir=path.join(root,"reports");
fs.mkdirSync(reportDir,{recursive:true});

function csvRows(source) {
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='"') {if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===","&&!quoted){row.push(cell);cell="";}
    else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";}
    else cell+=c;
  }
  row.push(cell);if(row.some(Boolean))rows.push(row);
  const [head,...data]=rows;
  return data.map((values)=>Object.fromEntries(head.map((key,index)=>[key,values[index]||""])));
}
function readJson(file,fallback){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):fallback;}
function readRows(file){return fs.existsSync(file)?csvRows(fs.readFileSync(file,"utf8")):[];}
const pct=(n,total)=>total?Math.round(n/total*1000)/10:null;
function comparable(value,field) {
  if(["bestGarments","bestOccasions"].includes(field)) {
    return (Array.isArray(value)?value:String(value).split("|")).map((item)=>String(item).trim()).filter(Boolean).sort().join("|");
  }
  return String(value);
}
const output={kind,generatedAt:new Date().toISOString(),status:"awaiting_owner_labels",labeledCases:0,evaluatedCases:0};

if(kind==="analyzer"){
  const gold=readRows(path.join(root,"fabrics.golden.csv")).filter((row)=>row.fabricId&&row.patternFamily);
  const predicted=readJson(path.join(root,"fabrics.predicted.json"),{});
  const fields=["shadeFamily","patternFamily","patternScale","patternContrast","texture","formality","bestGarments","bestOccasions"];
  const matches=gold.filter((row)=>predicted[row.fabricId]);
  output.labeledCases=gold.length;output.evaluatedCases=matches.length;
  output.fields=Object.fromEntries(fields.map((field)=>{
    const usable=matches.filter((row)=>row[field]!=="" && predicted[row.fabricId]?.[field]!==undefined);
    const confusion={};let correct=0;
    for(const row of usable){
      const expected=comparable(row[field],field);const actual=comparable(predicted[row.fabricId][field],field);
      correct+=Number(expected===actual);
      confusion[expected]??={};confusion[expected][actual]=(confusion[expected][actual]||0)+1;
    }
    return [field,{sampleSize:usable.length,accuracyPct:pct(correct,usable.length),confusion}];
  }));
  const colorErrors=[];
  for(const row of matches){
    const reported=predicted[row.fabricId]?.measuredHex;
    if(!/^#[0-9a-f]{6}$/i.test(row.measuredHex)||!/^#[0-9a-f]{6}$/i.test(reported||""))continue;
    const lab=(hex)=>srgbRgbToLab(...[1,3,5].map((i)=>parseInt(hex.slice(i,i+2),16)));
    colorErrors.push(deltaE2000(lab(row.measuredHex),lab(reported)));
  }
  colorErrors.sort((a,b)=>a-b);
  output.colorDeltaE={sampleSize:colorErrors.length,median:colorErrors.length?colorErrors[Math.floor(colorErrors.length/2)]:null,p90:colorErrors.length?colorErrors[Math.floor(colorErrors.length*.9)]:null};
  const bins=Array.from({length:5},(_,index)=>({range:[index*.2,(index+1)*.2],total:0,correct:0}));
  for(const row of matches){
    const p=predicted[row.fabricId],confidence=Number(p.confidence);
    if(!Number.isFinite(confidence)||confidence<0||confidence>1)continue;
    const bin=bins[Math.min(4,Math.floor(confidence*5))];
    bin.total++;bin.correct+=Number(String(row.patternFamily)===String(p.patternFamily));
  }
  output.calibration=bins.map((bin)=>({...bin,accuracyPct:pct(bin.correct,bin.total)}));
}else{
  const cases=readJson(path.join(root,"outfits.golden.json"),{cases:[]}).cases||[];
  const predicted=readJson(path.join(root,"outfits.predicted.json"),{});
  const labeled=cases.filter((entry)=>entry.shirtFabricId&&entry.pantFabricId&&Array.isArray(entry.ownerTop3)&&entry.ownerTop3.length);
  const matched=labeled.filter((entry)=>predicted[`${entry.shirtFabricId}|${entry.pantFabricId}|${entry.occasion}|${entry.climate}`]);
  output.labeledCases=labeled.length;output.evaluatedCases=matched.length;
  let top1=0,top3=0,violations=0;const suggestions=new Set();
  for(const entry of matched){
    const ids=predicted[`${entry.shirtFabricId}|${entry.pantFabricId}|${entry.occasion}|${entry.climate}`].top3||[];
    const approved=new Set(entry.ownerTop3),avoid=new Set(entry.ownerAvoid||[]);
    top1+=Number(approved.has(ids[0]));top3+=Number(ids.slice(0,3).some((id)=>approved.has(id)));
    violations+=Number(ids.slice(0,3).some((id)=>avoid.has(id)));
    ids.slice(0,3).forEach((id)=>suggestions.add(id));
  }
  output.top1AgreementPct=pct(top1,matched.length);
  output.top3AgreementPct=pct(top3,matched.length);
  output.ruleViolationPct=pct(violations,matched.length);
  output.uniqueSuggestions=suggestions.size;
}
output.status=output.evaluatedCases>0?"reported":"awaiting_owner_labels";
const file=path.join(reportDir,`${kind}.json`);
fs.writeFileSync(file,JSON.stringify(output,null,2)+"\n");
console.log(`${kind}: ${output.evaluatedCases}/${output.labeledCases} labelled cases evaluated; ${output.status}. Report: ${file}`);
