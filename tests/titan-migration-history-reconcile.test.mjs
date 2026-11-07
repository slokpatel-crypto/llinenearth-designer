import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reconcileMigrationHistory } from '../scripts/titan-reconcile-migration-history.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
const inventory = [{version:'20261001',filename:'20261001_a.sql',sha256:hash('a')},{version:'20261001',filename:'20261001_b.sql',sha256:hash('b')}];
const evidence = {source:'authenticated-read-only-staging',project_id:'synthetic-project',collected_at:new Date(Date.now() - 60_000).toISOString(),sql_identity_verified:true};
test('version-only staging history cannot resolve distinct SQL collision',()=> {const r=reconcileMigrationHistory(inventory,[{version:'20261001'}]); assert.equal(r.blocked,1); assert.equal(r.results[0].reason,'MISSING_AUTHENTICATED_SQL_IDENTITY');});
test('unattested hash remains blocked',()=> assert.equal(reconcileMigrationHistory(inventory,[{version:'20261001',sha256:hash('a')}]).blocked,1));
test('claimed exact SQL identity remains review-required and never grants release',()=> {const r=reconcileMigrationHistory(inventory,[{version:'20261001',sha256:hash('b'),evidence}]);assert.equal(r.results[0].matched_filename,'20261001_b.sql');assert.equal(r.results[0].status,'REVIEW_REQUIRED');assert.equal(r.blocked,1);assert.equal(r.release_ready,false);});
test('mismatched claimed hash blocks',()=> assert.equal(reconcileMigrationHistory(inventory,[{version:'20261001',sha256:hash('c'),evidence}]).results[0].reason,'NO_FINGERPRINT_MATCH'));
test('missing staging version blocks collision',()=> assert.equal(reconcileMigrationHistory(inventory,[]).results[0].reason,'COLLISION_NOT_IN_STAGING_HISTORY'));
test('duplicate staging versions rejected',()=> assert.throws(()=>reconcileMigrationHistory(inventory,[{version:'20261001'},{version:'20261001'}])));
test('invalid inventory hash rejected',()=> assert.throws(()=>reconcileMigrationHistory([{...inventory[0],sha256:'fake'}],[])));

import { readdirSync, readFileSync as readSqlFile } from 'node:fs';
import { join } from 'node:path';

test('real repository migration collisions remain blocked without authenticated staging identity', () => {
  const directory = join(process.cwd(), 'supabase', 'migrations');
  const filenames = readdirSync(directory).filter(name => /^\d{8,20}_.+\.sql$/.test(name));
  assert.ok(filenames.length > 0, 'Expected repository migration SQL files');
  const rows = filenames.map(filename => ({
    version: filename.split('_', 1)[0],
    filename,
    sha256: createHash('sha256').update(readSqlFile(join(directory, filename))).digest('hex'),
  }));
  const groups = new Map();
  for (const row of rows) groups.set(row.version, (groups.get(row.version) ?? 0) + 1);
  const collisions = [...groups].filter(([, count]) => count > 1);
  assert.ok(collisions.length > 0, 'Expected unresolved real migration version collisions');
  const report = reconcileMigrationHistory(rows, []);
  assert.equal(report.release_ready, false);
  assert.equal(report.blocked, groups.size);
  assert.deepEqual(
    new Set(report.results.map(row => row.version)),
    new Set(groups.keys()),
  );
  assert.ok(report.results.every(row => row.status === 'BLOCKED' && ['COLLISION_NOT_IN_STAGING_HISTORY', 'MIGRATION_NOT_IN_STAGING_HISTORY'].includes(row.reason)));
});

test('missing singleton migration is blocked rather than silently omitted', () => { const r = reconcileMigrationHistory([{version:'20261104',filename:'20261104_single.sql',sha256:hash('single')}],[]); assert.equal(r.blocked,1); assert.equal(r.results[0].reason,'MIGRATION_NOT_IN_STAGING_HISTORY'); });
test('empty inventory and staging cannot authorize release', () => { const r = reconcileMigrationHistory([],[]); assert.equal(r.release_ready,false); assert.equal(r.blocked,0); });

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

