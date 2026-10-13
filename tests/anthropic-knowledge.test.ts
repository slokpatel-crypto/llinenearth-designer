import test from "node:test";
import assert from "node:assert/strict";
import { parseAnthropicEditorialIdeas, maybeEnrichStyleDirectorLooks } from "../src/lib/designer/anthropic-editorial.ts";
import { KNOWLEDGE_PACKS, validatePack, runHarvest } from "../scripts/harvest-anthropic-knowledge.mjs";
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
