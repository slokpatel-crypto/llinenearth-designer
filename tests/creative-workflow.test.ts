import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { creativePersonalContext } from "../src/lib/designer/creative-profile.ts";
import { DEFAULT_CRAFT_PREFERENCES, DEFAULT_CRAFT_REQUEST, attachCreativeCraft, craftClarifications, resolveCraftFabrics, resolveCraftRequest, reviseCreativeCraft, validCraftRequest, validCreativeCraft } from "../src/lib/designer/creative-spec.ts";
import { creativePlacementSvg } from "../src/lib/designer/creative-placement.ts";
import { researchPageHypothesis, researchRefreshSources, researchRunKey } from "../src/lib/designer/research-refresh.ts";
const {load}=createRequire(import.meta.url)("../scripts/designer-test-loader.cjs");
const engine=load("src/lib/designer/engine.ts"),creative=load("src/lib/designer/creative-engine.ts"),garment=load("src/lib/designer/garment-spec.ts"),lock=load("src/lib/designer/design-lock.ts"),handoff=load("src/lib/designer/production-handoff.ts"),tech=load("src/lib/designer/tech-pack.ts"),research=load("src/lib/designer/creative-research.ts"),pool=load("src/lib/designer/fashion-research-source-pool.ts");
const shirt=engine.DESIGNER_SHIRTS[0],pant=engine.DESIGNER_PANTS[0],style=engine.designerStyleForOccasion("Casual"),context={climate:"Not specified",intention:"Balanced"};
const directions=creative.generateCreativeDirections({shirt,pant,style,context,occasion:"Casual",limit:5}),request={...DEFAULT_CRAFT_REQUEST,brief:"Subtle leaf embroidery on the cuff",surface:"embroidery" as const,motif:"leaf" as const,accentId:shirt.id};
const built=attachCreativeCraft(directions,resolveCraftRequest(request),shirt);
test("catalogue-backed craft recipes are bounded, deterministic and do not invent measured dimensions",()=>{
  assert.deepEqual(built,attachCreativeCraft(directions,resolveCraftRequest(request),shirt));
  assert.equal(built.length,5);
  for(const d of built){assert.ok(validCreativeCraft(d.craft));assert.equal(d.craft?.dimensionBasis,"proposed_sample_dimensions");assert.equal(d.craft?.panels[0].fabric.id,shirt.id);assert.equal(d.craft?.decoration?.motif,"leaf");assert.equal(d.craft?.decoration?.technique,"embroidery");assert.equal(d.pattern,undefined);assert.equal(d.craft?.decoration?.coverage,6);}
});
test("automatic combinations use available accent IDs and keep a quiet no-panel alternative",()=>{const auto=attachCreativeCraft(directions,{...DEFAULT_CRAFT_REQUEST},undefined,[shirt]);assert.equal(auto[0].craft?.panels.length,0);assert.equal(auto[1].craft?.panels[0].fabric.id,shirt.id);assert.notEqual(auto[1].id,attachCreativeCraft(directions,{...DEFAULT_CRAFT_REQUEST,threadColour:"#FF0000"},undefined,[shirt])[1].id);});

