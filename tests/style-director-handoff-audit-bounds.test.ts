import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  readStyleDirectorAuditId, verifiedStyleDirectorAuditId,
} from "../src/lib/designer/style-director-handoff-audit.ts";

const uuid = "550e8400-e29b-41d4-a716-446655440000";
const jsonReply = (body: BodyInit | null, contentType = "application/json") =>
  new Response(body, { status: 200, headers: { "content-type": contentType } });

test("the audit claims persisted only for an exact PostgreSQL UUID JSON string", async () => {
  assert.equal(verifiedStyleDirectorAuditId(uuid), uuid);
  assert.equal(verifiedStyleDirectorAuditId(uuid.toUpperCase()), uuid);
  assert.equal(await readStyleDirectorAuditId(jsonReply(JSON.stringify(uuid))), uuid);
  assert.equal(await readStyleDirectorAuditId(jsonReply(JSON.stringify(uuid.toUpperCase()),
    "application/json; charset=utf-8")), uuid);
  for (const invalid of [null, undefined, false, 42, "", "not-a-uuid", uuid + "extra",
    { auditId: uuid }, [uuid], "00000000-0000-0000-0000-0000000000x0"]) {
    assert.equal(verifiedStyleDirectorAuditId(invalid), null);
    assert.equal(await readStyleDirectorAuditId(jsonReply(JSON.stringify(invalid))), null);
  }
});

test("malformed, oversized, empty, wrong-MIME, and invalid UTF-8 audit replies never pass", async () => {
  for (const body of ["", "{", "null", "[]", "true", JSON.stringify({ auditId: uuid }),
    JSON.stringify(uuid) + " ".repeat(300)]) {
    assert.equal(await readStyleDirectorAuditId(jsonReply(body)), null, "invalid reply: " + body.slice(0, 30));
  }
  assert.equal(await readStyleDirectorAuditId(jsonReply(JSON.stringify(uuid), "text/html")), null);
  assert.equal(await readStyleDirectorAuditId(jsonReply(null)), null);
  assert.equal(await readStyleDirectorAuditId(jsonReply(new Uint8Array([0xc3]))), null);
});

test("a successful but untrusted audit response cannot claim an audited handoff", () => {
  const route = readFileSync("src/app/api/style-director/handoff/route.ts", "utf8");
  const matched = route.indexOf("if(!styleDirectorHandoffMatches(");
  const network = route.indexOf("const response=await fetch(");
  const bounded = route.indexOf("const auditId=await readStyleDirectorAuditId(response);");
  const failClosed = route.indexOf("if(!auditId) return notAudited();");
  const audited = route.indexOf("audited:true,auditId");
  assert.ok(matched >= 0 && matched < network && network < bounded &&
    bounded < failClosed && failClosed < audited, "HMAC match and validated audit ID must precede audited:true");
  assert.ok(route.includes("return notAudited();"));
  assert.ok(!route.includes("await response.text()"), "do not load or log upstream error bodies");
  assert.ok(!route.includes("const auditId=await response.json() as string"),
    "do not trust an arbitrary 200 JSON result as a persisted audit record");
});
