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
// Include both desktop frontend and native Tauri/Rust backend, not only desktop/src.
const roots = ['src/', 'desktop/', 'scripts/'];
const sourceExtensions = /\.(?:[cm]?[jt]sx?|py|sh|sql|rs)$/i;
const files = execFileSync('git', ['ls-files', '-z', '--', ...roots], {encoding:'utf8'})
  .split('\0').filter(Boolean)
  .filter(path => sourceExtensions.test(path))
  .filter(path => !/(?:^|\/)(?:test|tests|__tests__)(?:\/|-|\.)/.test(path))
  .filter(path => !path.startsWith('scripts/audit-retired-stock-rpc-callers.'));
function foldedStaticStrings(source) {
  // Normalize only literal template strings; interpolated templates cannot be
  // resolved statically. This also catches mixed quote/template concatenation.
  source = source.replace(/`((?:\\.|[^`\\])*)`/g, (literal, body) =>
    body.includes('${') ? literal : JSON.stringify(body));
  // Detect statically concatenated quoted RPC names, including across lines.
  const quoted = /(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1\s*\+\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\3/g;
  // Fold simple, fully static JS arrays joined without separators, including
  // mixed quote/template pieces. Dynamic expressions remain outside this audit.
  const joined = /\[\s*((?:(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*,\s*)*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"))\s*\]\s*\.join\(\s*(?:''|"")\s*\)/g;
  let previous;
  do {
    previous = source;
    source = source.replace(quoted, (_match, _q1, left, _q2, right) => JSON.stringify(left + right));
    source = source.replace(joined, (_match, pieces) =>
      JSON.stringify((pieces.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g) || [])
        .map(piece => piece.slice(1, -1)).join('')));
  } while (source !== previous);
  return source;
}
let matches = 0;
for (const path of files) {
  // Permit only standalone declarations about historical migration content.
  // A live RPC call appended to an assertion, or on a nearby line, is audited.
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).map(line =>
    /^\s*requireTokens\(["']supabase\/migrations\/[^"']+["'],\s*\[[^\]]*\]\);\s*$/.test(line)
      ? '' : line);
  lines.forEach((line, index) => {
    for (const name of retired) {
      if (new RegExp('\\b' + name + '\\b').test(line)) {
        console.error(`BLOCKED: ${path}:${index + 1}: retired RPC ${name}`);
        matches++;
      }
    }
  });
  const source = lines.join('\n');
  const folded = foldedStaticStrings(source);
  for (const name of retired) {
    const exact = new RegExp('\\b' + name + '\\b', 'g');
    const literalCount = [...source.matchAll(exact)].length;
    const foldedCount = [...folded.matchAll(exact)].length;
    if (foldedCount > literalCount) {
      console.error(`BLOCKED: ${path}: ${foldedCount - literalCount} statically concatenated retired RPC ${name}`);
      matches += foldedCount - literalCount;
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
