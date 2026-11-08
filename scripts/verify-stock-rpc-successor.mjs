#!/usr/bin/env node
// Read-only candidate source parity; never grants review or release approval.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const PIN = {
  repo:'slokpatel-crypto/' + 'l' + 'linenearth-designer',
  main:'4dd8020abd83429449ff53ea5bb71b046394d86e',
  basePr:880,
  baseBranch:'titan-central-retire-legacy-stock-execute-20261103',
  baseSha:'6730aba8198018b57db70eda1cadf9dbc41d5dc3',
  candidatePr:910,
  candidateBranch:'titan-central-stock-rpc-static-join-audit-20261108',
  candidateSha:'997326184b76b9937ab8ff2d5fa1ca0e007ece37',
  files:{
    'scripts/audit-retired-stock-rpc-callers.mjs':{
      old:'f71e2d6b3501805585e8f6c055db7dda4dbb0bac',
      latest:'64073718c9c1b927a9d23cf0ba6b7ba902e8fe75'
    },
    'scripts/test-retired-stock-rpc-caller-audit.mjs':{
      old:'532e733606eff0f34e58ff9178654825bb85b5f9',
      latest:'2aa53ab2d40f2022842634b6d994a8ef63df39ee'
    }
  }
};
// The exact check set recorded for the immutable candidate head. Any new,
// missing, running, unassociated or failed check must receive a fresh review.
export const REQUIRED_CANDIDATE_CHECKS = Object.freeze([
  'build',
  'studio',
  'Disposable PostgreSQL stock reservation invariants',
  'Disposable PostgreSQL legacy stock RPC ACL'
]);
export function gitBlobSha(bytes) {
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
export async function verifyCandidate(getJson, pin=PIN) {
  const prefix='/repos/'+pin.repo;
  const get=path=>getJson(prefix+path);
  const pr=n=>'/pulls/'+n;
  const ref=name=>'/git/ref/heads/'+name;
  async function readHeads() {
    const [b,c,m,br,cr]=await Promise.all([
      get(pr(pin.basePr)),get(pr(pin.candidatePr)),
      get('/branches/main'),get(ref(pin.baseBranch)),get(ref(pin.candidateBranch))
    ]);
    assert.equal(m?.commit?.sha,pin.main,'Main moved; re-review');
    for(const [p,num,branch,sha] of [[b,pin.basePr,pin.baseBranch,pin.baseSha],[c,pin.candidatePr,pin.candidateBranch,pin.candidateSha]]) {
      assert.equal(p?.number,num,'Unexpected PR');
      assert.equal(p?.state,'open','Source PR closed');
      assert.equal(p?.draft,true,'Source PR not draft');
      assert.equal(p?.head?.sha,sha,'Source PR head moved');
      assert.equal(p?.head?.ref,branch,'Source PR branch changed');
      assert.equal(p?.head?.repo?.full_name,pin.repo,'Source PR origin changed');
      assert.equal(p?.base?.repo?.full_name,pin.repo,'Source PR base repository changed');
    }
    assert.equal(b?.base?.ref,'main','Base PR retargeted');
    assert.equal(c?.base?.ref,pin.baseBranch,'Candidate PR retargeted');
    assert.equal(c?.base?.sha,pin.baseSha,'Candidate PR base commit changed');
    assert.equal(br?.ref,'refs/heads/'+pin.baseBranch,'Base branch identity changed');
    assert.equal(br?.object?.sha,pin.baseSha,'Base live branch moved');
    assert.equal(cr?.ref,'refs/heads/'+pin.candidateBranch,'Candidate branch identity changed');
    assert.equal(cr?.object?.sha,pin.candidateSha,'Candidate live branch moved');
  }
  await readHeads();
  const files=await get(pr(pin.candidatePr)+'/files?per_page=100&page=1');
  const names=Object.keys(pin.files);
  assert.ok(Array.isArray(files),'Missing changed-file list');
  assert.equal(files.length,names.length,'Unexpected number of changed files');
  const seen=new Set();
  for(const entry of files){
    assert.ok(entry&&typeof entry.filename==='string','Invalid changed-file metadata');
    assert.ok(!seen.has(entry.filename),'Duplicate changed-file entry');
    seen.add(entry.filename);
    assert.ok(Object.hasOwn(pin.files,entry.filename),'Unreviewed changed file');
    assert.equal(entry.status,'modified','Unexpected add/delete/rename');
    assert.equal(entry.previous_filename,undefined,'Unreviewed rename');
    assert.equal(entry.sha,pin.files[entry.filename].latest,'Candidate Git blob moved');
  }
  for(const [path,versions] of Object.entries(pin.files)){
    for(const [type,sha] of Object.entries(versions)){
      // A valid Git blob existing in the object store does NOT prove it belongs
      // to the pinned predecessor or candidate commit. Bind each path to its
      // exact commit's immutable tree before trusting the blob identities.
      const commit=type==='old' ? pin.baseSha : pin.candidateSha;
      const entry=await get('/contents/'+path+'?ref='+commit);
      assert.equal(entry?.type,'file',path+' '+type+' path is not a regular file');
      assert.equal(entry?.path,path,'Commit file path changed');
      assert.equal(entry?.sha,sha,path+' '+type+' commit tree does not reference pinned blob');
      assert.match(sha,/^[a-f0-9]{40}$/,'Invalid pinned Git blob');
      const blob=await get('/git/blobs/'+sha);
      assert.equal(blob?.sha,sha,path+' '+type+' Git blob identity drift');
      assert.equal(blob?.encoding,'base64','Unexpected blob encoding');
      assert.equal(typeof blob?.content,'string','Missing Git blob bytes');
      const base64=blob.content.replace(/\s/g,'');
      assert.match(base64,/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,'Invalid base64');
      const bytes=Buffer.from(base64,'base64');
      assert.equal(bytes.length,blob.size,'Git blob byte size changed');
      assert.equal(gitBlobSha(bytes),sha,'Git blob bytes do not match pinned identity');
    }
  }
  // Check-runs are only supporting evidence for this immutable PR head.
  // A green predecessor, partial pagination or run not bound to this PR is not enough.
  const checks=await get('/commits/'+pin.candidateSha+'/check-runs?per_page=100');
  assert.equal(checks?.total_count,REQUIRED_CANDIDATE_CHECKS.length,
    'Candidate CI set changed; independently re-review');
  assert.ok(Array.isArray(checks?.check_runs),'Missing candidate exact-head checks');
  assert.equal(checks.check_runs.length,REQUIRED_CANDIDATE_CHECKS.length,
    'Incomplete candidate CI pagination');
  const namesSeen=new Set();
  for(const check of checks.check_runs){
    assert.ok(REQUIRED_CANDIDATE_CHECKS.includes(check?.name),'Unexpected candidate check');
    assert.ok(!namesSeen.has(check.name),'Duplicate candidate check');
    namesSeen.add(check.name);
    assert.equal(check.head_sha,pin.candidateSha,'Candidate CI references wrong head');
    assert.equal(check.status,'completed','Candidate CI incomplete');
    assert.equal(check.conclusion,'success','Candidate CI unsuccessful');
    assert.ok(Array.isArray(check.pull_requests) &&
      check.pull_requests.some(p=>p.number===pin.candidatePr),
      'Candidate CI not associated with approved PR');
  }
  await readHeads();
  return {source_bytes_verified:true,source_files:names.length,candidate_sha:pin.candidateSha,
    candidate_ci_verified:true,candidate_ci_count:checks.check_runs.length,
    review_status:'REVIEW_REQUIRED',release_ready:false,
    note:'Automated byte identity is not independent human review, staging evidence or permission to merge/deploy.'};
}
async function githubGet(path){
  const token=process.env.GH_TOKEN;
  if(!token)throw Error('GH_TOKEN required for read-only GitHub proof');
  const response=await fetch('https://api.github.com'+path,{headers:{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'
  },signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('GitHub read failed: HTTP '+response.status);
  return response.json();
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  verifyCandidate(githubGet).then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(err=>{console.error('BLOCKED: '+err.message);process.exitCode=1;});
}
