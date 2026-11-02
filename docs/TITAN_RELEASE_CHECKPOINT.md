# TITAN release checkpoint — compatible M65 (2026-11-02 UTC)

The historical paths `docs/TITAN_RELEASE_CHECKPOINT.md`, `docs/TITAN_RELEASE_CHECKLIST.md` and `TODO.md` were **absent** from the M63 Git tree. This is a newly established checkpoint, **not** a reconstruction of historical M8–M63 files. Previous evidence remains in stacked PR descriptions and GitHub Actions. `AGENTS.md`, `DECISIONS.md` and `docs/production-release-checklist.md` exist.

## Verified ancestry and external read-only state
- Exact M65 parent: draft PR #756 M64 `94da1c944e1e48b3a3cd61de4098fc4d23fc795b`, itself stacked on draft PR #755 M63 `9241972045250c85228e07219266f0615e8b8bae` → #754 M62 `9ff55e554797ff39766919423db8ed03c27d5e2f`. Preserve all parents and sibling PR #757; do not silently overwrite them.
- M63 matching-head Full CI `41378290699` and independent Non-3D `41378290621` both **SUCCESS**, including disposable PostgreSQL 17.6 native and PostgREST. M64 PR #756 matching-head CI was **IN PROGRESS** at M65 branch creation; M65 must pass its own exact-head CI.
- Live Supabase **read-only** 2026-11-02: PostgreSQL 17.6; no development branches; `public.fabric_stock_record_v3` absent, `fabric_stock_snapshot_v2` and `fabric_stock_reserve_v2` present. No live migration, SQL write or Supabase development branch was created. The v3-dependent draft is not approved for live rollout.
- Last inspected `main` SHA `2f9c6fe27b62b40db568fd56bbc9c56d6d01d170`. No main merge or deployment. Re-fetch main and confirm `vercel.json` deployment disabled before any isolated main intake.

## M65 acceptance slice: operator stock JSON errors under fail-closed rollout gate
- Affected engineering criteria: T5/J5 privileged stock-write safety, T6/J6 regressions. **No full T1–T6/J1–J6 launch criterion newly certified.**
- Parent `94da1c944e1e48b3a3cd61de4098fc4d23fc795b` has an opt-in server-side `LINEN_STOCK_WRITES_ENABLED=enabled` gate; absent live approval keeps all stock mutations read-only. Do not enable it in live Vercel.
- Ported sibling PR #757's typed malformed-JSON rejection into the M65 compatible child: missing body, invalid UTF-8, malformed JSON or JSON arrays/primitive bodies are definitive private HTTP **400** before any privileged RPC, rather than ambiguous 503. Oversize remains 413, business evidence 409, real backend failures 503. Existing authorization, Origin and rollout checks stay ahead of body parsing.
- M65 source/test commits: `2a71a5eaa036514fc1dc21d5bc164b911190ae7f`, `97f86d701649541446678a8c4555f2a964be9bdc`, `29c68c229a88e460cf5bacd99141a5b39fc09ebe`, `9b5fb4d65069c86474adbab132b2eaaae60d65c6`.
- Authenticated localhost built-Next HTTP fixture explicitly opts into writes **only in its synthetic process**, checks GET `writesEnabled:true`, and tests four malformed request types all return 400 with **zero privileged stock RPCs**. Node regression tests check the typed parser and API classification. No production data or provider is used.
- **Verification PENDING:** M65 matching-head Full CI native PG17, PostgREST, quality, Node, engine, preview, release, build, strict browser/3D and independent Non-3D must complete successfully. No unrun test is marked passed.
- Next 30–40-minute slice: repair matching-head failures, review sibling compatibility and retain the default-off rollout. Evaluate a dependency-complete isolated main intake only after all matching-head checks, staging/migration compatibility and Vercel no-deploy guard are proved.

## Outstanding launch evidence
T1–T6/J1–J6 physical/human checks stay **PENDING/BLOCKED**: real supplier stock/metres, isolated Supabase staging/restore and approved v3 rollout, authenticated customer/operator acceptance, tailor fit/cutting, native Blender geometry/UV, actual devices, five beta testers, ten real deliveries and owner signoff. No fabricated percentages, approvals or physical stock facts.

No main merge, Vercel deployment, live migration, real stock mutation, paid AI or provider charge occurred in M65.
