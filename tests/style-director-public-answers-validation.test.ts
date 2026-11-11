import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseStyleDirectorAnswers } from "../src/lib/designer/style-director-answers.ts";

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
  const guard = route.indexOf("const body = parseStyleDirectorAnswers(await request.json());");
  const reject = route.indexOf("if (!body) return NextResponse.json(");
  const stock = route.indexOf("const metadata=await loadDesignerFabricMetadata();");
  const engine = route.indexOf("const looks=createStyleDirectorLooks(body,stock,fabricIntelligence);");
  assert.ok(guard >= 0 && guard < reject && reject < stock && stock < engine,
    "server must parse allowed IDs before network reads or creating recommendations");
  assert.equal(route.includes("function valid(body: Partial<StyleDirectorAnswers>)"), false,
    "truthy-only validation must not remain on the public endpoint");
});
