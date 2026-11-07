#!/usr/bin/env node
// Disposable tracked-source fixtures: prove both detection and narrow historical exemption.
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const auditor = resolve('scripts/audit-retired-stock-rpc-callers.mjs');
const root = mkdtempSync(join(tmpdir(), 'titan-stock-rpc-audit-'));
const cases = [
  ['safe active source', 'src/safe.ts', 'export const stock = "v2";', true],
  ['retired caller', 'src/active.ts', 'client.rpc("fabric_stock_reserve", payload);', false],
  ['historical migration assertion', 'scripts/release-readiness.mjs',
    'requireTokens("supabase/migrations/legacy.sql", ["fabric_stock_record"]);', true],
  ['active call in release gate', 'scripts/release-readiness.mjs',
    'client.rpc("fabric_stock_release", payload);', false],
  ['legacy name in desktop source', 'desktop/src/stock.ts',
    'const method = "fabric_stock_consume_reservation";', false],
];
try {
  execFileSync('git', ['init', '-q'], {cwd: root});
  for (const [label, file, source, shouldPass] of cases) {
    const full = join(root, file);
    mkdirSync(join(full, '..'), {recursive: true});
    writeFileSync(full, source + '\n');
    execFileSync('git', ['add', '--', file], {cwd: root});
    // Ensure at least one tracked source file for the positive fixture.
    mkdirSync(join(root, 'src'), {recursive: true});
    writeFileSync(join(root, 'src', 'baseline.ts'), 'export const ok = true;\n');
    execFileSync('git', ['add', 'src/baseline.ts'], {cwd: root});
    const run = spawnSync(process.execPath, [auditor], {cwd: root, encoding: 'utf8'});
    assert.equal(run.status === 0, shouldPass,
      label + ': unexpected exit ' + run.status + '\n' + run.stdout + run.stderr);
    if (!shouldPass) assert.match(run.stderr, /BLOCKED: .*retired RPC/);
    execFileSync('git', ['rm', '-q', '--cached', '--', file], {cwd: root});
    rmSync(full);
  }
  console.log('PASS: five disposable tracked-source stock RPC audit fixtures');
} finally {
  rmSync(root, {recursive: true, force: true});
}
