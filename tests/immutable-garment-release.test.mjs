import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { publishImmutableGarmentRelease, readGarmentRelease } from "../scripts/publish-immutable-garment-release.mjs";

async function workspace(run) {
  const root = await mkdtemp(path.join(tmpdir(), "linen immutable release "));
  const staged = path.join(root, "incoming");
  const releases = path.join(root, "published");
  await mkdir(staged);
  const model = path.join(staged, "candidate.glb");
  const manifest = path.join(staged, "candidate.viewer.json");
  try {
    await writeFile(model, "first verified GLB fixture");
    await writeFile(manifest, '{"panels":"first measured fixture"}');
    await run({ root, releases, model, manifest });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}
function publish(p, io) {
  return publishImmutableGarmentRelease(p.model, p.manifest, p.releases, io);
}
async function next(p) {
  await writeFile(p.model, "second verified GLB fixture");
  await writeFile(p.manifest, '{"panels":"second measured fixture"}');
}
function read(p) { return readGarmentRelease(p.releases); }

test("single current pointer resolves a complete verified GLB and measured sidecar pair", async () => workspace(async p => {
  const first = publish(p);
  const result = read(p);
  assert.deepEqual(result.pointer, first.pointer);
  assert.equal(result.glb.toString(), "first verified GLB fixture");
  assert.equal(result.sidecar.toString(), '{"panels":"first measured fixture"}');
  assert.equal(path.dirname(result.modelPath), path.dirname(result.manifestPath));
  assert.equal(await readFile(p.model, "utf8"), "first verified GLB fixture");
  assert.equal(await readFile(p.manifest, "utf8"), '{"panels":"first measured fixture"}');
  assert.equal((await readFile(first.pointerPath, "utf8")).trim(), JSON.stringify(first.pointer));
  assert.equal(publish(p).pointer.releaseId, first.pointer.releaseId, "Re-running is idempotent");
}));

test("new pointer switches both paths at once and never modifies prior release bytes", async () => workspace(async p => {
  const first = publish(p);
  const oldGlb = await readFile(first.modelPath);
  const oldManifest = await readFile(first.manifestPath);
  await next(p);
  const second = publish(p);
  assert.notEqual(first.pointer.releaseId, second.pointer.releaseId);
  assert.equal(read(p).glb.toString(), "second verified GLB fixture");
  assert.equal(read(p).sidecar.toString(), '{"panels":"second measured fixture"}');
  assert.deepEqual(await readFile(first.modelPath), oldGlb);
  assert.deepEqual(await readFile(first.manifestPath), oldManifest);
}));

test("pointer rename failure leaves complete old pair selected and staged data intact", async () => workspace(async p => {
  const original = publish(p);
  await next(p);
  const io = {
    ...fs,
    renameSync(from, to) {
      if (to === path.join(p.releases, "current.json")) throw new Error("injected pointer rename failure");
      return fs.renameSync(from, to);
    },
  };
  assert.throws(() => publish(p, io), /injected pointer rename failure/);
  assert.equal(read(p).pointer.releaseId, original.pointer.releaseId);
  assert.equal(read(p).sidecar.toString(), '{"panels":"first measured fixture"}');
  assert.equal(await readFile(p.model, "utf8"), "second verified GLB fixture");
  const temporary = (await fs.promises.readdir(p.releases)).filter(x => x.startsWith(".current-"));
  assert.deepEqual(temporary, []);
}));

test("failure while staging the second asset never publishes a partial release", async () => workspace(async p => {
  const original = publish(p);
  await next(p);
  const io = {
    ...fs,
    writeFileSync(file, contents, options) {
      if (String(file).endsWith("model.viewer.json")) throw new Error("injected staging write failure");
      return fs.writeFileSync(file, contents, options);
    },
  };
  assert.throws(() => publish(p, io), /injected staging write failure/);
  assert.equal(read(p).pointer.releaseId, original.pointer.releaseId);
  const staged = (await fs.promises.readdir(path.join(p.releases, "releases")))
    .filter(x => x.startsWith(".staged-"));
  assert.deepEqual(staged, []);
}));

test("corrupt immutable bytes are not reused or silently repaired", async () => workspace(async p => {
  const published = publish(p);
  await writeFile(published.manifestPath, "tampered sidecar");
  assert.throws(() => read(p), /checksum mismatch/);
  assert.throws(() => publish(p), /checksum mismatch/);
  assert.equal(await readFile(published.manifestPath, "utf8"), "tampered sidecar");
}));

test("malformed, injected and traversal pointers fail closed", async () => workspace(async p => {
  const published = publish(p);
  const pointerPath = published.pointerPath;
  const invalid = [
    { ...published.pointer, format: "future-release-v2" },
    { ...published.pointer, releaseId: "../escape" },
    { ...published.pointer, extra: "/etc/passwd" },
    { ...published.pointer, modelSha256: "0".repeat(64) },
    ["not a pointer"],
    null,
  ];
  for (const pointer of invalid) {
    await writeFile(pointerPath, JSON.stringify(pointer));
    assert.throws(() => read(p), /Invalid or unsupported garment release pointer/);
  }
  await writeFile(pointerPath, "{unparseable");
  assert.throws(() => read(p), SyntaxError);
}));

test("missing, empty, symlinked and oversized candidate inputs cannot advance pointer", async () => workspace(async p => {
  const first = publish(p);
  await writeFile(p.manifest, "");
  assert.throws(() => publish(p), /nonempty regular file/);
  await fs.promises.unlink(p.manifest);
  await fs.promises.symlink(first.manifestPath, p.manifest);
  assert.throws(() => publish(p), /nonempty regular file|ELOOP/);
  await fs.promises.unlink(p.manifest);
  await writeFile(p.manifest, Buffer.alloc(1024 * 1024 + 1));
  assert.throws(() => publish(p), /nonempty regular file/);
  assert.equal(read(p).pointer.releaseId, first.pointer.releaseId);
}));

test("readers retain a consistent old snapshot even after a concurrent pointer change", async () => workspace(async p => {
  const first = publish(p);
  const opened = read(p);
  await next(p);
  publish(p);
  assert.equal(opened.pointer.releaseId, first.pointer.releaseId);
  assert.equal(opened.glb.toString(), "first verified GLB fixture");
  assert.equal(opened.sidecar.toString(), '{"panels":"first measured fixture"}');
  assert.equal(read(p).glb.toString(), "second verified GLB fixture");
}));


test("symlinked release roots are rejected before publishing or reading", async () => workspace(async p => {
  const first = publish(p);
  const alias = path.join(p.root, "symlinked-published-root");
  await fs.promises.symlink(p.releases, alias, "dir");

  assert.throws(() => readGarmentRelease(alias), /real directory, not a symlink/);
  assert.throws(
    () => publishImmutableGarmentRelease(p.model, p.manifest, alias),
    /real directory, not a symlink/,
  );
  assert.equal(read(p).pointer.releaseId, first.pointer.releaseId);
}));

test("symlinked releases ancestor cannot redirect assets outside release root", async () => workspace(async p => {
  const first = publish(p);
  const releases = path.join(p.releases, "releases");
  const elsewhere = path.join(p.root, "displaced-immutable-assets");
  const pointerBefore = await readFile(first.pointerPath);
  await fs.promises.rename(releases, elsewhere);
  await fs.promises.symlink(elsewhere, releases, "dir");

  assert.throws(() => read(p), /real directory, not a symlink/);
  assert.throws(() => publish(p), /real directory, not a symlink/);
  assert.deepEqual(await readFile(first.pointerPath), pointerBefore);
}));

test("a symlinked version directory is invalid even with unmodified checked assets", async () => workspace(async p => {
  const first = publish(p);
  const saved = path.join(p.root, "displaced-version");
  const pointerBefore = await readFile(first.pointerPath);
  await fs.promises.rename(first.directory, saved);
  await fs.promises.symlink(saved, first.directory, "dir");

  assert.throws(() => read(p), /real directory, not a symlink/);
  assert.throws(() => publish(p), /real directory, not a symlink/);
  assert.deepEqual(await readFile(first.pointerPath), pointerBefore);
}));


test("existing symlinked parent of release root is rejected on read and publish", async () => workspace(async p => {
  const first = publish(p);
  const parentAlias = path.join(p.root, "parent-alias");
  await fs.promises.symlink(p.root, parentAlias, "dir");
  const aliasedRoot = path.join(parentAlias, "published");

  assert.throws(() => readGarmentRelease(aliasedRoot), /real directory, not a symlink/);
  assert.throws(
    () => publishImmutableGarmentRelease(p.model, p.manifest, aliasedRoot),
    /real directory, not a symlink/,
  );
  assert.equal(read(p).pointer.releaseId, first.pointer.releaseId);
}));

test("symlinked parent is checked before recursive mkdir mutates outside paths", async () => workspace(async p => {
  const outside = path.join(p.root, "outside-target");
  await mkdir(outside);
  const alias = path.join(p.root, "outside-alias");
  await fs.promises.symlink(outside, alias, "dir");
  const newRoot = path.join(alias, "unexpected", "published");

  assert.throws(
    () => publishImmutableGarmentRelease(p.model, p.manifest, newRoot),
    /real directory, not a symlink/,
  );
  assert.equal(fs.existsSync(path.join(outside, "unexpected")), false);
}));

test("pointer file swapped to a symlink at open cannot be read through an old lstat", async () => workspace(async p => {
  const first = publish(p);
  const oldPointerBytes = await readFile(first.pointerPath);
  let swapped = false;
  const io = {
    ...fs,
    openSync(file, flags) {
      if (file === first.pointerPath && !swapped) {
        swapped = true;
        fs.renameSync(file, file + ".original");
        fs.symlinkSync(file + ".original", file);
      }
      return fs.openSync(file, flags);
    },
  };

  assert.throws(() => readGarmentRelease(p.releases, io), /ELOOP|symbolic link|too many/i);
  assert.equal(swapped, true);
  assert.deepEqual(await readFile(first.pointerPath + ".original"), oldPointerBytes);
}));

test("staged candidate swapped to a symlink at open cannot advance current pointer", async () => workspace(async p => {
  const first = publish(p);
  await next(p);
  let swapped = false;
  const io = {
    ...fs,
    openSync(file, flags) {
      if (file === p.model && !swapped) {
        swapped = true;
        fs.renameSync(file, file + ".original");
        fs.symlinkSync(file + ".original", file);
      }
      return fs.openSync(file, flags);
    },
  };

  assert.throws(() => publish(p, io), /ELOOP|symbolic link|too many/i);
  assert.equal(swapped, true);
  assert.equal(read(p).pointer.releaseId, first.pointer.releaseId);
}));

test("short descriptor reads fail before returning a partial release snapshot", async () => workspace(async p => {
  const first = publish(p);
  const io = {
    ...fs,
    readFileSync(file, ...args) {
      const bytes = fs.readFileSync(file, ...args);
      return typeof file === "number" ? bytes.subarray(0, bytes.length - 1) : bytes;
    },
  };

  assert.throws(() => readGarmentRelease(p.releases, io), /Release asset changed while being read/);
  assert.equal(read(p).pointer.releaseId, first.pointer.releaseId);
}));
