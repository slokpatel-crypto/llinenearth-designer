import { readFileSync } from 'node:fs';

const hex64 = /^[a-f0-9]{64}$/;
const version = /^[0-9]{8,20}$/;

/** Compare claimed staging evidence to repository SQL identities without authorizing release. */
export function reconcileMigrationHistory(inventory, staging) {
  if (!Array.isArray(inventory) || !Array.isArray(staging)) throw new Error('Both inputs must be arrays');
  const byVersion = new Map();
  for (const row of inventory) {
    if (!row || typeof row.version !== 'string' || !version.test(row.version) || typeof row.filename !== 'string' || !row.filename.endsWith('.sql') || typeof row.sha256 !== 'string' || !hex64.test(row.sha256)) throw new Error('Invalid inventory row');
    const rows = byVersion.get(row.version) ?? [];
    if (rows.some(r => r.filename === row.filename)) throw new Error('Duplicate inventory filename');
    rows.push(row); byVersion.set(row.version, rows);
  }
  const seen = new Set();
  const results = [];
  for (const row of staging) {
    if (!row || typeof row.version !== 'string' || !version.test(row.version) || seen.has(row.version)) throw new Error('Invalid or repeated staging version');
    seen.add(row.version);
    const candidates = byVersion.get(row.version) ?? [];
    const claimedEvidence = row.evidence?.source === 'authenticated-read-only-staging' && typeof row.evidence?.project_id === 'string' && row.evidence.project_id.length > 0 && typeof row.evidence?.collected_at === 'string' && !Number.isNaN(Date.parse(row.evidence.collected_at)) && row.evidence?.sql_identity_verified === true;
    const hash = typeof row.sha256 === 'string' && hex64.test(row.sha256) ? row.sha256 : null;
    const matches = hash ? candidates.filter(c => c.sha256 === hash) : [];
    // Evidence fields are untrusted input: a claimed match still requires independent review.
    const status = claimedEvidence && matches.length === 1 ? 'REVIEW_REQUIRED' : 'BLOCKED';
    results.push({version: row.version, status, candidate_count: candidates.length, matched_filename: status === 'REVIEW_REQUIRED' ? matches[0].filename : null, reason: status === 'REVIEW_REQUIRED' ? 'INDEPENDENT_REVIEW_REQUIRED' : !claimedEvidence ? 'MISSING_AUTHENTICATED_SQL_IDENTITY' : !hash ? 'MISSING_SQL_FINGERPRINT' : matches.length === 0 ? 'NO_FINGERPRINT_MATCH' : 'AMBIGUOUS_FINGERPRINT'});
  }
  for (const [v, candidates] of byVersion) if (!seen.has(v)) results.push({version:v,status:'BLOCKED',candidate_count:candidates.length,matched_filename:null,reason:candidates.length > 1 ? 'COLLISION_NOT_IN_STAGING_HISTORY' : 'MIGRATION_NOT_IN_STAGING_HISTORY'});
  return {release_ready:false, results, blocked:results.length, note:'Input attestation fields are claims, not independently authenticated proof. No migration deployment approval is possible from this report.'};
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/titan-reconcile-migration-history.mjs inventory.json staging.json');
    const report = reconcileMigrationHistory(JSON.parse(readFileSync(process.argv[2], 'utf8')), JSON.parse(readFileSync(process.argv[3], 'utf8')));
    console.log(JSON.stringify(report, null, 2));
    // A comparison report never authorizes release, including empty inputs.\n    process.exitCode = report.release_ready === true && report.blocked === 0 ? 0 : 2;
  } catch (error) { console.error(String(error.message)); process.exitCode = 2; }
}
