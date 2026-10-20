import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { layerGlbFixture, layerRegistration, packLayerGlb } from "./helpers/model-layer-glb-fixture.ts";

const script = fileURLToPath(new URL("../scripts/check-model-layer-assembly.mjs", import.meta.url));
const slots = ["belt", "tie", "waistcoat", "blazer", "pocket-square"] as const;
type Slot = typeof slots[number];
async function workspace(run: (context: {
  root: string;
  writeAsset: (slot: Slot, bytes: Uint8Array) => Promise<void>;
  writeAssembly: (selected: Slot[], overrides?: Record<string, unknown>) => Promise<void>;
}) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "linen-assembly-preflight-"));
  const writeAsset = async (slot: Slot, bytes: Uint8Array) => {
    const dest = path.join(root, "public", layerRegistration(slot).glbPath);
    await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, bytes);
  };
  const writeAssembly = async (selected: Slot[], overrides: Record<string, unknown> = {}) => fs.writeFile(path.join(root, "assembly.json"), JSON.stringify({
    version: 1, plan: { version: 1, composition: "separates", layers: ["shirt", "trouser", ...selected] },
    assets: selected.map(slot => layerRegistration(slot)), ...overrides,
  }));
  try { await run({ root, writeAsset, writeAssembly }); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}
function check(root: string, args = ["assembly.json"]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], { cwd: root, encoding: "utf8", timeout: 20_000 });
  assert.equal(result.error, undefined); return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
}

test("Full extension stack has deterministic ordered byte evidence without base-model or production approval", async () => workspace(async ({ root, writeAsset, writeAssembly }) => {
  for (const slot of slots) await writeAsset(slot, layerGlbFixture({ slot }).pack());
  await writeAssembly([...slots].reverse());
  const result = check(root), again = check(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.report, again.report);
  assert.equal(result.report.candidateReady, true); assert.equal(result.report.productionApproved, false);
  assert.equal(result.report.baseModelChecked, false);
  assert.deepEqual(result.report.assets.map((asset: { registration: { slot: string } }) => asset.registration.slot), slots);
  assert.deepEqual(result.report.extensionTotals.vertices, 15); assert.equal(result.report.extensionTotals.triangles, 5);
  assert.equal(result.report.extensionTotals.primitives, 5);
  assert.ok(result.report.extensionTotals.fileBytes > 0);
  assert.ok(result.report.assets.every((asset: { candidateReady: boolean; productionApproved: boolean; assetSha256: string }) => asset.candidateReady && !asset.productionApproved && /^[a-f0-9]{64}$/.test(asset.assetSha256)));
}));

test("Two-piece and three-piece composition plans inspect exactly their required addon files", async () => workspace(async ({ root, writeAsset, writeAssembly }) => {
  for (const slot of ["blazer", "waistcoat"] as const) await writeAsset(slot, layerGlbFixture({ slot }).pack());
  for (const composition of ["two-piece-suit", "three-piece-suit"] as const) {
    const selected: Slot[] = composition === "two-piece-suit" ? ["blazer"] : ["blazer", "waistcoat"];
    await writeAssembly(selected, { plan: { version: 1, composition, layers: ["shirt", "trouser", ...selected] } });
    const result = check(root); assert.equal(result.status, 0); assert.equal(result.report.composition, composition);
    assert.equal(result.report.assets.length, selected.length); assert.equal(result.report.productionApproved, false);
  }
}));

test("No selected extensions is explicit and cannot imply a checked original model", async () => workspace(async ({ root, writeAssembly }) => {
  await writeAssembly([]); const result = check(root);
  assert.equal(result.status, 0); assert.equal(result.report.baseModelChecked, false);
  assert.equal(result.report.productionApproved, false); assert.deepEqual(result.report.assets, []);
  assert.deepEqual(result.report.extensionTotals, { fileBytes: 0, vertices: 0, triangles: 0, primitives: 0 });
}));

test("One broken/missing file rejects the entire assembly with no success fallback", async () => workspace(async ({ root, writeAsset, writeAssembly }) => {
  await writeAsset("blazer", layerGlbFixture().pack()); await writeAssembly(["blazer", "tie"]);
  let result = check(root); assert.equal(result.status, 1); assert.equal(result.report.candidateReady, false);
  await writeAsset("tie", new Uint8Array([1, 2, 3])); result = check(root);
  assert.equal(result.status, 1); assert.equal(result.report.candidateReady, false);
  assert.equal(result.report.productionApproved, false);
}));

