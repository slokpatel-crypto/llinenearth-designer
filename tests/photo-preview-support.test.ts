import assert from "node:assert/strict";
import test from "node:test";
import { photoPreviewSupportForChoice, photoPreviewSupportForStyle } from "../src/lib/designer/photo-preview-support.ts";

test("baseline photographed shirt details are exact only where the source photo truly matches",()=>{
  assert.equal(photoPreviewSupportForChoice("collar","Point (Standard) Collar").status,"exact");
  assert.equal(photoPreviewSupportForChoice("cuff","Barrel Cuff (1-button)").status,"exact");
  assert.equal(photoPreviewSupportForChoice("placket","Standard (visible stitch)").status,"exact");
  assert.equal(photoPreviewSupportForChoice("shirtFit","Regular / Classic Fit").status,"exact");
});

test("unsupported cut changes stay approximate instead of borrowing construction-drawing claims",()=>{
  assert.equal(photoPreviewSupportForChoice("collar","Spread Collar").status,"approximate");
  assert.equal(photoPreviewSupportForChoice("cuff","French / Double Cuff").status,"approximate");
  assert.equal(photoPreviewSupportForChoice("trouser","Formal Trouser (Flat-front)").status,"approximate");
  assert.match(photoPreviewSupportForChoice("trouser","Formal Trouser (Flat-front)").reason,/not represented by a matching source photo/i);
});

test("shirt wear has dedicated photographed templates while button material stays specification-only",()=>{
  assert.equal(photoPreviewSupportForChoice("shirtWear","Tucked").status,"exact");
  assert.equal(photoPreviewSupportForChoice("shirtWear","Untucked").status,"exact");
  const button=photoPreviewSupportForChoice("button","Mother-of-Pearl");
  assert.equal(button.status,"approximate");
  assert.match(button.reason,/specification-only/i);
});

test("contrast collar support does not imply physical contrast-cloth verification",()=>{
  const support=photoPreviewSupportForChoice("collarFinish","White contrast collar + cuffs");
  assert.equal(support.status,"approximate");
  assert.match(support.reason,/physical white collar\/cuff cloth is not selected or verified/i);
});


test("office preset directly matches every photographed construction detail except button material",()=>{
  const rows=photoPreviewSupportForStyle({
    collar:"Point (Standard) Collar",
    collarFinish:"Self-fabric",
    cuff:"Barrel Cuff (1-button)",
    placket:"Standard (visible stitch)",
    shirtFit:"Regular / Classic Fit",
    shirtWear:"Tucked",
    trouser:"Pleated Trouser",
    rise:"Mid Rise",
    waistband:"Belt Loops",
    break:"Slight Break",
    button:"Corozo (vegetable ivory)",
  });
  const approximate=rows.filter((row)=>row.support.status!=="exact");
  assert.deepEqual(approximate.map((row)=>row.key),["button"]);
  assert.equal(rows.filter((row)=>row.support.status==="exact").length,10);
});

test("untucked wide template treats wide trouser and full break as direct photo matches",()=>{
  const rows=photoPreviewSupportForStyle({
    collar:"Point (Standard) Collar",
    collarFinish:"Self-fabric",
    cuff:"Barrel Cuff (1-button)",
    placket:"Standard (visible stitch)",
    shirtFit:"Regular / Classic Fit",
    shirtWear:"Untucked",
    trouser:"Wide-leg / Relaxed Drape Trouser",
    rise:"Mid Rise",
    waistband:"Belt Loops",
    break:"Full Break",
    button:"Plastic / Resin",
  });
  assert.equal(rows.find((row)=>row.key==="trouser")?.support.status,"exact");
  assert.equal(rows.find((row)=>row.key==="break")?.support.status,"exact");
  assert.equal(rows.find((row)=>row.key==="rise")?.support.status,"approximate");
  assert.match(rows.find((row)=>row.key==="rise")?.support.reason||"",/hidden under the untucked shirt/i);
});
