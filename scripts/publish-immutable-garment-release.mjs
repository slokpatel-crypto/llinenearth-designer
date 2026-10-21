import * as fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const FORMAT = "linen-earth-garment-release-v1";
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_MODEL_BYTES = 128 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function isOwnShape(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}
function checkedDirectory(directory, io, allowMissing = false) {
  // Check every component, not only the leaf: lstat(leaf) follows aliases
  // in its parent path. During creation missing components are permitted,
  // but existing symlinks are rejected BEFORE mkdir can write through one.
  let current = path.resolve(directory);
  while (true) {
    try {
      const stat = io.lstatSync(current);
      if (!stat.isDirectory()) {
        throw new Error("Garment release path must be a real directory, not a symlink: " + current);
      }
    } catch (error) {
      if (!allowMissing || error?.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
function ensureDirectory(directory, io) {
  try {
    checkedDirectory(directory, io);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    io.mkdirSync(directory);
    checkedDirectory(directory, io);
  }
}
function checkedFile(file, maximum, io) {
  // A lstat(path) followed by readFile(path) is a symlink-swap race. Open one
  // descriptor with O_NOFOLLOW and validate/read that same inode instead.
  // O_NONBLOCK prevents hanging if an attacker substitutes a FIFO.
  const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;
  const fd = io.openSync(file, flags);
  try {
    const stat = io.fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > maximum) {
      throw new Error("Release asset must be a nonempty regular file within bounds: " + file);
    }
    const bytes = io.readFileSync(fd);
    if (bytes.length !== stat.size || bytes.length < 1 || bytes.length > maximum) {
      throw new Error("Release asset changed while being read: " + file);
    }
    return bytes;
  } finally {
    io.closeSync(fd);
  }
}
function syncFile(file, io) {
  const fd = io.openSync(file, "r");
  try { io.fsyncSync(fd); } finally { io.closeSync(fd); }
}
function syncDirectory(directory, io) {
  const fd = io.openSync(directory, "r");
  try { io.fsyncSync(fd); } finally { io.closeSync(fd); }
}
function snapshot(glb, manifest) {
  const modelSha256 = digest(glb);
  const manifestSha256 = digest(manifest);
  const releaseId = digest(Buffer.from(modelSha256 + ":" + manifestSha256));
  return { format: FORMAT, releaseId, modelSha256, manifestSha256 };
}
function releasePaths(root, pointer) {
  const directory = path.join(root, "releases", pointer.releaseId);
  return {
    directory,
    modelPath: path.join(directory, "model.glb"),
    manifestPath: path.join(directory, "model.viewer.json"),
  };
}
function verifiedRelease(root, pointer, io) {
  const paths = releasePaths(root, pointer);
  checkedDirectory(root, io);
  checkedDirectory(path.join(root, "releases"), io);
  checkedDirectory(paths.directory, io);
  const glb = checkedFile(paths.modelPath, MAX_MODEL_BYTES, io);
  const sidecar = checkedFile(paths.manifestPath, MAX_MANIFEST_BYTES, io);
  if (digest(glb) !== pointer.modelSha256 || digest(sidecar) !== pointer.manifestSha256) {
    throw new Error("Immutable garment release checksum mismatch; publication refused.");
  }
  return { ...paths, glb, sidecar };
}
function validatePointer(pointer) {
  if (!isOwnShape(pointer, ["format", "releaseId", "modelSha256", "manifestSha256"])
    || pointer.format !== FORMAT
    || !SHA256.test(pointer.releaseId)
    || !SHA256.test(pointer.modelSha256)
    || !SHA256.test(pointer.manifestSha256)
    || pointer.releaseId !== digest(Buffer.from(pointer.modelSha256 + ":" + pointer.manifestSha256))) {
    throw new Error("Invalid or unsupported garment release pointer.");
  }
  return pointer;
}

/**
 * Read current.json ONCE, then read the two immutable content-addressed files.
 * Callers must use these resolved paths together; never combine a pointer
 * from one read with a sidecar/path from another.
 */
export function readGarmentRelease(releaseRoot, io = fs) {
  const root = path.resolve(releaseRoot);
  checkedDirectory(root, io);
  const pointerPath = path.join(root, "current.json");
  const pointerBytes = checkedFile(pointerPath, MAX_MANIFEST_BYTES, io);
  const pointer = validatePointer(JSON.parse(pointerBytes.toString("utf8")));
  return { pointer, ...verifiedRelease(root, pointer, io) };
}

/**
 * Publish two validated candidate assets without changing their legacy paths.
 * A crash before the single pointer rename leaves the old release readable;
 * a crash after it leaves a new immutable pair reachable. The caller still
 * must validate geometry and physical evidence independently.
 */
export function publishImmutableGarmentRelease(stagedGlb, stagedManifest, releaseRoot, io = fs) {
  const root = path.resolve(releaseRoot);
  const glb = checkedFile(stagedGlb, MAX_MODEL_BYTES, io);
  const sidecar = checkedFile(stagedManifest, MAX_MANIFEST_BYTES, io);
  const pointer = snapshot(glb, sidecar);
  const paths = releasePaths(root, pointer);
  const releases = path.join(root, "releases");
  // Never write into an aliased release root or through an existing symlinked
  // releases directory, even when the target contains a valid old pair.
  checkedDirectory(root, io, true);
  io.mkdirSync(root, { recursive: true });
  checkedDirectory(root, io);
  ensureDirectory(releases, io);
  let staging = null;
  let pointerTemporary = null;
  try {
    // lstat catches dangling symlinks that existsSync would treat as missing.
    let existingRelease = false;
    try {
      checkedDirectory(paths.directory, io);
      existingRelease = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (!existingRelease) {
      staging = io.mkdtempSync(path.join(releases, ".staged-"));
      const tempGlb = path.join(staging, "model.glb");
      const tempManifest = path.join(staging, "model.viewer.json");
      io.writeFileSync(tempGlb, glb, { flag: "wx", mode: 0o600 });
      io.writeFileSync(tempManifest, sidecar, { flag: "wx", mode: 0o600 });
      syncFile(tempGlb, io);
      syncFile(tempManifest, io);
      syncDirectory(staging, io);
      try {
        io.renameSync(staging, paths.directory);
        staging = null;
        syncDirectory(releases, io);
      } catch (error) {
        // A competing publisher may have installed this exact immutable ID.
        // Reuse only if the existing bytes match; never overwrite corruption.
        if (!io.existsSync(paths.directory)) throw error;
      }
    }
    verifiedRelease(root, pointer, io);
    pointerTemporary = path.join(root, ".current-" + randomUUID() + ".json");
    io.writeFileSync(pointerTemporary, JSON.stringify(pointer) + "\n", { flag: "wx", mode: 0o600 });
    syncFile(pointerTemporary, io);
    syncDirectory(root, io);
    io.renameSync(pointerTemporary, path.join(root, "current.json"));
    pointerTemporary = null;
    syncDirectory(root, io);
    return { pointer, ...paths, pointerPath: path.join(root, "current.json") };
  } finally {
    if (staging) io.rmSync(staging, { recursive: true, force: true });
    if (pointerTemporary) io.rmSync(pointerTemporary, { force: true });
  }
}
