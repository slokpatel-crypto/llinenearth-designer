"use strict";
// Read-only GitHub API audit of the *current* source PR heads and changed-file
// blob identities. No live Supabase, writes, PR mutations or deployment.
// Complements the separately pinned snapshot and local on-disk blob checks.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const manifestFile = "docs/TITAN_CENTRAL_SOURCE_BLOB_MANIFEST.json";
const shaPattern = /^[0-9a-f]{40}$/;
// Pinned from the independently inspected main branch at integration intake.
// A new main commit must trigger review/rebase and an explicit re-pin; a
// passing source-blob snapshot alone cannot certify a moved release base.
const APPROVED_MAIN_SHA = "4dd8020abd83429449ff53ea5bb71b046394d86e";

async function verifyLiveSourceHeads(manifest, repository, getJson) {
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Expected GitHub owner/repo");
  assert.ok(Array.isArray(manifest.source_prs) && manifest.source_prs.length > 0,
    "Expected pinned source PRs");
  const selective = manifest.selective_source_imports;
  assert.ok(Array.isArray(selective), "Expected selective source import inventory");
  const sources = [...manifest.source_prs.map(source => ({...source, selective: false})),
    ...selective.map(source => ({...source, selective: true}))];
  const observedPrs = new Set();
  let files = 0;
  for (const source of sources) {
    assert.ok(!observedPrs.has(source.pr), "Duplicate source or selective import PR");
    observedPrs.add(source.pr);
    assert.ok(Number.isInteger(source.pr) && source.pr > 0, "Invalid PR number");
    assert.ok(shaPattern.test(source.head), "Invalid pinned PR head");
    assert.ok(source.files && !Array.isArray(source.files) &&
      typeof source.files === "object", "Invalid pinned PR file map");
    const base = "/repos/" + repository + "/pulls/" + source.pr;
    const detail = await getJson(base);
    assert.ok(detail && detail.state === "open",
      "Source PR #" + source.pr + " is no longer open");
    assert.equal(detail.head && detail.head.sha, source.head,
      "Source PR #" + source.pr + " head changed; audit and repin from reviewed source");
    // A PR's head SHA may lag behind its mutable branch. Check the actual
    // source ref independently before accepting its pinned file inventory.
    assert.equal(detail.head?.repo?.full_name, repository,
      "Source PR #" + source.pr + " must originate from the reviewed repository");
    assert.equal(detail.base?.repo?.full_name, repository,
      "Source PR #" + source.pr + " must target the reviewed repository");
    assert.ok(typeof source.base_ref === "string" &&
      /^[A-Za-z0-9._/-]+$/.test(source.base_ref) &&
      !source.base_ref.includes("..") && !source.base_ref.includes("//"),
      "Source PR #" + source.pr + " missing or unsafe reviewed base ref");
    assert.ok(shaPattern.test(source.base_sha || ""),
      "Source PR #" + source.pr + " missing or invalid reviewed base SHA");
    assert.equal(detail.base?.ref, source.base_ref,
      "Source PR #" + source.pr + " base retargeted; review dependencies and repin");
    assert.equal(detail.base?.sha, source.base_sha,
      "Source PR #" + source.pr + " base SHA changed; review dependencies and repin");
    const ref = detail.head?.ref;
    assert.ok(typeof ref === "string" && /^[A-Za-z0-9._/-]+$/.test(ref) &&
      !ref.includes("..") && !ref.includes("//") &&
      !ref.startsWith("/") && !ref.endsWith("/"),
      "Source PR #" + source.pr + " has an unsafe or missing branch ref");
    const tip = await getJson("/repos/" + repository + "/git/ref/heads/" + ref);
    assert.equal(tip?.ref, "refs/heads/" + ref,
      "Source PR #" + source.pr + " returned a mismatched live branch ref");
    assert.equal(tip?.object?.sha, source.head,
      "Source PR #" + source.pr + " live branch tip moved; review and repin");
    const actual = new Map();
    let page = 1;
    while (true) {
      assert.ok(page <= 50, "Source PR file pagination exceeded safety limit");
      const batch = await getJson(base + "/files?per_page=100&page=" + page);
      assert.ok(Array.isArray(batch) && batch.length <= 100,
        "Unexpected source PR files response");
      for (const item of batch) {
        assert.ok(item && typeof item.filename === "string" &&
          shaPattern.test(item.sha || ""), "Malformed GitHub PR file metadata");
        assert.ok(!actual.has(item.filename),
          "Duplicate GitHub source PR filename: " + item.filename);
        actual.set(item.filename, item.sha);
      }
      if (batch.length < 100) break;
      page++;
    }
    const pinnedFiles = Object.entries(source.files);
    if (!source.selective) {
      assert.equal(actual.size, pinnedFiles.length,
        "Source PR #" + source.pr + " file list changed; audit/review before integration");
    } else {
      assert.ok(typeof source.reason === "string" && source.reason.length >= 80,
        "Partial source intake requires explicit reason and exclusions");
    }
    for (const [path, sha] of pinnedFiles) {
      assert.ok(shaPattern.test(sha), "Malformed pinned source blob");
      assert.equal(actual.get(path), sha,
        "Source PR #" + source.pr + " changed or removed " + path);
    }
    // The branch can change while paginated file metadata is being read.
    // Pin both sides of the scan instead of accepting a mixed-time snapshot.
    const tipAfterFiles = await getJson("/repos/" + repository + "/git/ref/heads/" + ref);
    assert.equal(tipAfterFiles?.ref, "refs/heads/" + ref,
      "Source PR #" + source.pr + " live ref changed during file scan");
    assert.equal(tipAfterFiles?.object?.sha, source.head,
      "Source PR #" + source.pr + " branch moved during file scan");
    files += pinnedFiles.length;
  }
  return { prCount: sources.length, changedFileEntries: files };
}

