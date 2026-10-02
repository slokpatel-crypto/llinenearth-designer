import assert from "node:assert/strict";
import test from "node:test";
import { photoPreviewSupportForChoice } from "../src/lib/designer/photo-preview.ts";

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
