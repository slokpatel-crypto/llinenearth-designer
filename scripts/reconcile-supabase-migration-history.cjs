#!/usr/bin/env node
"use strict";
// READ ONLY: compare a separately approved staging migration-history export with
// repository SQL names. Never connects to Supabase, repairs history or writes SQL.
const fs = require("node:fs");
const path = require("node:path");
const { collectMigrationPaths, inspectMigrations, migrationVersion,
  validTimestampVersion } = require("./audit-supabase-migration-versions.cjs");

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
      snapshot.environment !== "staging" || snapshot.readOnly !== true ||
      !Array.isArray(snapshot.appliedVersions) || snapshot.appliedVersions.length > 5000 ||
      snapshot.appliedVersions.some(v=>typeof v !== "string" || !/^\d{8}(\d{6})?$/.test(v))) {
    throw Error("Snapshot must be approved staging-only JSON: environment=staging, readOnly=true, appliedVersions=[numeric 8/14-digit versions]");
  }
  if (Object.keys(snapshot).some(k=>!["environment","readOnly","appliedVersions"].includes(k))) {
    throw Error("Snapshot contains unsupported fields; never include keys, connection strings or customer data");
  }
  return snapshot.appliedVersions;
}
function compareHistory(files, appliedVersions) {
  const scan=inspectMigrations(files);
  const local=files.map(f=>({path:f,version:migrationVersion(f)}));
  const localVersions=new Map();
  for (const file of local) if(file.version) {
    localVersions.set(file.version, [...(localVersions.get(file.version)||[]),file.path]);
  }
  const applied=new Set(appliedVersions);
  const duplicatesApplied=[...new Set(appliedVersions.filter((v,i)=>appliedVersions.indexOf(v)!==i))].sort();
  const unknownApplied=[...applied].filter(v=>!localVersions.has(v)).sort();
  const unapplied=local.filter(f=>!applied.has(f.version)).map(f=>f.path);
  const collisionApplied=scan.duplicates.filter(d=>applied.has(d.version)).map(d=>d.version);
  const nonstandardApplied=[...applied].filter(v=>!validTimestampVersion(v)).sort();
  const blocked=scan.duplicates.length>0 || scan.nonstandardVersions.length>0 ||
    scan.invalidNames.length>0 || unknownApplied.length>0 ||
    duplicatesApplied.length>0 || nonstandardApplied.length>0;
  return {
    status:blocked?"BLOCKED":"STRUCTURALLY_CONSISTENT_REQUIRES_INDEPENDENT_REVIEW",
    evidenceScope:"static read-only staging snapshot; no schema-drift/ACL/deploy approval",
    localFileCount:scan.total,localDistinctVersions:scan.distinctVersions,
    appliedVersionCount:appliedVersions.length,localCollisionGroups:scan.duplicates,
    localNonstandardFiles:scan.nonstandardVersions,
    localInvalidNames:scan.invalidNames,duplicateAppliedVersions:duplicatesApplied,
    unknownAppliedVersions:unknownApplied,nonstandardAppliedVersions:nonstandardApplied,
    appliedCollisionVersions:collisionApplied,
    unappliedLocalPaths:unapplied
  };
}
function run(args=process.argv.slice(2)){
  if(args.length!==2 || args[0]!=="--snapshot" || !args[1]) {
    console.error("Usage: node scripts/reconcile-supabase-migration-history.cjs --snapshot /path/to/approved-staging-version-only.json");
    return 2;
  }
  let snapshot;
  try{
    const stat=fs.statSync(args[1]);
    if(!stat.isFile() || stat.size > 262144) throw Error("Snapshot must be a regular JSON file at most 256 KiB");
    snapshot=JSON.parse(fs.readFileSync(args[1],"utf8"));
    const applied=validateSnapshot(snapshot);
    const result=compareHistory(collectMigrationPaths(),applied);
    console.log(JSON.stringify(result,null,2));
    if(result.status==="BLOCKED"){
      console.error("BLOCKED: version collisions, nonstandard versions or remote/local mismatch. No migration commands executed.");
      return 1;
    }
    console.log("STRUCTURALLY CONSISTENT ONLY: review exact SQL order, staging schema drift, rollback and ACL before any deployment.");
    return 0;
  }catch(error){
    console.error("BLOCKED: invalid or inaccessible staging-history snapshot: "+error.message);
    return 2;
  }
}
if(require.main===module)process.exitCode=run();
module.exports={validateSnapshot,compareHistory,run};
