"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const audit = require("./audit-supabase-migration-versions.cjs");

test("migration parser uses the timestamp version, not the whole filename", () => {
  assert.equal(audit.migrationVersion("supabase/migrations/20261103080000_name.sql"), "20261103080000");
  assert.equal(audit.migrationVersion("supabase/migrations/20261103_first.sql"), "20261103");
  assert.equal(audit.migrationVersion("supabase/migrations/not-a-version.sql"), null);
});
test("duplicate timestamp versions are detected even when filename suffixes differ", () => {
  const r = audit.inspectMigrations([
    "supabase/migrations/20261103080000_alpha.sql",
    "supabase/migrations/20261103080000_beta.sql",
    "supabase/migrations/20261103080100_gamma.sql",
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.distinctVersions, 2);
  assert.deepEqual(r.duplicates.map(x => x.version), ["20261103080000"]);
  assert.deepEqual(r.nonstandardVersions, []);
});
test("approved historical inventory does not allow new 8-digit or duplicate versions", () => {
  const existing = ["supabase/migrations/20261103_legacy_a.sql","supabase/migrations/20261103_legacy_b.sql"];
  assert.equal(audit.checkAgainstBaseline(existing, existing).ok, true);
  const duplicate = audit.checkAgainstBaseline(
    [...existing, "supabase/migrations/20261103_new.sql"], existing);
  assert.equal(duplicate.ok, false);
  assert.deepEqual(duplicate.invalidNew, ["supabase/migrations/20261103_new.sql"]);
  assert.deepEqual(duplicate.conflictingNew, ["supabase/migrations/20261103_new.sql"]);
  const unique = audit.checkAgainstBaseline(
    [...existing, "supabase/migrations/20261103153000_new.sql"], existing);
  assert.equal(unique.ok, true);
  assert.equal(audit.checkAgainstBaseline(existing.slice(1), existing).ok, false);
  const sameVersion = audit.checkAgainstBaseline([
    ...existing, "supabase/migrations/20261103153000_first.sql",
    "supabase/migrations/20261103153000_second.sql"
  ], existing);
  assert.equal(sameVersion.ok, false);
  assert.equal(sameVersion.conflictingNew.length, 2);
});
test("historical migration hashes fail closed on edits, malformed entries or path replacement", () => {
  const file = "supabase/migrations/20261001_fabric_stock_ledger.sql";
  const pristine = Buffer.from("synthetic historical SQL;");
  const digest = audit.gitBlobSha(pristine);
  assert.match(digest,/^[0-9a-f]{40}$/);
  assert.equal(audit.verifyHistoricalBlobs([file],{[file]:digest}, () => pristine).ok,true);
  const modified = audit.verifyHistoricalBlobs([file],{[file]:digest},
    () => Buffer.from("synthetic historical SQL; -- sneaky edit"));
  assert.equal(modified.ok,false);
  assert.deepEqual(modified.modifiedHistorical,[file]);
  const missing = audit.verifyHistoricalBlobs([file],{},() => pristine);
  assert.equal(missing.ok,false);
  assert.deepEqual(missing.missingDigests,[file]);
  const extraneous = audit.verifyHistoricalBlobs([file],
    {[file]:digest,"supabase/migrations/20261103000000_unapproved.sql":digest},() => pristine);
  assert.equal(extraneous.ok,false);
  assert.equal(extraneous.unexpectedDigests.length,1);
});
test("filename-ordered stock RPC overwrite can lose a strict identity guard", () => {
  const paths = ["supabase/migrations/20261103_stock_reservation_identity_length_gate.sql",
    "supabase/migrations/20261103_stock_reservation_provenance_gate.sql"];
  const bodies = {
    [paths[0]]: "create or replace function public.fabric_stock_reserve_v2()\n-- reservation identity or evidence exceeds supported length",
    [paths[1]]: "create or replace function public.fabric_stock_reserve_v2()\n-- truncate left(trim(v_key),180)",
  };
  const r = audit.inspectReserveOverride(paths, p => bodies[p]);
  assert.equal(r.filenameOrderLastDefinition, paths[1]);
  assert.equal(r.hasStrictLengthGate, false);
});
test("current legacy baseline inventory is stable but strict deployment readiness fails", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname,
    "../docs/TITAN_SUPABASE_MIGRATION_BASELINE.json"),"utf8")).migrationPaths;
  const paths = audit.collectMigrationPaths();
  assert.equal(audit.checkAgainstBaseline(paths, baseline).ok, true);
  const provenance=JSON.parse(fs.readFileSync(path.join(__dirname,
    "../docs/TITAN_SUPABASE_MIGRATION_BASELINE.json"),"utf8"));
  assert.equal(Object.keys(provenance.blobShaByPath).length, baseline.length);
  const hashes=audit.verifyHistoricalBlobs(paths,provenance.blobShaByPath,
    file => fs.readFileSync(path.join(__dirname,"..",file)));
  assert.equal(hashes.ok,true,JSON.stringify(hashes));
  const r = audit.inspectMigrations(paths);
  assert.ok(r.duplicates.length > 0, "legacy collision debt must be recognized");
  assert.ok(r.nonstandardVersions.length > 0, "legacy 8-digit timestamps remain unresolved");
  const strict = spawnSync(process.execPath,
    [path.join(__dirname,"audit-supabase-migration-versions.cjs"),"--strict"],
    { encoding:"utf8" });
  assert.equal(strict.status, 1, "strict Supabase migration gate must remain blocking");
  assert.match(strict.stderr, /BLOCKED: cannot certify/);
  const baselineRun = spawnSync(process.execPath,
    [path.join(__dirname,"audit-supabase-migration-versions.cjs"),"--enforce-new"],
    { encoding:"utf8" });
  assert.equal(baselineRun.status,0,baselineRun.stderr);
});