// The source-file manifest also defines the expected *complete* central PR
// intake. Detect an added integration file not covered by a pinned blob before
// accepting the central branch. This queries only read-only GitHub PR metadata.
async function verifyCentralIntake(manifest, repository, getJson) {
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Expected owner/repo");
  assert.ok(shaPattern.test(manifest.central_base_commit), "Invalid central integration head");
  assert.ok(Array.isArray(manifest.source_prs) &&
    Array.isArray(manifest.selective_source_imports), "Missing source inventories");
  assert.ok(manifest.central_only_files && !Array.isArray(manifest.central_only_files) &&
    typeof manifest.central_only_files === "object", "Missing central-only inventory");
  const exceptions = manifest.intentionally_combined;
  assert.ok(exceptions && !Array.isArray(exceptions) && typeof exceptions === "object",
    "Missing reviewed workflow exceptions");

  const expected = new Map();
  for (const source of [...manifest.source_prs, ...manifest.selective_source_imports]) {
    for (const [path, sourceSha] of Object.entries(source.files)) {
      const blob = Object.hasOwn(exceptions, path)
        ? exceptions[path].integrated_blob_sha : sourceSha;
      assert.ok(shaPattern.test(blob), "Invalid integrated blob SHA: " + path);
      if (expected.has(path)) {
        assert.equal(expected.get(path), blob,
          "Conflicting central source file without reviewed workflow reconciliation: " + path);
      } else expected.set(path, blob);
    }
  }
  for (const [path, blob] of Object.entries(manifest.central_only_files)) {
    assert.ok(!expected.has(path), "Central-only path overlaps worker import: " + path);
    assert.ok(shaPattern.test(blob), "Invalid central-only integrated blob: " + path);
    expected.set(path, blob);
  }
  for (const path of Object.keys(exceptions)) {
    assert.ok(expected.has(path), "Orphan central workflow exception: " + path);
  }

  const prefix = "/repos/" + repository + "/pulls/881";
  const central = await getJson(prefix);
  assert.ok(central && central.state === "open" && central.draft === true,
    "Central PR #881 must remain open and draft");
  assert.equal(central.head?.sha, manifest.central_base_commit,
    "Central PR #881 head changed; review and repin complete intake");
  assert.equal(central.head?.repo?.full_name, repository,
    "Central PR #881 must originate from this repository");
  // PR metadata can be stale even when its recorded head SHA is pinned.
  // Confirm the live central integration branch itself has not advanced.
  const centralRef = central.head?.ref;
  assert.ok(typeof centralRef === "string" &&
    /^[A-Za-z0-9._/-]+$/.test(centralRef) && !centralRef.includes("..") &&
    !centralRef.includes("//") && !centralRef.startsWith("/") &&
    !centralRef.endsWith("/"),
    "Central PR #881 has an unsafe or missing head ref");
  const centralTip = await getJson("/repos/" + repository + "/git/ref/heads/" + centralRef);
  assert.equal(centralTip?.ref, "refs/heads/" + centralRef,
    "Central PR #881 returned a mismatched live branch ref");
  assert.equal(centralTip?.object?.sha, manifest.central_base_commit,
    "Central PR #881 live branch tip moved; review and repin intake");
  assert.equal(central.base?.ref, "main",
    "Central PR #881 must target main without an unreviewed rebase");
  assert.equal(central.base?.sha, APPROVED_MAIN_SHA,
    "Central PR #881 recorded base SHA moved; review integration and repin approved main");
  // GitHub PR base.sha may lag behind the actual branch tip, especially on
  // older open PRs. Query the branch directly before treating this intake as
  // current; a stale PR base snapshot must never bypass re-review.
  const liveMain = await getJson("/repos/" + repository + "/branches/main");
  assert.ok(shaPattern.test(liveMain?.commit?.sha || ""),
    "Cannot independently verify the live main branch commit");
  assert.equal(liveMain.commit.sha, APPROVED_MAIN_SHA,
    "Live main SHA moved; review integration and repin the approved base");

  const actual = new Map();
  let page = 1;
  while (true) {
    assert.ok(page <= 50, "Central PR file pagination exceeded limit");
    const batch = await getJson(prefix + "/files?per_page=100&page=" + page);
    assert.ok(Array.isArray(batch) && batch.length <= 100,
      "Malformed central PR changed-file response");
    for (const item of batch) {
      assert.ok(item && typeof item.filename === "string" &&
        shaPattern.test(item.sha || ""), "Malformed central PR file metadata");
      assert.ok(!actual.has(item.filename),
        "Duplicate central PR changed-file path: " + item.filename);
      actual.set(item.filename, item.sha);
    }
    if (batch.length < 100) break;
    page++;
  }
  assert.equal(actual.size, expected.size,
    "Central PR #881 file count changed; unreviewed addition or removal");
  for (const [path, sha] of expected) {
    assert.equal(actual.get(path), sha,
      "Central PR #881 omitted or changed reviewed file: " + path);
  }
  // Close the scan window: the central branch or main could advance after
  // their initial reads but before the last changed-file page completes.
  const centralTipAfterFiles = await getJson(
    "/repos/" + repository + "/git/ref/heads/" + centralRef);
  assert.equal(centralTipAfterFiles?.ref, "refs/heads/" + centralRef,
    "Central PR #881 live ref changed during file scan");
  assert.equal(centralTipAfterFiles?.object?.sha, manifest.central_base_commit,
    "Central PR #881 branch moved during file scan");
  const mainAfterFiles = await getJson("/repos/" + repository + "/branches/main");
  assert.equal(mainAfterFiles?.commit?.sha, APPROVED_MAIN_SHA,
    "Live main moved during central file scan");
  return { changedFiles: expected.size, commit: manifest.central_base_commit };
}

