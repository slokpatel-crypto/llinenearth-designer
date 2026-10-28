import test from "node:test";
import assert from "node:assert/strict";
import {directFabricCaptureBytes} from "../src/lib/fabric-capture-input.ts";

test("canonical direct capture preserves all bytes",()=>{
  const bytes=Buffer.alloc(601,7);
  const dataUrl=`data:image/webp;base64,${bytes.toString("base64")}`;
  assert.deepEqual(Buffer.from(directFabricCaptureBytes(dataUrl)!),bytes);
});

test("corrupted base64 cannot masquerade as a physical fabric capture",()=>{
  const valid=Buffer.alloc(601,7).toString("base64");
  const invalid=[
    valid.slice(0,-1),
    valid.slice(0,-4)+"=AAA",
    valid.slice(0,-4)+"A===",
    valid.slice(0,-4)+"!!!!",
    valid.slice(0,-4)+"AB==",
  ];
  for(const value of invalid){
    assert.throws(()=>directFabricCaptureBytes(`data:image/jpeg;base64,${value}`),/base64/i,value.slice(-12));
  }
});
