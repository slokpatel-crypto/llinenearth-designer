import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCandidate,gitBlobSha} from '../scripts/verify-stock-rpc-successor.mjs';
const blob=s=>{const b=Buffer.from(s);return {sha:gitBlobSha(b),encoding:'base64',size:b.length,content:b.toString('base64')};};
const old=blob('old content\n'), latest=blob('revised content\n');
const pin={
  repo:'sample/titan',main:'a'.repeat(40),basePr:880,baseBranch:'base',baseSha:'b'.repeat(40),
  candidatePr:910,candidateBranch:'candidate',candidateSha:'c'.repeat(40),
  files:{'scripts/file.mjs':{old:old.sha,latest:latest.sha}}
};
const candidateNames=['build','studio','Disposable PostgreSQL stock reservation invariants','Disposable PostgreSQL legacy stock RPC ACL'];
const ciRuns=candidateNames.map(name=>({name,head_sha:pin.candidateSha,status:'completed',conclusion:'success',pull_requests:[{number:pin.candidatePr}]}));
const api='/repos/'+pin.repo;
const basePr={number:880,state:'open',draft:true,head:{ref:'base',sha:pin.baseSha,repo:{full_name:pin.repo}},base:{ref:'main',repo:{full_name:pin.repo}}};
const candidatePr={number:910,state:'open',draft:true,head:{ref:'candidate',sha:pin.candidateSha,repo:{full_name:pin.repo}},base:{ref:'base',sha:pin.baseSha,repo:{full_name:pin.repo}}};
function fixture(overrides={}){
  const values={
    [api+'/pulls/880']:basePr,
    [api+'/pulls/910']:candidatePr,
    [api+'/branches/main']:{commit:{sha:pin.main}},
    [api+'/git/ref/heads/base']:{ref:'refs/heads/base',object:{sha:pin.baseSha}},
    [api+'/git/ref/heads/candidate']:{ref:'refs/heads/candidate',object:{sha:pin.candidateSha}},
    [api+'/pulls/910/files?per_page=100&page=1']:[{filename:'scripts/file.mjs',status:'modified',sha:latest.sha}],
    [api+'/git/blobs/'+old.sha]:old,
    [api+'/git/blobs/'+latest.sha]:latest,
    [api+'/commits/'+pin.candidateSha+'/check-runs?per_page=100']:{total_count:4,check_runs:ciRuns},...overrides
  };
  return async path=>{assert.ok(Object.hasOwn(values,path),'Unexpected lookup '+path);return structuredClone(values[path]);};
}
test('snapshot proof always remains REVIEW_REQUIRED and never release-ready',async()=>{
  const r=await verifyCandidate(fixture(),pin);
  assert.equal(r.source_bytes_verified,true);
  assert.equal(r.source_files,1);
  assert.equal(r.review_status,'REVIEW_REQUIRED');
  assert.equal(r.release_ready,false);
});
test('unreviewed files, rename, deletion, and modified sha fail closed',async()=>{
  const key=api+'/pulls/910/files?per_page=100&page=1';
  for(const files of [[],[{filename:'scripts/other.mjs',sha:latest.sha,status:'modified'}],
    [{filename:'scripts/file.mjs',sha:latest.sha,status:'added'}],
    [{filename:'scripts/file.mjs',sha:old.sha,status:'modified'}],
    [{filename:'scripts/file.mjs',sha:latest.sha,status:'modified',previous_filename:'old-file'}]]){
    await assert.rejects(verifyCandidate(fixture({[key]:files}),pin));
  }
});
test('moved heads, changed base, closed or non-draft PRs fail',async()=>{
  await assert.rejects(verifyCandidate(fixture({[api+'/branches/main']:{commit:{sha:'z'}}}),pin),/Main moved/);
  await assert.rejects(verifyCandidate(fixture({[api+'/pulls/910']:{...candidatePr,head:{...candidatePr.head,sha:'d'.repeat(40)}}}),pin),/head moved/);
  await assert.rejects(verifyCandidate(fixture({[api+'/pulls/910']:{...candidatePr,base:{...candidatePr.base,sha:'d'.repeat(40)}}}),pin),/base commit changed/);
  await assert.rejects(verifyCandidate(fixture({[api+'/pulls/880']:{...basePr,draft:false}}),pin),/not draft/);
  await assert.rejects(verifyCandidate(fixture({[api+'/pulls/910']:{...candidatePr,state:'closed'}}),pin),/closed/);
});
test('tampered Git blob content, size and encoding are all rejected',async()=>{
  await assert.rejects(verifyCandidate(fixture({[api+'/git/blobs/'+old.sha]:{...old,content:blob('malicious').content,size:9}}),pin),/bytes do not match/);
  await assert.rejects(verifyCandidate(fixture({[api+'/git/blobs/'+latest.sha]:{...latest,size:1}}),pin),/size changed/);
  await assert.rejects(verifyCandidate(fixture({[api+'/git/blobs/'+latest.sha]:{...latest,encoding:'utf8'}}),pin),/encoding/);
});
test('second read fence detects moving candidate branch mid-inspection',async()=>{
  const get=fixture();let count=0;
  await assert.rejects(verifyCandidate(async path=>{
    if(path===api+'/git/ref/heads/candidate'&&++count===2)
      return {ref:'refs/heads/candidate',object:{sha:'e'.repeat(40)}};
    return get(path);
  },pin),/Candidate live branch moved/);
});

test('candidate CI must be complete, successful, and tied to approved PR head',async()=>{
  const key=api+'/commits/'+pin.candidateSha+'/check-runs?per_page=100';
  const bad=[
    {total_count:4,check_runs:ciRuns.slice(0,3)},
    {total_count:3,check_runs:ciRuns.slice(0,3)},
    {total_count:4,check_runs:[...ciRuns.slice(0,3),{...ciRuns[3],conclusion:'failure'}]},
    {total_count:4,check_runs:[...ciRuns.slice(0,3),{...ciRuns[3],status:'in_progress',conclusion:null}]},
    {total_count:4,check_runs:[...ciRuns.slice(0,3),{...ciRuns[3],head_sha:'d'.repeat(40)}]},
    {total_count:4,check_runs:[...ciRuns.slice(0,3),{...ciRuns[3],pull_requests:[]}]},
    {total_count:4,check_runs:[...ciRuns.slice(0,3),{...ciRuns[3],name:'unreviewed-other-job'}]},
    {total_count:4,check_runs:[...ciRuns.slice(0,3),{...ciRuns[3],name:ciRuns[0].name}]}
  ];
  for(const report of bad) await assert.rejects(verifyCandidate(fixture({[key]:report}),pin));
});
test('CI verification never upgrades handoff to approved release',async()=>{
  const report=await verifyCandidate(fixture(),pin);
  assert.equal(report.candidate_ci_verified,true);
  assert.equal(report.candidate_ci_count,4);
  assert.equal(report.release_ready,false);
  assert.equal(report.review_status,'REVIEW_REQUIRED');
});
