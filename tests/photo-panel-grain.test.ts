import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTO_TUCKED_PANEL_GRAIN_ROTATION,
  PHOTO_TUCKED_PANEL_PATTERN_ANCHOR,
  PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION,
  PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR,
  PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION,
  PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR,
  photoPanelRotationFromVertical,
  photoPanelPatternMatrix,
} from "../src/lib/designer/photo-panel-grain.ts";

test("panel grain rotation measures screen-space fall from vertical",()=>{
  assert.equal(photoPanelRotationFromVertical({topX:100,topY:100,bottomX:100,bottomY:500}),0);
  assert.equal(photoPanelRotationFromVertical({topX:100,topY:100,bottomX:60,bottomY:500}),5.7);
  assert.equal(photoPanelRotationFromVertical({topX:100,topY:100,bottomX:140,bottomY:500}),-5.7);
});

test("tucked photo panels keep directional fabric aligned to photographed garment axes",()=>{
  assert.deepEqual(PHOTO_TUCKED_PANEL_GRAIN_ROTATION,{
    body:0,
    leftSleeve:5.2,
    rightSleeve:-4.9,
    leftTrouser:-.3,
    rightTrouser:-2.4,
    collar:90,
  });
});

test("invalid or horizontal-only axis fails safely to zero rotation",()=>{
  assert.equal(photoPanelRotationFromVertical({topX:0,topY:10,bottomX:20,bottomY:10}),0);
  assert.equal(photoPanelRotationFromVertical({topX:Number.NaN,topY:0,bottomX:20,bottomY:100}),0);
});


test("tucked panel pattern anchors stay on photographed seam and waist starts",()=>{
  assert.deepEqual(PHOTO_TUCKED_PANEL_PATTERN_ANCHOR,{
    body:{x:510,y:244},
    leftSleeve:{x:351,y:244},
    rightSleeve:{x:669,y:244},
    leftTrouser:{x:439,y:542},
    rightTrouser:{x:580,y:542},
    collar:{x:512,y:214},
  });
});


test("untucked studio shirt keeps sleeves and collar on photographed panel directions",()=>{
  assert.deepEqual(PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION,{
    body:0,
    leftSleeve:5.2,
    rightSleeve:-4.9,
    collar:90,
  });
  assert.deepEqual(PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR,{
    body:{x:510,y:244},
    leftSleeve:{x:351,y:244},
    rightSleeve:{x:669,y:244},
    collar:{x:512,y:214},
  });
});


test("untucked trouser photos keep each leg on its photographed fall",()=>{
  assert.deepEqual(PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION,{
    pleated:{leftTrouser:3.6,rightTrouser:-4.9},
    wide:{leftTrouser:1.8,rightTrouser:-2.9},
  });
  assert.deepEqual(PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR,{
    pleated:{
      leftTrouser:{x:495,y:758},
      rightTrouser:{x:511,y:759},
    },
    wide:{
      leftTrouser:{x:497,y:770},
      rightTrouser:{x:513,y:774},
    },
  });
});

test("canvas grain leans with the traced sleeve and trouser axes",()=>{
  for(const axis of [
    {topX:351,topY:244,bottomX:311,bottomY:680},
    {topX:669,topY:244,bottomX:706,bottomY:680},
    {topX:511,topY:759,bottomX:562,bottomY:1354},
  ]) {
    const radians=photoPanelRotationFromVertical(axis)*Math.PI/180;
    const projectedDx=-Math.sin(radians),projectedDy=Math.cos(radians);
    assert.ok(Math.abs(projectedDx/projectedDy-(axis.bottomX-axis.topX)/(axis.bottomY-axis.topY))<.002);
  }
});

function sourceTextureAt(matrix:readonly number[],p:{x:number;y:number}){
  const [a,b,c,d,e,f]=matrix,det=a*d-b*c;
  return {x:(d*(p.x-e)-c*(p.y-f))/det,y:(-b*(p.x-e)+a*(p.y-f))/det};
}

test("rotated garment panels preserve pattern phase at their seams for all valid scales",()=>{
  for(const scale of [.35,.75,1,1.4]) for(const fabricRotationDeg of [0,90]) for(const panelRotationDeg of [-7.5,-2.4,0,5.2,90]){
    for(const {reference,pivot} of [
      {reference:{x:510,y:244},pivot:{x:351,y:244}},
      {reference:{x:512,y:542},pivot:{x:580,y:542}},
    ]) {
      const base=photoPanelPatternMatrix({reference,pivot:reference,scale,fabricRotationDeg,panelRotationDeg:0});
      const panel=photoPanelPatternMatrix({reference,pivot,scale,fabricRotationDeg,panelRotationDeg});
      const a=sourceTextureAt(base,pivot),b=sourceTextureAt(panel,pivot);
      assert.ok(Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8,"seam phase changed");
      assert.ok(panel.every(Number.isFinite));
    }
  }
});

test("pattern transform refuses nonfinite geometry and invalid scale",()=>{
  assert.throws(()=>photoPanelPatternMatrix({reference:{x:510,y:244},pivot:{x:351,y:244},scale:0,panelRotationDeg:0,fabricRotationDeg:0}),RangeError);
  assert.throws(()=>photoPanelPatternMatrix({reference:{x:510,y:Number.NaN},pivot:{x:351,y:244},scale:1,panelRotationDeg:0,fabricRotationDeg:0}),RangeError);
});
