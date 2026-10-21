#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { publishGarmentCandidate } from "./publish-garment-candidate.mjs";
import { publishImmutableGarmentRelease } from "./publish-immutable-garment-release.mjs";

const scene = String(process.env.LINEN_GARMENT_BLEND || "").trim();
const panelSpec = String(process.env.LINEN_GARMENT_PANEL_SPEC || "").trim();
const output = String(process.env.LINEN_GARMENT_OUTPUT || "public/models/linen-earth-officewear-v1.glb").trim();
const immutableReleaseDir = String(process.env.LINEN_GARMENT_ATOMIC_RELEASE_DIR || "").trim();

function fail(message) { throw new Error(message); }
function requireFile(label, value) {
  if (!value) fail(label + " is required.");
  const resolved = path.resolve(value);
  if (!existsSync(resolved)) fail(label + " does not exist: " + resolved);
  return resolved;
}
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) fail(command + " could not start: " + result.error.message);
  if (result.signal) fail(command + " was terminated by signal " + result.signal + ".");
  if (result.status !== 0) fail(command + " exited with status " + result.status + ".");
}
function manifestOf(glb) {
  if (path.extname(glb).toLowerCase() !== ".glb") fail("LINEN_GARMENT_OUTPUT must end with .glb.");
  return glb.slice(0, -4) + ".viewer.json";
}

let stagedDirectory;
let finished = false;
let outputPath;
let immutableRelease = null;
try {
  const scenePath = requireFile("LINEN_GARMENT_BLEND", scene);
  const panelSpecPath = requireFile("LINEN_GARMENT_PANEL_SPEC", panelSpec);
  outputPath = path.resolve(output);
  const manifestPath = manifestOf(outputPath);
  const exporter = requireFile("Blender exporter", "scripts/blender/export-linen-earth-officewear.py");

  // Export into a private sibling directory. The previous model and its
  // measured manifest remain untouched if Blender or validation fails.
  mkdirSync(path.dirname(outputPath), { recursive: true });
  stagedDirectory = mkdtempSync(path.join(path.dirname(outputPath), ".linen-export-stage-"));
  const stagedOutput = path.join(stagedDirectory, path.basename(outputPath));
  const stagedManifest = manifestOf(stagedOutput);
  run("blender", [
    "--background", scenePath,
    // Blender may otherwise exit zero even after an uncaught Python exception.
    "--python-exit-code", "1",
    "--python", exporter,
    "--", "--output", stagedOutput, "--panel-spec", panelSpecPath,
  ]);
  // Verify precisely the bytes just exported, never a stale public candidate.
  run(process.execPath, [
    "--experimental-strip-types",
    path.resolve("scripts/check-garment-viewer-model.mjs"),
    stagedOutput,
  ]);
  if (immutableReleaseDir) {
    // Opt-in release protocol: atomic CURRENT pointer + immutable paired assets.
    // Never replace the legacy public GLB and sidecar in this mode.
    immutableRelease = publishImmutableGarmentRelease(
      stagedOutput, stagedManifest, path.resolve(immutableReleaseDir),
    );
  } else {
    publishGarmentCandidate(stagedOutput, stagedManifest, outputPath, manifestPath);
  }
  finished = true;
} catch (error) {
  console.error("Production GarmentViewer build failed: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (stagedDirectory) {
    try { rmSync(stagedDirectory, { recursive: true, force: true }); }
    catch (error) {
      finished = false;
      process.exitCode = 1;
      console.error("Production GarmentViewer build failed: could not clean temporary export: " + String(error));
    }
  }
}
if (finished) {
  console.log("Production GarmentViewer candidate passed export + structural validation: " + outputPath);
  if (immutableRelease) {
    console.log("Published immutable candidate release " + immutableRelease.pointer.releaseId);
    console.log("Release pointer: " + immutableRelease.pointerPath);
    console.log("Use a single read of current.json for both model and measured sidecar.");
  } else {
    console.log("Published the candidate GLB and measured sidecar after staging checks.");
  }
  console.log("Customer promotion still requires physical scale, latency, realism and boundary evidence.");
}
