import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

const cache=new Map();
function load(file){
  const full=path.resolve(file);
  if(cache.has(full)) return cache.get(full).exports;
  if(full.endsWith(".json")) return JSON.parse(fs.readFileSync(full,"utf8"));
  const source=fs.readFileSync(full,"utf8");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const loaded=new Module(full);
  loaded.filename=full;
  loaded.paths=Module._nodeModulePaths(path.dirname(full));
  cache.set(full,loaded);
  const nativeRequire=loaded.require.bind(loaded);
  loaded.require=(specifier)=>{
    if(specifier==="server-only") return {};
    if(specifier.startsWith("@/")) {
      const target=path.resolve("src",specifier.slice(2));
      for(const candidate of [target,target+".ts",target+".tsx",path.join(target,"index.ts")]) {
        if(fs.existsSync(candidate)) return load(candidate);
      }
    }
    if(specifier.startsWith("./")||specifier.startsWith("../")){
      const target=path.resolve(path.dirname(full),specifier);
      if(target.endsWith(".json")) return load(target);
      for(const candidate of [target,target+".ts",target+".tsx",path.join(target,"index.ts")]) {
        if(fs.existsSync(candidate)) return load(candidate);
      }
    }
    return nativeRequire(specifier);
  };
  loaded._compile(code,full);
  return loaded.exports;
}

const {
  DESIGNER_PANTS,
  DESIGNER_SHIRTS,
  designerStyleForOccasion,
}=load("src/lib/designer/engine.ts");
const {searchDesignerCatalogue}=load("src/lib/designer/search.ts");

const reportDir=path.resolve("evals/reports");
fs.mkdirSync(reportDir,{recursive:true});

function searchable(fabric){
  return `${fabric.line||""} ${fabric.name||""} ${fabric.patternType||""}`.toLowerCase();
}

function run(occasion,context){
  const currentShirt=DESIGNER_SHIRTS[0];
  const currentPant=DESIGNER_PANTS[0];
  if(!currentShirt||!currentPant) throw new Error("Designer catalogue is empty.");
  return searchDesignerCatalogue({
    shirts:DESIGNER_SHIRTS,
    pants:DESIGNER_PANTS,
    currentShirt,
    currentPant,
    occasion,
    chosenStyle:designerStyleForOccasion(occasion),
    context,
    scope:"open",
    preference:{wantedTokens:[],avoidTokens:[],strictOccasionFit:true},
  });
}

function signature(results){
  return results.map((item)=>({
    tier:item.tier,
    shirt:item.shirt.id,
    pant:item.pant.id,
    style:item.style,
    score:item.searchScore,
  }));
}

function evaluateCase(id,occasion,context){
  const first=run(occasion,context);
  const second=run(occasion,context);
  const failures=[];
  if(first.length!==3) failures.push(`expected 3 directions, got ${first.length}`);
  const tiers=first.map((item)=>item.tier).join(",");
  if(tiers!=="Safe,Elevated,Statement") failures.push(`unexpected tier order: ${tiers}`);
  const pairs=new Set(first.map((item)=>`${item.shirt.id}|${item.pant.id}`));
  if(first.length===3&&pairs.size<3) failures.push("top three directions do not use distinct fabric pairs");
  if(JSON.stringify(signature(first))!==JSON.stringify(signature(second))) failures.push("same input produced a different top-three snapshot");

  if(occasion==="Formal"){
    for(const item of first){
      const text=searchable(item.shirt);
      if(/linen print|printed linen blend|botanical|floral|leaf|abstract|chevron|mosaic/.test(text)) failures.push(`formal result selected relaxed print: ${item.shirt.id}`);
      if(item.style.shirtWear!=="Tucked") failures.push(`formal result is not tucked: ${item.tier}`);
    }
  }
  if(occasion==="Casual"){
    for(const item of first){
      if(/formal shirting/.test(searchable(item.shirt))) failures.push(`casual result selected formal shirting: ${item.shirt.id}`);
    }
  }
  return {id,occasion,context,pass:failures.length===0,failures,snapshot:signature(first)};
}

const cases=[
  evaluateCase("formal-boardroom","Formal",{climate:"Air-conditioned",intention:"Understated"}),
  evaluateCase("casual-warm","Casual",{climate:"Hot / humid",intention:"Balanced"}),
  evaluateCase("semi-formal-balanced","Semi-Formal",{climate:"Air-conditioned",intention:"Balanced"}),
];

const formal=cases.find((item)=>item.id==="formal-boardroom");
const casual=cases.find((item)=>item.id==="casual-warm");
if(formal&&casual){
  const formalShirts=formal.snapshot.map((x)=>x.shirt).join("|");
  const casualShirts=casual.snapshot.map((x)=>x.shirt).join("|");
  if(formalShirts===casualShirts){
    formal.pass=false;
    formal.failures.push("formal and casual top-three shirt snapshots are identical");
  }
}

const passed=cases.filter((item)=>item.pass).length;
const output={
  kind:"designer-top-three-regression",
  generatedAt:new Date().toISOString(),
  status:passed===cases.length?"pass":"fail",
  scope:"deterministic regression only; not owner-labelled taste accuracy",
  total:cases.length,
  passed,
  cases,
};
fs.writeFileSync(path.join(reportDir,"designer-top3.json"),JSON.stringify(output,null,2)+"\n");
console.log(`designer top-three snapshots: ${passed}/${cases.length} passed. Report: evals/reports/designer-top3.json`);
if(passed!==cases.length){
  for(const item of cases.filter((row)=>!row.pass)) console.error(item.id,item.failures.join("; "));
  process.exit(1);
}
