import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseBoundedStyleDirectorHandoffJson,
  STYLE_DIRECTOR_HANDOFF_MAX_REQUEST_BYTES,
} from "../src/lib/designer/style-director-handoff-request.ts";

const makeRequest = (body: string) => new Request("https://linenearth.example/api/style-director/handoff", {
  method: "POST", headers: { "Content-Type": "application/json" }, body,
});

test("the handoff decoder accepts the exact 64 KiB byte boundary, not one more", async () => {
  const base = JSON.stringify({ token: "signed-recipe-placeholder", padding: "" });
  const remaining = STYLE_DIRECTOR_HANDOFF_MAX_REQUEST_BYTES - Buffer.byteLength(base);
  assert.ok(remaining > 0);
  const valid = JSON.stringify({ token: "signed-recipe-placeholder", padding: "x".repeat(remaining) });
  const excess = JSON.stringify({ token: "signed-recipe-placeholder", padding: "x".repeat(remaining + 1) });
  assert.equal(Buffer.byteLength(valid), STYLE_DIRECTOR_HANDOFF_MAX_REQUEST_BYTES);
  assert.equal(Buffer.byteLength(excess), STYLE_DIRECTOR_HANDOFF_MAX_REQUEST_BYTES + 1);
  assert.deepEqual(await parseBoundedStyleDirectorHandoffJson(makeRequest(valid)), {
    token: "signed-recipe-placeholder", padding: "x".repeat(remaining),
  });
  assert.equal(await parseBoundedStyleDirectorHandoffJson(makeRequest(excess)), null);
});

test("the signed handoff JSON boundary rejects malformed, empty and nonobject bodies", async () => {
  for (const invalid of ["", "{", "not-json", "null", "[]", "42", "\"foo\""]) {
    assert.equal(await parseBoundedStyleDirectorHandoffJson(makeRequest(invalid)), null,
      "invalid body must fail closed: " + invalid);
  }
  assert.equal(await parseBoundedStyleDirectorHandoffJson(makeRequest("x".repeat(70000))), null);
  assert.equal(await parseBoundedStyleDirectorHandoffJson({
    body: null,
  }), null);
});

test("UTF-8 split across chunks is decoded; invalid sequences fail closed", async () => {
  const payload = Buffer.from(JSON.stringify({ token: "a.b.c", note: "café" }), "utf8");
  const split = payload.indexOf(0xc3) + 1;
  assert.ok(split > 1);
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(payload.subarray(0, split));
      controller.enqueue(payload.subarray(split));
      controller.close();
    },
  });
  assert.deepEqual(await parseBoundedStyleDirectorHandoffJson({ body: source }),
    { token: "a.b.c", note: "café" });
  const badUtf8 = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([0xc3])); controller.close(); },
  });
  assert.equal(await parseBoundedStyleDirectorHandoffJson({ body: badUtf8 }), null);
});

test("the public handoff API must bound JSON before verifying the token or accessing Supabase", () => {
  const source = readFileSync("src/app/api/style-director/handoff/route.ts", "utf8");
  const limit = source.indexOf("const body=await parseBoundedStyleDirectorHandoffJson(request)");
  const invalid = source.indexOf("if(!body) return NextResponse.json(");
  const token = source.indexOf("const payload=verifyStyleDirectorHandoffToken(token)");
  const network = source.indexOf("const cloud=getSupabaseAdminConfig()");
  assert.ok(limit >= 0 && limit < invalid && invalid < token && token < network);
  assert.equal(source.includes("const body=await request.json()"), false,
    "an unbounded JSON read cannot precede the HMAC and audit");
});
