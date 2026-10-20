import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(new URL("../scripts/build-production-garment-model.mjs", import.meta.url));

async function workspace(run: (root: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "linen export failure "));
  try {
    await fs.mkdir(path.join(root, "bin"));
    await fs.mkdir(path.join(root, "scripts/blender"), { recursive: true });
    await fs.writeFile(path.join(root, "scene with spaces.blend"), "scene fixture");
    await fs.writeFile(path.join(root, "panel spec.json"), "{}");
    await fs.writeFile(path.join(root, "candidate.glb"), "prior validated candidate fixture");
    await fs.writeFile(path.join(root, "candidate.viewer.json"), "prior manifest fixture");
    await fs.writeFile(path.join(root, "scripts/blender/export-linen-earth-officewear.py"), "# fixture only");
    // The validator marker proves whether a failed exporter advanced to the
    // next process. No test stub is used to certify real garment geometry.
    await fs.writeFile(path.join(root, "scripts/check-garment-viewer-model.mjs"), `
      import fs from "node:fs";
      fs.writeFileSync("validator-ran.json", JSON.stringify(process.argv.slice(2)));
      process.exit(Number(process.env.EXPORT_TEST_VALIDATOR_EXIT || 0));
    `);
    await fs.writeFile(path.join(root, "bin/blender"), `#!${process.execPath}
      const fs = require("node:fs");
      const args = process.argv.slice(2);
      fs.writeFileSync("blender-args.json", JSON.stringify(args));
      if (process.env.EXPORT_TEST_MODE === "python-error") {
        console.error("RuntimeError: production scene preflight failed");
        const flag = args.indexOf("--python-exit-code");
        process.exit(flag >= 0 ? Number(args[flag + 1]) : 0);
      }
      if (process.env.EXPORT_TEST_MODE === "signal") process.kill(process.pid, "SIGTERM");
      process.exit(Number(process.env.EXPORT_TEST_BLENDER_EXIT || 0));
    `, { mode: 0o755 });
    await run(root);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

function build(root: string, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root, encoding: "utf8", timeout: 15_000,
    env: {
      ...process.env,
      PATH: path.join(root, "bin"),
      LINEN_GARMENT_BLEND: "scene with spaces.blend",
      LINEN_GARMENT_PANEL_SPEC: "panel spec.json",
      LINEN_GARMENT_OUTPUT: "candidate.glb",
      ...env,
    },
  });
  assert.equal(result.error, undefined);
  return result;
}

async function assertNoValidation(root: string, stdout: string) {
  await assert.rejects(fs.access(path.join(root, "validator-ran.json")));
  assert.doesNotMatch(stdout, /candidate passed export/);
  assert.equal(await fs.readFile(path.join(root, "candidate.glb"), "utf8"), "prior validated candidate fixture");
  assert.equal(await fs.readFile(path.join(root, "candidate.viewer.json"), "utf8"), "prior manifest fixture");
}

test("Python export errors cannot validate or report success for an older candidate", async () => workspace(async root => {
  const result = build(root, { EXPORT_TEST_MODE: "python-error" });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /production scene preflight failed/);
  await assertNoValidation(root, result.stdout);
}));

test("A nonzero Blender exit, signal or missing executable stops before validation", async () => workspace(async root => {
  const failures: Record<string, string>[] = [
    { EXPORT_TEST_BLENDER_EXIT: "7" }, { EXPORT_TEST_MODE: "signal" }, { PATH: path.join(root, "missing-bin") },
  ];
  for (const env of failures) {
    const result = build(root, env);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    if (env.EXPORT_TEST_MODE === "signal") assert.match(result.stderr, /terminated by signal SIGTERM/);
    await assertNoValidation(root, result.stdout);
  }
}));

test("Successful export still requires independent structural validation", async () => workspace(async root => {
  const result = build(root, { EXPORT_TEST_VALIDATOR_EXIT: "9" });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /candidate passed export/);
  const checked = JSON.parse(await fs.readFile(path.join(root, "validator-ran.json"), "utf8")) as string[];
  assert.deepEqual(checked, [path.join(root, "candidate.glb")]);
}));

test("Export and validation preserve exact paths with spaces and separate process arguments", async () => workspace(async root => {
  const result = build(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const args = JSON.parse(await fs.readFile(path.join(root, "blender-args.json"), "utf8")) as string[];
  assert.equal(args[args.indexOf("--background") + 1], path.join(root, "scene with spaces.blend"));
  assert.equal(args[args.indexOf("--panel-spec") + 1], path.join(root, "panel spec.json"));
  assert.match(result.stdout, /candidate passed export \+ structural validation/);
}));
