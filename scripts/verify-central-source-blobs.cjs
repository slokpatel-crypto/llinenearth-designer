"use strict";
// Deterministic central integration snapshot proof. This does not query GitHub,
// access Supabase, alter migrations, or authorize a merge/deployment.
// Each SHA is Git's blob hash of the bytes originally imported from a worker.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const manifestFile = "docs/TITAN_CENTRAL_SOURCE_BLOB_MANIFEST.json";
const shaPattern = /^[a-f0-9]{40}$/;
// A manifest that silently omits one source PR/file would otherwise pass the
// remaining file checks. A separately reviewed pinned Git blob identity makes
// changes to the entire claimed source intake fail closed, including removals.
const PINNED_MANIFEST_BLOB = "f2f463b58e08da99ecc4610ac4f5a6da7c3485cc";

function gitBlobSha(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha1")
    .update(Buffer.from("blob " + buffer.length + "\0"))
    .update(buffer).digest("hex");
}

function verifyPinnedManifest(bytes) {
  assert.equal(gitBlobSha(bytes), PINNED_MANIFEST_BLOB,
    "Central source manifest changed: review all source PR files and explicitly repin");
}

function verifySnapshot(manifest, readSha) {
  assert.equal(manifest.schema_version, 1, "Unsupported manifest schema");
  assert.ok(shaPattern.test(manifest.central_base_commit), "Invalid central parent");
  assert.ok(Array.isArray(manifest.source_prs) && manifest.source_prs.length > 0,
    "Source PR list cannot be empty");
  assert.ok(manifest.intentionally_combined &&
    typeof manifest.intentionally_combined === "object" &&
    !Array.isArray(manifest.intentionally_combined), "Missing explicit combined workflow map");

  const seen = new Map();
  const sourceIds = new Set();
  const exceptions = manifest.intentionally_combined;
  for (const source of manifest.source_prs) {
    assert.ok(Number.isInteger(source.pr) && source.pr > 0, "Invalid source PR");
    assert.ok(!sourceIds.has(source.pr), "Duplicate source PR");
    sourceIds.add(source.pr);
    assert.ok(shaPattern.test(source.head), "Invalid source commit: #" + source.pr);
    assert.ok(source.files && typeof source.files === "object" &&
      !Array.isArray(source.files) && Object.keys(source.files).length,
      "Source changed-file manifest missing: #" + source.pr);
    for (const [path, sha] of Object.entries(source.files)) {
      assert.ok(path && !path.startsWith("/") && !path.split("/").includes("..") &&
        !path.includes("\\"), "Unsafe manifest path: " + path);
      assert.ok(shaPattern.test(sha), "Invalid source blob: " + path);
      const previous = seen.get(path);
      if (previous && previous !== sha && !Object.hasOwn(exceptions, path)) {
        throw Error("Conflicting source blobs without reviewed exception: " + path);
      }
      if (!previous) seen.set(path, sha);
    }
  }

  // Selective imports must never be presented as a complete worker intake.
  // Their reviewed SQL paths are covered by the same Git blob verification,
  // while the live-head check validates them against the actual source PR.
  const selective = manifest.selective_source_imports;
  assert.ok(Array.isArray(selective), "Selective source import inventory is required");
  for (const source of selective) {
    assert.ok(Number.isInteger(source.pr) && source.pr > 0 &&
      !sourceIds.has(source.pr), "Invalid or duplicate selective import PR");
    sourceIds.add(source.pr);
    assert.ok(shaPattern.test(source.head), "Invalid selective source head");
    assert.ok(typeof source.reason === "string" && source.reason.length >= 80,
      "Selective source import must explain excluded source PR files");
    assert.ok(source.files && typeof source.files === "object" &&
      !Array.isArray(source.files) && Object.keys(source.files).length > 0,
      "Selective source import files missing");
    for (const [path, sha] of Object.entries(source.files)) {
      assert.ok(path && !path.startsWith("/") && !path.split("/").includes("..") &&
        !path.includes("\\"), "Unsafe selective import path: " + path);
      assert.ok(shaPattern.test(sha), "Invalid selective source blob: " + path);
      assert.ok(!seen.has(path) && !Object.hasOwn(exceptions, path),
        "Selective import overlaps fully imported path or workflow exception: " + path);
      seen.set(path, sha);
    }
  }

  for (const [path, exception] of Object.entries(exceptions)) {
    assert.ok(seen.has(path), "Orphan combined-workflow exception: " + path);
    assert.ok(/^\.github\/workflows\/[^/]+\.ya?ml$/.test(path),
      "Only explicitly merged GitHub Actions workflows can have exceptions: " + path);
    assert.ok(exception && shaPattern.test(exception.integrated_blob_sha),
      "Missing integrated blob SHA: " + path);
    assert.ok(typeof exception.reason === "string" && exception.reason.length >= 20,
      "Document why the workflow differs: " + path);
  }

  const errors = [];
  for (const [path, sourceSha] of [...seen].sort(([a],[b]) => a.localeCompare(b))) {
    const expected = Object.hasOwn(exceptions, path)
      ? exceptions[path].integrated_blob_sha : sourceSha;
    try {
      const actual = readSha(path);
      if (actual !== expected)
        errors.push(path + ": expected " + expected + ", actual " + actual);
    } catch (error) {
      errors.push(path + ": cannot read file (" + error.message + ")");
    }
  }
  if (errors.length) throw Error("Integrated source blob mismatch:\n" + errors.join("\n"));
  return { sourcePrs: sourceIds.size, uniquePaths: seen.size,
    combinedWorkflowExceptions: Object.keys(exceptions).length };
}

