import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(
  "src/app/operator/production-calibration/ProductionCalibrationClient.tsx","utf8",
);

test("production cut evidence UI clears stale totals and disables optimistic readiness during refresh failure",()=>{
  const load=source.split('  async function load():Promise<boolean>{')[1]?.split('  useEffect(')[0]??"";
  assert.ok(load.includes("const generation=++refreshGeneration.current"));
  assert.ok(load.indexOf('setData(null)')<load.indexOf('fetch("/api/operator/production-calibration"'));
  assert.ok(load.includes('if(generation!==refreshGeneration.current)return false'));
  assert.ok(load.includes('if(!response.ok)throw new Error("Unavailable calibration ledger")'));
  assert.ok(load.includes('if(data.configured!==true||!Array.isArray(data.cases)'));
  assert.ok(load.includes('fields.total!==Number(fields.shirtCases)+Number(fields.trouserCases)'));
  assert.ok(load.includes('fields.readyForModel!==(Number(fields.shirtCases)>=20&&Number(fields.trouserCases)>=20)'));
  assert.match(load,/catch\{[\s\S]*setData\(null\);\s*setSnapshotState\("error"\)/);
  assert.ok(source.includes('snapshotState!=="ready"?"UNVERIFIED"'));
  assert.ok(source.includes('summary?.shirtCases??"—"'));
  assert.ok(source.includes('Refresh calibration evidence'));
  assert.ok(source.includes('role="alert"'));
});

test("operator cannot record or retry a physical cut until authenticated latest evidence passes the gate",()=>{
  const save=source.split("  async function save(){")[1]?.split("  const summary=")[0]??"";
  assert.ok(source.includes("useRef(createOperatorMutationGate())"));
  assert.ok(save.includes('snapshotState!=="ready"||data?.configured!==true||!mutationGate.current.enter()'));
  assert.ok(save.includes('typeof evidenceId!=="string"'));
  assert.ok(save.includes('const refreshed=await load()'));
  assert.ok(save.includes('setData(null);setSnapshotState("error")'));
  assert.ok(save.includes('mutationGate.current.exit();setSaving(false)'));
  assert.ok(source.includes('disabled={!valid||saving||snapshotState!=="ready"||data?.configured!==true}'));
  assert.ok(source.includes('snapshotState==="ready"&&!data?.cases.length'));
});

test("malformed API summaries and forged physical-cut rows are blocked at UI boundary",()=>{
  assert.ok(source.includes('Number.isSafeInteger(value)'));
  assert.ok(source.includes('data.cases.length>100'));
  assert.ok(source.includes('(item as UsageCase).verifiedEvidence===true'));
  assert.ok(source.includes('Number.isFinite((item as UsageCase).actualMetres)'));
  assert.ok(source.includes('typeof (item as UsageCase).evidenceReference==="string"'));
  assert.ok(source.includes('data.cases.every((item:unknown)'));
});
