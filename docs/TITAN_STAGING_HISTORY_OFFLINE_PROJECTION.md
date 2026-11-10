# TITAN — offline staging-history projection (untrusted, manual only)

**Status: preparation only; NOT run on staging or production.** This tool handles *previously collected*, owner-approved, private output from `docs/TITAN_STAGING_MIGRATION_READONLY_PROBE.sql` in draft PR #913. It does not create a database connection, query Supabase, migrate anything, verify a staging project, identify which source SQL file was applied, or approve deployment.

## Authorized reviewer workflow

1. An independent owner/database reviewer must identify the exact **staging** project using a trusted separate control plane and authorize the read-only reviewer account. Do not point this tool or probe at production.
2. Only after approval, the reviewer invokes the existing probe manually with `psql --no-psqlrc --set=ON_ERROR_STOP=1 --no-align --tuples-only --field-separator='|' --file docs/TITAN_STAGING_MIGRATION_READONLY_PROBE.sql`. Capture its **actual exit code** separately and retain raw stdout/stderr **privately**; do not put raw database output, function bodies, connection metadata, tokens or URLs in GitHub issues, PR comments or CI artifacts.
3. Run the **offline** parser from the local repository with `node scripts/titan-extract-staging-migration-versions.mjs PRIVATE_CAPTURE_FILE ACTUAL_PSQL_EXIT_CODE`. It only reads the local file and emits a limited JSON version projection. An exit status of **2 is intentional even for a valid untrusted capture**: never use the command as a green release check. Save the JSON privately for independent review.
4. The parser requires the connection fingerprint row and all 24 expected stock function/role permission pairs, with safe handling of function overloads, and rejects malformed/partial records or a nonzero upstream psql exit code. Duplicate applied versions are retained and flagged; no source SQL hash, filename, evidence attestation or production approval is fabricated.
5. Pass only the `applied_versions` value (array of `{version}` objects) to the existing offline draft #909 reconciler after an independent reviewer checks the capture; do not invent `sha256` or `sql_identity_verified` fields. Its output must remain BLOCKED without separately authenticated proof. The source-only inventory from #912 gives candidate file identities, but cannot identify applied SQL from a version alone.

**Private evidence handling:** keep raw captures and projections in a restricted local or approved private evidence store and delete per the owner's retention policy. The script prints no database name, reviewer role, server address, function source or permission details. Its output is an *unverified projection* that may be incomplete or forged; validation of shape and a claimed zero process code is **not** independent staging authentication.

## CI scope and remaining blockers

`.github/workflows/titan-offline-staging-history.yml` runs synthetic Node.js tests only. It cannot access Supabase/staging/production, set credentials, execute `psql`, or apply migrations. Production blockers remain migration collisions and function overwrite ordering in #882, protected-main/independent review in #878, physical garment acceptance, and explicit owner approval.

**Never:** automate the live staging probe, treat a complete projection as project identity, rename historical applied migrations, run `migration repair` without separate authorization, weaken strict preflight, merge or deploy from this document.
