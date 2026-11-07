#!/usr/bin/env node
// Static, source-only guard for this unmerged legacy stock RPC retirement migration.
// This is NOT a certificate that historical Supabase migration versions can deploy.
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const migrationDir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const expectedSuffix = '_legacy_stock_rpc_execute_retirement.sql';
const exactMigration = /^([0-9]{14})_legacy_stock_rpc_execute_retirement\.sql$/;
const namedMigration = /^([0-9]+)_[A-Za-z0-9_-]+\.sql$/;

export function validUtcVersion(version) {
  if (!/^[0-9]{14}$/.test(version)) return false;
  const [year,month,day,hour,minute,second] = [
    version.slice(0,4),version.slice(4,6),version.slice(6,8),
    version.slice(8,10),version.slice(10,12),version.slice(12,14)
  ].map(Number);
  const date = new Date(Date.UTC(year,month-1,day,hour,minute,second));
  return date.getUTCFullYear() === year && date.getUTCMonth()+1 === month &&
    date.getUTCDate() === day && date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}

export function checkRetirementMigrationNames(fileNames) {
  if (!Array.isArray(fileNames) || fileNames.some(name => typeof name !== 'string')) {
    throw Error('expected a list of migration filenames');
  }
  const retirementNames = fileNames.filter(name =>
    name.toLowerCase().includes('legacy_stock_rpc_execute_retirement') && name.toLowerCase().endsWith('.sql'));
  if (retirementNames.length !== 1) {
    throw Error('expected exactly one draft retirement migration, found ' + retirementNames.length);
  }
  const name = retirementNames[0];
  const match = exactMigration.exec(name);
  if (!match || !validUtcVersion(match[1])) {
    throw Error('draft retirement migration requires a valid 14-digit UTC Supabase version: ' + name);
  }
  const ownVersion = match[1];
  const versionConflicts = fileNames.filter(file =>
    namedMigration.exec(file)?.[1] === ownVersion);
  if (versionConflicts.length !== 1) {
    throw Error('duplicate draft retirement migration version ' + ownVersion +
      ': ' + versionConflicts.join(', '));
  }
  const historicalDays = fileNames.filter(file => file !== name)
    .map(file => namedMigration.exec(file)?.[1])
    .filter(version => version && /^[0-9]{8}$/.test(version));
  if (historicalDays.some(day => ownVersion.slice(0,8) < day)) {
    throw Error('draft retirement migration is backdated before historical migrations');
  }
  return {file:name,version:ownVersion,historicalMigrationFiles:fileNames.length};
}

if (process.argv[1] && fileURLToPath(import.meta.url) ===
    (await import('node:path')).resolve(process.argv[1])) {
  try {
    const files = readdirSync(migrationDir,{withFileTypes:true})
      .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
      .map(entry => entry.name);
    const result = checkRetirementMigrationNames(files);
    console.log('PASS: exactly one unique, calendar-valid 14-digit draft legacy stock RPC retirement migration: ' +
      result.file);
    console.log('LIMIT: historical duplicate migrations and remote applied history remain unverified');
  } catch (error) {
    console.error('BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
