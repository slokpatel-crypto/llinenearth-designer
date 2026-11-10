#!/usr/bin/env node
// Offline projection of manually captured psql output. NEVER contacts a database.
// This is untrusted evidence, not a staging attestation or migration authorization.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const versionPattern=/^(?:\d{8}|\d{14})$/;
const roles=['anon','authenticated','service_role'];
const functionNames=[
  'fabric_stock_record','fabric_stock_reserve','fabric_stock_release',
  'fabric_stock_consume_reservation','fabric_stock_record_v2',
  'fabric_stock_reserve_v2','fabric_stock_release_v2',
  'fabric_stock_consume_reservation_v2'
];
const expectedPairs=new Set(functionNames.flatMap(name=>roles.map(role=>name+'|'+role)));

/**
 * Projection for human/offline review, not a trusted SQL identity or project assertion.
 * psql must be invoked with --no-align --tuples-only --field-separator='|' and
 * --set=ON_ERROR_STOP=1, and its process exit code must be captured separately.
 */
export function extractUntrustedAppliedVersions(raw,{psqlExitCode}={}){
  if(psqlExitCode!==0)throw Error('Blocked: psql did not complete successfully');
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>4*1024*1024 || raw.includes('\0'))
    throw Error('Blocked: invalid or oversized psql evidence');
  const lines=raw.split(/\r?\n/);
  const versions=[];
  const matrix=new Map();
  const rolePresence=new Map();
  let connectionCount=0;
  let connectionLine=-1;
  let firstMatrixLine=-1;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(line.startsWith('connection_identity|')){
      const fields=line.split('|');
      if(fields.length!==6 || !fields[1] || !fields[2] || !/^\d*$/.test(fields[4]))
        throw Error('Blocked: malformed connection fingerprint');
      connectionCount++;
      connectionLine=i;
    } else if(line.startsWith('migration_history|')){
      const fields=line.split('|');
      if(fields.length!==3 || !versionPattern.test(fields[1]))
        throw Error('Blocked: malformed migration history row');
      versions.push({version:fields[1]});
      if(connectionLine<0 || firstMatrixLine>=0)
        throw Error('Blocked: unexpected history row order');
    } else if(line.startsWith('stock_function_effective_execute|')){
      if(firstMatrixLine<0)firstMatrixLine=i;
      const fields=line.split('|');
      if(fields.length!==7)throw Error('Blocked: malformed stock permissions row');
      const [,name,signature,exists,role,roleExists,canExecute]=fields;
      const pair=name+'|'+role;
      if(!expectedPairs.has(pair) || !['t','f'].includes(exists) ||
         !['t','f'].includes(roleExists) || !['t','f',''].includes(canExecute) ||
         (exists==='f' && signature!=='') ||
         (exists==='t' && !signature.startsWith(name+'(') && !signature.startsWith('public.'+name+'(')) ||
         ((exists==='f'||roleExists==='f') && canExecute!=='') ||
         (exists==='t' && roleExists==='t' && canExecute===''))
        throw Error('Blocked: inconsistent stock permissions row');
      const priorRoleExists=rolePresence.get(role);
      if(priorRoleExists!==undefined && priorRoleExists!==roleExists)
        throw Error('Blocked: inconsistent role presence across matrix');
      rolePresence.set(role,roleExists);
      const seen=matrix.get(pair)??new Set();
      if(seen.has(signature))throw Error('Blocked: repeated stock permissions row');
      seen.add(signature); matrix.set(pair,seen);
    }
  }
  if(connectionCount!==1 || firstMatrixLine<0 || connectionLine>=firstMatrixLine ||
     matrix.size!==expectedPairs.size)
    throw Error('Blocked: partial or ambiguous psql capture');
  // The SQL CROSS JOIN produces the same installed signatures for every role.
  // A contradictory matrix is an incomplete or forged capture, not reviewable evidence.
  for(const name of functionNames){
    const reference=matrix.get(name+'|'+roles[0]);
    for(const role of roles.slice(1)){
      const other=matrix.get(name+'|'+role);
      if(reference.size!==other.size || [...reference].some(signature=>!other.has(signature)))
        throw Error('Blocked: inconsistent stock function signature matrix');
    }
  }
  const counts=new Map();
  for(const row of versions)counts.set(row.version,(counts.get(row.version)??0)+1);
  const duplicates=[...counts].filter(([,count])=>count>1)
    .map(([version,count])=>({version,count})).sort((a,b)=>a.version.localeCompare(b.version));
  return {
    schema_version:1,
    evidence_class:'UNTRUSTED_OFFLINE_PSQL_PROJECTION',
    staging_project_verified:false,
    sql_source_identity_verified:false,
    release_ready:false,
    applied_versions:versions,
    duplicate_applied_versions:duplicates,
    expected_permission_pairs_observed:matrix.size,
    next_action:'Independent owner and database reviewer must verify staging, full raw capture, and migration identities. Version-only rows cannot resolve source collisions.'
  };
}

if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    if(process.argv.length!==4 || !/^(?:0|[1-9]\d*)$/.test(process.argv[3]))
      throw Error('Usage: node scripts/titan-extract-staging-migration-versions.mjs private-psql-output.txt psql-exit-code');
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(process.argv[2]));
    const report=extractUntrustedAppliedVersions(raw,{psqlExitCode:Number(process.argv[3])});
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    // Even complete output is UNTRUSTED and always blocks automated promotion.
    process.exitCode=2;
  }catch(e){console.error('BLOCKED: '+e.message);process.exitCode=2;}
}