// Final cross-scan fence: an early worker can advance while later workers
// and the central PR are audited. Re-read the live heads and base relationships
// at the end. This is bounded read-only evidence, not an atomic merge lock.
async function verifyFinalIntakeFence(manifest, repository, getJson) {
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  const prefix = "/repos/" + repository;
  const sources = [...manifest.source_prs, ...manifest.selective_source_imports];
  for (const source of sources) {
    const detail = await getJson(prefix + "/pulls/" + source.pr);
    assert.equal(detail?.state, "open",
      "Final fence: source PR #" + source.pr + " no longer open");
    assert.equal(detail.head?.sha, source.head,
      "Final fence: source PR #" + source.pr + " head moved after scan");
    assert.equal(detail.head?.repo?.full_name, repository,
      "Final fence: source PR #" + source.pr + " head repository moved");
    assert.equal(detail.base?.repo?.full_name, repository,
      "Final fence: source PR #" + source.pr + " base repository moved");
    assert.equal(detail.base?.ref, source.base_ref,
      "Final fence: source PR #" + source.pr + " retargeted after scan");
    assert.equal(detail.base?.sha, source.base_sha,
      "Final fence: source PR #" + source.pr + " base SHA moved after scan");
    const ref = detail.head?.ref;
    assert.ok(typeof ref === "string" && /^[A-Za-z0-9._/-]+$/.test(ref) &&
      !ref.includes("..") && !ref.includes("//") &&
      !ref.startsWith("/") && !ref.endsWith("/"),
      "Final fence: source PR #" + source.pr + " has unsafe ref");
    const tip = await getJson(prefix + "/git/ref/heads/" + ref);
    assert.equal(tip?.ref, "refs/heads/" + ref,
      "Final fence: source PR #" + source.pr + " ref mismatched");
    assert.equal(tip?.object?.sha, source.head,
      "Final fence: source PR #" + source.pr + " branch moved after scan");
  }
  const central = await getJson(prefix + "/pulls/881");
  assert.ok(central?.state === "open" && central?.draft === true,
    "Final fence: central PR #881 no longer open and draft");
  assert.equal(central.head?.sha, manifest.central_base_commit,
    "Final fence: central PR #881 head moved after scan");
  assert.equal(central.head?.repo?.full_name, repository,
    "Final fence: central PR #881 head repository moved");
  assert.equal(central.base?.ref, "main",
    "Final fence: central PR #881 retargeted after scan");
  assert.equal(central.base?.sha, APPROVED_MAIN_SHA,
    "Final fence: central PR #881 base SHA moved after scan");
  const ref = central.head?.ref;
  assert.ok(typeof ref === "string" && /^[A-Za-z0-9._/-]+$/.test(ref) &&
    !ref.includes("..") && !ref.includes("//") &&
    !ref.startsWith("/") && !ref.endsWith("/"),
    "Final fence: central PR #881 has unsafe ref");
  const tip = await getJson(prefix + "/git/ref/heads/" + ref);
  assert.equal(tip?.ref, "refs/heads/" + ref,
    "Final fence: central PR #881 ref mismatched");
  assert.equal(tip?.object?.sha, manifest.central_base_commit,
    "Final fence: central PR #881 branch moved after scan");
  const main = await getJson(prefix + "/branches/main");
  assert.equal(main?.commit?.sha, APPROVED_MAIN_SHA,
    "Final fence: main moved after source/central scan");
  return { sourcePrs: sources.length, main: APPROVED_MAIN_SHA };
}

