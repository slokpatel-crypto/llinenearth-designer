#!/usr/bin/env node
"use strict";
// Read-only Supabase migration-history preflight. Never connects to a database.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const migrationDir = path.join(root, "supabase", "migrations");
const baselinePath = path.join(root, "docs", "TITAN_SUPABASE_MIGRATION_BASELINE.json");

function migrationVersion(file) {
  const name = path.basename(file);
  const match = /^(\d+)_([\w-]+)\.sql$/.exec(name);
  return match ? match[1] : null;
}
function collectMigrationPaths(dir = migrationDir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
    .map(entry => "supabase/migrations/" + entry.name)
    .sort();
}
function inspectMigrations(paths) {
  const ordered = [...paths].sort();
  const versions = new Map();
  const invalidNames = [];
  const nonstandardVersions = [];
  for (const file of ordered) {
    const version = migrationVersion(file);
    if (!version) { invalidNames.push(file); continue; }
    if (!/^\d{14}$/.test(version)) nonstandardVersions.push(file);
    versions.set(version, [...(versions.get(version) || []), file]);
  }
  const duplicates = [...versions.entries()].filter(([,files]) => files.length > 1)
    .map(([version,files]) => ({ version, files })).sort((a,b) => a.version.localeCompare(b.version));
  return { total: ordered.length, distinctVersions: versions.size,
    invalidNames, nonstandardVersions, duplicates };
}
function checkAgainstBaseline(paths, baseline) {
  const current = new Set(paths);
  const previous = new Set(baseline);
  const removed = [...previous].filter(file => !current.has(file)).sort();
  const added = [...current].filter(file => !previous.has(file)).sort();
  const seen = new Map();
  for (const file of paths) {
    const version = migrationVersion(file);
    if (version) seen.set(version, [...(seen.get(version) || []),file]);
  }
  const invalidNew = added.filter(file => !/^\d{14}$/.test(migrationVersion(file) || ""));
  const conflictingNew = added.filter(file => {
    const version = migrationVersion(file);
    return !!version && (seen.get(version)?.length || 0) !== 1;
  });
  return { ok: removed.length === 0 && invalidNew.length === 0 && conflictingNew.length === 0,
    removed, added, invalidNew, conflictingNew };
}
function inspectReserveOverride(paths, readSql) {
  const overrides = paths.filter(file => {
    const sql = readSql(file);
    return /create\s+or\s+replace\s+function\s+public\.fabric_stock_reserve_v2\s*\(/i.test(sql);
  }).sort();
  const finalFile = overrides.at(-1) || null;
  const finalText = finalFile ? readSql(finalFile) : "";
  const hasStrictLengthGate = /reservation identity or evidence exceeds supported length/.test(finalText);
  return { overrides, filenameOrderLastDefinition: finalFile, hasStrictLengthGate };
}
function main(args = process.argv.slice(2)) {
  const opts = new Set(args);
  if (args.some(arg => !["--report", "--enforce-new", "--strict"].includes(arg))) {
    console.error("Usage: node scripts/audit-supabase-migration-versions.cjs [--report|--enforce-new|--strict]");
    return 2;
  }
  if ([...opts].filter(x => x !== "--report").length > 1) {
    console.error("Use only one enforcement mode.");
    return 2;
  }
  const files = collectMigrationPaths();
  const report = inspectMigrations(files);
  const override = inspectReserveOverride(files, file => fs.readFileSync(path.join(root,file), "utf8"));
  const result = { ...report, stockReserveV2FilenameOrder: override };
  if (opts.has("--enforce-new")) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")).migrationPaths;
    if (!Array.isArray(baseline) || new Set(baseline).size !== baseline.length) {
      throw Error("Migration baseline must be an array with unique paths");
    }
    result.baseline = checkAgainstBaseline(files, baseline);
    if (!result.baseline.ok) {
      console.error(JSON.stringify(result, null, 2));
      console.error("BLOCKED: new or renamed migration introduces unsupported/duplicate versions, or removes historical paths.");
      return 1;
    }
    console.log("PASS: no new ambiguous versions or historical-file changes; historical collisions remain NOT DEPLOY-SAFE.");
    console.log(JSON.stringify({ baseline: result.baseline, historicalCollisionGroups: report.duplicates.length,
      historicalNonstandardFiles: report.nonstandardVersions.length }));
    return 0;
  }
  console.log(JSON.stringify(result, null, 2));
  if (opts.has("--strict")) {
    if (report.invalidNames.length || report.nonstandardVersions.length || report.duplicates.length
        || (override.overrides.length > 0 && !override.hasStrictLengthGate)) {
      console.error("BLOCKED: cannot certify standard Supabase migration deployment/history or final RPC definition.");
      return 1;
    }
    console.log("PASS: static strict preflight. Staging migration history must still be independently verified.");
  }
  return 0;
}
if (require.main === module) process.exitCode = main();
module.exports = { migrationVersion, collectMigrationPaths, inspectMigrations, checkAgainstBaseline,
  inspectReserveOverride, main };
