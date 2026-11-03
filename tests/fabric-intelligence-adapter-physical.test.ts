import test from "node:test";
import assert from "node:assert/strict";
import { adaptFabricProfileToV4 } from "../src/lib/fabric-intelligence-adapter.ts";

test("physical facts and field provenance survive v4 normalization only as literal evidence",()=>{
  const result=adaptFabricProfileToV4({
    version:"fabric-analyzer-v4",
    verifiedPhysical:{
      gsm:155,
      drape:"Balanced",
      fiberContent:"55% linen / 45% cotton",
      sourceUrl:"https://supplier.example/batch-42",
      evidenceNote:"Supplier provided authenticated composition report.",
    },
    provenanceByField:{
      "verifiedPhysical.gsm":"declared",
      "verifiedPhysical.drape":"reviewed",
      "verifiedPhysical.fiberContent":"declared",
    },
  });
  assert.ok(result);
  assert.equal(result.verifiedPhysical.gsm,155);
  assert.equal(result.verifiedPhysical.drape,"Balanced");
  assert.equal(result.verifiedPhysical.fiberContent,"55% linen / 45% cotton");
  assert.equal(result.verifiedPhysical.sourceUrl,"https://supplier.example/batch-42");
  assert.equal(result.provenanceByField["verifiedPhysical.gsm"],"declared");
});

test("arrays and objects must not be coerced into certified GSM, drape, fibre or physical source",()=>{
  const result=adaptFabricProfileToV4({
    version:"fabric-analyzer-v4",
    verifiedPhysical:{
      gsm:[155],drape:["Balanced"],fiberContent:["100% linen"],
      sourceUrl:["https://supplier.example/batch"],evidenceNote:["verified"],
    },
    provenanceByField:{
      "verifiedPhysical.gsm":["reviewed"],
      "verifiedPhysical.drape":["declared"],
      "verifiedPhysical.fiberContent":{toString:"declared"},
      "measured.pattern.physicalScale":["declared"],
    },
  });
  assert.ok(result);
  assert.equal(result.verifiedPhysical.gsm,null);
  assert.equal(result.verifiedPhysical.drape,null);
  assert.equal(result.verifiedPhysical.fiberContent,null);
  assert.equal(result.verifiedPhysical.sourceUrl,null);
  assert.equal(result.verifiedPhysical.evidenceNote,null);
  assert.deepEqual(result.provenanceByField,{});
});

test("model-judged provenance stays distinct from physically declared/reviewed evidence",()=>{
  const result=adaptFabricProfileToV4({
    version:"fabric-analyzer-v4",
    provenanceByField:{
      "measured.colour.hex":"measured",
      "observed.weaveAppearance":"modelJudged",
      "verifiedPhysical.gsm":"declared",
      "verifiedPhysical.fiberContent":"reviewed",
      "verifiedPhysical.drape":"unknown",
    },
  });
  assert.ok(result);
  assert.equal(result.provenanceByField["measured.colour.hex"],"measured");
  assert.equal(result.provenanceByField["observed.weaveAppearance"],"modelJudged");
  assert.equal(result.provenanceByField["verifiedPhysical.gsm"],"declared");
  assert.equal(result.provenanceByField["verifiedPhysical.fiberContent"],"reviewed");
  assert.equal(result.provenanceByField["verifiedPhysical.drape"],undefined);
});

test("oversized physical supplier facts cannot be truncated into certified evidence",()=>{
  const valid={
    gsm:175,
    drape:"Balanced",
    fiberContent:"60% linen, 40% cotton",
    sourceUrl:"https://supplier.example/lot-72",
    evidenceNote:"Inspected supplier lot with a signed report.",
  };
  for(const [field,value] of [
    ["fiberContent","F".repeat(221)],
    ["sourceUrl","https://supplier.example/"+ "A".repeat(1780)],
    ["evidenceNote","R".repeat(501)],
  ] as const){
    const result=adaptFabricProfileToV4({
      version:"fabric-analyzer-v4",
      verifiedPhysical:{...valid,[field]:value},
    });
    assert.ok(result);
    assert.equal(result.verifiedPhysical[field],null,field);
    for(const unaffected of (["gsm","drape"] as const)){
      assert.equal(result.verifiedPhysical[unaffected],valid[unaffected]);
    }
  }
  const edge=adaptFabricProfileToV4({
    version:"fabric-analyzer-v4",
    verifiedPhysical:{fiberContent:"F".repeat(220),sourceUrl:"https://supplier.example/lot-72",evidenceNote:"R".repeat(500)},
  });
  assert.ok(edge);
  assert.equal(edge.verifiedPhysical.fiberContent?.length,220);
  assert.equal(edge.verifiedPhysical.evidenceNote?.length,500);
});

