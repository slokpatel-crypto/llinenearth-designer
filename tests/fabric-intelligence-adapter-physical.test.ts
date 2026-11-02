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
