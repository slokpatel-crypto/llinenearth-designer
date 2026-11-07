#!/usr/bin/env node
// Fail closed if a tracked application or operational script calls retired stock v1 RPCs.
// Scope is intentionally source-only: historical SQL, tests and documentation must retain
// the old names to prove that permission retirement works.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const retired = [
  'fabric_stock_record',
  'fabric_stock_reserve',
  'fabric_stock_release',
  'fabric_stock_consume_reservation',
];
const roots = ['src/', 'desktop/src/', 'scripts/'];
const sourceExtensions = /\.(?:[cm]?[jt]sx?|py|sh|sql|rs)$/i;
const files = execFileSync('git', ['ls-files', '-z', '--', ...roots], {encoding:'utf8'})
  .split('\0').filter(Boolean)
  .filter(path => sourceExtensions.test(path))
  .filter(path => !/(?:^|\/)(?:test|tests|__tests__)(?:\/|-|\.)/.test(path))
  .filter(path => !path.startsWith('scripts/audit-retired-stock-rpc-callers.'));
function foldedStaticStrings(source) {
  // Detect statically concatenated quoted RPC names, including across lines.
  const quoted = /(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1\s*\+\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\3/g;
  let previous;
  do {
    previous = source;
    source = source.replace(quoted, (_match, _q1, left, _q2, right) => JSON.stringify(left + right));
  } while (source !== previous);
  return source;
}
let matches = 0;
for (const path of files) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    // Release gate assertions inspect historical migration text; they are not RPC invocations.
    // Exempt only that exact declarative assertion, never the entire release-gate file.
    if (/^\s*requireTokens\(["']supabase\/migrations\//.test(line)) return;
    for (const name of retired) {
      if (new RegExp('\\b' + name + '\\b').test(line)) {
        console.error(`BLOCKED: ${path}:${index + 1}: retired RPC ${name}`);
        matches++;
      }
    }
  });
  const folded = foldedStaticStrings(lines.join('\n'));
  for (const name of retired) {
    if (folded.includes(name) && !lines.some(line => new RegExp('\\b' + name + '\\b').test(line))) {
      console.error(`BLOCKED: ${path}: statically concatenated retired RPC ${name}`);
      matches++;
    }
  }
}
if (!files.length) {
  console.error('BLOCKED: no tracked application source files inspected');
  process.exit(1);
}
if (matches) {
  console.error(`BLOCKED: ${matches} retired RPC reference(s); migrate callers to provenance-bearing v2 before rollout`);
  process.exit(1);
}
console.log(`PASS: inspected ${files.length} tracked application/operational source files; no retired v1 stock RPC references`);
console.log('LIMIT: does not cover external jobs, deployed integrations, dynamic RPC name construction or staging permissions');
