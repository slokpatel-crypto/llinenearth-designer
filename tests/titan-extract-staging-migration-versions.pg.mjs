import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {extractUntrustedAppliedVersions} from '../scripts/titan-extract-staging-migration-versions.mjs';

// Disposable local PostgreSQL fixture only. Do not run with staging/production credentials.
const guard={
  TITAN_SYNTHETIC_POSTGRES:'1',
  PGHOST:'127.0.0.1',
  PGPORT:'5432',
  PGDATABASE:'titan_offline_synthetic',
  PGUSER:'titan_offline',
  PGPASSWORD:'synthetic_only',
};
for(const [name,value] of Object.entries(guard)){
  assert.equal(process.env[name],value,'Refusing non-disposable PostgreSQL: '+name);
}
// Do not inherit libpq environment that could override loopback connection.
const env={
  PATH:process.env.PATH||'/usr/bin:/bin',
  HOME:process.env.HOME||'/tmp',
  LANG:'C',
  ...guard,
  PGHOSTADDR:'127.0.0.1',
  PGSSLMODE:'disable',
  PGCONNECT_TIMEOUT:'5',
};
const options=[
  '--no-psqlrc','--set=ON_ERROR_STOP=1',
  '--host=127.0.0.1','--port=5432',
  '--username=titan_offline','--dbname=titan_offline_synthetic','--no-password',
  '--no-align','--tuples-only','--field-separator=|',
];
function runPsql(args){
  const r=spawnSync('psql',[...options,...args],{
    cwd:process.cwd(),env,encoding:'utf8',timeout:30000,
  });
  assert.equal(r.error,undefined,'Disposable psql client failed to start');
  return r;
}
function execute(statement){
  const r=runPsql(['--command',statement]);
  assert.equal(r.status,0,r.stderr);
}
function probe(args=[]){
  return runPsql([...args,'--file','docs/TITAN_STAGING_MIGRATION_READONLY_PROBE.sql']);
}

execute([
  'CREATE SCHEMA supabase_migrations;',
  'CREATE TABLE supabase_migrations.schema_migrations (version text NOT NULL);',
  "INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('20261103'),('20261103'),('20261104010101');",
  'CREATE ROLE anon NOLOGIN;',
  'CREATE ROLE authenticated NOLOGIN;',
  // Deliberately omit service_role to test the UNKNOWN permission contract.
  'CREATE FUNCTION public.fabric_stock_reserve_v2(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;',
  'CREATE FUNCTION public.fabric_stock_reserve_v2(integer) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;',
  'REVOKE ALL ON FUNCTION public.fabric_stock_reserve_v2(text) FROM PUBLIC;',
  'GRANT EXECUTE ON FUNCTION public.fabric_stock_reserve_v2(text) TO authenticated;',
].join('\n'));

test('actual read-only probe output parses as an untrusted version-only projection',()=>{
  const r=probe();
  assert.equal(r.status,0,'Native SQL probe failed: '+r.stderr);
  assert.match(r.stdout,/connection_identity\|746974616e5f6f66666c696e655f73796e746865746963\|/);
  assert.match(r.stdout,/stock_function_definition\|fabric_stock_reserve_v2\(text\)\|/);
  assert.match(r.stdout,/stock_function_effective_execute\|/);
  const out=extractUntrustedAppliedVersions(r.stdout,{psqlExitCode:r.status});
  assert.deepEqual(out.applied_versions,[
    {version:'20261103'},{version:'20261103'},{version:'20261104010101'}
  ]);
  assert.deepEqual(out.duplicate_applied_versions,[{version:'20261103',count:2}]);
  assert.equal(out.expected_permission_pairs_observed,24);
  assert.equal(out.staging_project_verified,false);
  assert.equal(out.sql_source_identity_verified,false);
  assert.equal(out.release_ready,false);
  const publicProjection=JSON.stringify(out);
  for(const unsafe of ['titan_offline_synthetic','127.0.0.1','synthetic_only','CREATE FUNCTION','function_owner']){
    assert.equal(publicProjection.includes(unsafe),false,'Raw private evidence leaked: '+unsafe);
  }
});

test('incomplete read-only PostgreSQL capture must not become reviewable history',()=>{
  const r=probe();
  assert.equal(r.status,0,r.stderr);
  const matrix=r.stdout.split(/\r?\n/).filter(x=>x.startsWith('stock_function_effective_execute|'));
  assert.ok(matrix.length>24,'Fixture must include real function overloads');
  assert.throws(
    ()=>extractUntrustedAppliedVersions(r.stdout.replace(matrix[0]+'\n',''),{psqlExitCode:0}),
    /partial|signature matrix/,
  );
  assert.throws(
    ()=>extractUntrustedAppliedVersions(r.stdout,{psqlExitCode:3}),
    /did not complete/,
  );
});

