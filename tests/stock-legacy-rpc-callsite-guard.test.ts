import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {extname, join, relative} from "node:path";

// Runtime app/library/component code only. Migrations intentionally retain the
// retired v1 function definition so existing ledgers remain recoverable.
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const LEGACY_STOCK_WRITER = /\bfabric_stock_record\b/g;

function deployedSourceFiles(directory: string): string[] {
  const paths: string[] = [];
  for (const item of readdirSync(directory, {withFileTypes: true})) {
    const file = join(directory, item.name);
    if (item.isDirectory()) paths.push(...deployedSourceFiles(file));
    else if (item.isFile() && SOURCE_EXTENSIONS.has(extname(item.name))) paths.push(file);
  }
  return paths;
}

test("deployed source never references provenance-free legacy stock writer v1", () => {
  const violations: string[] = [];
  for (const file of deployedSourceFiles("src")) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      // The exact identifier boundary accepts fabric_stock_record_v2,
      // but rejects a literal v1 RPC name in any deployable source file.
      if (LEGACY_STOCK_WRITER.test(line))
        violations.push(`${relative(".", file)}:${index + 1}`);
      LEGACY_STOCK_WRITER.lastIndex = 0;
    });
  }
  assert.deepEqual(
    violations,
    [],
    "Legacy stock RPC v1 bypasses physical provenance and the shared fabric lock. Use fabric_stock_record_v2; verify all dynamic RPC names separately."
  );
});
