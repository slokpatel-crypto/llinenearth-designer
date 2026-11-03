# TITAN — Supabase migration version inventory preflight

This is a **read-only safety control**, not a green production database migration. Related blocking issue [#882](https://github.com/slokpatel-crypto/llinenearth-designer/issues/882) and central checkpoint #865.

## Why this gate exists

At main `4dd8020abd83429449ff53ea5bb71b046394d86e`, 58 historical SQL migration files have just 36 version prefixes, with 14 duplicate-version groups. They mostly use eight-digit `YYYYMMDD` prefixes rather than unique 14-digit Supabase CLI timestamps. On draft integration #881, additional same-day SQL files increase the files to 63 but not distinct versions. Supabase compares timestamps with `supabase_migrations.schema_migrations`; a native `psql -f` checklist can pass despite an invalid or ambiguous `supabase db push` history.

**Function-order risk:** `20261103_stock_reservation_identity_length_gate.sql` redefines `public.fabric_stock_reserve_v2` with strict nontruncation. Filename-ordered `20261103_stock_reservation_provenance_gate.sql` later replaces the same RPC with `left(trim(...), N)` truncation. The curated native CI uses the opposite order, so this is not verified for Supabase CLI application.

## Commands and meaning

- `node scripts/audit-supabase-migration-versions.cjs --report`: inventory duplicate versions and detect the last filename-ordered `fabric_stock_reserve_v2` definition. Report only; no database connection.
- `node scripts/audit-supabase-migration-versions.cjs --enforce-new`: prevents *additional* ambiguous migration prefixes, newly added non-14-digit timestamps, deletion/renaming of any historic path, **and modification of historic SQL bytes** (checked against its original Git blob SHA-1 at frozen main `4dd8020a`). The manifest in `docs/TITAN_SUPABASE_MIGRATION_BASELINE.json` records all 58 original paths and hashes. **Passing means no newly introduced violations, NOT deployment readiness**; altering the manifest itself must require independent security/release review.
- `node scripts/audit-supabase-migration-versions.cjs --enforce-new --verify-git-baseline`: the dedicated CI's stronger option. It fetches complete Git history, reads the immutable original main tree at `4dd8020a`, and checks that **every historical migration path and blob SHA** matches that original commit. This prevents a modified checked-in baseline manifest from silently excusing edited SQL. Fails closed if the pinned commit cannot be inspected. No remote Supabase connection.
- `node scripts/audit-supabase-migration-versions.cjs --strict`: intentionally **fails** while any historical duplicate/nonstandard versions or last-definition strict identity loss remain. This is the future deployment-history gate, not a permitted bypass.
- `node --test scripts/test-supabase-migration-versions.cjs`: exercises duplicate/overlap fixtures, known historical debt and strict red-before-green enforcement.

Additional new-file gate: an added SQL migration must use a real calendar-valid 14-digit timestamp, must not be backdated before the latest frozen historical prefix, and must not redefine `public.fabric_stock_reserve_v2` without the active nontruncation checks on all five identity/evidence fields. These are source-level checks to prevent **new regressions**; they cannot certify remote history or prove SQL behavior without disposable PostgreSQL replay.

The inventory now **fails closed** if the migration directory contains a symbolic link, nested directory or case-ambiguous SQL filename (such as `.SQL`) instead of silently skipping it. These are rejected at scan time to prevent untracked SQL from bypassing version and hash checks.

The `TITAN Supabase Migration Version Inventory` GitHub Actions workflow runs only file-system reads and Node tests. It labels its passing job **legacy baseline, NOT deploy ready**. Do not remove legacy files or rename already-applied versions without comparing staging/remote migration history and a signed-off forward-only version map.

## Read-only staging migration-history reconciliation

A separate offline tool, `scripts/reconcile-supabase-migration-history.cjs`, can compare a **version-only export** from an explicitly approved **staging** project with the local migration tree. The tool never accesses Supabase, reads credentials, issues SQL, repairs migration history, or deploys anything. It is deliberately not an automatic live-project inspection.

Once a reviewer authorizes a safe staging read, obtain the applied `version` values from `supabase_migrations.schema_migrations` through an approved **read-only** console/role (not from customer/application tables). Do not run the query against production without specific approval. Locally write a temporary JSON file **outside this repo** with precisely these three fields:

```json
{
  "environment": "staging",
  "readOnly": true,
  "appliedVersions": ["20260920", "20260929"]
}
```

Those example versions are **illustrative only** and not a claim about any database. Include the full staging version list rather than substituting the example. Do not include project IDs, URLs, tokens, credentials or customer records. Run:

```bash
node scripts/reconcile-supabase-migration-history.cjs --snapshot /secure/local/path/approved-staging-versions.json
```

A report marked `BLOCKED` lists duplicate local versions, nonstandard prefixes, duplicate/unknown applied versions, and local migration paths not found in the staging version list. Such discrepancies must not be auto-repaired or hidden. A `STRUCTURALLY_CONSISTENT_REQUIRES_INDEPENDENT_REVIEW` report **still does not authorize a migration**: it has not checked actual remote function definitions, migration SQL ordering, data invariants, drift, rollback readiness or external callers. Remove the temporary staging version export securely according to the organization's retention practices; do not commit it.

The automated workflow uses only **synthetic snapshots** and confirms that existing duplicate-version history remains blocked even when a staging snapshot looks superficially plausible.


## Owner-approved migration-path remediation (still pending)

1. Read the actual approved staging migration history without mutating it (`supabase migration list --remote`, authenticated in a safe environment), and record the deployment mechanism and versions already applied.
2. Reconcile all existing collision groups with a reviewed, forward-only plan. Supabase CLI tracks timestamp as the unique migration ID. Do not blindly rename applied historical files or use `migration repair` to create pretend physical state.
3. Build a disposable database from the **exact proposed CLI migration order** and prove stock lock parity, precise version/identity rejection, customer share/session/OTP authorization, v1 ACL deny and v2 provenance with real role execution.
4. Re-run `--strict`, `supabase db push --dry-run` on approved nonproduction credentials, and independent security/stock review before approving a deploy. Record exact-head CI results. Keep Vercel deployment disabled.

Supabase current docs: https://supabase.com/docs/reference/cli/introduction and https://supabase.com/docs/guides/deployment/database-migrations

No live Supabase changes, migration repair, physical-stock claims or main merge authorized by this preflight.
