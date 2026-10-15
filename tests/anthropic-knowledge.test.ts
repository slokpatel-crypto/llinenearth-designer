import test from "node:test";
import assert from "node:assert/strict";
import { parseAnthropicEditorialIdeas, maybeEnrichStyleDirectorLooks } from "../src/lib/designer/anthropic-editorial.ts";
// @ts-ignore -- standalone operational .mjs CLI intentionally has no TS declaration
import { KNOWLEDGE_PACKS, validatePack, runHarvest, harvestOnePack } from "../scripts/harvest-anthropic-knowledge.mjs";
import type { StyleDirectorLook } from "../src/lib/style-director-agent.ts";

test("editorial parser only retains approved look IDs and refuses unverified physical claims", () => {
  const accepted = parseAnthropicEditorialIdeas({ ideas: [
    { lookId: "one", note: "A relaxed shirt with a cleaner trouser balances this warm-weather look." },
    { lookId: "two", note: "Supplier verified 100% linen with exact 180 GSM for this outfit." },
    { lookId: "unknown", note: "Add a different product and change the garment stock identity." },
    { lookId: "one", note: "Duplicate note that must be discarded because one already exists." },
  ] }, ["one", "two"]);
  assert.deepEqual(accepted, [{
    lookId: "one",
    note: "A relaxed shirt with a cleaner trouser balances this warm-weather look.",
  }]);
  assert.deepEqual(parseAnthropicEditorialIdeas({ideas: Array.from({length:9},()=>({lookId:"one",note:"nice note"}))},["one"]), []);
  assert.deepEqual(parseAnthropicEditorialIdeas({ideas:[{lookId:"one",note:"<script>alert(1)</script> design"}]},["one"]), []);
});

test("Claude editorial is strictly opt-in and the fallback preserves the original design", async () => {
  const existing = [{ id: "one", why: ["Deterministic reason"] }] as StyleDirectorLook[];
  const originalFlag = process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  try {
    delete process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED;
    process.env.ANTHROPIC_API_KEY = "not-a-real-key";
    assert.equal(await maybeEnrichStyleDirectorLooks(existing), existing);
  } finally {
    if (originalFlag === undefined) delete process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED;
    else process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED = originalFlag;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  }
});

test("harvest dry-run never requires the API key or creates claimed research", async () => {
  const planned = await runHarvest();
  assert.equal(planned.dryRun, true);
  assert.equal(planned.packCount, 8);
  assert.deepEqual(planned.packs, KNOWLEDGE_PACKS.map((pack) => pack.id));
});

test("harvest rejects fabricated provenance levels and duplicate IDs", () => {
  const okEntry = {
    id: "test-guide",
    guideline: "Inspect physical swatch repeat with a ruler.",
    reason: "Screen-only pattern scale cannot be verified.",
    applicableWhen: "Striped shirting",
    verifyWith: "Measured millimetre ruler",
    riskIfWrong: "Wrong on-garment scale",
    evidenceLevel: "requires_measurement",
  };
  const entries = Array.from({length:8}, (_, i) => ({...okEntry, id:"guide-" + i}));
  assert.equal(validatePack({entries}).length, 8);
  assert.throws(() => validatePack({entries:[...entries.slice(0,7),entries[0]]}), /Duplicate/);
  assert.throws(() => validatePack({entries:entries.map((row,i)=>i===0?{...row,evidenceLevel:"measured"}:row)}), /Unsafe evidence level/);
  assert.throws(() => validatePack({entries:entries.slice(0,7)}), /Entry count/);
});

test("one-pack harvest validates provider response without storing secret", async () => {
  const entry = {
    id:"tested-guideline", guideline:"Inspect real cloth before cutting.",
    reason:"A photo cannot certify warp and weft performance.",
    applicableWhen:"Making a draped linen trouser", verifyWith:"Tailor and supplied swatch",
    riskIfWrong:"Incorrect production fit", evidenceLevel:"requires_measurement",
  };
  const oldFetch = globalThis.fetch;
  let outgoingRequest: RequestInit | undefined;
  globalThis.fetch = async (_url, request) => {
    outgoingRequest = request;
    return new Response(JSON.stringify({
      content:[{type:"text",text:JSON.stringify({entries:Array.from({length:8},(_,i)=>({...entry,id:"guideline-"+i}))})}],
      usage:{input_tokens:225,output_tokens:670},
    }),{status:200,headers:{"content-type":"application/json"}});
  };
  try {
    const response = await harvestOnePack(KNOWLEDGE_PACKS[0],"fake-test-only-key","fake-test-model");
    assert.equal(response.entries.length,8);
    assert.equal(response.usage.output_tokens,670);
    assert.ok(String(outgoingRequest?.body).includes("fabric"));
    assert.equal((outgoingRequest?.headers as Record<string,string>)["x-api-key"],"fake-test-only-key");
    assert.equal(JSON.stringify(response).includes("fake-test-only-key"),false);
  } finally { globalThis.fetch = oldFetch; }
});

test("enabled editorial adds only an extra styling note and preserves immutable look selections", async () => {
  const look = {
    id:"one",
    fabric:{id:"canonical-fabric",line:"Formal shirting",colorName:"Soft blue"},
    candidate:{garments:{shirt:"shirt",trouser:"trouser"}},
    why:["Deterministic reason"],
    realModel:{shirtId:"canonical-shirt",pantId:"canonical-pant"},
    handoffToken:"signed-design",
  } as unknown as StyleDirectorLook;
  const before = JSON.stringify(look);
  const oldFetch=globalThis.fetch;
  const oldKey=process.env.ANTHROPIC_API_KEY;
  const oldFlag=process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED;
  process.env.ANTHROPIC_API_KEY="fake-test-only-key";
  process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED="1";
  globalThis.fetch=async()=>new Response(JSON.stringify({
    content:[{type:"text",text:JSON.stringify({ideas:[{
      lookId:"one",
      note:"Let the soft blue shirt lead and keep the trousers visually quiet.",
    }]})}],
  }),{status:200,headers:{"content-type":"application/json"}});
  try {
    const enriched=await maybeEnrichStyleDirectorLooks([look]);
    assert.equal(enriched[0].why.length,2);
    assert.equal(enriched[0].fabric.id,"canonical-fabric");
    assert.equal(enriched[0].realModel?.shirtId,"canonical-shirt");
    assert.equal(JSON.stringify(look),before);
  } finally {
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY=oldKey;
    if(oldFlag===undefined)delete process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED;
    else process.env.ANTHROPIC_STYLE_EDITORIAL_ENABLED=oldFlag;
  }
});
