import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCanonicalCreativeVisualReview } from "../src/lib/designer/visual-review-input.ts";

const passing={
  status:"pass",heroVisibility:96,boundaryIntegrity:92,protectedChange:1,
  evidenceAvailable:true,semanticAvailable:true,semanticStatus:"pass",
  semanticIssue:"",redesignReason:"other",
} as const;

test("valid actual numeric and boolean visual review evidence remains usable",()=>{
  assert.deepEqual(parseCanonicalCreativeVisualReview(passing),passing);
  assert.deepEqual(parseCanonicalCreativeVisualReview({
    status:"review",heroVisibility:0,boundaryIntegrity:100,protectedChange:100,
    evidenceAvailable:false,semanticAvailable:false,
  }),{
    status:"review",heroVisibility:0,boundaryIntegrity:100,protectedChange:100,
    evidenceAvailable:false,semanticAvailable:false,
  });
});

test("malformed review envelopes and coerced statuses never create approval",()=>{
  for(const value of [null,undefined,[],true,"pass",42,
    {...passing,status:["pass"]},{...passing,status:{toString:()=>"pass"}},
    {...passing,status:"approved"},{...passing,status:null},
    {...passing,semanticStatus:["pass"]},{...passing,semanticStatus:"approved"},
    {...passing,semanticAvailable:true,semanticStatus:undefined},
  ])assert.equal(parseCanonicalCreativeVisualReview(value),null);
});

test("visual review cannot invent measured scores from strings, booleans or nonfinite values",()=>{
  for(const key of ["heroVisibility","boundaryIntegrity","protectedChange"] as const){
    for(const value of [null,true,false,"100","0","",NaN,Infinity,-Infinity,-1,100.001]){
      assert.equal(parseCanonicalCreativeVisualReview({...passing,[key]:value}),null,`${key}=${String(value)}`);
    }
  }
});

test("visual review requires literal boolean evidence and bounded notes",()=>{
  for(const key of ["evidenceAvailable","semanticAvailable"] as const){
    for(const value of ["true","false",1,0,null,[],{}]){
      assert.equal(parseCanonicalCreativeVisualReview({...passing,[key]:value}),null,`${key}=${String(value)}`);
    }
  }
  assert.equal(parseCanonicalCreativeVisualReview({...passing,semanticIssue:"x".repeat(181)}),null);
  assert.equal(parseCanonicalCreativeVisualReview({...passing,redesignReason:"x".repeat(41)}),null);
  assert.equal(parseCanonicalCreativeVisualReview({...passing,semanticIssue:{}}),null);
  assert.equal(parseCanonicalCreativeVisualReview({...passing,redesignReason:[]}),null);
});

test("server rejects invalid visual receipts before constructing a tailor handoff",()=>{
  const source=readFileSync("src/app/api/designer/assess/route.ts","utf8");
  const parser=source.indexOf("parseCanonicalCreativeVisualReview(body.creativeVisualReview)");
  const reject=source.indexOf("Invalid creative visual-review evidence");
  const garment=source.indexOf("const garmentSpec=buildCanonicalGarmentSpec");
  assert.ok(parser>0&&reject>parser&&garment>reject);
  assert.doesNotMatch(source,/Number\(input\.heroVisibility\)|Boolean\(input\.evidenceAvailable\)/);
});
