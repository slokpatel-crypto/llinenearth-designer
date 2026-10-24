import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeCustomerMeasurementProfileId,validStoredCustomerMeasurementProfiles} from "../src/lib/customer-measurement-storage-integrity.ts";

const profile={
  id:"CMP-1720000000000",name:"Existing customer",unit:"in" as const,
  updatedAt:"2026-10-24T12:30:00.000Z",
  measurements:{chest:100.5,waist:87.2,sleeveLength:62.5},
};

test("old customer measurement IDs and centimetre-normalized data are retained unchanged",()=>{
  const records=validStoredCustomerMeasurementProfiles([profile]);
  assert.deepEqual(records,[profile]);
  assert.equal(records[0].measurements.chest,100.5);
  assert.equal(records[0].id,"CMP-1720000000000");
});

test("corrupt nested rows never crash valid surrounding customer cards",()=>{
  const examples=[
    null,3,"string",[],{}, {...profile,id:""}, {...profile,name:null},
    {...profile,unit:"yards"}, {...profile,updatedAt:"not-a-date"},
    {...profile,measurements:null}, {...profile,measurements:{chest:"100"}},
    {...profile,measurements:{waist:Infinity}}, {...profile,measurements:{hip:-10}},
    {...profile,measurements:{chest:300}}, {...profile,measurements:{arbitraryMetric:100}},
  ];
  assert.deepEqual(validStoredCustomerMeasurementProfiles([examples[0],profile,...examples.slice(1)]),[profile]);
  assert.deepEqual(validStoredCustomerMeasurementProfiles({}),[]);
  assert.deepEqual(validStoredCustomerMeasurementProfiles(null),[]);
});

test("dedupes corrupt or repeated IDs before React keys, keeps newest valid and caps at 20",()=>{
  const many=Array.from({length:30},(_,i)=>({...profile,id:`CMP-${i}`,name:`Customer ${i}`}));
  assert.deepEqual(validStoredCustomerMeasurementProfiles([many[0],{...many[0],name:"Duplicate"},...many.slice(1)]).map(x=>x.id),many.slice(0,20).map(x=>x.id));
  assert.equal(validStoredCustomerMeasurementProfiles(many).length,20);
});

test("same-millisecond saved profiles use independent cryptographic nonce IDs",()=>{
  const id1=makeCustomerMeasurementProfileId(Uint8Array.from({length:16},(_,i)=>i),12345);
  const id2=makeCustomerMeasurementProfileId(Uint8Array.from({length:16},(_,i)=>i+1),12345);
  assert.notEqual(id1,id2);
  assert.match(id1,/^CMP-12345-[a-f0-9]{32}$/);
  assert.throws(()=>makeCustomerMeasurementProfileId(new Uint8Array(8),12345),/entropy/);
});

test("actual reader filters storage and writer requests browser crypto entropy",()=>{
  const source=readFileSync("src/lib/customer-measurements.ts","utf8");
  assert.match(source,/validStoredCustomerMeasurementProfiles<CustomerMeasurementProfile>\(parsed\)/);
  assert.match(source,/window\.crypto\.getRandomValues\(new Uint8Array\(16\)\)/);
  assert.match(source,/makeCustomerMeasurementProfileId/);
});

test("customer UI does not claim a saved or active profile after browser write fails",()=>{
  const source=readFileSync("src/components/CustomerMeasurements.tsx","utf8");
  assert.match(source,/Measurement profile could not be saved or activated on this device/);
  assert.match(source,/Could not activate the selected measurement profile on this device/);
  assert.match(source,/Could not delete this browser-stored profile/);
});
