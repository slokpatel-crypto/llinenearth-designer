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
test("migration inventory rejects symlinks, nested directories and ambiguous SQL casing", () => {
  const dirent=(name,kind)=>({
    name,isFile:()=>kind==="file",isDirectory:()=>kind==="directory",
    isSymbolicLink:()=>kind==="symlink"
  });
  const good=[
    dirent("20261103170000_valid.sql","file"),
    dirent(".gitkeep","file")
  ];
  assert.deepEqual(audit.migrationPathsFromEntries(good),
    ["supabase/migrations/20261103170000_valid.sql"]);
  for(const entry of [
    dirent("20261103170000_hidden.sql","symlink"),
    dirent("other-migrations","directory"),
    dirent("20261103170000_hidden.SQL","file"),
    dirent("20261103170000_hidden.sql","unknown")
  ]) {
    assert.throws(()=>audit.migrationPathsFromEntries([...good,entry]),
      /Ambiguous migration entry/);
  }
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
test("pinned Git history verifies immutable baseline provenance instead of trusting manifest text", () => {
  const a="supabase/migrations/20261001_alpha.sql";
  const b="supabase/migrations/20261001_beta.sql";
  const shaA="a".repeat(40), shaB="b".repeat(40);
  const manifest={ migrationPaths:[a,b], blobShaByPath:{[a]:shaA,[b]:shaB} };
  const gitTree=`100644 blob ${shaA}\t${a}\n100644 blob ${shaB}\t${b}\n`;
  assert.deepEqual([...audit.parsePinnedMigrationTree(gitTree).keys()], [a,b]);
  assert.equal(audit.verifyBaselineFromGit(manifest,gitTree).ok,true);
  assert.deepEqual(audit.verifyBaselineFromGit(manifest,gitTree.replace(shaB,shaA)).mismatched,[b]);
  assert.deepEqual(audit.verifyBaselineFromGit(manifest,gitTree.split("\n")[0]+"\n").absent,[b]);
  assert.throws(() => audit.parsePinnedMigrationTree("100755 blob "+shaA+"\t"+a),/Unexpected Git migration-tree entry/);
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
test("active stock RPC guard checks real statements and rejects comments or truncation", () => {
  const name = "supabase/migrations/20261103170000_reserve.sql";
  const header = "create or replace function public.fabric_stock_reserve_v2(" +
    "p_fabric_id text,p_quantity_metres numeric,p_revision_id text," +
    "p_request_key text,p_requested_by text,p_source_reference text) " +
    "returns uuid language plpgsql as $body$";
  const valid = [
    "declare",
    "v_fabric text:=trim(coalesce(p_fabric_id,''));",
    "v_key text:=trim(coalesce(p_request_key,''));",
    "v_revision text:=trim(coalesce(p_revision_id,''));",
    "v_requester text:=trim(coalesce(p_requested_by,''));",
    "v_source text:=trim(coalesce(p_source_reference,''));",
    "begin",
    "if length(v_fabric)>160 or length(v_key)>180 or length(v_revision)>220",
    "or length(v_requester)>120 or length(v_source)>240 then",
    "raise exception 'reservation identity or evidence exceeds supported length';",
    "end if;",
    "return gen_random_uuid(); end;"
  ].join("\n");
  const wrap = body => header + "\n" + body + "\n$body$;";
  const inspect = body => audit.inspectReserveOverride([name], () => wrap(body));
  assert.equal(inspect(valid).hasStrictLengthGate, true);
  assert.equal(inspect(valid).usesLossyIdentifierTruncation, false);
  assert.equal(inspect("begin -- reservation identity or evidence exceeds supported length\nend;").hasStrictLengthGate, false);
  assert.equal(inspect(valid.replace("raise exception 'reservation identity or evidence exceeds supported length'",
    "raise exception 'other input error'")).hasStrictLengthGate, false);
  const truncated = valid.replace("v_key text:=trim(coalesce(p_request_key,''));",
    "v_key text:=left(trim(coalesce(p_request_key,'')),180);");
  assert.equal(inspect(truncated).hasStrictLengthGate, false);
  assert.equal(inspect(truncated).usesLossyIdentifierTruncation, true);
  assert.equal(inspect(valid.replace("if length(v_fabric)>160", "if false and length(v_fabric)>160")).hasStrictLengthGate, false);
});

test("new Supabase versions must be real timestamps and ordered after historical versions", () => {
  assert.equal(audit.validTimestampVersion("20261103162000"),true);
  assert.equal(audit.validTimestampVersion("20261103"),false);
  assert.equal(audit.validTimestampVersion("20261131090000"),false);
  assert.equal(audit.validTimestampVersion("20260229090000"),false);
  assert.equal(audit.validTimestampVersion("20240229090000"),true);
  assert.equal(audit.validTimestampVersion("20261103246000"),false);
  const baseline=["supabase/migrations/20261103_historical.sql"];
  const check=paths=>audit.inspectNewMigrationSafety(paths,baseline,()=>"-- no stock RPC override");
  assert.equal(check([...baseline,"supabase/migrations/20261103170000_valid.sql"]).ok,true);
  assert.deepEqual(check([...baseline,"supabase/migrations/20261102170000_backdated.sql"]).backdated,
    ["supabase/migrations/20261102170000_backdated.sql"]);
  assert.deepEqual(check([...baseline,"supabase/migrations/20261131170000_invalid.sql"]).invalidTimestamps,
    ["supabase/migrations/20261131170000_invalid.sql"]);
});
test("new stock reservation migration cannot silently disable strict identity checks", () => {
  const baseline=["supabase/migrations/20261103_historical.sql"];
  const file="supabase/migrations/20261103170000_reserve_gate.sql";
  const header="create or replace function public.fabric_stock_reserve_v2("+
    "p_fabric_id text,p_quantity_metres numeric,p_revision_id text,"+
    "p_request_key text,p_requested_by text,p_source_reference text)"+
    " returns uuid language plpgsql as $body$";
  const body=[
    "declare",
    "v_fabric text:=trim(coalesce(p_fabric_id,''));",
    "v_key text:=trim(coalesce(p_request_key,''));",
    "v_revision text:=trim(coalesce(p_revision_id,''));",
    "v_requester text:=trim(coalesce(p_requested_by,''));",
    "v_source text:=trim(coalesce(p_source_reference,''));",
    "begin",
    "if length(v_fabric)>160 or length(v_key)>180 or length(v_revision)>220",
    "or length(v_requester)>120 or length(v_source)>240 then",
    "raise exception 'reservation identity or evidence exceeds supported length';",
    "end if; return gen_random_uuid(); end;"
  ].join("\n");
  const inspect=sql=>audit.inspectNewMigrationSafety([...baseline,file],baseline,()=>sql);
  assert.equal(inspect(header+body+"$body$;").ok,true);
  const missing=body.replace("raise exception 'reservation identity or evidence exceeds supported length'",
    "raise exception 'generic error'");
  assert.deepEqual(inspect(header+missing+"$body$;").unsafeReserveOverrides,[file]);
  const truncation=body.replace("v_key text:=trim(coalesce(p_request_key,''));",
    "v_key text:=left(trim(coalesce(p_request_key,'')),180);");
  assert.deepEqual(inspect(header+truncation+"$body$;").unsafeReserveOverrides,[file]);
});

test("historical SQL remains pinned and new migrations are rejected by the release policy", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname,
    "../docs/TITAN_SUPABASE_MIGRATION_BASELINE.json"),"utf8")).migrationPaths;
  const paths = audit.collectMigrationPaths();
  const pathGate=audit.checkAgainstBaseline(paths,baseline);
  assert.deepEqual(pathGate.removed,[],"historical migration paths must never disappear");
  const newGate=audit.inspectNewMigrationSafety(paths,baseline,
    file => fs.readFileSync(path.join(__dirname,"..",file),"utf8"));
  const provenance=JSON.parse(fs.readFileSync(path.join(__dirname,
    "../docs/TITAN_SUPABASE_MIGRATION_BASELINE.json"),"utf8"));
  assert.equal(Object.keys(provenance.blobShaByPath).length, baseline.length);
  const hashes=audit.verifyHistoricalBlobs(baseline,provenance.blobShaByPath,
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
  const expected=pathGate.ok && newGate.ok ? 0 : 1;
  assert.equal(baselineRun.status,expected,
    "CLI enforcement must match computed fail-closed migration policy: "+baselineRun.stderr);
  if(expected!==0) assert.match(baselineRun.stderr,/BLOCKED:/);
});
