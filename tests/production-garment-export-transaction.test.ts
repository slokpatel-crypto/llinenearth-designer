import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promoteValidatedGarmentCandidate, viewerManifestPath } from "../scripts/production-garment-export-transaction.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "linen-garment-promotion-"));
  const stage = path.join(root, "candidate");
  fs.mkdirSync(stage);
  const output = path.join(root, "model.glb");
  const candidate = path.join(stage, "model.glb");
  return { root, output, candidate, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("promotes validated GLB and physical-scale sidecar together", () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.output, "old-model");
    fs.writeFileSync(viewerManifestPath(f.output), "old-manifest");
    fs.writeFileSync(f.candidate, "new-model");
    fs.writeFileSync(viewerManifestPath(f.candidate), "new-manifest");
    promoteValidatedGarmentCandidate(f.candidate, f.output);
    assert.equal(fs.readFileSync(f.output, "utf8"), "new-model");
    assert.equal(fs.readFileSync(viewerManifestPath(f.output), "utf8"), "new-manifest");
  } finally { f.cleanup(); }
});

test("missing candidate manifest leaves previous production assets untouched", () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.output, "old-model");
    fs.writeFileSync(viewerManifestPath(f.output), "old-manifest");
    fs.writeFileSync(f.candidate, "new-model");
    assert.throws(() => promoteValidatedGarmentCandidate(f.candidate, f.output), /missing/);
    assert.equal(fs.readFileSync(f.output, "utf8"), "old-model");
    assert.equal(fs.readFileSync(viewerManifestPath(f.output), "utf8"), "old-manifest");
  } finally { f.cleanup(); }
});

test("failed second-file promotion restores both previous artifacts", () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.output, "old-model");
    fs.writeFileSync(viewerManifestPath(f.output), "old-manifest");
    fs.writeFileSync(f.candidate, "new-model");
    fs.writeFileSync(viewerManifestPath(f.candidate), "new-manifest");
    const io = {
      existsSync: fs.existsSync,
      rmSync: fs.rmSync,
      renameSync(from: string, to: string) {
        if (from === viewerManifestPath(f.candidate) && to === viewerManifestPath(f.output)) {
          throw new Error("simulated manifest promotion failure");
        }
        fs.renameSync(from, to);
      },
    };
    assert.throws(() => promoteValidatedGarmentCandidate(f.candidate, f.output, io), /simulated/);
    assert.equal(fs.readFileSync(f.output, "utf8"), "old-model");
    assert.equal(fs.readFileSync(viewerManifestPath(f.output), "utf8"), "old-manifest");
  } finally { f.cleanup(); }
});

test("supports first-time production candidate without existing assets", () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.candidate, "new-model");
    fs.writeFileSync(viewerManifestPath(f.candidate), "new-manifest");
    promoteValidatedGarmentCandidate(f.candidate, f.output);
    assert.equal(fs.readFileSync(f.output, "utf8"), "new-model");
    assert.equal(fs.readFileSync(viewerManifestPath(f.output), "utf8"), "new-manifest");
  } finally { f.cleanup(); }
});

test("rejects non-GLB candidate paths", () => {
  assert.throws(() => viewerManifestPath("model.obj"), /\.glb/);
});
