import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMigrationEntries, fingerprintSql, inventoryIntegrityVerified} from '../scripts/report-legacy-migration-prefixes.mjs';
const f=(n,kind='file')=>({path:'supabase/migrations/'+n,kind,
  ...fingerprintSql(Buffer.from('synthetic SQL for '+n))});
test('legacy eight-digit collisions are explicitly grouped instead of hidden behind filename failure',()=>{
  const x=summarizeMigrationEntries([f('20261103_alpha.sql'),f('20261103_beta.sql'),f('20261103_gamma.sql'),f('20261104010101_forward.sql')],'a'.repeat(40));
  assert.equal(x.collision_group_count,1);assert.equal(x.collisions[0].count,3);
  assert.equal(x.collisions[0].version,'20261103');assert.equal(x.legacy_eight_digit_files,3);
  assert.equal(x.standard_fourteen_digit_files,1);assert.equal(x.release_ready,false);
});
test('standard fourteen-digit duplicates are also collisions',()=>{
  const x=summarizeMigrationEntries([f('20261103010101_one.sql'),f('20261103010101_two.sql')]);
  assert.equal(x.collisions[0].version_format,'standard_14_digit');assert.equal(x.collision_group_count,1);
});
test('unsafe symlinks, nested paths and malformed filenames are reported without following data',()=>{
  const x=summarizeMigrationEntries([f('20261103010101_normal.sql','symlink'),{path:'supabase/migrations/nested/20261103010202_hidden.sql',kind:'file'},f('bad_version.sql'),f('20261103010101_bad.SQL')]);
  assert.equal(x.invalid_entries.length,4);assert.deepEqual(x.invalid_entries.map(p=>p.kind).sort(),['invalid_filename','invalid_filename','unsafe_source_entry','unsafe_source_entry'].sort());
});
test('no migration entries and duplicate tracked entries do not produce approval',()=>{
  const empty=summarizeMigrationEntries([]);assert.equal(empty.invalid_entries[0].kind,'no_migrations');
  const duplicate=summarizeMigrationEntries([f('20261103010101_ok.sql'),f('20261103010101_ok.sql')]);
  assert.ok(duplicate.invalid_entries.some(x=>x.kind==='invalid_or_duplicate_path'));
  assert.equal(duplicate.release_ready,false);
});
test('unique standard versions still require actual staging history and review',()=>{
  const x=summarizeMigrationEntries([f('20261103010101_a.sql'),f('20261103010102_b.sql')]);
  assert.equal(x.collision_group_count,0);assert.equal(x.invalid_entries.length,0);
  assert.equal(x.staging_history_verified,false);assert.equal(x.independent_review_complete,false);
  assert.equal(x.approval,'BLOCKED_PENDING_APPLIED_HISTORY_AND_REVIEW');
});
test('collision groups and invalid entry output have stable ordering',()=>{
  const x=summarizeMigrationEntries([f('20261104_z.sql'),f('20261001_b.sql'),f('20261104_a.sql'),f('20261001_a.sql'),f('unknown.sql')]);
  assert.deepEqual(x.collisions.map(c=>c.version),['20261001','20261104']);
  assert.deepEqual(x.collisions[0].files,['supabase/migrations/20261001_a.sql','supabase/migrations/20261001_b.sql']);
});

test('different SQL files with identical legacy version have content fingerprints',()=>{
  const one=f('20261103_one.sql'),two=f('20261103_two.sql');
  const out=summarizeMigrationEntries([two,one],'b'.repeat(40));
  assert.equal(out.file_fingerprints.length,2);
  assert.equal(out.content_fingerprints_complete,true);
  assert.equal(out.file_fingerprints[0].path,one.path);
  assert.notEqual(out.file_fingerprints[0].content_sha256,out.file_fingerprints[1].content_sha256);
});
test('missing or invalid source hashes are rejected without release approval',()=>{
  const path='supabase/migrations/20261103000101_test.sql';
  const out=summarizeMigrationEntries([{path,kind:'file'}]);
  assert.equal(out.file_fingerprints.length,0);
  assert.equal(out.content_fingerprints_complete,false);
  assert.ok(out.invalid_entries.some(x=>x.kind==='missing_or_invalid_source_fingerprint'));
  assert.equal(out.release_ready,false);
});
test('fingerprints are Git typed blobs and exact-byte SHA-256',()=>{
  const hash=fingerprintSql(Buffer.from('hello\n'));
  assert.equal(hash.git_blob_sha1,'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.equal(hash.content_sha256,'5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03');
});

test('inventory integrity must fail closed for source corruption or absent files, never legacy version collisions',()=>{
  const safe=summarizeMigrationEntries([f('20261103_one.sql'),f('20261103_two.sql')]);
  assert.equal(safe.collision_group_count,1);
  assert.equal(inventoryIntegrityVerified(safe),true);
  assert.equal(safe.release_ready,false);
  const corrupted=summarizeMigrationEntries([f('20261103010101_valid.sql'),
    {path:'supabase/migrations/20261103010102_missing.sql',kind:'missing'}]);
  assert.equal(inventoryIntegrityVerified(corrupted),false);
  assert.equal(inventoryIntegrityVerified(summarizeMigrationEntries([])),false);
  assert.equal(inventoryIntegrityVerified({...safe,file_fingerprints:[]}),false);
  assert.equal(inventoryIntegrityVerified({...safe,content_fingerprints_complete:false}),false);
});
