import * as fs from "node:fs";
import path from "node:path";

/**
 * Promote a fully validated temporary GLB + measured viewer sidecar together.
 *
 * This preserves prior bytes if the second rename fails in a live process.
 * Two independent filesystem paths cannot be published crash-atomically: for
 * strict multi-reader atomicity a future manifest pointer/directory release
 * protocol is required. This is NOT physical garment release approval.
 */
export function publishGarmentCandidate(
  stagedGlb, stagedManifest, targetGlb, targetManifest, io = fs,
) {
  const files = [
    { staged: stagedGlb, target: targetGlb, backup: path.join(path.dirname(stagedGlb), ".previous-candidate.glb") },
    { staged: stagedManifest, target: targetManifest, backup: path.join(path.dirname(stagedGlb), ".previous-candidate.viewer.json") },
  ];
  for (const file of files) {
    if (!io.existsSync(file.staged) || !io.statSync(file.staged).isFile() || !io.statSync(file.staged).size) {
      throw new Error("Missing or empty staged export output: " + file.staged);
    }
  }

  // Complete backup creation before touching EITHER public candidate path.
  for (const file of files) {
    file.existed = io.existsSync(file.target);
    if (file.existed) io.copyFileSync(file.target, file.backup);
  }

  try {
    for (const file of files) io.renameSync(file.staged, file.target);
  } catch (error) {
    const rollbackErrors = [];
    for (const file of files) {
      try {
        if (file.existed) io.copyFileSync(file.backup, file.target);
        else io.rmSync(file.target, { force: true });
      } catch (restoreError) {
        rollbackErrors.push(file.target + ": " + String(restoreError));
      }
    }
    if (rollbackErrors.length) {
      throw new Error("Export promotion failed and rollback was incomplete; inspect candidate paths: "
        + rollbackErrors.join("; "), { cause: error });
    }
    throw new Error("Export promotion failed; previous model and metadata were restored.", { cause: error });
  }
}
