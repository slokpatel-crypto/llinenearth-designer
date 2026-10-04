import assert from "node:assert/strict";
import test from "node:test";
import { photographicCollarOpacity, photographicGarmentOpacity as opacity } from "../src/lib/designer/photo-garment-mask.ts";

test("neutral source-cloth folds keep full selected-fabric coverage inside the traced shirt",()=>{
  for(const rgb of [[50,50,50],[56,57,58],[75,76,77],[96,98,100],[110,110,110]]) {
    assert.equal(opacity("shirt",...rgb as [number,number,number],255,255),1);
  }
});

test("neutral warm-trouser folds do not retain the template cloth inside the traced leg",()=>{
  for(const rgb of [[120,120,120],[151,150,149],[170,170,170]]) {
    assert.equal(opacity("pant",...rgb as [number,number,number],255,255),1);
  }
});

test("overlapping waist geometry cannot paint shirt cloth onto trousers or the reverse",()=>{
  assert.equal(opacity("pant",65,77,85,255,255),0);
  assert.equal(opacity("shirt",130,118,109,255,255),0);
  assert.equal(opacity("pant",130,118,109,255,255),1);
  assert.equal(opacity("shirt",65,77,85,255,255),1);
});

test("geometry and source brightness still protect skin, shoes and studio",()=>{
  for(const region of ["shirt","pant"] as const) {
    assert.equal(opacity(region,40,60,65,0,255),0);
    assert.equal(opacity(region,240,238,230,255,255),0);
    assert.equal(opacity(region,210,210,210,255,255),0);
  }
});

test("the uncertain edge retains the existing photographic colour segmentation",()=>{
  assert.equal(opacity("shirt",70,70,70,255,200),0);
  assert.equal(opacity("shirt",60,70,75,255,200),1);
  assert.equal(opacity("pant",150,140,135,255,200),1);
  assert.equal(opacity("pant",150,150,150,255,200),0);
  assert.ok(opacity("shirt",60,70,75,128,200)>0);
  assert.ok(opacity("shirt",60,70,75,128,200)<1);
});

test("known source cloth at the waistband gets full coverage without a source-colour fringe",()=>{
  assert.equal(opacity("shirt",70,72,73,255,180),1);
  assert.equal(opacity("pant",140,136,134,255,180),1);
  assert.equal(opacity("shirt",70,72,73,128,180),128/255);
});

test("interior recovery is smooth, bounded and rejects invalid evidence",()=>{
  assert.equal(opacity("shirt",80,80,80,255,210),0);
  assert.equal(opacity("shirt",80,80,80,255,222),.5);
  assert.equal(opacity("shirt",80,80,80,255,234),1);
  for(const alpha of [245,247,248]) assert.equal(opacity("shirt",40,39,42,255,alpha),1);
  assert.equal(opacity("shirt",Number.NaN,80,80,255,255),0);
});

test("inner collar cloth is covered while actual photographed neck skin stays excluded",()=>{
  for(const [r,g,b] of [[27,31,34],[38,45,47],[8,10,11],[5,7,9],[20,20,20],[25,23,24],[2,2,2]]) assert.equal(photographicCollarOpacity(r,g,b,255),1);
  for(const [r,g,b] of [[184,173,168],[223,216,212],[151,141,135]]) assert.equal(photographicCollarOpacity(r,g,b,255),0);
  assert.equal(photographicCollarOpacity(27,31,34,0),0);
  assert.equal(photographicCollarOpacity(27,31,34,128),128/255);
});
