import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySnapshotPair,RPC_SIGNATURES,ACL_ROLES} from './stock-acl-snapshot-evidence.mjs';

function makeRows(retiredServiceGranted) {
  const result=[];
  for (const [version,signature] of RPC_SIGNATURES) {
    for (const role of ACL_ROLES) {
      const granted = version === 'v2'
        ? role === 'service_role'
        : role === 'service_role' && retiredServiceGranted;
      result.push([version,signature,role,granted?'EXECUTE':'NO_EXECUTE'].join('|'));
    }
  }
  return result;
}
const before=makeRows(true), after=makeRows(false);
const rows=(lines)=>lines.join('\n')+'\n';
function change(lines, from, to) {
  const index=lines.findIndex(s=>s===from);
  assert.ok(index>=0,'test fixture missing target row');
  const replacement=[...lines];
  replacement[index]=to;
  return replacement;
}
function proveBlocked(name, first, second, match) {
  test(name,()=>assert.throws(()=>verifySnapshotPair(rows(first),rows(second)),match));
}

test('synthetic historical privileges revoked for four v1 signatures',()=>{
  assert.deepEqual(verifySnapshotPair(rows(before),rows(after)),
    {beforeRows:32,afterRows:32,retiredRPCs:4,activeRPCs:4});
});
test('already-revoked staging baseline supports safe repeated retirement',()=>{
  assert.equal(verifySnapshotPair(rows(after),rows(after)).afterRows,32);
});
test('evidence is independent of input row ordering',()=>{
  assert.equal(verifySnapshotPair(rows([...before].reverse()),rows([...after].reverse())).beforeRows,32);
});
const grant='v1|public.fabric_stock_record(text,text,numeric,text)|service_role|EXECUTE';
const deny='v1|public.fabric_stock_record(text,text,numeric,text)|service_role|NO_EXECUTE';
proveBlocked('v1 service-role grant after retirement fails',before,change(after,deny,grant),/remains executable/);
const v1anon='v1|public.fabric_stock_release(uuid,text)|anon|NO_EXECUTE';
proveBlocked('new v1 anon grant after retirement fails',before,
  change(after,v1anon,v1anon.replace('NO_EXECUTE','EXECUTE')),/remains executable/);
proveBlocked('preexisting non-service legacy privileges fail closed',
  change(before,v1anon,v1anon.replace('NO_EXECUTE','EXECUTE')),after,/unsafe non-service/);
const publicV1='v1|public.fabric_stock_reserve(text,numeric,text,text)|PUBLIC|NO_EXECUTE';
proveBlocked('inherited public v1 execution fails closed',
  before,change(after,publicV1,publicV1.replace('NO_EXECUTE','EXECUTE')),/remains executable/);
const v2Service='v2|public.fabric_stock_record_v2(text,text,numeric,text,text,text)|service_role|EXECUTE';
proveBlocked('authorized v2 service role cannot be revoked',
  before,change(after,v2Service,v2Service.replace('EXECUTE','NO_EXECUTE')),/v2 privilege drift/);
const v2Customer='v2|public.fabric_stock_release_v2(uuid,text,text,text)|authenticated|NO_EXECUTE';
proveBlocked('unprivileged v2 authenticated grant is prohibited',
  before,change(after,v2Customer,v2Customer.replace('NO_EXECUTE','EXECUTE')),/v2 privilege drift/);
proveBlocked('pre-migration v2 permission drift blocks approval',
  change(before,v2Service,v2Service.replace('EXECUTE','NO_EXECUTE')),after,/v2 privilege drift/);
proveBlocked('empty before file fails',[],after,/empty ACL snapshot/);
proveBlocked('missing ACL row fails',before,after.slice(1),/expected 32 ACL rows/);
proveBlocked('duplicate ACL key fails',before,change(after,after[0],after[1]),/duplicate ACL key|missing ACL key/);
proveBlocked('unexpected function signature fails',before,
  change(after,after[0],after[0].replace('fabric_stock_','unexpected_')),/unexpected ACL key/);
proveBlocked('missing role fails',before,
  change(after,after[0],after[0].replace('|PUBLIC|','|missing_role|')),/unexpected ACL key/);
proveBlocked('explicit missing-function evidence fails',before,
  change(after,after[0],after[0].replace('NO_EXECUTE','MISSING_FUNCTION')),/invalid ACL evidence/);
proveBlocked('explicit missing-role evidence fails',before,
  change(after,after[0],after[0].replace('NO_EXECUTE','MISSING_ROLE')),/invalid ACL evidence/);
proveBlocked('malformed delimiter fails',before,
  change(after,after[0],after[0].replace('|',';')),/malformed four-column/);
proveBlocked('extra trailing ACL row fails',before,[...after,after[0]],/expected 32 ACL rows/);