test("render metadata only accepts literal booleans and valid pixel dimensions",()=>{
  const valid=adaptFabricProfileToV4({
    version:"fabric-analyzer-v4",
    renderAssets:{tileWidthPx:1024,tileHeightPx:2048,repeatDetected:true,scaleApproximate:true},
  });
  assert.ok(valid);
  assert.equal(valid.renderAssets.tileWidthPx,1024);
  assert.equal(valid.renderAssets.tileHeightPx,2048);
  assert.equal(valid.renderAssets.repeatDetected,true);
  for(const falseProof of ["false","true",1,["true"],{},null,undefined]){
    const result=adaptFabricProfileToV4({
      version:"fabric-analyzer-v4",
      renderAssets:{repeatDetected:falseProof,tileWidthPx:null,tileHeightPx:""},
    });
    assert.ok(result);
    assert.equal(result.renderAssets.repeatDetected,false,JSON.stringify(falseProof));
    assert.equal(result.renderAssets.tileWidthPx,null);
    assert.equal(result.renderAssets.tileHeightPx,null);
  }
  for(const bad of [0,-1,1.5,NaN,Infinity,-Infinity,"1024",[],[1024],true,32769]){
    const result=adaptFabricProfileToV4({
      version:"fabric-analyzer-v4",renderAssets:{tileWidthPx:bad,tileHeightPx:bad},
    });
    assert.ok(result);
    assert.equal(result.renderAssets.tileWidthPx,null,String(bad));
    assert.equal(result.renderAssets.tileHeightPx,null,String(bad));
  }
  const max=adaptFabricProfileToV4({
    version:"fabric-analyzer-v4",
    renderAssets:{tileWidthPx:32768,tileHeightPx:1,repeatDetected:false},
  });
  assert.ok(max);
  assert.equal(max.renderAssets.tileWidthPx,32768);
  assert.equal(max.renderAssets.tileHeightPx,1);
  assert.equal(max.renderAssets.repeatDetected,false);
});

test("raw padded physical supplier receipts are rejected before trimming",()=>{
  const valid={
    fiberContent:"60% linen / 40% cotton",
    sourceUrl:"https://supplier.example/lot-100",
    evidenceNote:"Inspection and composition documented by supplier.",
  };
  for(const [field,max] of [
    ["fiberContent",220],
    ["sourceUrl",1800],
    ["evidenceNote",500],
  ] as const){
    const result=adaptFabricProfileToV4({
      version:"fabric-analyzer-v4",
      verifiedPhysical:{
        ...valid,
        [field]:" ".repeat(max)+valid[field],
      },
    });
    assert.ok(result);
    assert.equal(result.verifiedPhysical[field],null,field);
    // Rejection is field-local; one oversized source must not silently erase
    // distinct, previously documented physical data.
    for(const keep of (["fiberContent","sourceUrl","evidenceNote"] as const).filter(k=>k!==field)){
      assert.equal(result.verifiedPhysical[keep],valid[keep],keep);
    }
  }
});

test("persisted array-shaped measured data and image quality cannot masquerade as physical evidence",()=>{
  const invalid=adaptFabricProfileToV4({
    version:"fabric-analyzer-v4",
    measured:[{pattern:{repeatMm:12}}],
    imageQuality:[{score:100}],
  });
  assert.ok(invalid);
  assert.equal(invalid.measured,null);
  assert.equal(invalid.imageQuality,null);
});
