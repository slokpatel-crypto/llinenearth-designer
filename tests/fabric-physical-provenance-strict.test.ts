import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFabricPhysicalEvidenceProvenance,
  hasFabricPhysicalEvidenceProvenance,
} from "../src/lib/fabric-physical-provenance.ts";

const valid={
  sourceType:"supplier_document",
  reference:"Supplier roll batch E-2026-140",
  checkedBy:"Textile quality manager",
  evidenceDate:"2026-11-02",
  sourceUrl:"https://supplier.example/specs/E-2026-140",
};

test("physical supplier receipts preserve exact bounded references and human review",()=>{
  const actual=normalizeFabricPhysicalEvidenceProvenance(valid);
  assert.deepEqual(actual,valid);
  assert.equal(hasFabricPhysicalEvidenceProvenance(valid),true);
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({
    ...valid,reference:" ROLL  E-2026-140 ",
  })?.reference,"ROLL E-2026-140");
});

test("no overlength human or supplier receipt may be silently clipped into a different valid receipt",()=>{
  for(const [field,value] of [
    ["sourceType","supplier_document".padEnd(41," ")+"x"],
    ["reference","R".repeat(221)],
    ["checkedBy","C".repeat(121)],
    ["evidenceDate","2026-11-02".padEnd(21,"x")],
    ["sourceUrl","https://supplier.example/"+"a".repeat(500)],
  ] as const){
    assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,[field]:value}),null,field);
  }
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,reference:"R".repeat(220)})?.reference.length,220);
});

test("JSON value coercion must not create supplier, roll or inspector proof",()=>{
  for(const field of ["sourceType","reference","checkedBy","evidenceDate","sourceUrl"] as const){
    assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,[field]:[valid[field]]}),null,field);
    assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,[field]:{value:valid[field]}}),null,field);
  }
  assert.equal(hasFabricPhysicalEvidenceProvenance({...valid,sourceType:"unverified"}),false);
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,sourceUrl:"javascript:alert(1)"}),null);
});


test("supplier physical receipts require encrypted source URLs, never HTTP",()=>{
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,sourceUrl:"http://supplier.example/specs/E-2026-140"}),null);
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,sourceUrl:"https://supplier.example/specs/E-2026-140"})?.sourceUrl,valid.sourceUrl);
});

test("inspection evidence date must be a real calendar day, including leap years",()=>{
  for(const evidenceDate of [
    "2026-02-29","2026-02-30","2026-04-31","2026-00-10","2026-13-01",
    "0000-01-01","2026-11-00","2026-11-32",
  ]){
    assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,evidenceDate}),null,evidenceDate);
  }
  for(const evidenceDate of ["2024-02-29","2000-02-29","2026-02-28","2024-11-30"]){
    assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,evidenceDate})?.evidenceDate,evidenceDate);
  }
});

test("future-dated inspection receipts fail closed while UTC-plus time zones remain supported",()=>{
  const future=new Date(Date.now()+4*86_400_000).toISOString().slice(0,10);
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,evidenceDate:future}),null,
    "an inspection days in the future must never be recorded as completed");
  const tomorrowUtc=new Date(Date.now()+86_400_000).toISOString().slice(0,10);
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,evidenceDate:tomorrowUtc})?.evidenceDate,tomorrowUtc,
    "permit current local date in UTC+14 while today's UTC calendar day is earlier");
});
