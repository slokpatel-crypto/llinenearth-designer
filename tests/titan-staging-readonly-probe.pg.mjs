import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

// This test is deliberately *not* a staging probe execution. It must only run
// against the short-lived PostgreSQL service created by its GitHub Actions job.
// The exact synthetic connection guard prevents accidental manual reuse.
const syntheticEnv={
  TITAN_SYNTHETIC_POSTGRES:'1',
  PGHOST:'127.0.0.1',
  PGPORT:'5432',
  PGDATABASE:'titan_probe_synthetic',
  PGUSER:'titan_probe',
  PGPASSWORD:'synthetic_only',
};
for(const [name,expected] of Object.entries(syntheticEnv)){
  assert.equal(process.env[name],expected,
    'Refusing PostgreSQL test outside the explicitly configured disposable fixture: '+name);
}

// Never inherit libpq connection settings (PGHOSTADDR, PGSERVICE, etc.).
// PGHOSTADDR can override PGHOST; an inherited service may silently select
// another destination. The child process may only reach our loopback fixture.
const psqlEnv={
  PATH:process.env.PATH || '/usr/bin:/bin',
  HOME:process.env.HOME || '/tmp',
  LANG:process.env.LANG || 'C',
  ...syntheticEnv,
  PGHOSTADDR:'127.0.0.1',
  PGSSLMODE:'disable',
  PGCONNECT_TIMEOUT:'5',
};

function runPsql(args,{expectFailure=false}={}){
  const result=spawnSync('psql',[
    '--no-psqlrc','--set=ON_ERROR_STOP=1','--quiet',
    '--host=127.0.0.1','--port=5432',
    '--username=titan_probe','--dbname=titan_probe_synthetic','--no-password',
    '--no-align','--tuples-only','--field-separator=|',...args,
  ],{
    cwd:process.cwd(),
    env:psqlEnv,
    encoding:'utf8',
    timeout:20000,
  });
  assert.equal(result.error,undefined,'psql could not start');
  if(expectFailure){
    assert.notEqual(result.status,0,'Probe unexpectedly succeeded despite missing migration history');
    return result.stderr;
  }
  assert.equal(result.status,0,'Synthetic psql execution failed: '+result.stderr);
  return result.stdout;
}
function sql(statement){return runPsql(['--command',statement]);}
function evidence(){
  const output=runPsql(['--file','docs/TITAN_STAGING_MIGRATION_READONLY_PROBE.sql']);
  const lines=output.split(/\r?\n/).filter(line=>line.startsWith('stock_function_effective_execute|'));
  return lines.map(line=>{
    const fields=line.split('|');
    assert.equal(fields.length,7,'Unexpected permissions evidence projection');
    const [kind,name,signature,exists,role,roleExists,execute]=fields;
    return {kind,name,signature,exists,role,roleExists,execute};
  });
}

sql([
  'CREATE SCHEMA supabase_migrations;',
  'CREATE TABLE supabase_migrations.schema_migrations (version text NOT NULL);',
  'CREATE ROLE anon NOLOGIN;',
  'CREATE ROLE authenticated NOLOGIN;',
  'CREATE ROLE service_role NOLOGIN;',
].join('\n'));

const expectedNames=[
  'fabric_stock_record','fabric_stock_reserve','fabric_stock_release',
  'fabric_stock_consume_reservation','fabric_stock_record_v2',
  'fabric_stock_reserve_v2','fabric_stock_release_v2',
  'fabric_stock_consume_reservation_v2',
];
const expectedRoles=['anon','authenticated','service_role'];

test('native PostgreSQL: all absent RPCs still yield 24 explicit unknown observations',()=>{
  const rows=evidence();
  assert.equal(rows.length,expectedNames.length*expectedRoles.length);
  for(const name of expectedNames)for(const role of expectedRoles){
    const matches=rows.filter(row=>row.name===name&&row.role===role);
    assert.equal(matches.length,1,name+'/'+role+' must not disappear');
    assert.equal(matches[0].exists,'f');
    assert.equal(matches[0].roleExists,'t');
    assert.equal(matches[0].signature,'');
    assert.equal(matches[0].execute,'','Unknown must not become false or an implicit grant');
  }
});

