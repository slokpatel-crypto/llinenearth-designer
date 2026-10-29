import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOperatorProductionStatus } from "../src/lib/designer/operator-production-status.ts";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

test("operator quote/order statuses preserve exact UUID, closed vocabulary and optional note", () => {
  assert.deepEqual(parseOperatorProductionStatus({
    quoteId: ` ${uuid.toUpperCase()} `, status: "sent", note: "  customer notified  ",
  }, "quote"), {recordId:uuid,status:"sent",note:"customer notified"});
  assert.deepEqual(parseOperatorProductionStatus({
    orderId:uuid,status:"delivered",
  }, "order"), {recordId:uuid,status:"delivered",note:""});
  assert.deepEqual(parseOperatorProductionStatus({
    orderId:uuid,status:"cloth_reserved",note:null,
  }, "order"), {recordId:uuid,status:"cloth_reserved",note:""});
});

test("operator status changes reject forged or coerced IDs, status and notes before RPC", () => {
  for (const kind of ["quote","order"] as const) {
    const key = kind === "quote" ? "quoteId" : "orderId";
    const valid = { [key]:uuid,status:kind === "quote" ? "sent" : "cutting",note:"ok" };
    for (const invalid of [[],[uuid],{value:uuid},123,true,null,"",uuid.slice(0,-1),"x".repeat(300)])
      assert.equal(parseOperatorProductionStatus({...valid,[key]:invalid},kind),null,`${kind} ID ${String(invalid)}`);
    for (const invalid of [[],["sent"],{value:"sent"},null,123,true,"draft","created","toString","SENT","delivered ".repeat(2)])
      assert.equal(parseOperatorProductionStatus({...valid,status:invalid},kind),null,`${kind} status ${String(invalid)}`);
    for (const invalid of [[ "note" ],{text:"note"},true,42,"x".repeat(1001)])
      assert.equal(parseOperatorProductionStatus({...valid,note:invalid},kind),null,`${kind} note`);
    assert.equal(parseOperatorProductionStatus({...valid,note:"x".repeat(1000)},kind)?.note.length,1000);
  }
  assert.equal(parseOperatorProductionStatus({quoteId:uuid,status:"delivered"},"quote"),null);
  assert.equal(parseOperatorProductionStatus({orderId:uuid,status:"accepted"},"order"),null);
});

test("privileged production route parses both status changes before QC or RPC and refuses false receipts", () => {
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(source,/parseOperatorProductionStatus\(body,"quote"\)/);
  assert.match(source,/parseOperatorProductionStatus\(body,"order"\)/);
  assert.match(source,/if\(!change\) return NextResponse\.json\(/);
  assert.match(source,/if\(updated!==true\) return NextResponse\.json\(/);
  assert.match(source,/if\(error instanceof SecureJsonBodyTooLarge\).*status:413/);
  assert.match(source,/if\(error instanceof SecureJsonBodyInvalid\).*status:400/);
  assert.doesNotMatch(source,/String\(body\.(?:quoteId|orderId|status|note)/);
  assert.doesNotMatch(source,/String\(body\.note\|\|""\)\.slice/);
  assert.ok(source.indexOf('parseOperatorProductionStatus(body,"order")')<source.indexOf('if(status==="delivered")'));
});

test("privileged production errors do not reflect upstream SQL, owner or RPC details to the browser", () => {
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(source,/console\.error\("\[operator\/production\]",error\)/);
  assert.match(source,/error:"Production operation could not be completed\.".*status:409,headers:\{"cache-control":"private, no-store"\}/);
  assert.doesNotMatch(source,/error:error instanceof Error\?error\.message/);
  // Validation error.message is intentionally shown for malformed user input;
  // only the unexpected privileged RPC catch must not reflect backend details.
  const unexpected=source.split('console.error("[operator/production]",error);').at(-1)||"";
  assert.ok(unexpected.includes('Production operation could not be completed.'));
  assert.doesNotMatch(unexpected,/error:\s*error\.message/);
  // Client-visible validation remains explicit; unexpected backend diagnostics do not.
  assert.match(source,/error:"Valid quote UUID, allowed status/);
  assert.match(source,/error:"Valid order UUID, allowed status/);
});
