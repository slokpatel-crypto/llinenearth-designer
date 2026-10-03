import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTO_TUCKED_PANEL_GRAIN_ROTATION,
  PHOTO_TUCKED_PANEL_PATTERN_ANCHOR,
  photoPanelRotationFromVertical,
} from "../src/lib/designer/photo-panel-grain.ts";

test("panel grain rotation measures screen-space fall from vertical",()=>{
  assert.equal(photoPanelRotationFromVertical({topX:100,topY:100,bottomX:100,bottomY:500}),0);
  assert.equal(photoPanelRotationFromVertical({topX:100,topY:100,bottomX:60,bottomY:500}),-5.7);
  assert.equal(photoPanelRotationFromVertical({topX:100,topY:100,bottomX:140,bottomY:500}),5.7);
});

test("tucked photo panels keep directional fabric aligned to photographed garment axes",()=>{
  assert.deepEqual(PHOTO_TUCKED_PANEL_GRAIN_ROTATION,{
    body:0,
    leftSleeve:-5.2,
    rightSleeve:4.9,
    leftTrouser:.3,
    rightTrouser:2.4,
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
