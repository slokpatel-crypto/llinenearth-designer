"use strict";
// Read-only GitHub API audit of the *current* source PR heads and changed-file
// blob identities. No live Supabase, writes, PR mutations or deployment.
// Complements the separately pinned snapshot and local on-disk blob checks.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const manifestFile = "docs/TITAN_CENTRAL_SOURCE_BLOB_MANIFEST.json";
const shaPattern = /^[0-9a-f]{40}$/;

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
    files += pinnedFiles.length;
  }
  return { prCount: sources.length, changedFileEntries: files };
}

async function selfTest() {
  const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
  const fixture = { source_prs: [{ pr: 11, head: a,
    files: { "src/example.ts": b, "tests/example.test.ts": c } }] };
  const get = async path => {
    if (path.endsWith("/pulls/11")) return { state: "open", head: { sha: a } };
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
    async path => path.endsWith("/pulls/11")
      ? get(path) : [{ filename: "src/example.ts", sha: b }]), /file list changed/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? get(path) : [{ filename: "src/example.ts", sha: c },
                    { filename: "tests/example.test.ts", sha: c }]), /changed or removed/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11") ? get(path) :
      [{ filename: "src/example.ts", sha: b }, { filename: "src/example.ts", sha: b }]),
    /Duplicate GitHub source PR filename/);
  await assert.rejects(() => verifyLiveSourceHeads(fixture, "sample/repository",
    async path => path.endsWith("/pulls/11")
      ? { state: "closed", head: { sha: a } } : get(path)), /no longer open/);
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
  process.stdout.write("PASS: " + result.prCount + " live source PR heads and " +
    result.changedFileEntries + " changed-file blob identities match reviewed snapshot\n");
}

main().catch(error => { process.stderr.write(String(error.message) + "\n"); process.exitCode = 1; });
