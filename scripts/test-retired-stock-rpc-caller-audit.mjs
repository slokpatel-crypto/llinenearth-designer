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
  ['same-line active RPC after historical assertion', 'scripts/release-readiness.mjs',
    'requireTokens("supabase/migrations/legacy.sql", ["fabric_stock_record"]); client.rpc("fabric_stock_record", payload);', false],
  ['folded v1 RPC beside historical assertion', 'scripts/release-readiness.mjs',
    'requireTokens("supabase/migrations/legacy.sql", ["fabric_stock_reserve"]);\nclient.rpc("fabric_stock_" + "reserve", payload);', false],
  ['v2 RPC beside historical assertion stays valid', 'scripts/release-readiness.mjs',
    'requireTokens("supabase/migrations/legacy.sql", ["fabric_stock_reserve"]);\nclient.rpc("fabric_stock_reserve_v2", payload);', true],
  ['active call in release gate', 'scripts/release-readiness.mjs',
    'client.rpc("fabric_stock_release", payload);', false],
  ['legacy name in desktop source', 'desktop/src/stock.ts',
    'const method = "fabric_stock_consume_reservation";', false],
  ['retired v1 in Tauri Rust backend', 'desktop/src-tauri/src/stock.rs',
    'let rpc = "fabric_stock_record";', false],
  ['v2 in Tauri Rust backend remains valid', 'desktop/src-tauri/src/stock-v2.rs',
    'let rpc = "fabric_stock_record_v2";', true],
  ['v2 RPC names remain valid', 'src/v2.ts',
    'const names = ["fabric_stock_record_v2", "fabric_stock_reserve_v2", "fabric_stock_release_v2", "fabric_stock_consume_reservation_v2"];', true],
  ['statically concatenated v2 remains valid', 'src/v2-static.ts',
    'client.rpc("fabric_stock_" + "reserve_v2", payload);', true],
  ['statically concatenated retired v1 blocked', 'src/v1-static.ts',
    'client.rpc("fabric_stock_" + "reserve", payload);', false],
  ['multiline concatenated retired v1 blocked', 'desktop/src/v1-multiline.ts',
    'const method = "fabric_stock_" +\n "release";', false],
  ['retired template concatenation', 'src/v1-template.ts',
    'client.rpc(`fabric_stock_` + `release`, payload);', false],
  ['mixed quote/template retired name', 'src/v1-mixed.ts',
    'client.rpc("fabric_stock_" + `record`, payload);', false],
  ['three-part retired template name', 'desktop/src/v1-3parts.ts',
    'client.rpc(`fabric_stock_` + `consume_` + "reservation", payload);', false],
  ['concatenated v2 template is valid', 'src/v2-template.ts',
    'client.rpc(`fabric_stock_` + `reserve_v2`, payload);', true],
  ['array join reserve blocked', 'src/v1-joined.ts',
    'client.rpc(["fabric_stock_", "reserve"].join(""), payload);', false],
  ['array join consume blocked', 'src/v1-consume-joined.ts',
    "client.rpc(['fabric_stock_', 'consume_', 'reservation'].join(''), payload);", false],
  ['array join then concatenation blocked', 'src/v1-join-plus.ts',
    'client.rpc(["fabric_stock_", "re"].join("") + "serve", payload);', false],
  ['array join with template blocked', 'src/v1-template-join.ts',
    'client.rpc(["fabric_stock_", `release`].join(""), payload);', false],
  ['array join of v2 is safe', 'src/v2-joined.ts',
    'client.rpc(["fabric_stock_", "reserve_v2"].join(""), payload);', true],
  ['nonempty separator is not a retired name', 'src/v1-not-exact.ts',
    'client.rpc(["fabric_stock_", "reserve"].join("_"), payload);', true],
  ['hex-escaped retired RPC blocked', 'src/v1-hex-escaped.ts',
    'client.rpc("fabric_stock_\\x72eserve", payload);', false],
  ['unicode-escaped retired RPC blocked', 'src/v1-unicode-escaped.ts',
    'client.rpc("fabric_stock_\\u0072eserve", payload);', false],
  ['codepoint-escaped retired RPC blocked', 'src/v1-codepoint-escaped.ts',
    'client.rpc("fabric_stock_\\u{72}elease", payload);', false],
  ['escaped array join v1 blocked', 'src/v1-escaped-joined.ts',
    'client.rpc(["fabric_stock_", "\\u0072eserve"].join(""), payload);', false],
  ['hex-escaped v2 permitted', 'src/v2-escaped.ts',
    'client.rpc("fabric_stock_\\x72eserve_v2", payload);', true],
  ['fromCharCode v1 reserve is blocked', 'src/v1-fromchar.ts',
    'client.rpc("fabric_stock_" + String.fromCharCode(114,101,115,101,114,118,101), payload);', false],
  ['fromCharCode full v1 release is blocked', 'desktop/src/v1-fromchar-full.ts',
    'client.rpc(String.fromCharCode(102,97,98,114,105,99,95,115,116,111,99,107,95,114,101,108,101,97,115,101), payload);', false],
  ['fromCodePoint v1 record is blocked', 'src/v1-codepoint.ts',
    'client.rpc("fabric_stock_" + String.fromCodePoint(0x72,0x65,0x63,0x6f,0x72,0x64), payload);', false],
  ['fromCodePoint v2 reserve is allowed', 'src/v2-codepoint.ts',
    'client.rpc("fabric_stock_" + String.fromCodePoint(0x72,0x65,0x73,0x65,0x72,0x76,0x65,0x5f,0x76,0x32), payload);', true],
  ['dynamic fromCharCode is outside static audit', 'src/dynamic-code.ts',
    'client.rpc("fabric_stock_" + String.fromCharCode(lookup), payload);', true],
  ['non-printable fromCharCode is not folded', 'src/nonprinting-code.ts',
    'client.rpc("fabric_stock_" + String.fromCharCode(10), payload);', true],
  ['longer identifier not v1', 'src/identifier.ts',
    'const key = "prefix_fabric_stock_reserve";', true],
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
  console.log(`PASS: ${cases.length} disposable tracked-source stock RPC audit fixtures`);
} finally {
  rmSync(root, {recursive: true, force: true});
}
