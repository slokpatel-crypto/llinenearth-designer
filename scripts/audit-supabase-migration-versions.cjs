#!/usr/bin/env node
"use strict";
// Read-only Supabase migration-history preflight. Never connects to a database.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const migrationDir = path.join(root, "supabase", "migrations");
const baselinePath = path.join(root, "docs", "TITAN_SUPABASE_MIGRATION_BASELINE.json");

function migrationVersion(file) {
  const name = path.basename(file);
  const match = /^(\d+)_([\w-]+)\.sql$/.exec(name);
  return match ? match[1] : null;
}
function migrationPathsFromEntries(entries) {
  const ambiguous = entries.filter(entry =>
    entry.isSymbolicLink() || entry.isDirectory() ||
    (!entry.isFile() && /\.sql$/i.test(entry.name)) ||
    (entry.isFile() && /\.sql$/i.test(entry.name) && !entry.name.endsWith(".sql")));
  if (ambiguous.length > 0) {
    throw Error("Ambiguous migration entry (symlink, nested directory or SQL filename case): " +
      ambiguous.map(entry => entry.name).sort().join(", "));
  }
  return entries.filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
    .map(entry => "supabase/migrations/" + entry.name).sort();
}
function collectMigrationPaths(dir = migrationDir) {
  return migrationPathsFromEntries(fs.readdirSync(dir, { withFileTypes: true }));
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
// Git's blob hash binds both exact SQL bytes and length; no remote DB reads.
function gitBlobSha(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return createHash("sha1").update("blob " + buf.length + "\0").update(buf).digest("hex");
}
function verifyHistoricalBlobs(baselinePaths, expected, readFile) {
  const missingDigests = baselinePaths.filter(file =>
    !Object.hasOwn(expected, file) || !/^[0-9a-f]{40}$/.test(expected[file])).sort();
  const unexpectedDigests = Object.keys(expected).filter(file => !baselinePaths.includes(file)).sort();
  const modifiedHistorical = baselinePaths.filter(file => !missingDigests.includes(file) &&
    gitBlobSha(readFile(file)) !== expected[file]).sort();
  return { ok: missingDigests.length === 0 && unexpectedDigests.length === 0 &&
      modifiedHistorical.length === 0, missingDigests, unexpectedDigests, modifiedHistorical };
}
function parsePinnedMigrationTree(output) {
  const entries = new Map();
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const match = /^100644 blob ([0-9a-f]{40})\t(supabase\/migrations\/[^\t]+\.sql)$/.exec(line);
    if (!match) throw Error("Unexpected Git migration-tree entry: " + line);
    if (entries.has(match[2])) throw Error("Duplicate Git tree path: " + match[2]);
    entries.set(match[2], match[1]);
  }
  return entries;
}
function verifyBaselineFromGit(data, gitOutput) {
  const expected = data.blobShaByPath;
  const actual = parsePinnedMigrationTree(gitOutput);
  const listed = [...data.migrationPaths].sort();
  const actualPaths = [...actual.keys()].sort();
  const mismatched = listed.filter(file => actual.get(file) !== expected[file]);
  const absent = listed.filter(file => !actual.has(file));
  const additional = actualPaths.filter(file => !listed.includes(file));
  return { ok: listed.length === actualPaths.length && mismatched.length === 0 &&
      absent.length === 0 && additional.length === 0,
    mismatched, absent, additional, treeCount: actualPaths.length };
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
// This is a conservative text preflight only; a native replay must verify behavior.
// Ignore SQL comments and inspect the active dollar-quoted CREATE FUNCTION body,
// not documentation/comments elsewhere in the migration file.
function activeReserveBody(sql) {
  const uncommented = sql.replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
  const definitions = [...uncommented.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public|"public")\s*\.\s*(?:fabric_stock_reserve_v2|"fabric_stock_reserve_v2")\s*\(/gi)];
  if (!definitions.length) return null;
  const last = uncommented.slice(definitions.at(-1).index);
  const match = /\bas\s+(\$[a-zA-Z0-9_]*\$)([\s\S]*?)\1/i.exec(last);
  return match ? match[2] : "";
}
function inspectReserveOverride(paths, readSql) {
  const bodies = new Map();
  for (const file of paths) {
    const body = activeReserveBody(readSql(file));
    if (body !== null) bodies.set(file, body);
  }
  const overrides = [...bodies.keys()].sort();
  const finalFile = overrides.at(-1) || null;
  const finalBody = finalFile ? bodies.get(finalFile) : "";
  const gate = /\bif\s+length\(v_fabric\)\s*>\s*160\b([\s\S]{0,400}?)\braise\s+exception\s+'reservation identity or evidence exceeds supported length'/i.exec(finalBody);
  const variables = [
    ["v_fabric", "p_fabric_id", 160], ["v_key", "p_request_key", 180],
    ["v_revision", "p_revision_id", 220], ["v_requester", "p_requested_by", 120],
    ["v_source", "p_source_reference", 240]
  ];
  const hasStrictLengthGate = !!gate && variables.every(([v, input, max]) => {
    const source = new RegExp("\\b" + v + "\\s+text\\s*:=\\s*trim\\s*\\(\\s*coalesce\\s*\\(\\s*" + input + "\\s*,", "i");
    const checked = new RegExp("\\blength\\(" + v + "\\)\\s*>\\s*" + max + "\\b", "i");
    return source.test(finalBody) && checked.test(gate[0]);
  });
  const usesLossyIdentifierTruncation = /\b(?:v_fabric|v_key|v_revision|v_requester|v_source)\s+text\s*:=\s*left\s*\(/i.test(finalBody);
  return { overrides, filenameOrderLastDefinition: finalFile,
    hasStrictLengthGate: hasStrictLengthGate && !usesLossyIdentifierTruncation,
    usesLossyIdentifierTruncation };
}
// Prevent new migration files from evading the frozen-version inventory. An
// unrelated new timestamp is allowed for development, but is NOT db-push proof.
function validTimestampVersion(version) {
  if (!/^\d{14}$/.test(version || "")) return false;
  const y=Number(version.slice(0,4)), mo=Number(version.slice(4,6)),
    day=Number(version.slice(6,8)), hh=Number(version.slice(8,10)),
    mm=Number(version.slice(10,12)), ss=Number(version.slice(12,14));
  const d=new Date(Date.UTC(y,mo-1,day,hh,mm,ss));
  return d.getUTCFullYear()===y && d.getUTCMonth()+1===mo &&
    d.getUTCDate()===day && d.getUTCHours()===hh &&
    d.getUTCMinutes()===mm && d.getUTCSeconds()===ss;
}
function inspectNewMigrationSafety(paths, baseline, readSql) {
  const existing=new Set(baseline);
  const added=paths.filter(file => !existing.has(file)).sort();
  const latestBaselineVersion=baseline.map(migrationVersion).filter(Boolean).sort().at(-1) || "";
  const invalidTimestamps=added.filter(file => !validTimestampVersion(migrationVersion(file)));
  const backdated=added.filter(file => {
    const version=migrationVersion(file);
    return !!version && version<=latestBaselineVersion;
  });
  const unsafeReserveOverrides=added.filter(file => {
    const active=activeReserveBody(readSql(file));
    return active!==null && !inspectReserveOverride([file],readSql).hasStrictLengthGate;
  });
  return {ok:invalidTimestamps.length===0 && backdated.length===0 &&
    unsafeReserveOverrides.length===0,added,latestBaselineVersion,
    invalidTimestamps,backdated,unsafeReserveOverrides};
}

function main(args = process.argv.slice(2)) {
  const opts = new Set(args);
  if (args.some(arg => !["--report", "--enforce-new", "--strict", "--verify-git-baseline"].includes(arg))) {
    console.error("Usage: node scripts/audit-supabase-migration-versions.cjs [--report|--enforce-new|--strict] [--verify-git-baseline]");
    return 2;
  }
  if (opts.has("--verify-git-baseline") && !opts.has("--enforce-new")) {
    console.error("--verify-git-baseline requires --enforce-new");
    return 2;
  }
  if ([...opts].filter(x => x !== "--report" && x !== "--verify-git-baseline").length > 1) {
    console.error("Use only one enforcement mode.");
    return 2;
  }
  const files = collectMigrationPaths();
  const report = inspectMigrations(files);
  const override = inspectReserveOverride(files, file => fs.readFileSync(path.join(root,file), "utf8"));
  const result = { ...report, stockReserveV2FilenameOrder: override };
  if (opts.has("--enforce-new")) {
    const baselineData = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    const baseline = baselineData.migrationPaths;
    if (!Array.isArray(baseline) || new Set(baseline).size !== baseline.length) {
      throw Error("Migration baseline must be an array with unique paths");
    }
    if (baselineData.baseCommit !== "4dd8020abd83429449ff53ea5bb71b046394d86e"
      || !baselineData.blobShaByPath || typeof baselineData.blobShaByPath !== "object"
      || Array.isArray(baselineData.blobShaByPath)) {
      throw Error("Migration baseline provenance or content digests are invalid");
    }
    result.baseline = checkAgainstBaseline(files, baseline);
    result.newMigrationSafety = inspectNewMigrationSafety(files, baseline,
      file => fs.readFileSync(path.join(root,file), "utf8"));
    result.contents = verifyHistoricalBlobs(baseline, baselineData.blobShaByPath,
      file => fs.readFileSync(path.join(root,file)));
    if (opts.has("--verify-git-baseline")) {
      const git = spawnSync("git", ["ls-tree", "-r", "--full-tree", baselineData.baseCommit,
        "--", "supabase/migrations"], {cwd:root, encoding:"utf8"});
      if (git.status !== 0) {
        throw Error("Could not verify pinned original Git commit tree; fail closed: " + git.stderr);
      }
      result.gitProvenance = verifyBaselineFromGit(baselineData, git.stdout);
    }
    if (!result.baseline.ok || !result.newMigrationSafety.ok || !result.contents.ok ||
       (opts.has("--verify-git-baseline") && !result.gitProvenance.ok)) {
      console.error(JSON.stringify(result, null, 2));
      console.error("BLOCKED: migration version/date, new stock reserve override, or historical SQL integrity violated.");
      return 1;
    }
    console.log("PASS: no new ambiguous versions, historical path removals, or historical SQL content edits; NOT DEPLOY-SAFE.");
    console.log(JSON.stringify({ baseline: result.baseline, newMigrationSafety: result.newMigrationSafety,
      contents: result.contents, gitProvenance: result.gitProvenance || null,
      historicalCollisionGroups: report.duplicates.length,
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
module.exports = { migrationVersion, collectMigrationPaths, migrationPathsFromEntries,
  inspectMigrations, checkAgainstBaseline,
  gitBlobSha, verifyHistoricalBlobs, parsePinnedMigrationTree,
  verifyBaselineFromGit, inspectReserveOverride, validTimestampVersion,
  inspectNewMigrationSafety, main };
