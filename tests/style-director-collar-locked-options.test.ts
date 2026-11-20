import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateCollarIssues } from "../src/lib/designer/style-director-compatibility.ts";

test("explicit collar requests and prohibitions require a trustworthy saved option ID", () => {
  const camp = Object.freeze({ collar: "cuban_camp_collar" });
  const spread = Object.freeze({ collar: "spread_collar" });
  const wing = Object.freeze({ collar: "wing_collar" });
  assert.deepEqual(styleDirectorCandidateCollarIssues("camp collar", camp), []);
  assert.deepEqual(styleDirectorCandidateCollarIssues("no camp collar", spread), []);
  assert.deepEqual(styleDirectorCandidateCollarIssues("wing collar", wing), []);
  assert.deepEqual(styleDirectorCandidateCollarIssues("camp collar", spread)
    .map(issue => issue.code), ["candidate_collar_mismatch"]);
  assert.deepEqual(styleDirectorCandidateCollarIssues("no camp collar", camp)
    .map(issue => issue.code), ["candidate_collar_mismatch"]);
  const inherited = Object.create({ collar: "spread_collar" });
  const accessor = Object.defineProperty({}, "collar", {
    get() { throw new Error("do not read an untrusted saved collar getter"); },
  });
  const trap = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const saved of [null, {}, inherited, accessor, trap, revoked.proxy,
    { collar: "obsolete_collar" }, { collar: "barrel_cuff_1_button" }]) {
    for (const wording of ["no camp collar", "camp collar", "wing collar"]) {
      const first = styleDirectorCandidateCollarIssues(wording, saved as never);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_collar_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateCollarIssues(wording, saved as never), first,
        "untrusted saved data must deterministically fail closed");
    }
  }
  assert.deepEqual(styleDirectorCandidateCollarIssues("camp collar optional", null as never), [],
    "optional wording cannot force an unsupported construction");
  assert.deepEqual(styleDirectorCandidateCollarIssues("camp collar and wing collar", null as never), [],
    "a conflicting request belongs to the wording gate");
  assert.deepEqual(styleDirectorCandidateCollarIssues("dress shirt", null as never), [],
    "without explicit intent, this check does not authorise a collar choice");
  assert.equal(camp.collar, "cuban_camp_collar");
  assert.equal(spread.collar, "spread_collar");
  assert.equal(wing.collar, "wing_collar");
});
