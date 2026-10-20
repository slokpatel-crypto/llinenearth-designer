import path from "node:path";
import { inspectModelLayerAssembly } from "../src/lib/designer/model-layer-assembly.ts";
import { MODEL_LAYER_GLB_LIMITS } from "../src/lib/designer/model-layer-glb.ts";
import { readBounded, inspectLocalLayerRegistration, sha256 } from "./lib/model-layer-asset-preflight.mjs";

const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith("--")) {
  console.error("Usage: npm run garment:outfit-check -- path/to/assembly.json");
  process.exit(2);
}
const report = {
  version: 1, mode: "engineering-candidate", candidateReady: false, productionApproved: false,
  baseModelChecked: false, assemblyFileSha256: null, modelIdentityId: null,
  composition: null, assets: [], extensionTotals: { fileBytes: 0, vertices: 0, triangles: 0, primitives: 0 }, reasons: [],
};
try {
  const bytes = await readBounded(path.resolve(args[0]), 32 * 1024);
  report.assemblyFileSha256 = sha256(bytes);
  const assembly = inspectModelLayerAssembly(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  if (!assembly.valid || !assembly.plan) throw new Error(assembly.reasons.join(" "));
  report.modelIdentityId = assembly.plan.modelIdentityId;
  report.composition = assembly.plan.composition;
  for (const registration of assembly.candidates) {
    const asset = await inspectLocalLayerRegistration(registration);
    report.assets.push(asset);
    if (!asset.candidateReady) throw new Error(registration.slot + ": " + asset.reasons.join(" "));
    report.extensionTotals.fileBytes += asset.geometry.fileBytes;
    report.extensionTotals.vertices += asset.geometry.vertexCount;
    report.extensionTotals.triangles += asset.geometry.triangleCount;
    report.extensionTotals.primitives += asset.geometry.primitiveCount;
    for (const key of ["fileBytes", "vertices", "triangles", "primitives"]) {
      if (report.extensionTotals[key] > MODEL_LAYER_GLB_LIMITS[key]) throw new Error("Combined extension " + key + " budget exceeded.");
    }
  }
  report.candidateReady = true;
  report.reasons = ["Extension set preflight only. Original base-model/native, overlap/contact, measured fabric, browser and owner/tailor approval are not established."];
} catch (error) {
  report.reasons = [error instanceof Error ? error.message : "Assembly preflight failed."];
}
console.log(JSON.stringify(report, null, 2));
if (!report.candidateReady) process.exitCode = 1;