function selfTest() {
  const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
  assert.equal(gitBlobSha(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a");
  const sample = { schema_version: 1, central_base_commit: a,
    source_prs: [
      { pr: 10, head: a, files: { "src/a.ts": a, ".github/workflows/test.yml": a } },
      { pr: 11, head: b, files: { ".github/workflows/test.yml": b } }
    ],
    intentionally_combined: { ".github/workflows/test.yml": {
      integrated_blob_sha: c, reason: "Explicitly reconciled independent source jobs" } }
  };
  const lookup = path => path === "src/a.ts" ? a : c;
  assert.deepEqual(verifySnapshot(sample, lookup),
    { sourcePrs: 2, uniquePaths: 2, combinedWorkflowExceptions: 1 });
  assert.throws(() => verifySnapshot(sample, () => b), /Integrated source blob mismatch/);
  const noException = structuredClone(sample);
  noException.intentionally_combined = {};
  assert.throws(() => verifySnapshot(noException, lookup), /Conflicting source blobs/);
  const orphan = structuredClone(sample);
  orphan.intentionally_combined[".github/workflows/extra.yml"] = {
    integrated_blob_sha: c, reason: "An unexpected untracked extra workflow" };
  assert.throws(() => verifySnapshot(orphan, lookup), /Orphan combined-workflow exception/);
  const badSource = structuredClone(sample);
  badSource.source_prs[0].files["src/a.ts"] = "not-a-sha";
  assert.throws(() => verifySnapshot(badSource, lookup), /Invalid source blob/);
  assert.throws(() => verifySnapshot(sample, () => { throw Error("missing"); }),
    /cannot read file/);
  const pinnedBytes = readFileSync(join(process.cwd(), manifestFile));
  verifyPinnedManifest(pinnedBytes);
  assert.throws(() => verifyPinnedManifest(Buffer.concat([pinnedBytes, Buffer.from(" ")])),
    /Central source manifest changed/);
  const omittedSource = JSON.parse(pinnedBytes.toString("utf8"));
  omittedSource.source_prs.pop();
  assert.throws(() => verifyPinnedManifest(Buffer.from(JSON.stringify(omittedSource))),
    /Central source manifest changed/);
  process.stdout.write("PASS: central blob parity self-tests reject tampering, conflicts and missing files\n");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const manifestBytes = readFileSync(join(process.cwd(), manifestFile));
  verifyPinnedManifest(manifestBytes);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const result = verifySnapshot(manifest,
    path => gitBlobSha(readFileSync(join(process.cwd(), path))));
  process.stdout.write("PASS: " + result.sourcePrs + " pinned worker PRs, " +
    result.uniquePaths + " source paths, " + result.combinedWorkflowExceptions +
    " approved merged-workflow exceptions; no unreviewed source drift\n");
}
