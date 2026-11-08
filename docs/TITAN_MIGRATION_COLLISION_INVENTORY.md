# TITAN migration collision inventory — source-only, non-authorizing

This isolated draft inventories **Git-tracked** Supabase SQL migration filenames. It does not connect to a database, read applied migration history, rename old migrations, issue SQL, repair history or approve a release.

The strict migration version preflight remains in [draft #903](https://github.com/slokpatel-crypto/llinenearth-designer/pull/903) and intentionally rejects historical eight-digit filenames. This **additional** read-only report makes that failure actionable by grouping all repeated eight-digit and fourteen-digit filename versions, even when the filename is not a valid modern Supabase migration name. It does not bypass or weaken that preflight.

Run `node --test tests/report-legacy-migration-prefixes.test.mjs` for pure tests. Run `node scripts/report-legacy-migration-prefixes.mjs --output inventory.json --reconciliation-output source-rows.json` at the reviewed checkout. The CI job checks out the exact PR event head and uploads **both non-authorizing JSON files**. It also validates that the tracked SQL bytes agree with the Git index objects. Unsafe or incomplete fingerprints stop the reporter with a failed exit status.

## Compatibility with draft #909

The generated `source-rows.json` is an **array of `{version,filename,sha256}` source rows** intended for the inventory input to draft [#909](https://github.com/slokpatel-crypto/llinenearth-designer/pull/909)'s existing read-only history comparator. Each row is derived from the exact Git-tracked file's validated SHA-256; no invented or inferred remote staging data is included. Two colliding filenames with the same eight-digit version remain two distinct rows. This is a data-format handoff only: PR #909's comparator lives on a separate unmerged branch and **its workflow is not executed by this PR**. Its second input must be independently authenticated owner-approved staging evidence. No direct use of the comparator can authorize release.

## Snapshot scope

At main `4dd8020abd83429449ff53ea5bb71b046394d86e`, a live GitHub directory metadata listing on November 8, 2026 showed **58 SQL files, 36 unique digit prefixes and 14 repeated prefix groups**. Draft #903 had one additional standard-timestamp migration (59 SQL, 37 prefixes) and the same 14 repeated groups. These are **different source scopes** from the combined integration draft #881, which previously contained 63 migrations. The CI report records its own immutable checkout SHA to prevent confusing these inventories.

## Required reviewer/owner acceptance (not accomplished here)

1. Identify an approved **staging**, never assume the one connected Supabase project is staging. Read only `supabase_migrations.schema_migrations` or the approved CLI history with authorized staging credentials.
2. Compare the actual applied versions with the named Git history for the exact candidate branch, especially repeated `20261103` stock RPC definitions. Do not rename a previously applied migration or run speculative `migration repair`.
3. Independently review a forward-only unique-version deployment plan, replay its **actual sequence** in disposable PostgreSQL, and prove the final v2 stock reserve RPC retains overlength rejection and historical v1 EXECUTE retirement.
4. Obtain independent database/security review, operator compatibility signoff and protected-main merge governance. The reporter is never a replacement for review.

All outputs deliberately retain `release_ready:false`, `staging_history_verified:false` and `approval:BLOCKED_PENDING_APPLIED_HISTORY_AND_REVIEW`. A green inventory CI means only that source evidence was collected safely.

Release blockers: [#882](https://github.com/slokpatel-crypto/llinenearth-designer/issues/882) migration history, [#878](https://github.com/slokpatel-crypto/llinenearth-designer/issues/878) protected main and independent approval. **No merge, database writes or deployment.**
