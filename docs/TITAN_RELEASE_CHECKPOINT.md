# TITAN release checkpoint — M64 (2026-11-02 UTC)

This is a **new checkpoint file** on the compatible M64 draft. The requested historical paths `docs/TITAN_RELEASE_CHECKPOINT.md`, `docs/TITAN_RELEASE_CHECKLIST.md` and `TODO.md` were absent from the exact M63 Git tree. Do not mistake this new file for recovered historical M8–M63 notes. Previous milestone evidence remains in the existing stacked draft PR descriptions and GitHub Actions; `AGENTS.md`, `DECISIONS.md` and `docs/production-release-checklist.md` remain available. Preserve prior branches.

## Compatible baseline and release gates
- Exact parent: M63 draft PR #755 head `9241972045250c85228e07219266f0615e8b8bae`, stacked on M62 #754 `9ff55e554797ff39766919423db8ed03c27d5e2f`. Do not merge the full development stack into `main`.
- M63 matching-head Full CI `41378290699` **SUCCESS** (build, native disposable PostgreSQL 17.6 and disposable PostgREST jobs all successful); independent Non-3D `41378290621` **SUCCESS**. These are **synthetic engineering** checks, not a production launch acceptance.
- Live connected Supabase **read-only inspection on 2026-11-02 UTC**: PostgreSQL server version 17.6; no development branches; `public.fabric_stock_record_v3` absent, while `fabric_stock_snapshot_v2` and `fabric_stock_reserve_v2` exist. No live SQL mutation or migration was executed. The v3-dependent draft is **not deployable** against this production backend.
- Current `main` inspected at `2f9c6fe27b62b40db568fd56bbc9c56d6d01d170`. No main merge, deployment or live migration authorized by this checkpoint. Before any future isolated main intake, re-fetch main, verify `vercel.json` deployment guard and exact-head full checks.
- T1–T6/J1–J6 human/physical evidence remains **PENDING/BLOCKED** unless separately proved: real supplier roll/metres and provenance, isolated Supabase staging/restore, customer/operator acceptance, tailor fit/cutting, native Blender geometry/UV, real device QA, five beta testers, ten delivered orders and owner signoff. No release criterion newly certified.

## M64 — malformed operator stock request must be definitive, not ambiguous
- Scope: T5/J5 operator stock write safety and T6/J6 regression. This is an independently verifiable, no-paid-AI, no-schema slice.
- Exact starting parent: `9241972045250c85228e07219266f0615e8b8bae`.
- Code commits: `079c0503b68c0bc01aca1cab7a3e4423e1bcd31d` (typed invalid-JSON failure), `7edbd1fb4d73dd8ce3ecd639f3d9005514d65a6f` (private HTTP 400 before privileged RPC).
- Test commits: `6edcb829da828c4f0f7a6ca2ef1e2515a49313e5` (Node input/route regressions), `942b26f92fcda6b6868bc5a952125e382205ef8a` (real authenticated built-Next HTTP: missing body, array, malformed JSON, invalid UTF-8; all must return 400 and zero privileged RPC calls).
- Why: Previously these client input failures were caught as HTTP 503, falsely implying a stock mutation may have committed. Oversized inputs remain 413; valid but invalid business evidence remains 409; actual backend/transport ambiguity remains private 503.
- Exact-head Full CI, browser and independent Non-3D **PENDING** until GitHub Actions finish. Do not assert tests passed or merge until matching-head proof exists.
- Next 30–40-minute slice: resolve any M64 matching-head test/Chromium failures; if green, evaluate a separate dependency-complete main intake only where v3 runtime migration dependency can be proved, otherwise preserve draft. Independently address a production-blocking customer/operator flow without inventing physical evidence.

No Vercel deployment, provider charge, live database write, real stock mutation, paid AI or physical approval occurred.