test('CLI fails closed with exit 2 for empty and unresolved evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'titan-j1-cli-'));
  try {
    const inventoryPath = join(directory, 'inventory.json');
    const stagingPath = join(directory, 'staging.json');
    const script = join(process.cwd(), 'scripts', 'titan-reconcile-migration-history.mjs');
    for (const [inventoryRows, stagingRows] of [[[], []], [inventory, []], [inventory, [{version:'20261001',sha256:hash('a'),evidence}]]]) {
      writeFileSync(inventoryPath, JSON.stringify(inventoryRows));
      writeFileSync(stagingPath, JSON.stringify(stagingRows));
      const result = spawnSync(process.execPath, [script, inventoryPath, stagingPath], {encoding:'utf8'});
      assert.equal(result.status, 2, result.stderr || result.stdout);
      assert.equal(JSON.parse(result.stdout).release_ready, false);
    }
  } finally { rmSync(directory, {recursive:true,force:true}); }
});

test('stale, future, malformed and forged provenance never reaches review-required', () => {
  const valid = { ...evidence, collected_at: new Date(Date.now() - 60_000).toISOString() };
  const bad = [
    { ...valid, collected_at: new Date(Date.now() - 48 * 60 * 60_000).toISOString() },
    { ...valid, collected_at: new Date(Date.now() + 60 * 60_000).toISOString() },
    { ...valid, collected_at: '2026-11-05' },
    { ...valid, project_id: '../fake' },
    { ...valid, source: 'self-attested' },
    { ...valid, sql_identity_verified: 'true' },
    { ...valid, project_id: '' },
  ];
  for (const claimed of bad) {
    const result = reconcileMigrationHistory(inventory, [{version:'20261001',sha256:hash('a'),evidence:claimed}]);
    assert.equal(result.results[0].status, 'BLOCKED', JSON.stringify(claimed));
    assert.equal(result.release_ready, false);
  }
  const review = reconcileMigrationHistory(inventory, [{version:'20261001',sha256:hash('a'),evidence:valid}]);
  assert.equal(review.results[0].status, 'REVIEW_REQUIRED');
  assert.equal(review.release_ready, false);
});

test('unexpected staging-only version is explicitly blocked even with claimed matching provenance', () => {
  const report = reconcileMigrationHistory(inventory, [{version:'20261106000000',sha256:hash('a'),evidence}]);
  assert.equal(report.release_ready, false);
  assert.equal(report.results.find(row => row.version === '20261106000000').reason, 'UNEXPECTED_STAGING_VERSION');
  assert.equal(report.results.find(row => row.version === '20261001').reason, 'COLLISION_NOT_IN_STAGING_HISTORY');
  assert.equal(report.blocked, 2);
});


test('inventory filename must match version and remain a safe SQL basename', () => {
  const invalid = ['20261002_a.sql', '../20261001_a.sql', '20261001_../a.sql', '20261001_a.SQL', '20261001_.sql', '20261001_a/b.sql'];
  for (const filename of invalid) {
    assert.throws(() => reconcileMigrationHistory([{...inventory[0], filename}], []), /Invalid inventory row/, filename);
  }
  assert.equal(reconcileMigrationHistory(inventory, []).release_ready, false);
});


test('noncanonical timestamp cannot masquerade as valid provenance', () => {
  const invalid = { ...evidence, collected_at: new Date(Date.now() - 60_000).toISOString().replace('Z', '0Z') };
  const report = reconcileMigrationHistory(inventory, [{version:'20261001',sha256:hash('a'),evidence:invalid}]);
  assert.equal(report.release_ready, false);
  assert.equal(report.results[0].status, 'BLOCKED');
  assert.equal(report.results[0].reason, 'MISSING_AUTHENTICATED_SQL_IDENTITY');
});


test('identical SQL fingerprints across colliding filenames remain ambiguous and blocked', () => {
  const identical = [
    {version:'20261001',filename:'20261001_first.sql',sha256:hash('same SQL')},
    {version:'20261001',filename:'20261001_second.sql',sha256:hash('same SQL')},
  ];
  const report = reconcileMigrationHistory(identical, [{version:'20261001',sha256:hash('same SQL'),evidence}]);
  assert.equal(report.release_ready, false);
  assert.equal(report.blocked, 1);
  assert.equal(report.results[0].status, 'BLOCKED');
  assert.equal(report.results[0].reason, 'AMBIGUOUS_FINGERPRINT');
  assert.equal(report.results[0].matched_filename, null);
});
