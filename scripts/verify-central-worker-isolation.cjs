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

// Dedicated software/research boundaries. A disjoint path is not automatically
// owned by its PR: new files outside the assigned module still need explicit
// central review. Scope patterns are intentionally narrower than src/ or tests/.
const WORKER_PATH_RULES = Object.freeze({
  861: [
    /^docs\/TITAN_(?:PARALLEL_TAILOR_HANDOFF|MEASUREMENT_[A-Z0-9_]+)\.md$/,
    /^src\/lib\/designer\/(?:handoff-|production-handoff|tech-pack)[a-z0-9-]*\.ts$/,
    /^tests\/(?:handoff-|production-handoff|tech-pack)[a-z0-9-]*\.test\.ts$/
  ],
  862: [
    /^docs\/TITAN_FABRIC_[A-Z0-9_]+\.md$/,
    /^src\/lib\/(?:fabric-[a-z0-9-]+|physical-evidence-provenance)\.ts$/,
    /^tests\/(?:fabric-[a-z0-9-]+|phase10-(?:analyzer-ground-truth-scorecard|measurement|physical-evidence-provenance))\.test\.ts$/
  ],
  868: [
    /^src\/lib\/designer\/style-director-[a-z0-9-]+\.ts$/,
    /^src\/lib\/style-director-[a-z0-9-]+\.ts$/,
    /^tests\/style-director-[a-z0-9-]+\.test\.ts$/,
    /^tests\/helpers\/style-director-[a-z0-9-]+\.mjs$/
  ],
  869: [
    /^docs\/TITAN_OPERATOR_ORDER_LIFECYCLE(?:_[A-Z0-9_]+)?\.md$/,
    /^src\/lib\/operator\/order-lifecycle[a-z0-9-]*\.ts$/,
    /^tests\/operator-order-lifecycle[a-z0-9-]*\.test\.ts$/
  ],
  886: [
    /^docs\/TITAN_VISUAL_FIDELITY_PHASE[0-9]+\.md$/,
    /^scripts\/(?:build-fabric-render-assets\.mjs|verify-photo-form\.cjs|photo-[a-z0-9-]+\.cjs)$/,
    /^src\/components\/PhotoOutfitPreview\.tsx$/,
    // Narrow, reviewed Studio action-panel responsive fix from visual PR #886.
    /^src\/app\/designer-studio\/designer-light\.css$/,
    /^src\/lib\/designer\/photo-[a-z0-9-]+\.ts$/,
    /^tests\/photo-[a-z0-9-]+\.test\.ts$/
  ],
  897: [
    /^docs\/TITAN_3D_[A-Z0-9_]+\.md$/,
    /^\.github\/workflows\/titan-native-source-candidate\.yml$/,
    /^scripts\/blender\/[a-z0-9-]+\.py$/,
    /^tests\/crotch-trouser-[a-z0-9-]+-native\.test\.ts$/,
    /^tests\/python\/test_source_trouser_[a-z0-9_]+\.py$/
  ]
});

async function checkLiveWorkerRef(repository, number, ref, sha, getJson) {
  assert.ok(typeof ref === "string" && /^[A-Za-z0-9._/-]+$/.test(ref) &&
    !ref.includes("..") && !ref.includes("//") &&
    !ref.startsWith("/") && !ref.endsWith("/"),
    "Worker isolation PR #" + number + " has unsafe or missing live ref");
  const live = await getJson("/repos/" + repository + "/git/ref/heads/" + ref);
  assert.equal(live?.ref, "refs/heads/" + ref,
    "Worker isolation PR #" + number + " returned mismatched live ref");
  assert.equal(live?.object?.sha, sha,
    "Worker isolation PR #" + number + " live head moved; re-audit changed files");
}

async function scanPr(repository, number, getJson) {
  const prefix = "/repos/" + repository + "/pulls/" + number;
  const detail = await getJson(prefix);
  assert.ok(detail?.state === "open" && detail?.head?.repo?.full_name === repository &&
    detail?.base?.repo?.full_name === repository &&
    shaPattern.test(detail?.head?.sha || ""),
    "Integration ownership PR #" + number + " unavailable, closed, foreign or malformed");
  const ref = detail.head?.ref;
  await checkLiveWorkerRef(repository, number, ref, detail.head.sha, getJson);
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
  assert.equal(after?.head?.ref, ref,
    "PR #" + number + " changed branch during ownership scan");
  assert.equal(after?.head?.repo?.full_name, repository,
    "PR #" + number + " changed head repository during ownership scan");
  assert.equal(after?.base?.ref, detail.base.ref,
    "PR #" + number + " retargeted during ownership scan");
  assert.equal(after?.base?.sha, detail.base.sha,
    "PR #" + number + " base changed during ownership scan");
  await checkLiveWorkerRef(repository, number, ref, detail.head.sha, getJson);
  return { number, head: detail.head.sha, ref,
    baseRef: detail.base.ref, baseSha: detail.base.sha, paths };
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
  // Path ownership is stronger than collision-freedom. A worker editing
  // another module is out of scope even if no other open PR touches it.
  for (const pr of scans) {
    if (pr.number === CENTRAL_PR) continue;
    const allowed = WORKER_PATH_RULES[pr.number];
    assert.ok(Array.isArray(allowed) && allowed.length > 0,
      "Unreviewed worker scope owner: PR #" + pr.number);
    for (const path of pr.paths) {
      assert.ok(allowed.some(rule => rule.test(path)),
        "Out-of-scope worker file in PR #" + pr.number + ": " + path);
    }
  }
  // Recheck every PR and live branch after the complete multi-PR scan.
  // This reduces false acceptance from an earlier worker moving while later
  // PRs are examined. GitHub has no atomic cross-PR snapshot here.
  for (const scan of scans) {
    const detail = await getJson("/repos/" + repository + "/pulls/" + scan.number);
    assert.ok(detail?.state === "open" &&
      detail?.head?.repo?.full_name === repository &&
      detail?.base?.repo?.full_name === repository,
      "Worker isolation PR #" + scan.number + " status or repository changed");
    assert.equal(detail.head?.sha, scan.head,
      "Worker isolation PR #" + scan.number + " head moved after cross-PR scan");
    assert.equal(detail.head?.ref, scan.ref,
      "Worker isolation PR #" + scan.number + " ref moved after cross-PR scan");
    assert.equal(detail.base?.ref, scan.baseRef,
      "Worker isolation PR #" + scan.number + " retargeted after cross-PR scan");
    assert.equal(detail.base?.sha, scan.baseSha,
      "Worker isolation PR #" + scan.number + " base moved after cross-PR scan");
    await checkLiveWorkerRef(repository, scan.number, scan.ref, scan.head, getJson);
  }
  return { checkedPrs: scans.length, workers: WORKER_PRS.length,
    uniquePaths: owners.size, centralHead: scans[0].head };
}

