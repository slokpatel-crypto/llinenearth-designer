# TITAN J1 — historical migration collision reconciliation (2026-11-05)

Status: **BLOCKED — evidence inventory only; NOT a migration plan or staging approval.**

Parent branch head before this documentation slice: `668112005e9122d55352279ac631f85c29c4fdec` (draft PR #908 stacked on #906). Source: fail-closed migration inventory run `42022658556`, JSON artifact `13412796255` (4,470 bytes, reported expiry 2026-11-19). Full CI `42022658438` and Non-3D QA `42022658488` passed at that parent SHA; the migration-history gate failed intentionally. These are **parent** checks, not checks for this documentation commit.

## Collision groups requiring authenticated staging reconciliation

The extracted 36-file working matrix contains 14 duplicated migration-version prefixes. Within each group all listed files have distinct SHA-256 SQL fingerprints; no group may be collapsed as byte-identical.

| Version prefix | Distinct files | Distinct SQL fingerprints |
| --- | ---: | ---: |
| 20260930 | 5 | 5 |
| 20261001 | 5 | 5 |
| 20261007 | 2 | 2 |
| 20261023 | 2 | 2 |
| 20261024 | 3 | 3 |
| 20261026 | 2 | 2 |
| 20261027 | 2 | 2 |
| 20261028 | 2 | 2 |
| 20261029 | 2 | 2 |
| 20261030 | 2 | 2 |
| 20261031 | 2 | 2 |
| 20261101 | 2 | 2 |
| 20261102 | 2 | 2 |
| 20261103 | 3 | 3 |
| **Total** | **36** | **36** |

A separate locally extracted 36-row CSV includes each filename and SQL fingerprint; it is not a staging-derived artifact and has **not** been committed to this repository. The source GitHub Actions JSON artifact is the canonical downloadable evidence while retained. Do not infer applied migration identity from filename or version alone.

## Required before any migration repair or release

1. Obtain authorized **read-only** `supabase_migrations.schema_migrations` history from the correct staging project, with project identity, collection timestamp and responsible reviewer; never publish secrets.
2. Match every applied version to independently authenticated SQL provenance, including exact file bytes / SHA-256 when obtainable. A version-only staging record cannot resolve same-version different-SQL files.
3. Mark each collision **UNRESOLVED** until its applied identity and ordering are independently proven. Record any unknown or ambiguous rows explicitly; do not guess, rename applied versions blindly, or alter live history.
4. Draft a forward-only, owner-reviewed resolution mapping; verify the actual migration runner's ordering and a complete replay on a disposable PostgreSQL instance, including negative collision tests.
5. Require matching-head Full CI, Non-3D, security, release and database checks before any isolated main intake. Confirm main `vercel.json` has `git.deploymentEnabled === false` immediately before any authorized main update.

**Next independent slice:** implement a fail-closed machine-readable staging-history reconciliation validator using a synthetic, non-secret fixture and tests; it must reject version-only claims as proof of SQL identity. Do not contact production or staging without authorized read-only access.

Physical stock, customer/operator, tailor, device, native Blender/UV and owner approvals remain PENDING/BLOCKED. No deploy or live migration is authorized.
