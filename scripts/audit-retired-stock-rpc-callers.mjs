#!/usr/bin/env node
// Fail closed if a tracked application or operational script calls retired stock v1 RPCs.
// Scope is intentionally source-only: historical SQL, tests and documentation must retain
// the old names to prove that permission retirement works.
import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync} from 'node:fs';

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
  // Statistically written hex/Unicode code points can hide real v1 RPC names.
  // Conservatively decode these simple escapes for auditing only; do not
  // evaluate expressions or execute the inspected source.
  source = source.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\{([0-9a-fA-F]{1,6})\})/g,
    (sequence, hex, four, braced) => {
      const point = Number.parseInt(hex ?? four ?? braced, 16);
      return point <= 0x10ffff ? String.fromCodePoint(point) : sequence;
    });
  // Evaluate only bounded, printable-ASCII literal character-code builders.
  // Never attempt a dynamic expression or arbitrary source execution.
  source = source.replace(
    /\bString\.(?:fromCharCode|fromCodePoint)\(\s*((?:(?:0x[0-9a-fA-F]{1,4}|\d{1,6})\s*,\s*)*(?:0x[0-9a-fA-F]{1,4}|\d{1,6}))\s*\)/g,
    (expression, argumentsText) => {
      const parts = argumentsText.split(',').map(value => value.trim());
      if (parts.length > 80) return expression;
      const codes = parts.map(Number);
      if (codes.some(code => !Number.isInteger(code) || code < 32 || code > 126)) return expression;
      return JSON.stringify(String.fromCharCode(...codes));
    },
  );
  // Normalize only literal template strings; interpolated templates cannot be
  // resolved statically. This also catches mixed quote/template concatenation.
  source = source.replace(/`((?:\\.|[^`\\])*)`/g, (literal, body) =>
    body.includes('${') ? literal : JSON.stringify(body));
  // Detect statically concatenated quoted RPC names, including across lines.
  const quoted = /(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1\s*\+\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\3/g;
  // Fold simple, fully static JS arrays joined without separators, including
  // mixed quote/template pieces. Dynamic expressions remain outside this audit.
  const joined = /\[\s*((?:(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*,\s*)*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"))\s*\]\s*\.join\(\s*(?:''|"")\s*\)/g;
  // Statically specified .concat(...) arguments can assemble retired RPC names
  // without a + operator. Keep dynamic arguments unexpanded.
  const concat = /(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1\s*\.concat\(\s*((?:(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*,\s*)*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"))\s*\)/g;
  let previous;
  do {
    previous = source;
    source = source.replace(quoted, (_match, _q1, left, _q2, right) => JSON.stringify(left + right));
    source = source.replace(joined, (_match, pieces) =>
      JSON.stringify((pieces.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g) || [])
        .map(piece => piece.slice(1, -1)).join('')));
    source = source.replace(concat, (_match, _quote, start, pieces) =>
      JSON.stringify(start + (pieces.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g) || [])
        .map(piece => piece.slice(1, -1)).join('')));
  } while (source !== previous);
  return source;
}
let matches = 0;
for (const path of files) {
  // A tracked symlink can redirect the audit outside the checked-out repository.
  // Fail closed rather than following it or accepting a missing source.
  if (!lstatSync(path).isFile()) {
    console.error(`BLOCKED: ${path}: tracked source is not a regular file`);
    matches++;
    continue;
  }
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
  console.error(`BLOCKED: ${matches} invalid source file or retired RPC reference(s); migrate callers to provenance-bearing v2 before rollout`);
  process.exit(1);
}
console.log(`PASS: inspected ${files.length} tracked application/operational source files; no retired v1 stock RPC references`);
console.log('LIMIT: does not cover external jobs, deployed integrations, dynamic RPC name construction or staging permissions');
