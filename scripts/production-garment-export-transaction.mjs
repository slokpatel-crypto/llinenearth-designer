import fs from "node:fs";
import path from "node:path";

export function viewerManifestPath(modelPath) {
  if (path.extname(modelPath).toLowerCase() !== ".glb") {
    throw new Error("Production garment output must end in .glb.");
  }
  return modelPath.slice(0, -4) + ".viewer.json";
}

// Publish a GLB and its physical-scale evidence as a pair. Do not touch
// the approved output until both staged files have passed validation.
export function promoteValidatedGarmentCandidate(candidateModelPath, outputModelPath, io = fs) {
  const candidateManifestPath = viewerManifestPath(candidateModelPath);
  const outputManifestPath = viewerManifestPath(outputModelPath);
  const backupDir = path.dirname(candidateModelPath);
  const entries = [
    { candidate: candidateModelPath, output: outputModelPath, backup: path.join(backupDir, ".previous-model.glb") },
    { candidate: candidateManifestPath, output: outputManifestPath, backup: path.join(backupDir, ".previous-model.viewer.json") },
  ];
  for (const { candidate } of entries) {
    if (!io.existsSync(candidate)) throw new Error("Validated candidate is missing: " + candidate);
  }
  const saved = [];
  const installed = [];
  try {
    for (const entry of entries) {
      if (io.existsSync(entry.output)) {
        io.renameSync(entry.output, entry.backup);
        saved.push(entry);
      }
    }
    for (const entry of entries) {
      io.renameSync(entry.candidate, entry.output);
      installed.push(entry);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of installed.reverse()) {
      try { if (io.existsSync(entry.output)) io.rmSync(entry.output); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const entry of saved.reverse()) {
      try { io.renameSync(entry.backup, entry.output); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], "Candidate promotion failed and rollback was incomplete; inspect preserved backup files.");
    }
    throw error;
  }
  return { modelPath: outputModelPath, manifestPath: outputManifestPath };
}
