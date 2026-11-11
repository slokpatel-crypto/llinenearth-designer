import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseStyleDirectorAnswers, parseStyleDirectorJsonRequest, STYLE_DIRECTOR_MAX_REQUEST_BYTES } from "../src/lib/designer/style-director-answers.ts";

const journey = {
  occasion: "Travel",
  mood: "Relaxed",
  time: "Day",
  climate: "Hot",
  garment: "shirt",
  colorDirection: "Surprise me",
} as const;

test("the public journey parser accepts every supported canonical option", () => {
  const options = {
    occasion: ["Wedding", "Work", "Date", "Celebration", "Travel", "Everyday"],
    mood: ["Quiet", "Sharp", "Relaxed", "Statement"],
    time: ["Day", "Evening"],
    climate: ["Hot", "Indoor", "Mixed"],
    garment: ["shirt", "trouser", "suit", "blazer"],
    colorDirection: ["Light", "Earthy", "Blue", "Dark", "Surprise me"],
  } as const;
  for (const [field, values] of Object.entries(options)) {
    for (const value of values) {
      const expected = { ...journey, [field]: value };
      assert.deepEqual(parseStyleDirectorAnswers(expected), expected,
        "canonical " + field + ": " + value);
    }
  }
});

test("every missing or invalid journey field is rejected without fallback", () => {
  for (const field of Object.keys(journey)) {
    const missing: Record<string, unknown> = { ...journey };
    delete missing[field];
    assert.equal(parseStyleDirectorAnswers(missing), null, "missing: " + field);
    for (const bad of ["", " ", "invalid-option", "__proto__", "SHIRT", 2,
      0, false, true, null, [], ["shirt"], {}, { id: "shirt" }]) {
      assert.equal(parseStyleDirectorAnswers({ ...journey, [field]: bad }), null,
        "rejected " + field + ": " + JSON.stringify(bad));
    }
  }
  for (const body of [undefined, null, "", "not an object", 3, true, [], [journey]]) {
    assert.equal(parseStyleDirectorAnswers(body), null);
  }
});

test("only own plain values are accepted; inherited and getter-backed answers fail closed", () => {
  const inherited = Object.create(journey);
  assert.equal(parseStyleDirectorAnswers(inherited), null);
  let getters = 0;
  const getterAnswers = Object.defineProperty({ ...journey }, "garment", {
    get() { getters++; throw new Error("must not invoke getter"); },
  });
  assert.equal(parseStyleDirectorAnswers(getterAnswers), null);
  assert.equal(getters, 0);
  const throwingProxy = new Proxy({ ...journey }, {
    getOwnPropertyDescriptor(_target, key) {
      if (key === "garment") throw new Error("unreadable supplied answer");
      return Reflect.getOwnPropertyDescriptor(_target, key);
    },
  });
  assert.equal(parseStyleDirectorAnswers(throwingProxy), null);
});

test("extra client fields are discarded without reading accessors or altering input", () => {
  let extraCalls = 0;
  const input = Object.defineProperty({ ...journey }, "operator", {
    enumerable: true,
    get() { extraCalls++; throw new Error("should not use arbitrary submitted fields"); },
  });
  const parsed = parseStyleDirectorAnswers(input);
  assert.deepEqual(parsed, journey);
  assert.notEqual(parsed, input);
  assert.deepEqual(Object.keys(parsed ?? {}), Object.keys(journey));
  assert.equal(extraCalls, 0);
  assert.equal(journey.garment, "shirt", "input does not mutate");
});

test("public Style Director rejects invalid answers before any stock lookup or recommendation", () => {
  const route = readFileSync("src/app/api/style-director/route.ts", "utf8");
  const guard = route.indexOf("const body = await parseStyleDirectorJsonRequest(request);");
  const reject = route.indexOf("if (!body) return NextResponse.json(");
  const stock = route.indexOf("const metadata=await loadDesignerFabricMetadata();");
  const engine = route.indexOf("const looks=createStyleDirectorLooks(body,stock,fabricIntelligence);");
  assert.ok(guard >= 0 && guard < reject && reject < stock && stock < engine,
    "server must parse allowed IDs before network reads or creating recommendations");
  assert.equal(route.includes("function valid(body: Partial<StyleDirectorAnswers>)"), false,
    "truthy-only validation must not remain on the public endpoint");
});

