import test from "node:test";
import assert from "node:assert/strict";
import {
  DIRECT_FABRIC_CAPTURE_MAX_BYTES,
  directFabricCaptureBytes,
  isDirectFabricCapture,
  storedFabricCaptureReference,
} from "../src/lib/fabric-capture-input.ts";

test("authenticated direct fabric capture decodes bounded base64 payload",()=>{
  const payload=Buffer.alloc(600,7).toString("base64");
  const dataUrl=`data:image/jpeg;base64,${payload}`;
  const bytes=directFabricCaptureBytes(dataUrl);
  assert(bytes);
  assert.equal(bytes.byteLength,600);
  assert.equal(isDirectFabricCapture(dataUrl),true);
  assert.equal(storedFabricCaptureReference(dataUrl),"operator-direct-capture");
});

test("too-small direct fabric capture is rejected",()=>{
  const dataUrl=`data:image/png;base64,${Buffer.alloc(100).toString("base64")}`;
  assert.throws(()=>directFabricCaptureBytes(dataUrl),/empty or too small/i);
});

test("oversized direct fabric capture is rejected before Analyzer measurement",()=>{
  const dataUrl=`data:image/webp;base64,${Buffer.alloc(DIRECT_FABRIC_CAPTURE_MAX_BYTES+1).toString("base64")}`;
  assert.throws(()=>directFabricCaptureBytes(dataUrl),/too large/i);
});

test("normal trusted URL remains a normal stored source reference",()=>{
  const url="https://example.vercel-storage.com/fabric/test.webp";
  assert.equal(isDirectFabricCapture(url),false);
  assert.equal(directFabricCaptureBytes(url),null);
  assert.equal(storedFabricCaptureReference(url),url);
});
