import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const width = 576;
const height = 768;
const views = ["front", "three-quarter", "side", "back"];

async function writeReview(file: string, skinGap: boolean, exposedTorso = false) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = [220, 216, 207]; // neutral studio, not skin
      if (x >= 190 && x < 386 && y >= 170 && y < 350) color = [200, 181, 142]; // sandstone review shirt; warm R>G>B must NOT be bare skin
      if (x >= 185 && x < 391 && y >= 315 && y < 710) color = [52, 60, 73]; // navy trouser
      if (exposedTorso && x >= 245 && x < 325 && y >= 222 && y < 320) color = [217, 180, 155]; // bare back skin
      if (x >= 201 && x < 258 && y >= 672 && y < 741) color = [58, 44, 35]; // left leather shoe
      if (x >= 319 && x < 375 && y >= 672 && y < 741) color = [58, 44, 35]; // right leather shoe
      if (skinGap && x >= 228 && x < 290 && y >= 445 && y < 580) {
        color = [217, 180, 155]; // uncovered leg skin despite blue garment nearby
      }
      const i = (y * width + x) * 3;
      rgb[i] = color[0]; rgb[i + 1] = color[1]; rgb[i + 2] = color[2];
    }
  }
  await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toFile(file);
}

async function fixture(skinGap: boolean, exposedTorso = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "linen-review-gate-"));
  const review = path.join(root, "review");
  fs.mkdirSync(review);
  for (const view of views) await writeReview(path.join(review, view + ".png"), skinGap, exposedTorso);
  return {
    root,
    review,
    reportPath: path.join(root, "report.json"),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function evaluate(f: Awaited<ReturnType<typeof fixture>>) {
  return spawnSync(process.execPath, ["scripts/evaluate-realistic-review.mjs", f.review], {
    cwd: process.cwd(),
    env: { ...process.env, LINEN_REVIEW_VISIBILITY_REPORT: f.reportPath },
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("covered officewear legs and visible leather shoes pass photographic gate", async () => {
  const f = await fixture(false);
  try {
    const result = evaluate(f);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const report = JSON.parse(fs.readFileSync(f.reportPath, "utf8"));
    assert.equal(report.ready, true);
    assert.ok(views.every((view) => report.views[view].exposedLegSkinRatio < 0.05));
    assert.ok(views.every((view) => report.views[view].exposedTorsoSkinRatio < 0.06), "Warm sandstone shirt must not be mistaken for the model's exposed body.");
  } finally { f.cleanup(); }
});

test("bare thigh gap fails photographic gate even when navy trousers and shoes exist", async () => {
  const f = await fixture(true);
  try {
    const result = evaluate(f);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    const report = JSON.parse(fs.readFileSync(f.reportPath, "utf8"));
    assert.equal(report.ready, false);
    assert.ok(report.reasons.some((reason: string) => reason.includes("bare leg/body skin")));
    assert.ok(report.views.front.exposedLegSkinRatio > 0.05);
    assert.ok(report.views.front.trouserRatio > 0.04);
    assert.ok(report.views.front.shoeRatio > 0.003);
  } finally { f.cleanup(); }
});

test("bare upper back fails four-angle review despite complete trousers and dress shoes", async () => {
  const f = await fixture(false, true);
  try {
    const result = evaluate(f);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    const report = JSON.parse(fs.readFileSync(f.reportPath,"utf8"));
    assert.equal(report.ready, false);
    assert.ok(report.views.back.exposedTorsoSkinRatio > 0.06);
    assert.ok(report.reasons.some((reason: string) => reason.includes("bare torso/back skin")));
    assert.ok(report.views.back.trouserRatio >= 0.04);
    assert.ok(report.views.back.shoeRatio >= 0.003);
  } finally { f.cleanup(); }
});
