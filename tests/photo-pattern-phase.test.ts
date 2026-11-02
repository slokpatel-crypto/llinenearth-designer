import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { phaseLockedPhotoPatternMatrix, type PhotoPatternMatrix, type PhotoPatternPoint } from "../src/lib/designer/photo-pattern-phase.ts";

function sample(m:PhotoPatternMatrix,p:PhotoPatternPoint) {
  const det=m.a*m.d-m.b*m.c;
  return {x:(m.d*(p.x-m.e)-m.c*(p.y-m.f))/det,
          y:(-m.b*(p.x-m.e)+m.a*(p.y-m.f))/det};
}
function near(left:PhotoPatternPoint,right:PhotoPatternPoint) {
  assert.ok(Math.abs(left.x-right.x)<1e-8,`fabric X phase diverged ${left.x} vs ${right.x}`);
  assert.ok(Math.abs(left.y-right.y)<1e-8,`fabric Y phase diverged ${left.y} vs ${right.y}`);
}

test("sleeve and collar stripe pixels align at photographed joins across fabric scale and orientation",()=>{
  const origin={x:510,y:244};
  for(const scale of [.12,.82,1,1.6])for(const fabricRotationDeg of [0,90]) {
    const base=phaseLockedPhotoPatternMatrix({scale,fabricRotationDeg,panelRotationDeg:0,phaseOrigin:origin,seam:origin});
    for(const [seam,panelRotationDeg] of [[{x:351,y:244},-5.2],[{x:669,y:244},4.9],[{x:512,y:214},90]] as const){
      const panel=phaseLockedPhotoPatternMatrix({scale,fabricRotationDeg,panelRotationDeg,phaseOrigin:origin,seam});
      near(sample(base,seam),sample(panel,seam));
      assert.ok(Number.isFinite(panel.e)&&Number.isFinite(panel.f));
    }
  }
});

test("tucked and untucked trouser legs share repeat phase at center join",()=>{
  for(const config of [
    {origin:{x:510,y:542},seam:{x:510,y:690},rotations:[.3,2.4]},
    {origin:{x:512,y:758},seam:{x:512,y:758},rotations:[-3.6,4.9]},
    {origin:{x:512,y:774},seam:{x:512,y:774},rotations:[-1.8,2.9]},
  ])for(const scale of [.85,1.02,1.6]){
    const base=phaseLockedPhotoPatternMatrix({scale,fabricRotationDeg:0,panelRotationDeg:0,phaseOrigin:config.origin,seam:config.seam});
    for(const panelRotationDeg of config.rotations){
      const panel=phaseLockedPhotoPatternMatrix({scale,fabricRotationDeg:0,panelRotationDeg,phaseOrigin:config.origin,seam:config.seam});
      near(sample(base,config.seam),sample(panel,config.seam));
    }
  }
});

test("no-rotation retains canonical pattern phase and nonfinite transformations fail closed",()=>{
  const origin={x:510,y:244},seam={x:351,y:244};
  const m=phaseLockedPhotoPatternMatrix({scale:.9,fabricRotationDeg:0,panelRotationDeg:0,phaseOrigin:origin,seam});
  assert.ok(Math.abs(m.a-.9)<1e-12);
  assert.ok(Math.abs(m.e-51)<1e-12);
  assert.throws(()=>phaseLockedPhotoPatternMatrix({scale:0,fabricRotationDeg:0,panelRotationDeg:0,phaseOrigin:origin,seam}),RangeError);
  assert.throws(()=>phaseLockedPhotoPatternMatrix({scale:1,fabricRotationDeg:NaN,panelRotationDeg:0,phaseOrigin:origin,seam}),RangeError);
});

test("visual compositor keeps the locked photographic model and phases original sleeves and trousers without ad-hoc offsets",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(preview,/phaseLockedPhotoPatternMatrix/);
  assert.match(preview,/phaseOriginX:510,phaseOriginY:244/);
  assert.match(preview,/phaseLockX:510,phaseLockY:690/);
  assert.match(preview,/const untuckedTrouserPhaseAnchor=/);
  assert.doesNotMatch(preview,/deferCoverage:true, offsetX:\\s*(?:11|-9|5|-5)/);
  const photo=readFileSync("src/lib/designer/photo-preview.ts","utf8");
  assert.match(photo,/\/designer\/studio-tucked\\.webp/);
});
