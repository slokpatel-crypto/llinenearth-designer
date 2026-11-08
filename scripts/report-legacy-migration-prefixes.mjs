#!/usr/bin/env node
// Inventory only. Never interprets SQL, touches a database, or authorizes migration.
import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {basename, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT='supabase/migrations';
const SAFE_FILENAME=/^(\d{8}|\d{14})_([A-Za-z0-9_]+)\.sql$/;
export function fingerprintSql(bytes) {
  return {
    git_blob_sha1:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),
    content_sha256:createHash('sha256').update(bytes).digest('hex')
  };
}
export function summarizeMigrationEntries(entries, sourceCommit='unknown') {
  const groups=new Map();
  const problems=[];
  const fingerprints=[];
  let legacy=0, standard=0, sqlFiles=0;
  const seen=new Set();
  for(const item of entries){
    const path=item.path;
    if(typeof path!=='string'||!path||seen.has(path)){
      problems.push({kind:'invalid_or_duplicate_path',path:String(path)});continue;
    }
    seen.add(path);
    const name=basename(path);
    if(!name.toLowerCase().endsWith('.sql'))continue;
    sqlFiles++;
    if(dirname(path)!==ROOT || item.kind!=='file'){
      problems.push({kind:'unsafe_source_entry',path});continue;
    }
    const match=SAFE_FILENAME.exec(name);
    if(!match){problems.push({kind:'invalid_filename',path});continue;}
    if(!/^[0-9a-f]{40}$/.test(item.git_blob_sha1||'') ||
       !/^[0-9a-f]{64}$/.test(item.content_sha256||'')){
      problems.push({kind:'missing_or_invalid_source_fingerprint',path});continue;
    }
    fingerprints.push({path,git_blob_sha1:item.git_blob_sha1,content_sha256:item.content_sha256});
    const version=match[1];
    if(version.length===8)legacy++;else standard++;
    const bucket=groups.get(version)||[];
    bucket.push(path);
    groups.set(version,bucket);
  }
  if(!sqlFiles) problems.push({kind:'no_migrations',path:ROOT});
  const collisions=[...groups.entries()].filter(([,files])=>files.length>1)
    .map(([version,files])=>({version,version_format:version.length===8?'legacy_8_digit':'standard_14_digit',files:files.sort(),count:files.length}))
    .sort((a,b)=>a.version.localeCompare(b.version));
  return {
    schema_version:1,source_commit:sourceCommit,source_scope:'git_tracked_repository_files',
    total_sql_files:sqlFiles,unique_numeric_versions:groups.size,
    legacy_eight_digit_files:legacy,standard_fourteen_digit_files:standard,
    collision_group_count:collisions.length,colliding_file_count:collisions.reduce((n,c)=>n+c.count,0),
    collisions,file_fingerprints:fingerprints.sort((a,b)=>a.path.localeCompare(b.path)),
    content_fingerprints_complete:fingerprints.length===sqlFiles && problems.length===0,
    invalid_entries:problems.sort((a,b)=>a.path.localeCompare(b.path)),
    // Distinguish data collection success from readiness; a clean repo is not remote applied history.
    report_generated:true,staging_history_verified:false,independent_review_complete:false,
    release_ready:false,approval:'BLOCKED_PENDING_APPLIED_HISTORY_AND_REVIEW'
  };
}
// File-version collisions are expected review findings. Unsafe/missing
// source entries or incomplete hashes are evidence integrity failures.
export function inventoryIntegrityVerified(report){
  return report?.content_fingerprints_complete===true &&
    Array.isArray(report?.invalid_entries) && report.invalid_entries.length===0 &&
    Array.isArray(report?.file_fingerprints) &&
    report.file_fingerprints.length===report.total_sql_files && report.total_sql_files>0;
}
// Adapter for the source-side input of draft #909's migration-history comparator.
// No staged/applied-version data is supplied or inferred by this adapter.
export function reconciliationRows(report){
  if(!inventoryIntegrityVerified(report))throw Error('Incomplete source inventory; reconciliation export blocked');
  const output=[];
  const seen=new Set();
  for(const item of report.file_fingerprints){
    const match=/^supabase\/migrations\/((\d{8}|\d{14})_[A-Za-z0-9_]+\.sql)$/.exec(item.path);
    if(!match)throw Error('Unsafe migration path in reconciliation export');
    if(seen.has(item.path))throw Error('Repeated migration path in reconciliation export');
    seen.add(item.path);
    if(!/^[a-f0-9]{64}$/.test(item.content_sha256) || !/^[a-f0-9]{40}$/.test(item.git_blob_sha1))
      throw Error('Invalid source fingerprint in reconciliation export');
    output.push({version:match[2],filename:match[1],sha256:item.content_sha256});
  }
  return output.sort((a,b)=>a.filename.localeCompare(b.filename));
}
export function collectTrackedMigrations(){
  // Evidence must describe HEAD, not dirty or separately staged SQL files.
  execFileSync('git',['diff','--quiet','HEAD','--',ROOT]);
  const raw=execFileSync('git',['ls-files','--stage','-z','--',ROOT],{encoding:'utf8'});
  return raw.split('\0').filter(Boolean).map(row=>{
    const match=/^(\d{6}) ([0-9a-f]{40}) (\d)\t(.*)$/.exec(row);
    if(!match)throw Error('Unparseable tracked Git index entry');
    const [,mode,oid,stage,path]=match;
    if(stage!=='0')throw Error('Unmerged SQL migration index entry: '+path);
    let kind='missing';
    let hashes={};
    try {
      const stat=lstatSync(path);
      kind=stat.isFile()?'file':stat.isSymbolicLink()?'symlink':'other';
      if(kind==='file'){
        const bytes=readFileSync(path);
        hashes=fingerprintSql(bytes);
        if(hashes.git_blob_sha1!==oid)throw Error('SQL content differs from committed Git blob: '+path);
        if(mode!=='100644'&&mode!=='100755')throw Error('Unexpected Git file mode: '+path);
      }
    } catch(e) {
      if(e?.code!=='ENOENT')throw e;
    }
    return {path,kind,...hashes};
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const args=process.argv.slice(2);
    const destinations=new Map();
    if(args.length%2 || args.length>4)throw Error('Usage: node report-legacy-migration-prefixes.mjs [--output PATH] [--reconciliation-output PATH]');
    for(let i=0;i<args.length;i+=2){
      const opt=args[i],target=args[i+1];
      if(!['--output','--reconciliation-output'].includes(opt) || destinations.has(opt) ||
         typeof target!=='string' || !target || target.startsWith('--'))
        throw Error('Invalid inventory output arguments');
      destinations.set(opt,target);
    }
    if(destinations.get('--output') && destinations.get('--output')===destinations.get('--reconciliation-output'))
      throw Error('Outputs must use distinct paths');
    const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const result=summarizeMigrationEntries(collectTrackedMigrations(),head);
    const serialized=JSON.stringify(result,null,2)+'\n';
    process.stdout.write(serialized);
    if(!inventoryIntegrityVerified(result)){
      console.error('BLOCKED: unsafe, missing, or incomplete tracked migration source evidence');
      process.exitCode=1;
    }else{
      const sourceOutput=destinations.get('--output');
      if(sourceOutput)writeFileSync(sourceOutput,serialized,{flag:'w'});
      const reconcileOutput=destinations.get('--reconciliation-output');
      if(reconcileOutput)writeFileSync(reconcileOutput,JSON.stringify(reconciliationRows(result),null,2)+'\n',{flag:'w'});
    }
  }catch(error){console.error('BLOCKED: unable to collect read-only migration inventory:',error.message);process.exitCode=1;}
}
