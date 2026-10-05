import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fields = [
  "verifiedStructure",
  "verifiedBreathability",
  "verifiedWrinkleResistance",
  "verifiedStretch",
] as const;

test("single and batch Analyzer paths retain every normalized physics field", () => {
  const files = [
    "src/app/api/operator/fabric-analyzer/analyze/route.ts",
    "src/app/api/operator/fabric-analyzer/batch/route.ts",
    "src/app/api/operator/fabric-analyzer/process/route.ts",
    "src/lib/fabric-analyzer-store.ts",
    "src/app/operator/fabric-analyzer/FabricAnalyzerClient.tsx",
    "src/app/operator/fabric-analyzer/FabricAnalyzerBatchPanel.tsx",
  ].map((path)=>({path,source:readFileSync(path,"utf8")}));

  for(const field of fields) {
    for(const file of files) {
      assert.match(file.source,new RegExp("\\b"+field+"\\b"),`${field} missing from ${file.path}`);
    }
  }
});

test("batch CSV exposes the normalized physics columns", () => {
  const source=readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerBatchPanel.tsx","utf8");
  for(const field of fields) assert.match(source,new RegExp('"'+field+'"'));
});