test('native PostgreSQL: existing RPC differentiates granted versus denied EXECUTE',()=>{
  sql([
    'CREATE FUNCTION public.fabric_stock_reserve_v2(text) RETURNS boolean',
    "LANGUAGE sql AS 'SELECT true';",
    'REVOKE ALL ON FUNCTION public.fabric_stock_reserve_v2(text) FROM PUBLIC;',
    'GRANT EXECUTE ON FUNCTION public.fabric_stock_reserve_v2(text) TO service_role;',
  ].join('\n'));
  const rows=evidence();
  assert.equal(rows.length,expectedNames.length*expectedRoles.length);
  for(const role of expectedRoles){
    const row=rows.find(row=>row.name==='fabric_stock_reserve_v2'&&row.role===role);
    assert.ok(row);
    assert.equal(row.exists,'t');
    assert.match(row.signature,/fabric_stock_reserve_v2\(text\)/);
    assert.equal(row.roleExists,'t');
    assert.equal(row.execute,role==='service_role'?'t':'f');
  }
  assert.equal(rows.filter(row=>row.name==='fabric_stock_release_v2').length,3);
  assert.ok(rows.filter(row=>row.name==='fabric_stock_release_v2').every(row=>row.execute===''));
});

test('native PostgreSQL: missing role stays visible with unknown permission',()=>{
  sql([
    'DROP FUNCTION public.fabric_stock_reserve_v2(text);',
    'DROP ROLE service_role;',
  ].join('\n'));
  const rows=evidence();
  assert.equal(rows.length,expectedNames.length*expectedRoles.length);
  const missingRole=rows.filter(row=>row.role==='service_role');
  assert.equal(missingRole.length,expectedNames.length);
  for(const row of missingRole){
    assert.equal(row.roleExists,'f');
    assert.equal(row.execute,'');
    assert.equal(row.exists,'f');
  }
});

test('native PostgreSQL: inherited libpq overrides cannot redirect synthetic fixture',()=>{
  const previousAddress=process.env.PGHOSTADDR;
  const previousService=process.env.PGSERVICE;
  try{
    // RFC 5737 TEST-NET-1 is never queried: the child has a controlled env.
    process.env.PGHOSTADDR='192.0.2.23';
    process.env.PGSERVICE='should-never-be-inherited';
    // Docker may report its container bridge IP as inet_server_addr(),
    // even though the CLIENT connects to 127.0.0.1 via the published port.
    const identity=sql("SELECT current_database() || '|' || current_user || '|' || inet_server_port()::text;").trim();
    assert.equal(identity,'titan_probe_synthetic|titan_probe|5432');
    assert.equal(psqlEnv.PGHOSTADDR,'127.0.0.1');
    assert.equal(psqlEnv.PGHOST,'127.0.0.1');
    assert.equal(psqlEnv.PGPORT,'5432');
    assert.equal(Object.hasOwn(psqlEnv,'PGSERVICE'),false);
  }finally{
    if(previousAddress===undefined)delete process.env.PGHOSTADDR;
    else process.env.PGHOSTADDR=previousAddress;
    if(previousService===undefined)delete process.env.PGSERVICE;
    else process.env.PGSERVICE=previousService;
  }
});

test('native PostgreSQL: default PUBLIC EXECUTE and overloads are separately observable',()=>{
  sql([
    'CREATE ROLE service_role NOLOGIN;',
    'CREATE FUNCTION public.fabric_stock_reserve_v2(text) RETURNS boolean',
    "LANGUAGE sql AS 'SELECT true';",
    'CREATE FUNCTION public.fabric_stock_reserve_v2(integer) RETURNS boolean',
    "LANGUAGE sql AS 'SELECT true';",
    'REVOKE ALL ON FUNCTION public.fabric_stock_reserve_v2(text) FROM PUBLIC;',
    'GRANT EXECUTE ON FUNCTION public.fabric_stock_reserve_v2(text) TO service_role;',
  ].join('\\n'));
  const rows=evidence();
  assert.equal(rows.length,(expectedNames.length+1)*expectedRoles.length,
    'An unexpected overload must add three evidence rows, not overwrite another signature');
  for(const role of expectedRoles){
    const candidateRows=rows.filter(row=>row.name==='fabric_stock_reserve_v2'&&row.role===role);
    assert.equal(candidateRows.length,2,'Each overload needs an independently auditable privilege result');
    const bySig=Object.fromEntries(candidateRows.map(row=>[row.signature,row.execute]));
    assert.equal(bySig['fabric_stock_reserve_v2(integer)'],'t',
      'PostgreSQL default PUBLIC EXECUTE grants effective permission to every role');
    assert.equal(bySig['fabric_stock_reserve_v2(text)'],role==='service_role'?'t':'f');
  }
});

test('native PostgreSQL: missing migration history fails closed instead of providing partial evidence',()=>{
  sql('DROP TABLE supabase_migrations.schema_migrations;');
  const error=runPsql(['--file','docs/TITAN_STAGING_MIGRATION_READONLY_PROBE.sql'],
    {expectFailure:true});
  assert.match(error,/schema_migrations/);
  assert.match(error,/does not exist/i);
});