test("Invalid metadata rejects before any files are read", async () => workspace(async ({ root, writeAssembly }) => {
  for (const overrides of [{ assets: [] }, { productionApproved: true }, { version: 2 },
    { plan: { version: 1, composition: "three-piece-suit", layers: ["shirt", "trouser", "blazer"] } }]) {
    await writeAssembly(["blazer"], overrides); const result = check(root);
    assert.equal(result.status, 1); assert.deepEqual(result.report.assets, []);
  }
}));

test("Several individually acceptable files share one total byte budget", async () => workspace(async ({ root, writeAsset, writeAssembly }) => {
  for (const slot of ["blazer", "tie"] as const) {
    const f = layerGlbFixture({ slot }), binary = new Uint8Array(4 * 1024 * 1024);
    binary.set(f.binary); f.document.buffers[0].byteLength = binary.length;
    await writeAsset(slot, packLayerGlb(f.document, binary));
  }
  await writeAssembly(["blazer", "tie"]); const result = check(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.report.assets.every((asset: { candidateReady: boolean }) => asset.candidateReady));
  assert.match(result.report.reasons[0], /Combined extension fileBytes budget/);
  assert.equal(result.report.productionApproved, false);
}));

test("Repeated small primitives cannot evade the combined draw-call budget", async () => workspace(async ({ root, writeAsset, writeAssembly }) => {
  for (const slot of ["blazer", "tie"] as const) {
    const f = layerGlbFixture({ slot });
    f.document.meshes[0].primitives = Array.from({ length: 65 }, () => structuredClone(f.document.meshes[0].primitives[0]));
    await writeAsset(slot, f.pack());
  }
  await writeAssembly(["blazer", "tie"]); const result = check(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.report.assets.every((asset: { candidateReady: boolean }) => asset.candidateReady));
  assert.match(result.report.reasons[0], /Combined extension primitives budget/);
}));

test("Rendered vertices across independent files share the original extension vertex budget", async () => workspace(async ({ root, writeAsset, writeAssembly }) => {
  const vertices = 35_001;
  for (const slot of ["blazer", "tie"] as const) {
    const f = layerGlbFixture({ slot, interleaved: true, indices: false }), binary = new Uint8Array(vertices * 32);
    for (let at = 0; at < binary.length; at += f.binary.length) binary.set(f.binary, at);
    f.document.buffers[0].byteLength = binary.length;
    f.document.bufferViews[0].byteLength = binary.length;
    for (const accessor of f.document.accessors) accessor.count = vertices;
    await writeAsset(slot, packLayerGlb(f.document, binary));
  }
  await writeAssembly(["blazer", "tie"]); const result = check(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.report.assets.every((asset: { candidateReady: boolean }) => asset.candidateReady));
  assert.match(result.report.reasons[0], /Combined extension vertices budget/);
}));

test("Indexed triangle totals cannot bypass the combined triangle budget", async () => workspace(async ({ root, writeAsset, writeAssembly }) => {
  const triangles = 45_000;
  for (const slot of ["blazer", "tie"] as const) {
    const f = layerGlbFixture({ slot }), binary = new Uint8Array(96 + triangles * 6), view = new DataView(binary.buffer);
    binary.set(f.binary.subarray(0, 96));
    for (let i = 0; i < triangles * 3; i++) view.setUint16(96 + i * 2, i % 3, true);
    f.document.buffers[0].byteLength = binary.length;
    f.document.bufferViews[3].byteLength = triangles * 6;
    f.document.accessors[3].count = triangles * 3;
    await writeAsset(slot, packLayerGlb(f.document, binary));
  }
  await writeAssembly(["blazer", "tie"]); const result = check(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.report.assets.every((asset: { candidateReady: boolean }) => asset.candidateReady));
  assert.match(result.report.reasons[0], /Combined extension triangles budget/);
}));

test("CLI argument and assembly-file boundaries fail cleanly", async () => workspace(async ({ root }) => {
  for (const args of [[], ["--production"], ["assembly.json", "extra"]]) assert.equal(check(root, args).status, 2);
  assert.equal(check(root).status, 1);
  for (const contents of ["", "broken", "null", "[]", " ".repeat(32 * 1024 + 1)]) {
    await fs.writeFile(path.join(root, "assembly.json"), contents);
    const result = check(root); assert.equal(result.status, 1); assert.equal(result.report.productionApproved, false);
  }
}));
