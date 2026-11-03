import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFabricDevelopment } from "../src/lib/fabric-analysis.ts";

function classify(fileName:string){
  return analyzeFabricDevelopment({fileName,contentType:"image/webp",size:1024});
}

test("Linen-Cotton filename evidence outranks generic Linen, irrespective of common separators",()=>{
  for(const name of ["linen-cotton-check.webp","LINEN_COTTON_solid.png","linencotton swatch.jpg","cotton-linen-check.webp","COTTON_LINEN_solid.png","cottonlinen swatch.jpg","linen cotton sample.webp"]){
    const result=classify(name);
    assert.equal(result.alternatives[0]?.family,"Linen-Cotton",name);
    assert.equal(result.observations[0].basis,"development_visual_classifier");
  }
  assert.equal(classify("linen-solid.webp").alternatives[0]?.family,"Linen");
});

test("ordinary stripe and texture filenames must not impersonate TR or PV suiting declarations",()=>{
  for(const name of ["striped-shirt.webp","textured-linen-look.webp","preview-swatch.webp","streetwear.png"]){
    const result=classify(name);
    assert.notEqual(result.alternatives[0]?.family,"TR / Poly-Viscose Suiting",name);
  }
  for(const name of ["tr-office-suiting.webp","pv-formal-suiting.webp"]){
    assert.equal(classify(name).alternatives[0]?.family,"TR / Poly-Viscose Suiting",name);
  }
});

test("filename guesses remain explicitly visual and do not assert physical fibre counts or GSM",()=>{
  const result=classify("linen-cotton-75lea-160gsm.webp");
  assert.equal(result.source,"development_visual_classifier");
  assert(result.observations.every(item=>item.basis==="development_visual_classifier"));
  assert(result.cautions.some(item=>/fibre|fiber|composition/i.test(item)));
  assert(result.cautions.some(item=>/GSM|weight/i.test(item)));
});
