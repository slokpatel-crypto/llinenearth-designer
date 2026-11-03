# TITAN — Supabase migration version inventory preflight

This is a **read-only safety control**, not a green production database migration. Related blocking issue [#882](https://github.com/slokpatel-crypto/llinenearth-designer/issues/882) and central checkpoint #865.

## Why this gate exists

At main `4dd8020abd83429449ff53ea5bb71b046394d86e`, 58 historical SQL migration files have just 36 version prefixes, with 14 duplicate-version groups. They mostly use eight-digit `YYYYMMDD` prefixes rather than unique 14-digit Supabase CLI timestamps. On draft integration #881, additional same-day SQL files increase the files to 63 but not distinct versions. Supabase compares timestamps with `supabase_migrations.schema_migrations`; a native `psql -f` checklist can pass despite an invalid or ambiguous `supabase db push` history.

**Function-order risk:** `20261103_stock_reservation_identity_length_gate.sql` redefines `public.fabric_stock_reserve_v2` with strict nontruncation. Filename-ordered `20261103_stock_reservation_provenance_gate.sql` later replaces the same RPC with `left(trim(...), N)` truncation. The curated native CI uses the opposite order, so this is not verified for Supabase CLI application.

## Commands and meaning

- `node scripts/audit-supabase-migration-versions.cjs --report`: inventory duplicate versions and detect the last filename-ordered `fabric_stock_reserve_v2` definition. Report only; no database connection.
- `node scripts/audit-supabase-migration-versions.cjs --enforce-new`: prevents *additional* ambiguous migration prefixes, newly added non-14-digit timestamps, and deletion/renaming of any historic path in `docs/TITAN_SUPABASE_MIGRATION_BASELINE.json`. **Passing means no newly introduced violations, NOT deployment readiness**.
- `node scripts/audit-supabase-migration-versions.cjs --strict`: intentionally **fails** while any historical duplicate/nonstandard versions or last-definition strict identity loss remain. This is the future deployment-history gate, not a permitted bypass.
- `node --test scripts/test-supabase-migration-versions.cjs`: exercises duplicate/overlap fixtures, known historical debt and strict red-before-green enforcement.

The `TITAN Supabase Migration Version Inventory` GitHub Actions workflow runs only file-system reads and Node tests. It labels its passing job **legacy baseline, NOT deploy ready**. Do not remove legacy files or rename already-applied versions without comparing staging/remote migration history and a signed-off forward-only version map.

## Owner-approved migration-path remediation (still pending)

1. Read the actual approved staging migration history without mutating it (`supabase migration list --remote`, authenticated in a safe environment), and record the deployment mechanism and versions already applied.
2. Reconcile all existing collision groups with a reviewed, forward-only plan. Supabase CLI tracks timestamp as the unique migration ID. Do not blindly rename applied historical files or use `migration repair` to create pretend physical state.
3. Build a disposable database from the **exact proposed CLI migration order** and prove stock lock parity, precise version/identity rejection, customer share/session/OTP authorization, v1 ACL deny and v2 provenance with real role execution.
4. Re-run `--strict`, `supabase db push --dry-run` on approved nonproduction credentials, and independent security/stock review before approving a deploy. Record exact-head CI results. Keep Vercel deployment disabled.

Supabase current docs: https://supabase.com/docs/reference/cli/introduction and https://supabase.com/docs/guides/deployment/database-migrations

No live Supabase changes, migration repair, physical-stock claims or main merge authorized by this preflight.
