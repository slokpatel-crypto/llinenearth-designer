import test from "node:test";
import assert from "node:assert/strict";
import { parseLiteralOperatorAvailability } from "../src/lib/designer/operator-availability-literal.ts";

const catalogue = ["linen-one", "linen-two"];

test("only literal operator available can confirm a known fabric", () => {
  assert.deepEqual(parseLiteralOperatorAvailability({
    subtype:"designer_fabric_metadata",fabricId:"linen-one",availability:"available",
  },catalogue),{fabricId:"linen-one",availability:"available",trustedSubtype:true});
  assert.deepEqual(parseLiteralOperatorAvailability({
    subtype:"designer_fabric_metadata",fabricId:"linen-two",availability:"unavailable",
  },catalogue),{fabricId:"linen-two",availability:"unavailable",trustedSubtype:true});
});

test("JSON-coerced, padded and missing availability never become available", () => {
  for(const availability of [["available"],["unavailable"],{toString:"available"},1,true,null," available ","AVAILABLE",undefined]){
    const result=parseLiteralOperatorAvailability({
      subtype:"designer_fabric_metadata",fabricId:"linen-one",availability,
    },catalogue);
    assert.equal(result?.availability,"unknown",JSON.stringify(availability));
  }
});

test("malformed active-fabric subtype carrying availability vetoes older confirmation", () => {
  for(const subtype of [["designer_fabric_metadata"],"designer_fabric_metadata ","typo",null]){
    assert.deepEqual(parseLiteralOperatorAvailability({
      subtype,fabricId:"linen-one",availability:"available",
    },catalogue),{fabricId:"linen-one",availability:"unknown",trustedSubtype:false});
  }
});

test("unrelated notes do not veto known fabric and unknown IDs do not gain authority", () => {
  assert.equal(parseLiteralOperatorAvailability({
    subtype:"tailor_note",fabricId:"linen-one",note:"no stock instruction",
  },catalogue),null);
  assert.equal(parseLiteralOperatorAvailability({
    subtype:"designer_fabric_metadata",fabricId:"unknown",availability:"available",
  },catalogue),null);
  assert.equal(parseLiteralOperatorAvailability({
    subtype:"designer_fabric_metadata",fabricId:["linen-one"],availability:"available",
  },catalogue),null);
});

test("metadata loader must use the literal evidence before selecting newest override", async () => {
  const {readFile}=await import("node:fs/promises");
  const source=await readFile(new URL("../src/lib/designer-fabric-metadata.ts",import.meta.url),"utf8");
  assert.match(source,/parseLiteralOperatorAvailability\(payload, FABRIC_STOCK\.map/);
  assert.match(source,/if \(!identity\.trustedSubtype\) return \{ fabricId, availability:"unknown", verifiedAt:at \}/);
  assert.match(source,/if \(!metadata \|\| result\[metadata\.fabricId\]\) continue/);
  assert.doesNotMatch(source,/const availability = safe\(payload\.availability/);
});