test('real permission-denied history fails closed without accepting partial stdout',()=>{
  execute([
    'CREATE ROLE titan_offline_reviewer NOLOGIN;',
    'GRANT USAGE ON SCHEMA supabase_migrations TO titan_offline_reviewer;',
  ].join('\n'));
  const denied=probe(['--command=SET ROLE titan_offline_reviewer;']);
  assert.notEqual(denied.status,0,'Read-only reviewer unexpectedly accessed version history');
  assert.match(denied.stderr,/permission denied for table schema_migrations/i);
  assert.throws(
    ()=>extractUntrustedAppliedVersions(denied.stdout,{psqlExitCode:denied.status}),
    /did not complete/,
  );
});

test('encoding prevents migration-name row injection and multiline SQL-body spoofing',()=>{
  execute([
    'ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN name text;',
    "UPDATE supabase_migrations.schema_migrations SET name = E'legitimate\\nmigration_history|20261110010101|false' WHERE version = '20261103';",
    'CREATE OR REPLACE FUNCTION public.fabric_stock_reserve_v2(text) RETURNS boolean LANGUAGE plpgsql AS $$',
    'BEGIN',
    '  -- migration_history|20261111010101|false',
    '  RETURN true;',
    'END; $$;',
  ].join('\n'));
  const r=probe();
  assert.equal(r.status,0,r.stderr);
  const output=extractUntrustedAppliedVersions(r.stdout,{psqlExitCode:r.status});
  assert.deepEqual(output.applied_versions,[
    {version:'20261103'},{version:'20261103'},{version:'20261104010101'}
  ]);
  assert.deepEqual(output.duplicate_applied_versions,[{version:'20261103',count:2}]);
  assert.equal(output.release_ready,false);
  assert.doesNotMatch(r.stdout,/migration_history\|20261110010101\|/);
  assert.doesNotMatch(r.stdout,/migration_history\|20261111010101\|/);
  const row=r.stdout.split(/\r?\n/).find(x=>x.startsWith('stock_function_definition|fabric_stock_reserve_v2(text)|'));
  assert.ok(row,'Expected encoded function evidence row');
  const cols=row.split('|');
  assert.equal(cols.length,8,'Multiline source should remain in one SQL field');
  const rendered=Buffer.from(cols[7],'hex').toString('utf8');
  assert.match(rendered,/migration_history\|20261111010101\|/,'Human reviewer can still decode original function body');
  assert.equal(output.sql_source_identity_verified,false);
});


test('untrusted multiline reviewer role cannot inject a migration-history row',()=>{
  const fakeVersion=Buffer.from('20261231').toString('hex');
  // PostgreSQL quoted identifiers permit literal pipes and newlines.
  const role='x|a|5432|16\nmigration_history|'+fakeVersion+'|\n';
  assert.ok(Buffer.byteLength(role,'utf8')<63);
  execute([
    'CREATE ROLE "'+role+'" NOLOGIN;',
    'GRANT USAGE ON SCHEMA supabase_migrations TO "'+role+'";',
    'GRANT SELECT ON TABLE supabase_migrations.schema_migrations TO "'+role+'";',
  ].join('\n'));
  const r=probe(['--command=SET ROLE "'+role+'";']);
  assert.equal(r.status,0,'Synthetic reviewer could not run read-only probe: '+r.stderr);
  assert.ok(!r.stdout.split(/\r?\n/).includes('migration_history|'+fakeVersion+'|'),
    'Reviewer identifier must not forge a history row');
  const identity=r.stdout.split(/\r?\n/).find(line=>line.startsWith('connection_identity|'));
  assert.ok(identity,'Missing connection fingerprint');
  const fields=identity.split('|');
  assert.equal(fields.length,6,'Fingerprint must stay one row');
  assert.equal(Buffer.from(fields[2],'hex').toString('utf8'),role);
  const out=extractUntrustedAppliedVersions(r.stdout,{psqlExitCode:0});
  assert.deepEqual(out.applied_versions,[
    {version:'20261103'},{version:'20261103'},{version:'20261104010101'}
  ]);
  assert.equal(out.release_ready,false);
});

test('malformed multiline version in actual PostgreSQL cannot impersonate extra history',()=>{
  execute("INSERT INTO supabase_migrations.schema_migrations(version) VALUES (E'20261103\\nmigration_history|20261110010101|');");
  const r=probe();
  assert.equal(r.status,0,'Native SQL probe failed: '+r.stderr);
  assert.doesNotMatch(r.stdout,/^migration_history\|20261110010101\|/m,
    'The forged-looking multiline version must not create an extra psql row');
  const invalid=Buffer.from('20261103\nmigration_history|20261110010101|').toString('hex');
  assert.ok(r.stdout.includes('migration_history|'+invalid+'|'),
    'The malformed original version must be retained as one encoded database value');
  assert.throws(
    ()=>extractUntrustedAppliedVersions(r.stdout,{psqlExitCode:0}),
    /malformed migration history/,
    'A malformed history version must fail closed rather than be skipped or projected',
  );
});
