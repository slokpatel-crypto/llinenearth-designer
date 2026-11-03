"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const {validateSnapshot,compareHistory}=require("./reconcile-supabase-migration-history.cjs");

const file=(version,suffix)=>"supabase/migrations/"+version+"_"+suffix+".sql";
test("accepts only bounded, explicitly staging and read-only version-only snapshots",()=>{
  const snap={environment:"staging",readOnly:true,appliedVersions:["20260920","20261103155501"]};
  assert.deepEqual(validateSnapshot(snap),snap.appliedVersions);
  for(const bad of [
    {...snap,readOnly:false},
    {...snap,environment:"production"},
    {...snap,appliedVersions:["abc"]},
    {...snap,appliedVersions:[20261103155501]},
    {...snap,appliedVersions:[],apiKey:"secret"},
    {...snap,appliedVersions:[],connectionString:"postgres://invalid"},
    {...snap,appliedVersions:["2026-11-03"]}
  ])assert.throws(()=>validateSnapshot(bad),/Snapshot/);
});
test("history report fails closed on duplicate local versions and ambiguous applied history",()=>{
  const a=file("20261103","alpha"),b=file("20261103","beta");
  const r=compareHistory([a,b],["20261103","20261103","20990101000000"]);
  assert.equal(r.status,"BLOCKED");
  assert.equal(r.localCollisionGroups.length,1);
  assert.deepEqual(r.appliedCollisionVersions,["20261103"]);
  assert.deepEqual(r.duplicateAppliedVersions,["20261103"]);
  assert.deepEqual(r.unknownAppliedVersions,["20990101000000"]);
  assert.deepEqual(r.nonstandardAppliedVersions,["20261103"]);
});
test("unique standard filenames and matching applied versions only allow independent review",()=>{
  const a=file("20261103160000","alpha"),b=file("20261103170000","beta");
  const complete=compareHistory([a,b],["20261103160000","20261103170000"]);
  assert.equal(complete.status,"STRUCTURALLY_CONSISTENT_REQUIRES_INDEPENDENT_REVIEW");
  assert.deepEqual(complete.unappliedLocalPaths,[]);
  const pending=compareHistory([a,b],["20261103160000"]);
  assert.equal(pending.status,"STRUCTURALLY_CONSISTENT_REQUIRES_INDEPENDENT_REVIEW");
  assert.deepEqual(pending.unappliedLocalPaths,[b]);
  assert.equal(compareHistory([a,b],["20261103160000","20261103180000"]).status,"BLOCKED");
});
test("no snapshot never passes; verified staging-only snapshot still blocks current duplicate legacy history",()=>{
  const cmd=path.resolve(__dirname,"reconcile-supabase-migration-history.cjs");
  const missing=spawnSync(process.execPath,[cmd],{encoding:"utf8"});
  assert.equal(missing.status,2);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"titan-staging-version-only-"));
  try{
    const p=path.join(dir,"versions.json");
    fs.writeFileSync(p,JSON.stringify({environment:"staging",readOnly:true,appliedVersions:["20261103"]}));
    const out=spawnSync(process.execPath,[cmd,"--snapshot",p],{encoding:"utf8",maxBuffer:1024*1024});
    assert.equal(out.status,1,out.stderr);
    const report=JSON.parse(out.stdout);
    assert.equal(report.status,"BLOCKED");
    assert.ok(report.localCollisionGroups.length>=14);
    assert.ok(report.localNonstandardFiles.length>=58);
    assert.equal(report.appliedCollisionVersions.includes("20261103"),true);
    fs.writeFileSync(p,JSON.stringify({environment:"production",readOnly:true,appliedVersions:[]}));
    const noProd=spawnSync(process.execPath,[cmd,"--snapshot",p],{encoding:"utf8"});
    assert.equal(noProd.status,2);
    assert.match(noProd.stderr,/BLOCKED/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
