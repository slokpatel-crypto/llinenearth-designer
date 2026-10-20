import path from "node:path";
import { emptyAssetReport, readBounded, inspectLocalLayerRegistration, sha256 } from "./lib/model-layer-asset-preflight.mjs";

// A zero exit status means static candidate checks passed, NEVER release approval.
const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith("--")) {
  console.error("Usage: npm run garment:layer-check -- path/to/registration.json");
  process.exit(2);
}
let report = emptyAssetReport();
try {
  const bytes = await readBounded(path.resolve(args[0]), 16 * 1024);
  report = await inspectLocalLayerRegistration(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  report.registrationFileSha256 = sha256(bytes);
} catch (error) {
  report.reasons = [error instanceof Error ? error.message : "Extension preflight failed."];
}
console.log(JSON.stringify(report, null, 2));
if (!report.candidateReady) process.exitCode = 1;
