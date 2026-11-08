import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const path=new URL('../docs/TITAN_STAGING_MIGRATION_READONLY_PROBE.sql',import.meta.url);
const raw=readFileSync(path,'utf8');
const sql=raw.replace(/^\s*--[^\n]*$/gm,'').trim();
const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);

test('probe wraps all statements in a repeatable-read, read-only transaction',()=>{
  assert.match(statements[0],/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY$/i);
  assert.equal(statements.at(-1).toUpperCase(),'COMMIT');
  assert.equal(statements.length,6,'Expected BEGIN, four read-only SELECTs, COMMIT');
});

test('all query statements are SELECTs with no extra write commands',()=>{
  for(const statement of statements.slice(1,-1)){
    assert.match(statement,/^SELECT\s/i);
    assert.doesNotMatch(statement,/\b(?:INTO|FOR\s+UPDATE|FOR\s+SHARE|LOCK\s+TABLE|PERFORM|DO|CALL|EXECUTE|INSERT|UPDATE|DELETE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY|VACUUM|SET\s+ROLE)\b(?!['"])/i);
  }
});

test('only migration metadata and public function catalog are queried',()=>{
  assert.match(sql,/FROM\s+supabase_migrations\.schema_migrations\s+AS\s+m/i);
  assert.match(sql,/FROM\s+pg_proc\s+AS\s+p/);
  assert.match(sql,/JOIN\s+pg_namespace\s+AS\s+ns/);
  assert.match(sql,/LEFT\s+JOIN\s+pg_roles\s+AS\s+registered_role/);
  assert.doesNotMatch(sql,/\b(?:private\.|auth\.|storage\.|fabric_stock_ledger|customer_|production_orders)\b/i);
});

test('capture includes migration versions but does not infer SQL file identity',()=>{
  assert.match(sql,/\bversion\b/);
  assert.match(sql,/to_jsonb\(m\)->>'name'/);
  assert.match(raw,/not.*resolve duplicate-version SQL/i);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE)\s+supabase_migrations\./i);
});

test('capture includes deployed function body and security attributes',()=>{
  assert.match(sql,/pg_get_functiondef\(p\.oid\)\s+AS\s+rendered_definition/i);
  assert.match(sql,/md5\(pg_get_functiondef\(p\.oid\)\)\s+AS\s+rendered_definition_md5/i);
  assert.match(sql,/p\.prosecdef\s+AS\s+security_definer/i);
  assert.match(sql,/pg_get_userbyid\(p\.proowner\)\s+AS\s+function_owner/i);
  assert.match(sql,/p\.proconfig\s+AS\s+function_settings/i);
  const names=['fabric_stock_record','fabric_stock_reserve','fabric_stock_release','fabric_stock_consume_reservation'];
  for(const name of names)for(const suffix of ['','_v2'])
    assert.match(sql,new RegExp("'"+name+suffix+"'"));
});

test('capture reports effective grants for anon authenticated and service roles',()=>{
  assert.match(sql,/has_function_privilege\(registered_role\.oid,p\.oid,'EXECUTE'\)/i);
  for(const role of ['anon','authenticated','service_role'])
    assert.match(sql,new RegExp("\\('"+role+"'\\)|,'"+role+"'"));
  assert.match(sql,/registered_role\.oid\s+IS\s+NOT\s+NULL\s+AS\s+role_exists/i);
  assert.match(sql,/CASE\s+WHEN\s+registered_role\.oid\s+IS\s+NULL\s+THEN\s+NULL/i);
});

test('probe cannot claim connection is staging and contains no credential placeholders',()=>{
  assert.match(sql,/current_database\(\)/);
  assert.match(sql,/current_user/);
  assert.match(raw,/owner.*independently verify staging project/i);
  assert.doesNotMatch(raw,/postgres(?:ql)?:\/\/|(?:password|service_role_key|anon_key)\s*=/i);
});