test("the public JSON boundary rejects malformed, empty and unreadable bodies", async () => {
  const makeRequest = (body: string) => new Request("https://linenearth.example/api/style-director", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const valid = await parseStyleDirectorJsonRequest(makeRequest(JSON.stringify(journey)));
  assert.deepEqual(valid, journey);
  const withExtra = await parseStyleDirectorJsonRequest(makeRequest(
    JSON.stringify({ ...journey, operator: true }),
  ));
  assert.deepEqual(withExtra, journey, "untrusted extra fields cannot pass into stock lookup");
  for (const malformed of ["", "{", "not-json", "null", "[]", "{}", "{\"garment\":42}"]) {
    assert.equal(await parseStyleDirectorJsonRequest(makeRequest(malformed)), null,
      "bad JSON must be rejected before any stock read: " + malformed);
  }
  assert.equal(await parseStyleDirectorJsonRequest({
    json: async () => { throw new SyntaxError("invalid JSON"); },
  }), null, "a JSON decoding failure must fail closed");
  assert.equal(await parseStyleDirectorJsonRequest({
    json: async () => { throw new Error("unreadable request stream"); },
  }), null, "a failed request stream must not become a server 500");
});

test("the API returns 400 for bad JSON and keeps real server failures separate", () => {
  const route = readFileSync("src/app/api/style-director/route.ts", "utf8");
  assert.match(route, /const body = await parseStyleDirectorJsonRequest\(request\);/);
  const boundary = route.indexOf("const body = await parseStyleDirectorJsonRequest(request);");
  const reject = route.indexOf("if (!body) return NextResponse.json(");
  const badStatus = route.indexOf("{ status: 400 }", reject);
  const stock = route.indexOf("const metadata=await loadDesignerFabricMetadata();");
  const unexpectedError = route.indexOf("{ status: 500 }");
  assert.ok(boundary >= 0 && boundary < reject && reject < badStatus &&
    badStatus < stock && stock < unexpectedError,
    "invalid JSON and invalid choices must exit as 400 before IO, while server errors remain 500");
  assert.ok(!route.includes("parseStyleDirectorAnswers(await request.json())"),
    "unsafe JSON decoder must not be inside the server's broad 500 catch");
});

test("real public requests enforce a strict byte cap without truncating valid JSON", async () => {
  const makeRequest = (body: string) => new Request("https://linenearth.example/api/style-director", {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });
  const emptyPadding = JSON.stringify({ ...journey, padding: "" });
  const paddingLength = STYLE_DIRECTOR_MAX_REQUEST_BYTES - new TextEncoder().encode(emptyPadding).length;
  assert.ok(paddingLength > 0, "ordinary six-choice submissions fit within the cap");
  const exactlyAllowed = JSON.stringify({ ...journey, padding: "x".repeat(paddingLength) });
  const oneByteOver = JSON.stringify({ ...journey, padding: "x".repeat(paddingLength + 1) });
  assert.equal(new TextEncoder().encode(exactlyAllowed).length, STYLE_DIRECTOR_MAX_REQUEST_BYTES);
  assert.equal(new TextEncoder().encode(oneByteOver).length, STYLE_DIRECTOR_MAX_REQUEST_BYTES + 1);
  assert.deepEqual(await parseStyleDirectorJsonRequest(makeRequest(exactlyAllowed)), journey,
    "a valid bounded request may carry unrelated fields without forwarding them");
  assert.equal(await parseStyleDirectorJsonRequest(makeRequest(oneByteOver)), null,
    "the request must reject the first excess byte before parsing JSON");
  assert.equal(await parseStyleDirectorJsonRequest(makeRequest("x".repeat(9000))), null);
});

test("the bounded decoder survives split UTF-8 and stops untrusted streaming input", async () => {
  const original = new TextEncoder().encode(JSON.stringify({ ...journey, note: "café" }));
  const splitAt = original.indexOf(0xc3) + 1;
  assert.ok(splitAt > 1, "test must split inside a two-byte UTF-8 character");
  let decoderCalls = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(original.slice(0, splitAt));
      controller.enqueue(original.slice(splitAt));
      controller.close();
    },
  });
  const parsed = await parseStyleDirectorJsonRequest({
    body: stream,
    json: async () => { decoderCalls++; throw new Error("must use bounded stream"); },
  });
  assert.deepEqual(parsed, journey);
  assert.equal(decoderCalls, 0);
  const badUtf8 = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([0xc3])); controller.close(); },
  });
  assert.equal(await parseStyleDirectorJsonRequest({
    body: badUtf8,
    json: async () => { throw new Error("unexpected JSON decoder"); },
  }), null, "incomplete multibyte payload must fail closed");
});
