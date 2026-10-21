import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readGarmentRelease } from "../scripts/publish-immutable-garment-release.mjs";

const builder = fileURLToPath(new URL("../scripts/build-production-garment-model.mjs", import.meta.url));

test("Blender export validates staged bytes and publishes one immutable pair through an opt-in pointer", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "linen native CLI atomic "));
  const releaseRoot = path.join(root, "releases with spaces");
  try {
    await fs.mkdir(path.join(root, "bin"));
    await fs.mkdir(path.join(root, "scripts/blender"), { recursive: true });
    await fs.writeFile(path.join(root, "source.blend"), "locked scene fixture");
    await fs.writeFile(path.join(root, "measured.json"), "fixture dimensions");
    await fs.writeFile(path.join(root, "candidate.glb"), "legacy GLB must remain untouched");
    await fs.writeFile(path.join(root, "candidate.viewer.json"), "legacy sidecar must remain untouched");
    await fs.writeFile(path.join(root, "scripts/blender/export-linen-earth-officewear.py"), "# fixture");
    await fs.writeFile(path.join(root, "scripts/check-garment-viewer-model.mjs"), `
      import fs from "node:fs";
      const candidate = process.argv[2];
      fs.writeFileSync("validator-input.json", JSON.stringify({ candidate, bytes: fs.readFileSync(candidate, "utf8") }));
      process.exit(Number(process.env.CLI_VALIDATION_EXIT || 0));
    `);
    await fs.writeFile(path.join(root, "bin/blender"), `#!${process.execPath}
      const fs = require("node:fs");
      const args = process.argv.slice(2);
      if (!args.includes("--python-exit-code") || args[args.indexOf("--python-exit-code")+1] !== "1") process.exit(4);
      const output = args[args.indexOf("--output")+1];
      fs.writeFileSync(output, "verified new model " + (process.env.CLI_VERSION || "1"));
      fs.writeFileSync(output.replace(/\\.glb$/, ".viewer.json"), "measured new manifest " + (process.env.CLI_VERSION || "1"));
    `, { mode: 0o755 });

    function run(options = {}) {
      return spawnSync(process.execPath, [builder], {
        cwd: root, encoding: "utf8", timeout: 15_000,
        env: {
          ...process.env, PATH: path.join(root, "bin"),
          LINEN_GARMENT_BLEND: "source.blend",
          LINEN_GARMENT_PANEL_SPEC: "measured.json",
          LINEN_GARMENT_OUTPUT: "candidate.glb",
          LINEN_GARMENT_ATOMIC_RELEASE_DIR: releaseRoot,
          ...options,
        },
      });
    }
    const first = run();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const checked = JSON.parse(await fs.readFile(path.join(root, "validator-input.json"), "utf8"));
    assert.match(checked.candidate, /\\.linen-export-stage-/);
    assert.equal(checked.bytes, "verified new model 1");
    const before = readGarmentRelease(releaseRoot);
    assert.equal(before.glb.toString(), "verified new model 1");
    assert.equal(before.sidecar.toString(), "measured new manifest 1");
    assert.match(first.stdout, /Published immutable candidate release/);
    assert.equal(await fs.readFile(path.join(root, "candidate.glb"), "utf8"), "legacy GLB must remain untouched");
    assert.equal(await fs.readFile(path.join(root, "candidate.viewer.json"), "utf8"), "legacy sidecar must remain untouched");

    const invalid = run({ CLI_VERSION: "2", CLI_VALIDATION_EXIT: "8" });
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
    assert.equal(readGarmentRelease(releaseRoot).pointer.releaseId, before.pointer.releaseId);

    const second = run({ CLI_VERSION: "2" });
    assert.equal(second.status, 0, second.stdout + second.stderr);
    const after = readGarmentRelease(releaseRoot);
    assert.notEqual(after.pointer.releaseId, before.pointer.releaseId);
    assert.equal(after.glb.toString(), "verified new model 2");
    assert.equal(after.sidecar.toString(), "measured new manifest 2");
    assert.equal(await fs.readFile(before.modelPath, "utf8"), "verified new model 1");
    assert.equal(await fs.readFile(before.manifestPath, "utf8"), "measured new manifest 1");
    assert.equal((await fs.readdir(root)).some(x => x.startsWith(".linen-export-stage-")), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