test("unknown motif, unbounded dimensions and unknown zone are rejected",()=>{
  for(const patch of [{zone:"face"},{motif:"anything"},{repeatMm:Infinity},{repeatMm:3},{threadWidthMm:99},{coverage:90}])assert.equal(validCreativeCraft({...built[0].craft,decoration:{...built[0].craft?.decoration,...patch}}),false);
  assert.equal(validCraftRequest({...request,threadColour:"url(javascript:x)"}),false);
  assert.equal(validCreativeCraft({...built[0].craft,panels:Array(3).fill(built[0].craft?.panels[0])}),false);
});
test("brief instructions override profile defaults; plain removes decoration and contrast opt-outs are preserved",()=>{
  const r=resolveCraftRequest({...DEFAULT_CRAFT_REQUEST,brief:"Plain, no contrast, minimal collar"},{enabled:true,surface:"embroidery",motif:"wave",novelty:"bold"});
  assert.equal(r.surface,"plain");assert.equal(r.zone,"collar");assert.equal(r.novelty,"subtle");assert.equal(r.accentId,"");assert.equal(attachCreativeCraft(directions,r)[0].craft?.decoration,null);
  assert.equal(resolveCraftRequest({...DEFAULT_CRAFT_REQUEST,brief:"Leaf embroidery in navy on cuff"}).threadColour,"#182E4A");
  assert.ok(craftClarifications({...request,brief:"Peacock with sequins"}).length);
});
test("personal settings and reviews are isolated by server-resolved owner and reset cutoff",()=>{
  const settings=(owner:string,resetAt="")=>({type:"customer_updated",payload:{subtype:"designer_creative_profile",customerId:owner,preferences:{...DEFAULT_CRAFT_PREFERENCES,enabled:true},resetAt}});
  const review=(owner:string,id:string,rating="up")=>({type:"designer_feedback",received_at:"2026-10-04T06:00:00.000Z",payload:{subtype:"designer_creative_personal_feedback",customerId:owner,recommendationId:id,creativeConceptId:id,creativeFamilyId:"craft",rating,creativeReason:"visual_balance",craft:built[0].craft}});
  const rows=[settings("A"),review("A","creative:craft:1"),review("A","creative:craft:2"),review("A","creative:craft:3"),review("B","creative:craft:4","down")];
  const a=creativePersonalContext(rows,"A");assert.equal(a.reviewCount,3);assert.equal(a.effective.surface,"embroidery");assert.equal(a.effective.motif,"leaf");assert.equal(a.learning.totalReviews,3);
  assert.equal(creativePersonalContext(rows,"B").preferences.enabled,false);
  const reset=creativePersonalContext([...rows,settings("A","2026-10-04T07:00:00.000Z")],"A");assert.equal(reset.reviewCount,0);assert.equal(reset.effective.motif,"auto");
});
test("repeated taps replace a judgement and sparse feedback cannot set preferences",()=>{
  const payload={subtype:"designer_creative_personal_feedback",customerId:"A",recommendationId:"creative:x:1",creativeConceptId:"creative:x:1",creativeFamilyId:"x",rating:"up",craft:built[0].craft};
  const settings={type:"customer_updated",payload:{subtype:"designer_creative_profile",customerId:"A",preferences:{...DEFAULT_CRAFT_PREFERENCES,enabled:true}}};
  const profile=creativePersonalContext([settings,...Array(20).fill({type:"designer_feedback",payload}),{type:"designer_feedback",payload:{...payload,rating:"down"}}],"A");assert.equal(profile.reviewCount,1);assert.equal(profile.effective.surface,"auto");assert.equal(profile.learning.buckets[0].negative,1);
});
test("render mismatch judgements do not train creative taste",()=>{
  const profile=creativePersonalContext([{type:"customer_updated",payload:{subtype:"designer_creative_profile",customerId:"A",preferences:{...DEFAULT_CRAFT_PREFERENCES,enabled:true}}},...Array.from({length:4},(_,i)=>({type:"designer_feedback",payload:{subtype:"designer_creative_personal_feedback",customerId:"A",recommendationId:`creative:x:${i}`,creativeConceptId:`creative:x:${i}`,creativeFamilyId:"x",rating:"down",creativeReason:"render_mismatch",craft:built[0].craft}}))],"A");assert.equal(profile.learning.totalReviews,0);assert.equal(profile.effective.surface,"auto");
});
test("targeted craft revision preserves both fabrics and cut and produces a new reconstructable ID",()=>{
  const revised=reviseCreativeCraft(built[0],"too_busy");assert.ok(revised.craft!.decoration!.coverage<built[0].craft!.decoration!.coverage);assert.deepEqual(revised.baseStyle,built[0].baseStyle);assert.deepEqual(revised.craft?.panels,built[0].craft?.panels);assert.notEqual(revised.id,built[0].id);assert.equal(reviseCreativeCraft(built[0],"render_mismatch"),built[0]);assert.equal(built[0].craft?.decoration?.coverage,6);
});
test("placement SVG is deterministic, garment clipped and escapes reference names",()=>{
  const a=creativePlacementSvg(built[0].craft!,{shirt,pant});assert.equal(a,creativePlacementSvg(built[0].craft!,{shirt,pant}));assert.match(a,/clip-path/);assert.match(a,/patternUnits/);assert.doesNotMatch(creativePlacementSvg(built[0].craft!,{shirt:{image:'"/><script>alert(1)</script>',hex:shirt.hex},pant}),/<script>/);
});
test("accent references are canonicalised from stock and incompatible IDs fail closed",()=>{
  const spec=structuredClone(built[0].craft!);spec.panels[0].fabric.image="https://evil.invalid/image";
  const resolved=resolveCraftFabrics(spec,[shirt,pant],shirt.id,pant.id);assert.equal(resolved?.panels[0].fabric.image,shirt.image);assert.equal(resolveCraftFabrics(spec,[pant],shirt.id,pant.id),null);assert.equal(resolveCraftFabrics(spec,[shirt,pant],"changed",pant.id),null);
});
test("craft survives garment lock, reconstruction, production handoff and escaped tech pack; changes invalidate the recipe",async()=>{
  const spec=garment.buildCanonicalGarmentSpec(built[0].recommendation,null,null,null,null,built[0]);assert.deepEqual(spec.creative.craft,built[0].craft);assert.equal(spec.status,"review_required");
  const locked=await lock.lockGarmentSpec(spec),reconstructed=lock.reconstructLockedGarmentSpec(locked),packet=handoff.buildProductionHandoff(locked);
  assert.deepEqual(reconstructed.creative.craft,built[0].craft);assert.deepEqual(packet.construction.creative.craft,built[0].craft);assert.match(tech.buildTailorTechPackHtml(packet),/Creative recipe/);assert.match(tech.buildTailorTechPackHtml(packet),/proposed_sample|Proposed sample/);
  const changed=structuredClone(spec);changed.creative.craft.decoration.colour="#FF0000";assert.notEqual((await lock.lockGarmentSpec(changed)).recipeHash,locked.recipeHash);assert.ok(await lock.verifyLockedDesignRevision(locked));
});
test("old creative recipes remain valid without optional craft",async()=>{
  const spec=garment.buildCanonicalGarmentSpec(directions[0].recommendation,null,null,null,null,directions[0]);assert.equal(spec.creative.craft,undefined);assert.ok(await lock.verifyLockedDesignRevision(await lock.lockGarmentSpec(spec)));
});
test("daily research is bounded, rotates primary sources and uses the customer timezone",()=>{
  const a=researchRefreshSources(pool.FASHION_RESEARCH_SOURCES,new Date("2026-10-04T06:00:00Z")),b=researchRefreshSources(pool.FASHION_RESEARCH_SOURCES,new Date("2026-10-05T06:00:00Z"));assert.equal(a.length,2);assert.notDeepEqual(a,b);assert.ok(a.every((s:any)=>s.authority==="primary"));assert.match(researchRunKey(new Date("2026-10-04T20:00:00Z")),/2026-10-05$/);assert.deepEqual(researchRefreshSources([]),[]);
});
test("collected hypotheses remain inactive, preserve provenance and cannot become measured fabric facts",()=>{
  const source=pool.FASHION_RESEARCH_SOURCES.find((s:any)=>s.category==="museum"),p=researchPageHypothesis(source,{url:source.baseUrl,text:"Embroidery and textile history"},{contentHash:"a".repeat(64),fetchedAt:"2026-10-04T06:00:00Z"});assert.ok(p);assert.equal(p.active,false);assert.equal(p.provenance?.reviewRequired,true);assert.match(p.note||"",/not a source finding/);
  const library=research.aggregateCreativeResearch([{type:"operator_note",payload:{...p,subtype:"designer_creative_research",researchId:p.id}}]);assert.equal(library.active,0);assert.equal(library.signals[0].provenance.contentHash,"a".repeat(64));assert.equal(researchPageHypothesis(source,{url:source.baseUrl,text:"Just a cookie notice"},{contentHash:"b".repeat(64),fetchedAt:"now"}),null);
});
