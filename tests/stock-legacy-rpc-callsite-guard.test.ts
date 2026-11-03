import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {extname, join, relative} from "node:path";
import ts from "typescript";

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

 
// Read syntactic calls, not source-code strings/comments. Regex counting could be
// spoofed by an irrelevant comment masking a newly dynamic RPC destination.
function operatorRpcTargets(source: string): string[] {
  const root = ts.createSourceFile("operator-stock-route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const targets: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "rpc") {
      const arg = node.arguments[0];
      assert.ok(arg && ts.isStringLiteral(arg), "Operator stock RPC target must be a literal audited name.");
      targets.push(arg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return targets.sort();
}

// An explicit allowlist catches dynamically assembled or newly introduced
// privileged stock RPC calls even when literal v1 identifiers are absent.
test("operator stock route uses only audited literal v2 RPC targets", () => {
  const route = readFileSync("src/app/api/operator/stock/route.ts", "utf8");
  assert.deepEqual(operatorRpcTargets(route), [
    "fabric_stock_snapshot_v2",
    "fabric_stock_record_v2",
    "fabric_stock_reserve_v2",
    "fabric_stock_release_v2",
    "fabric_stock_consume_reservation_v2",
  ].sort());
});

test("operator RPC target guard cannot be spoofed with comments or dynamic arguments", () => {
  assert.deepEqual(operatorRpcTargets(`
    // rpc("fabric_stock_record_v2", {})
    const documentation = 'rpc("fabric_stock_reserve_v2")';
    async function rpc(name: string): Promise<void> { void name; }
    rpc("fabric_stock_snapshot_v2");
  `), ["fabric_stock_snapshot_v2"]);
  assert.throws(() => operatorRpcTargets(`
    // rpc("fabric_stock_record_v2") might fool a regex counter
    rpc(stockRpcName);
  `), /literal audited name/);
  assert.throws(() => operatorRpcTargets('rpc(`fabric_stock_record_v2`);'), /literal audited name/);
});