async function selfTest() {
  const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
  const fixture = { source_prs: [{ pr: 11, head: a,
    base_ref: "main", base_sha: b,
    files: { "src/example.ts": b, "tests/example.test.ts": c } }],
    selective_source_imports: [] };
  const get = async path => {
    if (path.endsWith("/pulls/11")) return { state: "open",
      head: { sha: a, ref: "source-11", repo: { full_name: "sample/repository" } },
      base: { ref: "main", sha: b, repo: { full_name: "sample/repository" } } };
    if (path.endsWith("/git/ref/heads/source-11"))
      return { ref: "refs/heads/source-11", object: { sha: a } };
    if (path.includes("/pulls/11/files?"))
      return [{ filename: "src/example.ts", sha: b },
        { filename: "tests/example.test.ts", sha: c }];
    throw Error("Unexpected synthetic GitHub request");
  };
  assert.deepEqual(await verifyLiveSourceHeads(fixture, "sample/repository", get),
    { prCount: 1, changedFileEntries: 2 });
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? { state: "open", head: { sha: b } } : get(path)), /head changed/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.includes("/pulls/11/files?")
      ? [{ filename: "src/example.ts", sha: b }] : get(path)), /file list changed/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.includes("/pulls/11/files?")
      ? [{ filename: "src/example.ts", sha: c },
        { filename: "tests/example.test.ts", sha: c }] : get(path)), /changed or removed/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.includes("/pulls/11/files?")
      ? [{ filename: "src/example.ts", sha: b },
        { filename: "src/example.ts", sha: b }] : get(path)),
    /Duplicate GitHub source PR filename/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? { state: "closed", head: { sha: a } } : get(path)), /no longer open/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/git/ref/heads/source-11")
      ? { ref: "refs/heads/source-11", object: { sha: b } } : get(path)),
    /live branch tip moved/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/git/ref/heads/source-11")
      ? { ref: "refs/heads/wrong", object: { sha: a } } : get(path)),
    /mismatched live branch ref/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? { ...await get(path), head: { sha: a, ref: "source-11",
        repo: { full_name: "foreign/fork" } } } : get(path)),
    /must originate from the reviewed repository/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? { ...await get(path), head: { sha: a, ref: "../unsafe",
        repo: { full_name: "sample/repository" } } } : get(path)),
    /unsafe or missing branch ref/);
  // Return the pinned head initially, then move the branch after file listing.
  let sourceRefReads = 0;
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/git/ref/heads/source-11")
      ? { ref: "refs/heads/source-11",
        object: { sha: ++sourceRefReads === 1 ? a : b } } : get(path)),
    /branch moved during file scan/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? { ...await get(path), base: { ref: "other", sha: b,
        repo: { full_name: "sample/repository" } } } : get(path)),
    /base retargeted/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? { ...await get(path), base: { ref: "main", sha: c,
        repo: { full_name: "sample/repository" } } } : get(path)),
    /base SHA changed/);
  const subset = { ...fixture, selective_source_imports: [
    { pr: 12, head: a, base_ref: "work/reviewed-parent", base_sha: c,
      files: { "src/only-imported.sql": b },
      reason: "Only this migration SQL is integrated. The source PR tests, scripts, and documentation remain excluded pending review." }
  ] };
  const partialGet = async path => {
    if (path.endsWith("/pulls/12")) return { state: "open",
      head: { sha: a, ref: "work/source-12", repo: { full_name: "sample/repository" } },
      base: { ref: "work/reviewed-parent", sha: c,
        repo: { full_name: "sample/repository" } } };
    if (path.endsWith("/git/ref/heads/work/source-12"))
      return { ref: "refs/heads/work/source-12", object: { sha: a } };
    if (path.includes("/pulls/12/files?")) return [
      { filename: "src/only-imported.sql", sha: b },
      { filename: "docs/not-imported.md", sha: c }
    ];
    return get(path);
  };
  assert.deepEqual(await verifyLiveSourceHeads(subset, "sample/repository", partialGet),
    { prCount: 2, changedFileEntries: 3 });
  await assert.rejects(() => verifyLiveSourceHeads(subset, "sample/repository",
    async path => path.endsWith("/pulls/12")
      ? { ...await partialGet(path), base: { ref: "main", sha: c,
        repo: { full_name: "sample/repository" } } } : partialGet(path)),
    /base retargeted/);
  await assert.rejects(() => verifyLiveSourceHeads(subset, "sample/repository",
    async path => path.endsWith("/pulls/12")
      ? { ...await partialGet(path), base: { ref: "work/reviewed-parent", sha: b,
        repo: { full_name: "sample/repository" } } } : partialGet(path)),
    /base SHA changed/);
  await assert.rejects(() => verifyLiveSourceHeads(subset, "sample/repository",
    async path => path.includes("/pulls/12/files?")
      ? [{filename: "docs/not-imported.md", sha: c}] : partialGet(path)), /changed or removed/);
  await assert.rejects(() => verifyLiveSourceHeads(subset, "sample/repository",
    async path => path.endsWith("/pulls/12")
      ? { state: "open", head: { sha: c } } : partialGet(path)), /head changed/);
  const duplicate = structuredClone(subset);
  duplicate.selective_source_imports[0].pr = 11;
  await assert.rejects(() => verifyLiveSourceHeads(duplicate, "sample/repository", partialGet),
    /Duplicate source or selective import PR/);
  const centralManifest = {
    central_base_commit: a,
    source_prs: fixture.source_prs,
    selective_source_imports: [],
    central_only_files: { "docs/central.md": b },
    intentionally_combined: {}
  };
  const centralGet = async path => {
    if (path.endsWith("/branches/main")) return { commit: { sha: APPROVED_MAIN_SHA } };
    if (path.endsWith("/git/ref/heads/central-integration"))
      return { ref: "refs/heads/central-integration", object: { sha: a } };
    if (path.endsWith("/pulls/881")) return {
      state: "open", draft: true,
      head: { sha: a, ref: "central-integration",
        repo: { full_name: "sample/repository" } },
      base: { ref: "main", sha: APPROVED_MAIN_SHA }
    };
    if (path.includes("/pulls/881/files?")) return [
      { filename: "src/example.ts", sha: b },
      { filename: "tests/example.test.ts", sha: c },
      { filename: "docs/central.md", sha: b }
    ];
    throw Error("Unexpected synthetic central PR query " + path);
  };
  assert.deepEqual(await verifyCentralIntake(centralManifest, "sample/repository", centralGet),
    { changedFiles: 3, commit: a });
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.includes("/pulls/881/files?")
      ? [...await centralGet(path), { filename: "scripts/unreviewed.sh", sha: b }]
      : centralGet(path)), /file count changed/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.includes("/pulls/881/files?")
      ? (await centralGet(path)).slice(0, 2) : centralGet(path)), /file count changed/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.includes("/pulls/881/files?")
      ? (await centralGet(path)).map(item => item.filename === "docs/central.md"
        ? {...item, sha: c} : item) : centralGet(path)), /omitted or changed reviewed file/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/pulls/881")
      ? {...await centralGet(path), head: { sha: b, repo: { full_name: "sample/repository" } }}
      : centralGet(path)), /head changed/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/pulls/881")
      ? {...await centralGet(path), draft: false} : centralGet(path)),
    /must remain open and draft/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/git/ref/heads/central-integration")
      ? { ref: "refs/heads/central-integration", object: { sha: b } } : centralGet(path)),
    /live branch tip moved/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/git/ref/heads/central-integration")
      ? { ref: "refs/heads/unreviewed", object: { sha: a } } : centralGet(path)),
    /mismatched live branch ref/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/pulls/881")
      ? {...await centralGet(path), head: { sha: a, ref: "../unsafe",
        repo: { full_name: "sample/repository" } }} : centralGet(path)),
    /unsafe or missing head ref/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/pulls/881")
      ? {...await centralGet(path), base: { ref: "main", sha: a }} : centralGet(path)),
    /recorded base SHA moved/);
  // A PR base snapshot can stay pinned even as the live branch advances.
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/branches/main")
      ? { commit: { sha: b } } : centralGet(path)),
    /Live main SHA moved/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/branches/main")
      ? { commit: {} } : centralGet(path)),
    /Cannot independently verify the live main branch commit/);
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/pulls/881")
      ? {...await centralGet(path), head: { sha: a, repo: { full_name: "other/fork" } }}
      : centralGet(path)), /must originate from this repository/);
  let centralRefReads = 0;
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/git/ref/heads/central-integration")
      ? { ref: "refs/heads/central-integration",
        object: { sha: ++centralRefReads === 1 ? a : b } } : centralGet(path)),
    /branch moved during file scan/);
  let mainReads = 0;
  await assert.rejects(() => verifyCentralIntake(centralManifest, "sample/repository",
    async path => path.endsWith("/branches/main")
      ? { commit: { sha: ++mainReads === 1 ? APPROVED_MAIN_SHA : b } }
      : centralGet(path)), /Live main moved during central file scan/);
  const finalGet = async path =>
    path.endsWith("/pulls/881") || path.endsWith("/branches/main") ||
    path.endsWith("/git/ref/heads/central-integration")
      ? centralGet(path) : partialGet(path);
  const finalManifest = { ...centralManifest,
    selective_source_imports: subset.selective_source_imports };
  assert.deepEqual(await verifyFinalIntakeFence(finalManifest, "sample/repository", finalGet),
    { sourcePrs: 2, main: APPROVED_MAIN_SHA });
  await assert.rejects(() => verifyFinalIntakeFence(finalManifest, "sample/repository",
    async path => path.endsWith("/git/ref/heads/source-11")
      ? { ref: "refs/heads/source-11", object: { sha: b } } : finalGet(path)),
    /source PR #11 branch moved after scan/);
  await assert.rejects(() => verifyFinalIntakeFence(finalManifest, "sample/repository",
    async path => path.endsWith("/pulls/12")
      ? { ...await finalGet(path),
        base: { ref: "new-base", sha: c, repo: { full_name: "sample/repository" } } }
      : finalGet(path)), /source PR #12 retargeted after scan/);
  await assert.rejects(() => verifyFinalIntakeFence(finalManifest, "sample/repository",
    async path => path.endsWith("/git/ref/heads/central-integration")
      ? { ref: "refs/heads/central-integration", object: { sha: b } }
      : finalGet(path)), /central PR #881 branch moved after scan/);
  await assert.rejects(() => verifyFinalIntakeFence(finalManifest, "sample/repository",
    async path => path.endsWith("/branches/main")
      ? { commit: { sha: b } } : finalGet(path)),
    /main moved after source\/central scan/);
  process.stdout.write("PASS: live-source guard rejects changed heads, missing, rewritten or duplicate files and closed PRs\n");
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const token = process.env.GH_TOKEN;
  assert.ok(token, "GH_TOKEN required for read-only source PR verification");
  const repository = process.env.GITHUB_REPOSITORY;
  const getJson = async apiPath => {
    const response = await fetch("https://api.github.com" + apiPath, {
      headers: {
        authorization: "Bearer " + token,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28"
      },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw Error("GitHub read-only source PR lookup failed: HTTP " + response.status);
    return response.json();
  };
  const manifest = JSON.parse(readFileSync(join(process.cwd(), manifestFile), "utf8"));
  const result = await verifyLiveSourceHeads(manifest, repository, getJson);
  const central = await verifyCentralIntake(manifest, repository, getJson);
  const fence = await verifyFinalIntakeFence(manifest, repository, getJson);
  assert.equal(fence.sourcePrs, result.prCount, "Final source count drift");
  process.stdout.write("PASS: " + result.prCount + " live source PR heads and " +
    result.changedFileEntries + " changed-file blob identities match reviewed snapshot\n");
  process.stdout.write("PASS: central PR #881 has exactly " + central.changedFiles +
    " reviewed files at " + central.commit + "; no untracked integration paths\n");
  process.stdout.write("PASS: final cross-scan worker/central/main refs pinned at " +
    fence.main + "\n");
}

main().catch(error => { process.stderr.write(String(error.message) + "\n"); process.exitCode = 1; });
