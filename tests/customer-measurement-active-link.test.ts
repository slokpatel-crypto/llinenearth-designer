import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY,
  serializeActiveCustomerMeasurementLink,
  parseActiveCustomerMeasurementLink,
  matchesActiveCustomerMeasurementSnapshot,
} from "../src/lib/customer-measurement-active-link.ts";

const snapshot=JSON.stringify({version:1,unit:"in",shirt:{chest:98,waist:82},pants:{waist:80},updatedAt:"2026-10-24T12:00:00Z"});

test("customer-specific active snapshot can be cleared only when ID and content match",()=>{
  const raw=serializeActiveCustomerMeasurementLink("CMP-A",snapshot);
  const link=parseActiveCustomerMeasurementLink(raw);
  assert.ok(link);
  assert.equal(link?.profileId,"CMP-A");
  assert.match(link?.digest||"",/^[0-9a-f]{16}$/);
  assert.equal(matchesActiveCustomerMeasurementSnapshot(link,"CMP-A",snapshot),true);
  assert.equal(matchesActiveCustomerMeasurementSnapshot(link,"CMP-B",snapshot),false);
  assert.equal(matchesActiveCustomerMeasurementSnapshot(link,"CMP-A",null),false);
});

test("manual modifications or a different customer fit are never deleted by stale linkage",()=>{
  const link=parseActiveCustomerMeasurementLink(serializeActiveCustomerMeasurementLink("CMP-A",snapshot));
  const edited=JSON.stringify({...JSON.parse(snapshot),updatedAt:"2026-10-24T14:00:00Z"});
  const different=JSON.stringify({...JSON.parse(snapshot),shirt:{chest:110,waist:92}});
  assert.equal(matchesActiveCustomerMeasurementSnapshot(link,"CMP-A",edited),false);
  assert.equal(matchesActiveCustomerMeasurementSnapshot(link,"CMP-A",different),false);
});

test("missing old linkage and corrupted browser markers fail closed",()=>{
  for(const input of [null,"garbage","[]","null","{}",'{"version":1,"profileId":"CMP-A","digest":"wrong"}']){
    const link=parseActiveCustomerMeasurementLink(input);
    assert.equal(link,null);
    assert.equal(matchesActiveCustomerMeasurementSnapshot(link,"CMP-A",snapshot),false);
  }
  assert.throws(()=>serializeActiveCustomerMeasurementLink("",snapshot),/empty/);
});

test("activation and deletion use the same guarded browser identity contract",()=>{
  const lib=readFileSync("src/lib/customer-measurements.ts","utf8");
  assert.match(lib,/serializeActiveCustomerMeasurementLink\(profile\.id,snapshot\)/);
  assert.match(lib,/\[ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY,serializeActiveCustomerMeasurementLink/);
  assert.match(lib,/matchesActiveCustomerMeasurementSnapshot\(link,id,active\)/);
  assert.match(lib,/records\.push\(\[MEASUREMENT_STORAGE_KEY,null\]\)/);
  assert.match(lib,/records\.push\(\[ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY,null\]\)/);
  assert.match(lib,/link\?\.profileId===id/);
  assert.equal(ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY,"linen-earth-active-customer-measurement-link-v1");
});
