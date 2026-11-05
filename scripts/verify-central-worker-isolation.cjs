"use strict";
// Read-only integration ownership audit: six independently developed worker
// drafts must not change each other's files or central draft #881 files.
// Explicitly a path-collision guard, not proof of runtime compatibility or
// permission to merge/deploy. No application, stock or Supabase writes.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const CENTRAL_PR = 881;
const WORKER_PRS = Object.freeze([861, 862, 868, 869, 886, 897]);
const shaPattern = /^[0-9a-f]{40}$/;

async function scanPr(repository, number, getJson) {
  const prefix = "/repos/" + repository + "/pulls/" + number;
  const detail = await getJson(prefix);
  assert.ok(detail?.state === "open" && detail?.head?.repo?.full_name === repository &&
    detail?.base?.repo?.full_name === repository &&
    shaPattern.test(detail?.head?.sha || ""),
    "Integration ownership PR #" + number + " unavailable, closed, foreign or malformed");
  const paths = new Set();
  for (let page = 1; page <= 50; page++) {
    const files = await getJson(prefix + "/files?per_page=100&page=" + page);
    assert.ok(Array.isArray(files) && files.length <= 100,
      "Malformed changed-file response for PR #" + number);
    for (const f of files) {
      assert.ok(typeof f?.filename === "string" && f.filename.length > 0 &&
        !f.filename.includes("\\") && !f.filename.startsWith("/") &&
        !f.filename.split("/").includes(".."),
        "Unsafe changed-file path in PR #" + number);
      assert.ok(!paths.has(f.filename),
        "Duplicate changed-file path within PR #" + number + ": " + f.filename);
      paths.add(f.filename);
      // Detect a worker renaming away from a central-owned file: its old path
      // is as important as the new one for file ownership and conflict review.
      if (f.previous_filename !== undefined) {
        assert.ok(f.status === "renamed" && typeof f.previous_filename === "string" &&
          f.previous_filename.length > 0 &&
          !f.previous_filename.includes("\\") &&
          !f.previous_filename.startsWith("/") &&
          !f.previous_filename.split("/").includes(".."),
          "Invalid rename source in PR #" + number);
        paths.add(f.previous_filename);
      }
    }
    if (files.length < 100) break;
    assert.notEqual(page, 50, "PR #" + number + " file pagination exceeded limit");
  }
  assert.ok(paths.size > 0, "PR #" + number + " has no changed file paths");
  // Verify no branch move or retarget occurred while collecting file pages.
  const after = await getJson(prefix);
  assert.equal(after?.head?.sha, detail.head.sha,
    "PR #" + number + " changed head during ownership scan");
  assert.equal(after?.base?.ref, detail.base.ref,
    "PR #" + number + " retargeted during ownership scan");
  assert.equal(after?.base?.sha, detail.base.sha,
    "PR #" + number + " base changed during ownership scan");
  return { number, head: detail.head.sha, paths };
}

async function verifyWorkerIsolation(manifest, repository, getJson) {
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  assert.ok(shaPattern.test(manifest.central_base_commit || ""),
    "Missing pinned central integration commit");
  const ids = [CENTRAL_PR, ...WORKER_PRS];
  assert.equal(new Set(ids).size, ids.length, "Duplicate audited pull request");
  const scans = [];
  for (const id of ids) scans.push(await scanPr(repository, id, getJson));
  assert.equal(scans[0].head, manifest.central_base_commit,
    "Central integration changed: review before accepting worker isolation");
  const owners = new Map();
  for (const pr of scans) {
    for (const path of pr.paths) {
      const earlier = owners.get(path);
      assert.ok(earlier === undefined,
        "Cross-workstream file ownership conflict: " + path +
        " in PR #" + earlier + " and PR #" + pr.number);
      owners.set(path, pr.number);
    }
  }
  return { checkedPrs: scans.length, workers: WORKER_PRS.length,
    uniquePaths: owners.size, centralHead: scans[0].head };
}

async function selfTest() {
  const a = "a".repeat(40), b = "b".repeat(40);
  const sample = { central_base_commit: a };
  const files = new Map([
    [CENTRAL_PR, [{ filename: "src/central.ts" }]],
    [861, [{ filename: "src/measurements.ts" }]],
    [862, [{ filename: "src/fabric.ts" }]],
    [868, [{ filename: "src/style.ts" }]],
    [869, [{ filename: "src/operator.ts" }]],
    [886, [{ filename: "src/photo.ts" }]],
    [897, [{ filename: "scripts/3d.py" }]]
  ]);
  const get = async path => {
    const m = path.match(/\/pulls\/(\d+)(\/files\?.*)?$/);
    assert.ok(m, "Unexpected synthetic read: " + path);
    const id = Number(m[1]);
    assert.ok(files.has(id), "Unexpected synthetic PR #" + id);
    if (m[2]) return files.get(id);
    return { state: "open",
      head: { sha: a, repo: { full_name: "sample/repo" } },
      base: { ref: "main", sha: b, repo: { full_name: "sample/repo" } } };
  };
  assert.deepEqual(await verifyWorkerIsolation(sample, "sample/repo", get),
    { checkedPrs: 7, workers: 6, uniquePaths: 7, centralHead: a });
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/868/files?")
      ? [{ filename: "src/central.ts" }] : get(path)),
    /Cross-workstream file ownership conflict/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/868/files?")
      ? [{ filename: "src/fabric.ts" }] : get(path)),
    /Cross-workstream file ownership conflict/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/886/files?")
      ? [{ filename: "src/photo.ts", status: "renamed",
        previous_filename: "src/central.ts" }] : get(path)),
    /Cross-workstream file ownership conflict/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.endsWith("/pulls/861")
      ? { ...await get(path), state: "closed" } : get(path)),
    /unavailable, closed, foreign or malformed/);
  let reads = 0;
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.endsWith("/pulls/861")
      ? { ...await get(path),
        head: { sha: ++reads === 1 ? a : b,
          repo: { full_name: "sample/repo" } } } : get(path)),
    /changed head during ownership scan/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/897/files?")
      ? [{ filename: "../unsafe.ts" }] : get(path)),
    /Unsafe changed-file path/);
  process.stdout.write("PASS: worker isolation rejects central, pairwise, rename, stale, closed and unsafe PR paths\n");
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const token = process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  assert.ok(token, "GH_TOKEN required for read-only worker scope verification");
  const getJson = async path => {
    const response = await fetch("https://api.github.com" + path, {
      headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28" },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw Error("GitHub worker scope lookup failed: HTTP " + response.status);
    return response.json();
  };
  const manifest = JSON.parse(readFileSync(join(process.cwd(),
    "docs/TITAN_CENTRAL_SOURCE_BLOB_MANIFEST.json"), "utf8"));
  const result = await verifyWorkerIsolation(manifest, repository, getJson);
  process.stdout.write("PASS: central " + result.centralHead +
    " and " + result.workers + " independent worker PRs have " +
    result.uniquePaths + " disjoint changed paths; no direct overlap\n");
}
main().catch(e => { process.stderr.write(String(e.message) + "\n"); process.exitCode = 1; });
