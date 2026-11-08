#!/usr/bin/env node
// Inventory only. Never interprets SQL, touches a database, or authorizes migration.
import {execFileSync} from 'node:child_process';
import {lstatSync, writeFileSync} from 'node:fs';
import {basename, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT='supabase/migrations';
const SAFE_FILENAME=/^(\d{8}|\d{14})_([A-Za-z0-9_]+)\.sql$/;
export function summarizeMigrationEntries(entries, sourceCommit='unknown') {
  const groups=new Map();
  const problems=[];
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
    collisions,invalid_entries:problems.sort((a,b)=>a.path.localeCompare(b.path)),
    // Distinguish data collection success from readiness; a clean repo is not remote applied history.
    report_generated:true,staging_history_verified:false,independent_review_complete:false,
    release_ready:false,approval:'BLOCKED_PENDING_APPLIED_HISTORY_AND_REVIEW'
  };
}
export function collectTrackedMigrations(){
  const raw=execFileSync('git',['ls-files','-z','--',ROOT],{encoding:'utf8'});
  const paths=raw.split('\0').filter(Boolean);
  return paths.map(path=>{
    let kind='missing';
    try {const s=lstatSync(path);kind=s.isFile()?'file':s.isSymbolicLink()?'symlink':'other';}
    catch {kind='missing';}
    return {path,kind};
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const args=process.argv.slice(2);
    if(args.length>2 || (args.length && (args[0]!=='--output'||args.length!==2)))throw Error('Usage: node report-legacy-migration-prefixes.mjs [--output PATH]');
    const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const result=summarizeMigrationEntries(collectTrackedMigrations(),head);
    const serialized=JSON.stringify(result,null,2)+'\n';
    if(args.length)writeFileSync(args[1],serialized,{flag:'w'});
    process.stdout.write(serialized);
  }catch(error){console.error('BLOCKED: unable to collect read-only migration inventory:',error.message);process.exitCode=1;}
}
