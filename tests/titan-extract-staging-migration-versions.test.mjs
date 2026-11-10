import test from 'node:test';
import assert from 'node:assert/strict';
import {extractUntrustedAppliedVersions as parse} from '../scripts/titan-extract-staging-migration-versions.mjs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const names=['fabric_stock_record','fabric_stock_reserve','fabric_stock_release','fabric_stock_consume_reservation','fabric_stock_record_v2','fabric_stock_reserve_v2','fabric_stock_release_v2','fabric_stock_consume_reservation_v2'];
const roles=['anon','authenticated','service_role'];
const rows=names.flatMap(name=>roles.map(role=>'stock_function_effective_execute|'+name+'||f|'+role+'|t|'));
const fixture=(versions=['20261103'])=>[
  'connection_identity|synthetic_database|synthetic_reader|127.0.0.1|5432|16.15',
  ...versions.map(v=>'migration_history|'+Buffer.from(v,'utf8').toString('hex')+'|'),...rows
].join('\n')+'\n';
const parseGood=raw=>parse(raw,{psqlExitCode:0});

test('complete synthetic capture exports only untrusted version-only observations',()=>{
  const report=parseGood(fixture(['20261103','20261104010101']));
  assert.deepEqual(report.applied_versions,[{version:'20261103'},{version:'20261104010101'}]);
  assert.equal(report.expected_permission_pairs_observed,24);
  assert.equal(report.staging_project_verified,false);
  assert.equal(report.sql_source_identity_verified,false);
  assert.equal(report.release_ready,false);
  assert.equal(JSON.stringify(report).includes('synthetic_database'),false);
});
test('duplicate applied versions retained without fabricated SQL identities',()=>{
  const report=parseGood(fixture(['20261103','20261103']));
  assert.deepEqual(report.duplicate_applied_versions,[{version:'20261103',count:2}]);
  assert.deepEqual(report.applied_versions,[{version:'20261103'},{version:'20261103'}]);
});
test('absent history is not mistaken for verified deployment',()=>{
  const report=parseGood(fixture([]));
  assert.deepEqual(report.applied_versions,[]);
  assert.equal(report.release_ready,false);
});
test('psql process failure blocks even if partial results resemble a complete capture',()=>{
  assert.throws(()=>parse(fixture(),{psqlExitCode:3}),/did not complete/);
  assert.throws(()=>parse(fixture()),/did not complete/);
});
test('missing or duplicated matrix observation rejects truncated or ambiguous output',()=>{
  assert.throws(()=>parseGood(fixture().replace(rows[0]+'\n','')),/partial/);
  assert.throws(()=>parseGood(fixture()+rows[0]+'\n'),/repeated/);
});
test('malformed role permissions never become an implicit grant',()=>{
  assert.throws(()=>parseGood(fixture().replace(rows[0],rows[0].replace('|f|anon|t|','|f|anon|t|t'))),/inconsistent/);
  assert.throws(()=>parseGood(fixture().replace(rows[0],rows[0].replace('|t|','|unknown|'))),/inconsistent/);
});
test('present function and registered role cannot have UNKNOWN EXECUTE permission',()=>{
  const altered=rows[0].replace(
    'fabric_stock_record||f|anon|t|',
    'fabric_stock_record|fabric_stock_record(text)|t|anon|t|');
  assert.throws(()=>parseGood(fixture().replace(rows[0],altered)),/inconsistent/);
});
test('contradictory function signatures across roles fail closed',()=>{
  const altered=rows[0].replace(
    'fabric_stock_record||f|anon|t|',
    'fabric_stock_record|fabric_stock_record(text)|t|anon|t|t');
  assert.throws(()=>parseGood(fixture().replace(rows[0],altered)),/signature matrix/);
});
test('contradictory role existence across functions fails closed',()=>{
  const altered=rows[0].replace('|anon|t|','|anon|f|');
  assert.throws(()=>parseGood(fixture().replace(rows[0],altered)),/role presence/);
});
test('genuine complete multi-overload evidence remains a non-approving projection',()=>{
  const withoutReserve=fixture().split('\n').filter(line=>
    !line.startsWith('stock_function_effective_execute|fabric_stock_reserve_v2|')).join('\n');
  const observed=roles.flatMap(role=>[
    'stock_function_effective_execute|fabric_stock_reserve_v2|fabric_stock_reserve_v2(text)|t|'+role+'|t|f',
    'stock_function_effective_execute|fabric_stock_reserve_v2|fabric_stock_reserve_v2(integer)|t|'+role+'|t|t'
  ]);
  const report=parseGood(withoutReserve+'\n'+observed.join('\n')+'\n');
  assert.equal(report.expected_permission_pairs_observed,24);
  assert.equal(report.release_ready,false);
});
test('a function cannot be both absent and installed in one capture',()=>{
  const installed='stock_function_effective_execute|fabric_stock_record|fabric_stock_record(text)|t|anon|t|t';
  assert.throws(()=>parseGood(fixture()+installed+'\n'),/contradictory absent\/present/);
  assert.throws(()=>parseGood(fixture().replace(rows[0],installed+'\n'+rows[0])),/contradictory absent\/present/);
});
test('missing role with installed RPC remains an explicit non-approving observation',()=>{
  let captured=fixture().replace(/\|service_role\|t\|/g,'|service_role|f|');
  for(const role of roles){
    const absent='stock_function_effective_execute|fabric_stock_reserve_v2||f|'+role+'|'+(role==='service_role'?'f':'t')+'|';
    const installed='stock_function_effective_execute|fabric_stock_reserve_v2|fabric_stock_reserve_v2(text)|t|'+role+'|'+(role==='service_role'?'f':'t')+'|'+(role==='service_role'?'':'t');
    assert.ok(captured.includes(absent));
    captured=captured.replace(absent,installed);
  }
  const report=parseGood(captured);
  assert.equal(report.expected_permission_pairs_observed,24);
  assert.equal(report.sql_source_identity_verified,false);
  assert.equal(report.release_ready,false);
});
test('versions must have supported 8 or 14 digit formats',()=>{
  for(const bad of ['2026','20261103000','20261103x','202611030000000'])
    assert.throws(()=>parseGood(fixture([bad])),/malformed migration/);
});
test('raw or malformed hex migration-version data fails closed',()=>{
  const valid=fixture();
  const encoded=Buffer.from('20261103').toString('hex');
  assert.throws(()=>parseGood(valid.replace('migration_history|'+encoded+'|',
    'migration_history|20261103|')),/malformed migration/);
  assert.throws(()=>parseGood(valid.replace('migration_history|'+encoded+'|',
    'migration_history|'+encoded+'\nmigration_history|20261110010101|')),
    /malformed migration/);
  assert.throws(()=>parseGood(valid.replace('migration_history|'+encoded+'|',
    'migration_history|'+Buffer.from('20261103\nmigration_history|20261110010101|').toString('hex')+'|')),
    /malformed migration/);
});
test('connection fingerprint is mandatory and unique',()=>{
  const s=fixture();const head=s.split('\n')[0];
  assert.throws(()=>parseGood(s.replace(head+'\n','')),/unexpected history row order/);
  assert.throws(()=>parseGood(head+'\n'+s),/partial/);
});
test('rendered RPC body text cannot forge an applied migration-history record',()=>{
  const header='stock_function_definition|fabric_stock_reserve_v2(text)|owner|t|v||hash|CREATE FUNCTION';
  const injected=fixture().replace(rows[0],
    header+'\nBEGIN\nmigration_history|'+Buffer.from('20261110010101').toString('hex')+'|\nEND;\n'+rows[0]);
  assert.throws(()=>parseGood(injected),/unexpected history row order/);
});
test('function-definition sections cannot appear after the permission matrix',()=>{
  const late='stock_function_definition|fabric_stock_reserve_v2(text)|owner|t|v||hash|CREATE FUNCTION';
  assert.throws(()=>parseGood(fixture()+late+'\n'),/unexpected function definition row order/);
});
test('function definition multiline body is ignored, not published',()=>{
  const s=fixture().replace(rows[0],"stock_function_definition|fabric_stock_reserve_v2(text)|synthetic_owner|t|v||hash|CREATE FUNCTION\nPRIVATE-SYNTHETIC-BODY\nEND;\n"+rows[0]);
  assert.equal(JSON.stringify(parseGood(s)).includes('PRIVATE-SYNTHETIC'),false);
});
test('CLI outputs only sanitized JSON and always exits nonzero, never authorizes release',()=>{
  const dir=mkdtempSync(join(tmpdir(),'titan-psql-offline-'));
  try{
    const file=join(dir,'private.txt');writeFileSync(file,fixture());
    const bin=fileURLToPath(new URL('../scripts/titan-extract-staging-migration-versions.mjs',import.meta.url));
    const yes=spawnSync(process.execPath,[bin,file,'0'],{encoding:'utf8'});
    assert.equal(yes.status,2,yes.stderr);
    const result=JSON.parse(yes.stdout);
    assert.equal(result.release_ready,false);
    assert.equal(result.applied_versions[0].version,'20261103');
    assert.equal(yes.stdout.includes('synthetic_database'),false);
    const no=spawnSync(process.execPath,[bin,file,'1'],{encoding:'utf8'});
    assert.equal(no.status,2);
    assert.equal(no.stdout,'');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('malformed, oversized or embedded-NUL capture is blocked',()=>{
  assert.throws(()=>parseGood(fixture()+'\0'),/invalid/);
  assert.throws(()=>parseGood('x'.repeat(4*1024*1024+1)),/invalid/);
});