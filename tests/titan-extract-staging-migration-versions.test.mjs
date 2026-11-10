import test from 'node:test';
import assert from 'node:assert/strict';
import {extractUntrustedAppliedVersions as parse} from '../scripts/titan-extract-staging-migration-versions.mjs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const names=['fabric_stock_record','fabric_stock_reserve','fabric_stock_release','fabric_stock_consume_reservation','fabric_stock_record_v2','fabric_stock_reserve_v2','fabric_stock_release_v2','fabric_stock_consume_reservation_v2'];
const roles=['anon','authenticated','service_role'];
const endMarker='probe_complete|TITAN_STAGING_READONLY_V1';
const hex=value=>Buffer.from(value,'utf8').toString('hex');
const definition=(signature,body='CREATE FUNCTION synthetic',owner='synthetic_owner',settings='')=>
  ['stock_function_definition',hex(signature),hex(owner),'f','v',hex(settings),
   createHash('md5').update(body).digest('hex'),hex(body)].join('|');
const installedRow=(name,signature,role,roleExists='t',execute='t')=>
  'stock_function_effective_execute|'+name+'|'+hex(signature)+'|t|'+role+'|'+roleExists+'|'+(roleExists==='t'?execute:'');
const insertDefinition=(raw,definitionRow)=>raw.replace(rows[0],definitionRow+'\n'+rows[0]);
const rows=names.flatMap(name=>roles.map(role=>'stock_function_effective_execute|'+name+'||f|'+role+'|t|'));
const fixture=(versions=['20261103'])=>[
  'connection_identity|'+Buffer.from('synthetic_database').toString('hex')+'|'+Buffer.from('synthetic_reader').toString('hex')+'|127.0.0.1|5432|16.15',
  ...versions.map(v=>'migration_history|'+Buffer.from(v,'utf8').toString('hex')+'|'),...rows,endMarker
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
  assert.throws(()=>parseGood(fixture().replace(endMarker,rows[0]+'\n'+endMarker)),/repeated/);
});
test('malformed role permissions never become an implicit grant',()=>{
  assert.throws(()=>parseGood(fixture().replace(rows[0],rows[0].replace('|f|anon|t|','|f|anon|t|t'))),/inconsistent/);
  assert.throws(()=>parseGood(fixture().replace(rows[0],rows[0].replace('|t|','|unknown|'))),/inconsistent/);
});
test('present function and registered role cannot have UNKNOWN EXECUTE permission',()=>{
  const altered=rows[0].replace(
    'fabric_stock_record||f|anon|t|',
    'fabric_stock_record|'+hex('fabric_stock_record(text)')+'|t|anon|t|');
  assert.throws(()=>parseGood(fixture().replace(rows[0],altered)),/inconsistent/);
});
test('contradictory function signatures across roles fail closed',()=>{
  const altered=rows[0].replace(
    'fabric_stock_record||f|anon|t|',
    'fabric_stock_record|'+hex('fabric_stock_record(text)')+'|t|anon|t|t');
  assert.throws(()=>parseGood(fixture().replace(rows[0],altered)),/signature matrix/);
});
test('contradictory role existence across functions fails closed',()=>{
  const altered=rows[0].replace('|anon|t|','|anon|f|');
  assert.throws(()=>parseGood(fixture().replace(rows[0],altered)),/role presence/);
});
test('genuine complete multi-overload evidence remains a non-approving projection',()=>{
  const withoutReserve=fixture().split('\n').filter(line=>
    line!==endMarker && !line.startsWith('stock_function_effective_execute|fabric_stock_reserve_v2|')).join('\n').trimEnd();
  const observed=roles.flatMap(role=>[
    installedRow('fabric_stock_reserve_v2','fabric_stock_reserve_v2(text)',role,'t','f'),
    installedRow('fabric_stock_reserve_v2','fabric_stock_reserve_v2(integer)',role)
  ]);
  const complete=withoutReserve.replace(rows[0],definition('fabric_stock_reserve_v2(text)')+'\n'+
    definition('fabric_stock_reserve_v2(integer)')+'\n'+rows[0]);
  const report=parseGood(complete+'\n'+observed.join('\n')+'\n'+endMarker+'\n');
  assert.equal(report.expected_permission_pairs_observed,24);
  assert.equal(report.release_ready,false);
});
test('a function cannot be both absent and installed in one capture',()=>{
  const installed=installedRow('fabric_stock_record','fabric_stock_record(text)','anon');
  assert.throws(()=>parseGood(fixture().replace(endMarker,installed+'\n'+endMarker)),/contradictory absent\/present/);
  assert.throws(()=>parseGood(fixture().replace(rows[0],installed+'\n'+rows[0])),/contradictory absent\/present/);
});
test('missing role with installed RPC remains an explicit non-approving observation',()=>{
  let captured=fixture().replace(/\|service_role\|t\|/g,'|service_role|f|');
  for(const role of roles){
    const absent='stock_function_effective_execute|fabric_stock_reserve_v2||f|'+role+'|'+(role==='service_role'?'f':'t')+'|';
    const installed=installedRow('fabric_stock_reserve_v2','fabric_stock_reserve_v2(text)',role,role==='service_role'?'f':'t');
    assert.ok(captured.includes(absent));
    captured=captured.replace(absent,installed);
  }
  const report=parseGood(insertDefinition(captured,definition('fabric_stock_reserve_v2(text)')));
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
test('raw or malformed connection identifiers fail closed before history projection',()=>{
  const valid=fixture();
  const encodedDatabase=Buffer.from('synthetic_database').toString('hex');
  const encodedRole=Buffer.from('synthetic_reader').toString('hex');
  assert.throws(()=>parseGood(valid.replace('connection_identity|'+encodedDatabase+'|',
    'connection_identity|synthetic_database|')),/malformed connection fingerprint/);
  assert.throws(()=>parseGood(valid.replace('|'+encodedRole+'|127.0.0.1|',
    '|synthetic_reader|127.0.0.1|')),/malformed connection fingerprint/);
  const hostile='x|a|5432|16\nmigration_history|'+Buffer.from('20261231').toString('hex')+'|\n';
  assert.throws(()=>parseGood(valid.replace('|'+encodedRole+'|127.0.0.1|',
    '|'+hostile+'|127.0.0.1|')),/malformed connection fingerprint/);
});
test('rendered RPC body text cannot forge an applied migration-history record',()=>{
  const header=definition('fabric_stock_reserve_v2(text)');
  const injected=fixture().replace(rows[0],
    header+'\nmigration_history|'+Buffer.from('20261110010101').toString('hex')+'|\n'+rows[0]);
  assert.throws(()=>parseGood(injected),/unexpected history row order/);
});
test('function-definition sections cannot appear after the permission matrix',()=>{
  const late='stock_function_definition|fabric_stock_reserve_v2(text)|owner|t|v||hash|CREATE FUNCTION';
  assert.throws(()=>parseGood(fixture().replace(endMarker,late+'\n'+endMarker)),/unexpected function definition row order/);
});
test('function definition multiline body is ignored, not published',()=>{
  let s=fixture();
  for(const role of roles){
    s=s.replace('stock_function_effective_execute|fabric_stock_reserve_v2||f|'+role+'|t|',
      installedRow('fabric_stock_reserve_v2','fabric_stock_reserve_v2(text)',role));
  }
  s=insertDefinition(s,definition('fabric_stock_reserve_v2(text)','CREATE FUNCTION\nPRIVATE-SYNTHETIC-BODY\nEND;'));
  assert.equal(JSON.stringify(parseGood(s)).includes('PRIVATE-SYNTHETIC'),false);
});
test('malformed function metadata, hash and matrix mismatch fail closed',()=>{
  let s=fixture();
  for(const role of roles){
    s=s.replace('stock_function_effective_execute|fabric_stock_reserve_v2||f|'+role+'|t|',
      installedRow('fabric_stock_reserve_v2','fabric_stock_reserve_v2(text)',role));
  }
  const header=definition('fabric_stock_reserve_v2(text)','CREATE FUNCTION synthetic');
  const good=insertDefinition(s,header);
  assert.equal(parseGood(good).release_ready,false);
  assert.throws(()=>parseGood(good.replace(header,header.replace('|'+hex('synthetic_owner')+'|','|raw|owner|'))),
    /malformed stock function definition row/);
  assert.throws(()=>parseGood(good.replace(header,header.replace(/\|[a-f0-9]{32}\|/, '|'+ '0'.repeat(32) +'|'))),
    /inconsistent or duplicated stock function definition/);
  assert.throws(()=>parseGood(s),/definition\/matrix disagreement/);
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
test('post-COMMIT completion marker is required after every ACL observation',()=>{
  const valid=fixture();
  assert.throws(()=>parseGood(valid.replace(endMarker+'\n','')),/missing post-COMMIT/);
  assert.throws(()=>parseGood(valid.replace(endMarker,'probe_complete|WRONG_FORMAT')),/malformed or premature/);
  assert.throws(()=>parseGood(valid.replace(endMarker,endMarker+'\n'+endMarker)),/trailing content/);
  assert.throws(()=>parseGood(valid.replace(endMarker,endMarker+'\n'+'migration_history|3230323631323331|')),/trailing content/);
  assert.throws(()=>parseGood(valid.replace(endMarker+'\n','').replace(rows[0],endMarker+'\n'+rows[0])),/malformed or premature/);
});
test('unrecognized stdout and interior blank rows fail closed even with complete ACL matrix',()=>{
  const raw=fixture();
  const bad=[
    raw.replace(endMarker,'NOTICE|unrecognized line\\n'+endMarker),
    raw.replace(endMarker,'migration_histori|3230323631313033|\\n'+endMarker),
    raw.replace(endMarker,'\\n'+endMarker),
    raw.replace(endMarker,' \\n'+endMarker),
    'unexpected prefix\\n'+raw,
    raw+ '\\n',
  ];
  for(const input of bad)
    assert.throws(()=>parseGood(input),/unrecognized|unexpected blank|trailing/,JSON.stringify(input.slice(-75)));
});
test('optional psql BEGIN and COMMIT status rows are permitted only as a paired envelope',()=>{
  const raw=fixture();
  const envelope='BEGIN\\n'+raw.replace(endMarker,'COMMIT\\n'+endMarker);
  const r=parseGood(envelope);
  assert.deepEqual(r.applied_versions,[{version:'20261103'}]);
  assert.equal(r.release_ready,false);
  const bad=[
    'BEGIN\\n'+raw,
    raw.replace(endMarker,'COMMIT\\n'+endMarker),
    'BEGIN\\nBEGIN\\n'+raw.replace(endMarker,'COMMIT\\n'+endMarker),
    'BEGIN\\n'+raw.replace(endMarker,'COMMIT\\nCOMMIT\\n'+endMarker),
    'BEGIN\\n'+raw.replace('migration_history|','COMMIT\\nmigration_history|').replace(endMarker,'COMMIT\\n'+endMarker),
    raw.replace(endMarker,'COMMIT\\n'+endMarker+'\\nBEGIN'),
  ];
  for(const input of bad)
    assert.throws(()=>parseGood(input),/status|completion|after COMMIT|trailing|unrecognized/);
});
test('malformed, oversized or embedded-NUL capture is blocked',()=>{
  assert.throws(()=>parseGood(fixture()+'\0'),/invalid/);
  assert.throws(()=>parseGood('x'.repeat(4*1024*1024+1)),/invalid/);
});