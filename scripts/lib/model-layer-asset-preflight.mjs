import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import validator from "gltf-validator";
import { inspectModelLayerAssetRegistration } from "../../src/lib/designer/model-layer-assets.ts";
import { inspectModelLayerGlb, MODEL_LAYER_GLB_PROFILE, MODEL_LAYER_GLB_LIMITS } from "../../src/lib/designer/model-layer-glb.ts";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const emptyAssetReport = () => ({
  profile: MODEL_LAYER_GLB_PROFILE, mode: "engineering-candidate",
  candidateReady: false, productionApproved: false,
  registrationSha256: null, assetSha256: null, registration: null,
  geometry: null, gltfValidation: null, reasons: [],
});

export async function readBounded(filePath, limit) {
  const entry = await fs.lstat(filePath);
  if (!entry.isFile() || entry.size === 0 || entry.size > limit) throw new Error("Expected a nonempty regular file within the byte budget.");
  const handle = await fs.open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size === 0 || info.size > limit) throw new Error("Expected a nonempty regular file within the byte budget.");
    const bytes = Buffer.alloc(info.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total !== info.size) throw new Error("File changed while reading; rerun the preflight on stable bytes.");
    return bytes.subarray(0, total);
  } finally { await handle.close(); }
}

/** No loader, file write, remote fetch or approval side effect. */
export async function inspectLocalLayerRegistration(value, publicDirectory = path.resolve("public")) {
  const report = emptyAssetReport();
  try {
    const inspection = inspectModelLayerAssetRegistration(value);
    if (!inspection.valid || !inspection.candidate) throw new Error(inspection.reasons.join(" "));
    report.registration = inspection.candidate;
    report.registrationSha256 = sha256(JSON.stringify(inspection.candidate));
    const publicRoot = await fs.realpath(publicDirectory);
    const expected = path.resolve(publicRoot, "." + inspection.candidate.glbPath);
    const actual = await fs.realpath(expected);
    if (actual !== expected) throw new Error("Extension path must not use symbolic links or redirect to another asset.");
    const bytes = await readBounded(actual, MODEL_LAYER_GLB_LIMITS.fileBytes);
    report.assetSha256 = sha256(bytes);
    report.geometry = inspectModelLayerGlb(bytes, inspection.candidate);
    report.candidateReady = report.geometry.candidateReady;
    report.reasons = [...report.geometry.reasons];
    if (report.candidateReady) {
      const validation = await validator.validateBytes(bytes, {
        uri: inspection.candidate.glbPath, format: "glb", writeTimestamp: false, maxIssues: 2048,
        externalResourceFunction: () => Promise.reject(new Error("External resources are forbidden.")),
      });
      report.gltfValidation = {
        validatorVersion: validator.version(),
        // Validate the complete bounded profile before trimming diagnostics.
        // Runtime-assigned textiles can legitimately generate >32 UV-use infos.
        issues: { ...validation.issues, messages: validation.issues.messages.slice(0, 32) },
        messagesOmitted: Math.max(0, validation.issues.messages.length - 32),
      };
      if (validation.issues.numErrors > 0 || validation.issues.truncated) {
        report.candidateReady = false;
        report.reasons = ["Independent Khronos glTF validation failed or reached the issue limit; inspect gltfValidation."];
      }
    }
  } catch (error) {
    report.candidateReady = false;
    report.reasons = [error instanceof Error ? error.message : "Extension preflight failed."];
  }
  return report;
}