async function selfTest() {
  const a = "a".repeat(40), b = "b".repeat(40);
  const sample = { central_base_commit: a };
  const files = new Map([
    [CENTRAL_PR, [{ filename: "src/central.ts" }]],
    [861, [{ filename: "src/lib/designer/tech-pack.ts" }]],
    [862, [{ filename: "src/lib/fabric-analysis.ts" }]],
    [868, [{ filename: "src/lib/style-director-agent.ts" }]],
    [869, [{ filename: "src/lib/operator/order-lifecycle.ts" }]],
    [886, [{ filename: "src/components/PhotoOutfitPreview.tsx" },
      { filename: "src/app/designer-studio/designer-light.css" }]],
    [897, [{ filename: "scripts/blender/source-trouser-max-retained-uv.py" }]]
  ]);
  const get = async path => {
    const refMatch = path.match(/\/git\/ref\/heads\/worker-(\d+)$/);
    if (refMatch) return { ref: "refs/heads/worker-" + refMatch[1],
      object: { sha: a } };
    const m = path.match(/\/pulls\/(\d+)(\/files\?.*)?$/);
    assert.ok(m, "Unexpected synthetic read: " + path);
    const id = Number(m[1]);
    assert.ok(files.has(id), "Unexpected synthetic PR #" + id);
    if (m[2]) return files.get(id);
    return { state: "open",
      head: { sha: a, ref: "worker-" + id,
        repo: { full_name: "sample/repo" } },
      base: { ref: "main", sha: b, repo: { full_name: "sample/repo" } } };
  };
  assert.deepEqual(await verifyWorkerIsolation(sample, "sample/repo", get),
    { checkedPrs: 7, workers: 6, uniquePaths: 8, centralHead: a });
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/868/files?")
      ? [{ filename: "src/central.ts" }] : get(path)),
    /Cross-workstream file ownership conflict/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/868/files?")
      ? [{ filename: "src/lib/fabric-analysis.ts" }] : get(path)),
    /Cross-workstream file ownership conflict/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/886/files?")
      ? [{ filename: "src/components/PhotoOutfitPreview.tsx", status: "renamed",
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
        head: { ...(await get(path)).head, sha: ++reads === 1 ? a : b } } : get(path)),
    /changed head during ownership scan/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/897/files?")
      ? [{ filename: "../unsafe.ts" }] : get(path)),
    /Unsafe changed-file path/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/868/files?")
      ? [{ filename: "src/lib/inventory/stock-ledger.ts" }] : get(path)),
    /Out-of-scope worker file in PR #868/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/886/files?")
      ? [{ filename: "src/components/DesignerModule.tsx" }] : get(path)),
    /Out-of-scope worker file in PR #886/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/886/files?")
      ? [{ filename: "src/app/designer-studio/global.css" }] : get(path)),
    /Out-of-scope worker file in PR #886/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.includes("/pulls/897/files?")
      ? [{ filename: "public/approved-production-model.glb" }] : get(path)),
    /Out-of-scope worker file in PR #897/);
  // A PR snapshot may look unchanged while the live branch has advanced.
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.endsWith("/git/ref/heads/worker-861")
      ? { ref: "refs/heads/worker-861", object: { sha: b } } : get(path)),
    /live head moved; re-audit/);
  // Even if the first two live reads pass, the final cross-PR fence must fail.
  let liveReads = 0;
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.endsWith("/git/ref/heads/worker-861")
      ? { ref: "refs/heads/worker-861",
        object: { sha: ++liveReads <= 2 ? a : b } } : get(path)),
    /live head moved; re-audit/);
  await assert.rejects(() => verifyWorkerIsolation(sample, "sample/repo",
    async path => path.endsWith("/git/ref/heads/worker-868")
      ? { ref: "refs/heads/worker-869", object: { sha: a } } : get(path)),
    /mismatched live ref/);
  process.stdout.write("PASS: worker isolation rejects central, pairwise, rename, stale, closed, unsafe and moving live PR paths\n");
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
