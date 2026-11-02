import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  photoPanelPatternMatrix,
  PHOTO_TUCKED_PANEL_GRAIN_ROTATION,
  PHOTO_TUCKED_PANEL_PATTERN_ANCHOR,
  PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION,
  PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR,
} from "../src/lib/designer/photo-panel-grain.ts";

function fabricPixel(m:readonly number[],point:{x:number;y:number}) {
  const [a,b,c,d,e,f]=m,det=a*d-b*c;
  return {x:(d*(point.x-e)-c*(point.y-f))/det,y:(-b*(point.x-e)+a*(point.y-f))/det};
}
function matchAtSeam(left:readonly number[],right:readonly number[],seam:{x:number;y:number}) {
  const a=fabricPixel(left,seam),b=fabricPixel(right,seam);
  assert.ok(Math.abs(a.x-b.x)<1e-8,`trouser stripe X mismatch: ${a.x} versus ${b.x}`);
  assert.ok(Math.abs(a.y-b.y)<1e-8,`trouser stripe Y mismatch: ${a.y} versus ${b.y}`);
}
test("tucked left and right actual trouser panels share the photographed centre seam phase",()=>{
  const seam={x:510,y:690},reference={x:512,y:542};
  for(const scale of [.35,.82,1.02,1.6])for(const fabricRotationDeg of [0,90]){
    const opts={reference,pivot:seam,fabricRotationDeg,scale};
    const left=photoPanelPatternMatrix({...opts,panelRotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.leftTrouser});
    const right=photoPanelPatternMatrix({...opts,panelRotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.rightTrouser});
    matchAtSeam(left,right,seam);
  }
});
test("untucked straight and wide trouser legs share seam phase despite independent photographed axes",()=>{
  for(const geometry of ["pleated","wide"] as const) {
    const seam={x:512,y:geometry==="wide"?774:758},reference={x:512,y:geometry==="wide"?770:758};
    for(const scale of [.35,1.02,1.6])for(const fabricRotationDeg of [0,90]) {
      const opts={reference,pivot:seam,fabricRotationDeg,scale};
      const left=photoPanelPatternMatrix({...opts,panelRotationDeg:PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION[geometry].leftTrouser});
      const right=photoPanelPatternMatrix({...opts,panelRotationDeg:PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION[geometry].rightTrouser});
      matchAtSeam(left,right,seam);
    }
  }
});
test("photographic compositor actually uses the shared seam pivot on both trouser legs",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/pivot:hasSharedSeam\?\{x:placement\.phaseLockX!,y:placement\.phaseLockY!\}/);
  assert.equal((source.match(/phaseLockX:510, phaseLockY:690/g)||[]).length,2);
  assert.equal((source.match(/phaseLockX:UNTUCKED_TROUSER_SEAM_X/g)||[]).length,2);
  assert.match(source,/phaseLockY:trouserGeometry==="wide"\?774:758/);
  const geometry=PHOTO_TUCKED_PANEL_PATTERN_ANCHOR;
  assert.notDeepEqual(geometry.leftTrouser,geometry.rightTrouser,"different panel axes are intentionally preserved");
  assert.notDeepEqual(PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR.pleated.leftTrouser,PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR.pleated.rightTrouser);
});

test("real-browser photo gate covers striped trousers in both photographed legs",()=>{
  const script=readFileSync("scripts/verify-photo-form.cjs","utf8");
  assert.match(script,/const stripedPant=\{\.\.\.pant,image:"\/qa-stripe-pant\.png"/);
  assert.match(script,/compose\(pantStriped\.getContext\("2d"\),model,trouser,shirtImage,stripedImage,shirt,stripedPant,selected\)/);
  assert.match(script,/pantStripeLeft=changes\(pantStripeData/);
  assert.match(script,/pantStripeRight=changes\(pantStripeData/);
  assert.match(script,/assert\.ok\(result\.pantStripeLeft>50/);
  assert.match(script,/assert\.ok\(result\.pantStripeRight>50/);
  assert.match(script,/assert\.equal\(result\.protectedPantChanges,0/);
  assert.match(script,/before-after-\$\{name\}\.png/);
});

test("browser stripe evidence must show dye bands, not only a flat trouser recolour",()=>{
  const script=readFileSync("scripts/verify-photo-form.cjs","utf8");
  for(const required of [
    "control.width=control.height=320",
    "pantStripeLeftBlue=blueStripePixels",
    "pantStripeRightBlue=blueStripePixels",
    "result.pantStripeLeftBlue>40",
    "result.pantStripeRightBlue>40",
  ]) assert.ok(script.includes(required),`missing dyed stripe verification: ${required}`);
});
