import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { layerGlbFixture } from "./helpers/model-layer-glb-fixture.ts";

const script = fileURLToPath(new URL("../scripts/check-model-layer-asset.mjs", import.meta.url));
async function workspace(run: (context: { root: string; asset: string; registrationPath: string; fixture: ReturnType<typeof layerGlbFixture> }) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "linen-layer-preflight-"));
  const fixture = layerGlbFixture(), asset = path.join(root, "public", fixture.registration.glbPath);
  const registrationPath = path.join(root, "candidate.json");
  try {
    await fs.mkdir(path.dirname(asset), { recursive: true });
    await fs.writeFile(asset, fixture.pack());
    await fs.writeFile(registrationPath, JSON.stringify(fixture.registration));
    await run({ root, asset, registrationPath, fixture });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
function check(root: string, args = ["candidate.json"]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], { cwd: root, encoding: "utf8", timeout: 10_000 });
  assert.equal(result.error, undefined);
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
}

test("CLI hashes the actual registered bytes, writes nothing and never approves production", async () => workspace(async ({ root, asset, fixture }) => {
  const before = await fs.readFile(asset), first = check(root), second = check(root);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.deepEqual(first.report, second.report, "Same bytes give deterministic evidence.");
  assert.equal(first.report.candidateReady, true); assert.equal(first.report.productionApproved, false);
  assert.equal(first.report.assetSha256, createHash("sha256").update(fixture.pack()).digest("hex"));
  assert.equal(first.report.registrationFileSha256, createHash("sha256").update(JSON.stringify(fixture.registration)).digest("hex"));
  assert.equal(first.report.registrationSha256, createHash("sha256").update(JSON.stringify(first.report.registration)).digest("hex"));
  assert.equal(first.report.geometry.productionApproved, false);
  assert.equal(first.report.geometry.triangleCount, 1);
  assert.equal(first.report.gltfValidation.issues.numErrors, 0);
  assert.equal(first.report.gltfValidation.validatorVersion, "2.0.0-dev.3.10");
  assert.deepEqual(await fs.readFile(asset), before);
  assert.deepEqual((await fs.readdir(root)).sort(), ["candidate.json", "public"]);
}));

test("CLI needs an explicit single registration file", async () => workspace(async ({ root }) => {
  for (const args of [[], ["--production"], ["candidate.json", "other.json"]]) {
    const result = check(root, args); assert.equal(result.status, 2); assert.match(result.stderr, /Usage/);
  }
}));

test("CLI refuses missing or malformed registration and empty/oversized files", async () => workspace(async ({ root, registrationPath }) => {
  assert.equal(check(root, ["missing.json"]).status, 1);
  for (const data of ["", "{broken", "[]", JSON.stringify({ stock: true }), " ".repeat(16 * 1024 + 1)]) {
    await fs.writeFile(registrationPath, data);
    const result = check(root); assert.equal(result.status, 1, data.slice(0, 80));
    assert.equal(result.report.candidateReady, false); assert.equal(result.report.productionApproved, false);
    assert.equal(result.report.assetSha256, null);
  }
}));

test("CLI refuses nonexistent, non-file and corrupted GLB paths", async () => workspace(async ({ root, asset }) => {
  await fs.writeFile(asset, "not a glb");
  const corrupt = check(root); assert.equal(corrupt.status, 1); assert.equal(corrupt.report.geometry.candidateReady, false);
  await fs.unlink(asset); assert.equal(check(root).status, 1);
  await fs.mkdir(asset); assert.equal(check(root).status, 1);
}));

test("A changed asset gets a different hash and invalid geometry cannot reuse prior evidence", async () => workspace(async ({ root, asset }) => {
  const first = check(root), changed = await fs.readFile(asset); changed[0] = 0; await fs.writeFile(asset, changed);
  const second = check(root);
  assert.equal(second.status, 1); assert.equal(second.report.productionApproved, false);
  assert.notEqual(second.report.assetSha256, first.report.assetSha256);
  assert.equal(second.report.registrationSha256, first.report.registrationSha256);
}));

test("A file symlink cannot substitute another GLB or escape the registered slot", async () => workspace(async ({ root, asset, fixture }) => {
  const replacement = path.join(root, "other.glb"); await fs.writeFile(replacement, fixture.pack());
  await fs.unlink(asset); await fs.symlink(replacement, asset);
  const result = check(root); assert.equal(result.status, 1); assert.match(result.report.reasons[0], /symbolic links/);
  assert.equal(result.report.assetSha256, null);
}));

test("A directory symlink cannot redirect a registered garment slot", async () => workspace(async ({ root, asset, fixture }) => {
  const slot = path.dirname(asset), replacement = path.join(root, "other-slot");
  await fs.mkdir(replacement); await fs.writeFile(path.join(replacement, "unit-fixture.glb"), fixture.pack());
  await fs.rm(slot, { recursive: true }); await fs.symlink(replacement, slot, "dir");
  const result = check(root); assert.equal(result.status, 1); assert.match(result.report.reasons[0], /symbolic links/);
}));

test("Independent schema validation rejects malformed names even when numeric geometry passes", async () => workspace(async ({ root, asset, fixture }) => {
  fixture.document.nodes[0].name = 123;
  await fs.writeFile(asset, fixture.pack());
  const result = check(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.geometry.candidateReady, true, "Local profile is not a complete glTF schema validator.");
  assert.equal(result.report.candidateReady, false);
  assert.ok(result.report.gltfValidation.issues.numErrors > 0);
  assert.equal(result.report.productionApproved, false);
}));

test("Registration claims cannot enable production mode or a remote resource", async () => workspace(async ({ root, fixture, registrationPath }) => {
  for (const registration of [{ ...fixture.registration, state: "approved" }, { ...fixture.registration, productionApproved: true },
    { ...fixture.registration, glbPath: "https://example.org/model.glb" }, { ...fixture.registration, glbPath: "/models/body.glb" }]) {
    await fs.writeFile(registrationPath, JSON.stringify(registration));
    const result = check(root); assert.equal(result.status, 1); assert.equal(result.report.productionApproved, false);
    assert.equal(result.report.assetSha256, null);
  }
}));
