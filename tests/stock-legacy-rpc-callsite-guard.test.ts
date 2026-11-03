import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {extname, join, relative} from "node:path";

// Runtime app/library/component code only. Migrations intentionally retain the
// retired v1 function definition so existing ledgers remain recoverable.
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const LEGACY_STOCK_WRITER = /\bfabric_stock_(?:record|reserve|release|consume_reservation)\b/g;

function deployedSourceFiles(directory: string): string[] {
  const paths: string[] = [];
  for (const item of readdirSync(directory, {withFileTypes: true})) {
    const file = join(directory, item.name);
    if (item.isDirectory()) paths.push(...deployedSourceFiles(file));
    else if (item.isFile() && SOURCE_EXTENSIONS.has(extname(item.name))) paths.push(file);
  }
  return paths;
}

test("deployed source never references any legacy stock mutation RPC v1", () => {
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
    "Legacy stock v1 write RPCs bypass provenance or shared lock guarantees. Use only audited v2 RPCs; verify dynamic RPC names separately."
  );
});

 
// An explicit allowlist catches dynamically assembled or newly introduced
// privileged stock RPC calls even when literal v1 identifiers are absent.
test("operator stock route uses only audited literal v2 RPC targets", () => {
  const route = readFileSync("src/app/api/operator/stock/route.ts", "utf8");
  const calls = [...route.matchAll(/\brpc(?:<[^>]+>)?\s*\(/g)];
  const names = [...route.matchAll(/\brpc(?:<[^>]+>)?\s*\(\s*"([^"]+)"/g)].map((match) => match[1]);
  // Exactly one generic function definition and one static literal per call.
  assert.equal(calls.length, names.length + 1, "Operator stock RPC call was added without a literal audited target.");
  assert.deepEqual(names.sort(), [
    "fabric_stock_snapshot_v2",
    "fabric_stock_record_v2",
    "fabric_stock_reserve_v2",
    "fabric_stock_release_v2",
    "fabric_stock_consume_reservation_v2",
  ].sort());
});
