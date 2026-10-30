import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

// Production's legacy engine imports JSON without an ESM import attribute.
// Load the real TypeScript modules as the established check-designer script does,
// rather than rewriting functioning app imports merely for test execution.
const cache=new Map<string,any>();
function load(file:string):any {
  const full=path.resolve(file);
  if(cache.has(full))return cache.get(full)!.exports;
  if(full.endsWith(".json"))return JSON.parse(readFileSync(full,"utf8"));
  const code=ts.transpileModule(readFileSync(full,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
  }).outputText;
  const loaded=new Module(full);loaded.filename=full;
  loaded.paths=Module._nodeModulePaths(path.dirname(full));
  cache.set(full,loaded);
  const nativeRequire=loaded.require.bind(loaded);
  loaded.require=((specifier:string)=>{
    if(specifier.startsWith("@/"))return load(path.resolve("src",specifier.slice(2))+".ts");
    if(specifier.startsWith("./")||specifier.startsWith("../")){
      const resolved=path.resolve(path.dirname(full),specifier);
      if(resolved.endsWith(".json"))return load(resolved);
      if(resolved.endsWith(".ts")||resolved.endsWith(".tsx"))return load(resolved);
      return load(resolved+".ts");
    }
    return nativeRequire(specifier);
  }) as typeof loaded.require;
  loaded._compile(code,full);
  return loaded.exports;
}
const {DESIGNER_STYLE_CHOICES,designerStyleForOccasion}=load("src/lib/designer/engine.ts");
const {photoTemplateForStyle,photoTemplateGaps}=load("src/lib/designer/photo-preview.ts");
const {photoPreviewSupportForChoice}=load("src/lib/designer/photo-preview-support.ts");
const {fromLegacyStyle,mergeLegacyIntoStyleSpec,styleSpecHashInput,toLegacyStyle,validateStyleSpecV2}=load("src/lib/designer/style-spec-v2.ts");


const checkedKeys=["collar","cuff","placket","shirtWear","trouser"] as const;
const baseline=designerStyleForOccasion("Semi-Formal");

test("all visible collar, cuff, placket, shirt-wear and trouser options round-trip the canonical tailor spec",()=>{
  const observed=new Set<string>();
  for(const key of checkedKeys){
    const options=DESIGNER_STYLE_CHOICES[key];
    assert(options.length>0,"missing option group "+key);
    assert.equal(new Set(options).size,options.length,"duplicate visible choices in "+key);
    for(const option of options){
      const chosen={...baseline,[key]:option};
      const spec=mergeLegacyIntoStyleSpec(fromLegacyStyle(baseline),chosen);
      assert(validateStyleSpecV2(spec),"invalid canonical spec: "+key+"="+option);
      assert.equal(toLegacyStyle(spec)[key],option,"lost option in tailor handoff: "+key+"="+option);
      assert.equal(spec.legacy[key],option,"legacy snapshot not synchronized: "+key+"="+option);
      assert.equal(styleSpecHashInput(spec),styleSpecHashInput(fromLegacyStyle(chosen)),"inconsistent canonical construction: "+key+"="+option);
      observed.add(key+"="+option);
    }
  }
  assert.equal(observed.size,checkedKeys.reduce((n,key)=>n+DESIGNER_STYLE_CHOICES[key].length,0));
});

test("each shirt-wear and trouser combination chooses the real photographic source, never an invented cut",()=>{
  for(const wear of DESIGNER_STYLE_CHOICES.shirtWear){
    for(const trouser of DESIGNER_STYLE_CHOICES.trouser){
      const chosen={...baseline,shirtWear:wear,trouser};
      const template=photoTemplateForStyle(chosen);
      const expected=wear==="Tucked"?"tucked":trouser==="Wide-leg / Relaxed Drape Trouser"?"wide":"pleated";
      assert.equal(template,expected,wear+" / "+trouser);
      const support=photoPreviewSupportForChoice("trouser",trouser,chosen);
      const direct=trouser==="Pleated Trouser"||(trouser==="Wide-leg / Relaxed Drape Trouser"&&wear==="Untucked");
      assert.equal(support.status,direct?"exact":"approximate",wear+" / "+trouser);
      const gaps=photoTemplateGaps(chosen,template);
      assert.equal(gaps.includes(trouser),!direct,"gap mismatch: "+wear+" / "+trouser);
      assert.equal(photoPreviewSupportForChoice("shirtWear",wear,chosen).status,"exact");
    }
  }
});

test("unphotographed collars, cuffs and plackets never claim geometry changed on the original model",()=>{
  const photographed={collar:"Point (Standard) Collar",cuff:"Barrel Cuff (1-button)",placket:"Standard (visible stitch)"};
  for(const key of ["collar","cuff","placket"] as const){
    for(const label of DESIGNER_STYLE_CHOICES[key]){
      const chosen={...baseline,[key]:label};
      const support=photoPreviewSupportForChoice(key,label,chosen);
      const exact=label===photographed[key];
      assert.equal(support.status,exact?"exact":"approximate",key+"="+label);
      assert.equal(photoTemplateGaps(chosen,photoTemplateForStyle(chosen)).includes(label),!exact);
    }
  }
});

test("customer source uses context-aware photo support while preserving the existing original model and no mandatory provider calls",()=>{
  const module=readFileSync("src/components/DesignerModule.tsx","utf8");
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(module,/photoPreviewSupportForChoice\(key,style\[key\],style\)/);
  assert.match(module,/<PhotoOutfitPreview/);
  assert.doesNotMatch(module,/<LiveConstructionPreview/);
  assert.match(preview,/LINEN_EARTH_MODEL_IDENTITY_ID/);
  assert.match(preview,/DESIGNER_PHOTO_TEMPLATES/);
  assert.match(preview,/Instant preview/);
});

test("precision-only cuff does not overwrite a legacy photographed cuff, even after other selector changes",()=>{
  const start=fromLegacyStyle(baseline);
  const expanded={...start,shirt:{...start.shirt,cuff:"open_short_hem_cuff",sleeve:"half_sleeve"}};
  assert(validateStyleSpecV2(expanded));
  assert.equal(toLegacyStyle(expanded).cuff,baseline.cuff);
  const changed={...baseline,collar:"English Spread / British Collar"};
  const preserved=mergeLegacyIntoStyleSpec(expanded,changed);
  assert.equal(preserved.shirt.cuff,"open_short_hem_cuff");
  assert.equal(toLegacyStyle(preserved).cuff,baseline.cuff);
  assert.equal(toLegacyStyle(preserved).collar,"English Spread / British Collar");
  assert.equal(preserved.shirt.sleeve,"half_sleeve");
});
