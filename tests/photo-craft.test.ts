import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { CRAFT_ZONES, DEFAULT_CRAFT_REQUEST, attachCreativeCraft } from "../src/lib/designer/creative-spec.ts";
import { photoCraftAreaPath, photoCraftMarks, photoCraftZone, resolvePhotoCraft } from "../src/lib/designer/photo-craft.ts";
const {load}=createRequire(import.meta.url)("../scripts/designer-test-loader.cjs");
const e=load("src/lib/designer/engine.ts"),c=load("src/lib/designer/creative-engine.ts");
const shirt=e.DESIGNER_SHIRTS[0],pant=e.DESIGNER_PANTS[0],style={...e.designerStyleForOccasion("Casual"),shirtWear:"Tucked",trouser:"Pleated Trouser"};
const direction=c.generateCreativeDirections({shirt,pant,style,occasion:"Casual",context:{climate:"Not specified",intention:"Balanced"},limit:1});
const craft=attachCreativeCraft(direction,{...DEFAULT_CRAFT_REQUEST,surface:"embroidery",motif:"leaf"},shirt)[0].craft!;

test("supported photographic zones are approximate and keep absent or hidden features specification-only",()=>{
  for(const zone of CRAFT_ZONES){const p=photoCraftZone(zone,style);assert.equal(p.status,zone==="pocket"?"spec_only":"approximate");assert.equal(p.areas.length>0,p.status==="approximate");}
  for(const zone of ["waistband","pleat"] as const)assert.equal(photoCraftZone(zone,{...style,shirtWear:"Untucked"}).status,"spec_only");
  assert.equal(photoCraftZone("pleat",{...style,trouser:"Formal Trouser (Flat-front)"}).status,"spec_only");
});
test("placement boxes stay inside photograph bounds and never cover the face or shoes",()=>{
  for(const shirtWear of ["Tucked","Untucked"]){for(const zone of CRAFT_ZONES){for(const a of photoCraftZone(zone,{...style,shirtWear}).areas){assert.ok(a.x>=0&&a.x+a.width<=1024);assert.ok(a.y>=173&&a.y+a.height<=1382);assert.ok(a.width>0&&a.height>0);}}}
  assert.equal(photoCraftZone("cuff",style).areas.length,2);
  assert.match(photoCraftAreaPath(photoCraftZone("cuff",style).areas),/Z M/);
});
test("photo craft uses current catalogue metadata and rejects stale base or unknown accent",()=>{
  const spoof=structuredClone(craft);spoof.panels[0].fabric.image="https://untrusted.invalid/swatch";
  const resolved=resolvePhotoCraft(spoof,e.DESIGNER_FABRICS,shirt.id,pant.id)!;
  assert.equal(resolved.craft.panels[0].fabric.image,shirt.image);
  assert.equal(resolved.panelFabric,shirt);
  assert.equal(resolvePhotoCraft(craft,e.DESIGNER_FABRICS,"another-shirt",pant.id),null);
  assert.equal(resolvePhotoCraft(craft,[],shirt.id,pant.id),null);
  assert.equal(resolvePhotoCraft(undefined,e.DESIGNER_FABRICS,shirt.id,pant.id),null);
});
test("invalid craft cannot reach canvas and unsupported garment accent is rejected",()=>{
  assert.equal(resolvePhotoCraft({...craft,decoration:{...craft.decoration,coverage:Infinity}},e.DESIGNER_FABRICS,shirt.id,pant.id),null);
  const onlyPant={...shirt,allowedGarments:["pant"]};
  assert.equal(resolvePhotoCraft(craft,[onlyPant],shirt.id,pant.id),null);
});
test("illustrative motif grid is deterministic, bounded and responds to judgement dimensions",()=>{
  const d=craft.decoration!,areas=photoCraftZone("shirt-body",{...style,shirtWear:"Untucked"}).areas;
  const before=JSON.stringify(d),marks=photoCraftMarks(d,areas);
  assert.deepEqual(marks,photoCraftMarks(d,areas));assert.equal(JSON.stringify(d),before);
  const quiet=photoCraftMarks({...d,coverage:3},areas),bold=photoCraftMarks({...d,coverage:35},areas);
  assert.ok(quiet[0].size<bold[0].size);
  assert.ok(photoCraftMarks({...d,repeatMm:4},areas).length>photoCraftMarks({...d,repeatMm:60},areas).length);
  assert.ok(photoCraftMarks({...d,repeatMm:4},[{x:0,y:0,width:1024,height:1536}]).length<=768);
  assert.deepEqual(photoCraftMarks(d,[]),[]);
  for(const mark of marks)assert.ok(mark.x>=areas[0].x&&mark.x<areas[0].x+areas[0].width&&mark.y>=areas[0].y&&mark.y<areas[0].y+areas[0].height);
});
