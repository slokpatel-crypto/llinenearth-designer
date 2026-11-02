import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorConstructionIssues,
  styleDirectorIntelligenceTrustWeight,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const trust = (reviewStatus: "unreviewed" | "approved" | "corrected" | "rejected",
  level: "reviewed" | "high-confidence" | "provisional") =>
  styleDirectorIntelligenceTrustWeight({ reviewStatus, trust: level });

function spec(shirt: Record<string,string> = {}, pant: Record<string,string> = {}): StyleSpecV2 {
  return {
    shirt: {
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button", ...shirt,
    },
    pant: {
      type: "formal_flat_front", pleat: "flat_front", hem: "plain_hem",
      break: "slight_break", ...pant,
    },
  } as unknown as StyleSpecV2;
}

test("rejected or unreviewed intelligence cannot masquerade as physically reviewed", () => {
  assert.equal(trust("approved", "reviewed"), 1);
  assert.equal(trust("corrected", "reviewed"), 1);
  assert.equal(trust("rejected", "reviewed"), 0);
  assert.equal(trust("unreviewed", "reviewed"), 0.28);
  assert.equal(trust("rejected", "high-confidence"), 0);
  assert.equal(trust("unreviewed", "high-confidence"), 0.72);
  assert.equal(trust("approved", "provisional"), 0.28);
  assert.equal(styleDirectorIntelligenceTrustWeight(undefined), 0);
});

test("camp-collar type requires matching open collar and untucked wear", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "camp_collar_resort", collar: "cuban_camp_collar", wear: "untucked",
  })), []);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "camp_collar_resort", collar: "point_standard_collar", wear: "tucked",
  })).map(x=>x.code), ["camp_collar_construction"]);
});

test("short sleeves cannot be recommended with French double cuffs", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  })).map(x=>x.code), ["short_sleeve_double_cuff"]);
});

test("pleated and flat-front trouser construction must match selected type", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "pleated_trouser", pleat: "flat_front",
  })).map(x=>x.code), ["pleated_front_missing_pleat"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "formal_flat_front", pleat: "single_pleat_forward",
  })).map(x=>x.code), ["flat_front_has_pleat"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "pleated_trouser", pleat: "single_pleat_forward",
  })), []);
});

test("cropped hem cannot simultaneously claim a full shoe break", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "cropped_ankle", break: "full_break",
  })).map(x=>x.code), ["cropped_full_break"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    hem: "cropped_above_ankle_hem", break: "full_break",
  })).map(x=>x.code), ["cropped_full_break"]);
});

test("construction review is deterministic and never mutates locked style IDs", () => {
  const selected=spec({
    type: "camp_collar_resort", collar: "point_standard_collar", wear: "tucked",
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  }, {type:"pleated_trouser",pleat:"flat_front"});
  const before=JSON.stringify(selected);
  const a=styleDirectorConstructionIssues(selected);
  assert.deepEqual(a,styleDirectorConstructionIssues(selected));
  assert.equal(JSON.stringify(selected),before);
  assert.equal(a.length,3);
});

test("Style Director applies review gates and preserves real versioned camp/band collar IDs", () => {
  const agent=readFileSync("src/lib/style-director-agent.ts","utf8");
  assert.ok(agent.includes("styleDirectorIntelligenceTrustWeight(intel)"));
  assert.ok(agent.includes("styleDirectorConstructionIssues(styleSpec)"));
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'));
  for (const token of [
    'spec.shirt.type="camp_collar_resort"',
    'spec.shirt.collar="cuban_camp_collar"',
    'spec.shirt.wear="untucked"',
    'spec.shirt.type="band_collar_shirt"',
    'spec.shirt.collar="mandarin_band_collar"',
  ]) assert.ok(agent.includes(token),token);
});
