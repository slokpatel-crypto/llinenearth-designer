#!/usr/bin/env node
// Fail-closed offline validation of two captured, read-only stock ACL snapshots.
// This script never connects to PostgreSQL. Supply locally captured TSV files.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const RPC_SIGNATURES = Object.freeze([
  ['v1','public.fabric_stock_record(text,text,numeric,text)'],
  ['v1','public.fabric_stock_reserve(text,numeric,text,text)'],
  ['v1','public.fabric_stock_release(uuid,text)'],
  ['v1','public.fabric_stock_consume_reservation(uuid,numeric,text)'],
  ['v2','public.fabric_stock_record_v2(text,text,numeric,text,text,text)'],
  ['v2','public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)'],
  ['v2','public.fabric_stock_release_v2(uuid,text,text,text)'],
  ['v2','public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text)'],
]);
export const ACL_ROLES = Object.freeze(['PUBLIC','anon','authenticated','service_role']);
const expected = new Set(RPC_SIGNATURES.flatMap(([version, signature]) =>
  ACL_ROLES.map(role => [version, signature, role].join('|'))));

export function parseSnapshot(source, label) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error(label + ': empty ACL snapshot');
  }
  const rows = source.trimEnd().split(/\r?\n/);
  if (rows.length !== expected.size) {
    throw new Error(label + ': expected 32 ACL rows; received ' + rows.length);
  }
  const result = new Map();
  rows.forEach((line,index) => {
    const pieces = line.split('|');
    if (pieces.length !== 4) {
      throw new Error(label + ':' + (index+1) + ': malformed four-column ACL row');
    }
    const [version,signature,role,access] = pieces;
    const key = [version,signature,role].join('|');
    if (!expected.has(key)) throw new Error(label + ':' + (index+1) + ': unexpected ACL key ' + key);
    if (result.has(key)) throw new Error(label + ':' + (index+1) + ': duplicate ACL key ' + key);
    if (access !== 'EXECUTE' && access !== 'NO_EXECUTE') {
      throw new Error(label + ':' + (index+1) + ': missing or invalid ACL evidence ' + access);
    }
    result.set(key,access);
  });
  for (const key of expected) {
    if (!result.has(key)) throw new Error(label + ': missing ACL key ' + key);
  }
  return result;
}

export function verifySnapshotPair(beforeSource,afterSource) {
  const before = parseSnapshot(beforeSource,'before');
  const after = parseSnapshot(afterSource,'after');
  for (const [version,signature] of RPC_SIGNATURES) {
    for (const role of ACL_ROLES) {
      const key = [version,signature,role].join('|');
      const original = before.get(key);
      const current = after.get(key);
      if (version === 'v1') {
        if (role !== 'service_role' && original !== 'NO_EXECUTE') {
          throw new Error('before: unsafe non-service v1 privilege: ' + key);
        }
        if (current !== 'NO_EXECUTE') {
          throw new Error('after: retired v1 RPC remains executable: ' + key);
        }
      } else {
        const required = role === 'service_role' ? 'EXECUTE' : 'NO_EXECUTE';
        if (original !== required || current !== required) {
          throw new Error('v2 privilege drift or unsafe grant: ' + key +
            ' expected ' + required + ', before=' + original + ', after=' + current);
        }
      }
    }
  }
  return {beforeRows:before.size,afterRows:after.size,retiredRPCs:4,activeRPCs:4};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) {
      throw new Error('usage: node tests/stock-acl-snapshot-evidence.mjs before.tsv after.tsv');
    }
    const verified = verifySnapshotPair(
      readFileSync(process.argv[2],'utf8'),
      readFileSync(process.argv[3],'utf8'));
    console.log('PASS: fail-closed ACL snapshot pair verified (' +
      verified.beforeRows + ' before / ' + verified.afterRows +
      ' after; four retired v1 and four preserved v2 signatures)');
    console.log('LIMIT: offline snapshot evidence alone is not staging rollout approval');
  } catch (error) {
    console.error('BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
