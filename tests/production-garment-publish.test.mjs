import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as files from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { publishGarmentCandidate } from "../scripts/publish-garment-candidate.mjs";

async function fixture(run) {
  const root = await files.mkdtemp(path.join(tmpdir(), "linen-publish-pair "));
  const stage = path.join(root, "stage");
  await files.mkdir(stage);
  const paths = {
    stagedGlb: path.join(stage, "model.glb"),
    stagedManifest: path.join(stage, "model.viewer.json"),
    targetGlb: path.join(root, "model.glb"),
    targetManifest: path.join(root, "model.viewer.json"),
  };
  try { await run(paths); }
  finally { await files.rm(root, { force: true, recursive: true }); }
}
async function prepare(paths, prior = true) {
  await files.writeFile(paths.stagedGlb, "new glb fixture");
  await files.writeFile(paths.stagedManifest, "new measured manifest");
  if (prior) {
    await files.writeFile(paths.targetGlb, "prior glb fixture");
    await files.writeFile(paths.targetManifest, "prior measured manifest");
  }
}
function publish(p, operations) {
  return publishGarmentCandidate(p.stagedGlb, p.stagedManifest,
    p.targetGlb, p.targetManifest, operations);
}
async function assertPrior(p) {
  assert.equal(await files.readFile(p.targetGlb, "utf8"), "prior glb fixture");
  assert.equal(await files.readFile(p.targetManifest, "utf8"), "prior measured manifest");
}

test("Verified staged GLB and sidecar replace both previously published files", async () => fixture(async p => {
  await prepare(p);
  publish(p);
  assert.equal(await files.readFile(p.targetGlb, "utf8"), "new glb fixture");
  assert.equal(await files.readFile(p.targetManifest, "utf8"), "new measured manifest");
  await assert.rejects(files.access(p.stagedGlb));
  await assert.rejects(files.access(p.stagedManifest));
}));

test("Missing or zero-byte new sidecar blocks publication without touching old files", async () => fixture(async p => {
  await prepare(p);
  await files.unlink(p.stagedManifest);
  assert.throws(() => publish(p), /Missing or empty staged export/);
  await assertPrior(p);
  await files.writeFile(p.stagedManifest, "");
  assert.throws(() => publish(p), /Missing or empty staged export/);
  await assertPrior(p);
}));

test("Failure during the SECOND rename restores both original GLB and manifest", async () => fixture(async p => {
  await prepare(p);
  let injected = false;
  const operations = {
    ...fs,
    renameSync(from, to) {
      if (to === p.targetManifest && !injected) {
        injected = true;
        throw new Error("simulated second rename failure");
      }
      return fs.renameSync(from, to);
    },
  };
  assert.throws(() => publish(p, operations), /previous model and metadata were restored/);
  assert.equal(injected, true);
  await assertPrior(p);
}));

test("First rename failure with no previous pair leaves no published partial files", async () => fixture(async p => {
  await prepare(p, false);
  const operations = { ...fs, renameSync() { throw new Error("simulated first rename failure"); } };
  assert.throws(() => publish(p, operations), /previous model and metadata were restored/);
  await assert.rejects(files.access(p.targetGlb));
  await assert.rejects(files.access(p.targetManifest));
}));

test("A failure to create backups stops before modifying either final file", async () => fixture(async p => {
  await prepare(p);
  const operations = {
    ...fs,
    copyFileSync() { throw new Error("backup unavailable"); },
  };
  assert.throws(() => publish(p, operations), /backup unavailable/);
  await assertPrior(p);
}));
