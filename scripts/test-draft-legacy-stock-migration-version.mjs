import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validUtcVersion,checkRetirementMigrationNames,gitBlobDigest,verifyReviewedSql,REVIEWED_SQL_BLOB_SHA,listMigrationFiles} from './verify-draft-legacy-stock-migration-version.mjs';

const correct = '20261107093030_legacy_stock_rpc_execute_retirement.sql';
const legacy = ['20261103_stock_close_evidence_integrity.sql',
  '20261103_stock_reservation_provenance_gate.sql',
  '20261103_stock_reservation_identity_length_gate.sql',
  '20261001_fabric_stock_ledger.sql'];
const files = [correct,...legacy];

test('accepts one new uniquely versioned migration without excusing old duplicates',() => {
  assert.equal(checkRetirementMigrationNames(files).file,correct);
});
test('rejects the old eight-digit draft collision',() => {
  assert.throws(()=>checkRetirementMigrationNames([
    '20261103_z_legacy_stock_rpc_execute_retirement.sql',...legacy]),/14-digit/);
});
test('rejects old and new draft migrations coexisting',() => {
  assert.throws(()=>checkRetirementMigrationNames([
    '20261103_z_legacy_stock_rpc_execute_retirement.sql',...files]),/exactly one/);
});
test('rejects a second file reusing the new timestamp',() => {
  assert.throws(()=>checkRetirementMigrationNames([
    ...files,'20261107093030_other_migration.sql']),/duplicate/);
});
test('rejects two draft retirement files',() => {
  assert.throws(()=>checkRetirementMigrationNames([correct,correct,...legacy]),/exactly one/);
});
test('rejects an absent retirement migration',() => {
  assert.throws(()=>checkRetirementMigrationNames(legacy),/exactly one/);
});
test('rejects malformed short version',() => {
  assert.throws(()=>checkRetirementMigrationNames([
    '202611070930_legacy_stock_rpc_execute_retirement.sql',...legacy]),/14-digit/);
});
test('rejects impossible dates and times',() => {
  assert.equal(validUtcVersion('20260230093030'),false);
  assert.equal(validUtcVersion('20261107246000'),false);
  assert.equal(validUtcVersion('20261107093030'),true);
  assert.throws(()=>checkRetirementMigrationNames([
    '20260230093030_legacy_stock_rpc_execute_retirement.sql',...legacy]),/valid 14-digit/);
});
test('rejects an unreviewed draft migration that sorts before historical versions',() => {
  assert.throws(()=>checkRetirementMigrationNames([
    '20261030093030_legacy_stock_rpc_execute_retirement.sql',...legacy]),/backdated/);
});
test('never accepts an unknown non-array migration listing',() => {
  assert.throws(()=>checkRetirementMigrationNames(null),/expected a list/);
});
test('does not misclassify a v1 stock API identifier as a migration filename',() => {
  assert.equal(checkRetirementMigrationNames([...files,'20261107093031_unrelated_rpc.sql']).version,'20261107093030');
});

test('reviewed SQL bytes match pinned git blob fingerprint',() => {
  const bytes = readFileSync(new URL('../supabase/migrations/'+correct,import.meta.url));
  assert.equal(gitBlobDigest(bytes),REVIEWED_SQL_BLOB_SHA);
  assert.equal(verifyReviewedSql(bytes),REVIEWED_SQL_BLOB_SHA);
});
test('appended revoke or grant fails pinned SQL identity',() => {
  const bytes = readFileSync(new URL('../supabase/migrations/'+correct,import.meta.url));
  assert.throws(()=>verifyReviewedSql(Buffer.concat([bytes,Buffer.from('\nrevoke all on schema public from anon;\n')])),/SQL changed/);
  assert.throws(()=>verifyReviewedSql(Buffer.concat([bytes,Buffer.from('\ngrant execute on all functions in schema public to public;\n')])),/SQL changed/);
});
test('whitespace-only SQL edit also requires explicit review',() => {
  const bytes = readFileSync(new URL('../supabase/migrations/'+correct,import.meta.url));
  assert.throws(()=>verifyReviewedSql(Buffer.concat([bytes,Buffer.from(' ')])),/SQL changed/);
});
const fake = (name,kind='file')=>({
  name, isFile:()=>kind==='file', isDirectory:()=>kind==='directory',
  isSymbolicLink:()=>kind==='symlink'
});
test('migration inventory refuses SQL symlinks and directories',()=> {
  assert.throws(()=>listMigrationFiles([fake(correct),fake('20261107093031_legacy.sql','symlink')]),/symlink/);
  assert.throws(()=>listMigrationFiles([fake(correct),fake('hidden','directory')]),/directory/);
});
test('migration inventory refuses uppercase SQL extensions',()=> {
  assert.throws(()=>listMigrationFiles([fake(correct),fake('20261107093031_hidden.SQL')]),/SQL filename case/);
  assert.deepEqual(listMigrationFiles([fake(correct),fake('README.md')]),[correct]);
});
