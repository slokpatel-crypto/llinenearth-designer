import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("assessment validates explicit measurements and tailor notes before catalogue I/O",()=>{
  const source=readFileSync(new URL("../src/app/api/designer/assess/route.ts",import.meta.url),"utf8");
  const measurements=source.indexOf("let measurements:MeasurementProfile|null;");
  const notes=source.indexOf("const observations=safeObservations(body.observations)");
  const malformed=source.indexOf("Invalid tailor observations; review the current fit notes.");
  const catalogue=source.indexOf("const [catalogue,easeModel]=await Promise.all([");
  assert.ok(measurements>0 && notes>measurements && malformed>notes);
  assert.ok(catalogue>malformed,"untrusted fit evidence must fail before remote catalogue/ease loads");
  assert.ok(source.includes("status:422"),"bad explicit fit evidence must be a client error");
});
