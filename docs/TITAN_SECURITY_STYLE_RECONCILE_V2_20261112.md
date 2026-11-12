# TITAN security / Style Director reconciliation — 2026-11-12 run 11

- Acceptance slice: retain latest Style Director compatibility and collar regression tests from primary PR #868 while restoring bounded handoff JSON parsing, audit UUID validation, error redaction, and two corresponding security regression suites from previously passing PR #984.
- Exact parent: `838c0065f9e638d0420121de722dc166e6e8e46f` (primary PR #868). Parent Full CI `43250543728` PASS; Non-3D `43250543645` PASS.
- Security source: `2061808e20a7315de31ae35c95d3ef8f45e2ce34` (PR #984), Full CI `43241065388` PASS; Non-3D `43241065408` PASS.
- Five-file port result before checkpoint: `1a3d59b875a5ce16d92bb0bc9b04c8de51a3d51c`. Port commit sequence: `30e19d06aa891aa6d4116e4649e5199feb0ba70e`, `e64e808e1cfe81d0ed4b0300fbd861b25ef3f9db`, `34db5a314b4b3e0369b9f49a5243c330db673be9`, `f41f0701c8e8fc68699c458e341290c9f776fa51`, `1a3d59b875a5ce16d92bb0bc9b04c8de51a3d51c`.
- This combined head has **NOT** yet passed matching-head CI, browser/Non-3D, release, security, build or disposable PostgreSQL. No local tests run. No main integration authorized until checks pass and isolated intake proof exists.
- `AGENTS.md` and `DECISIONS.md` inspected. `docs/TITAN_RELEASE_CHECKLIST.md`, `docs/TITAN_RELEASE_CHECKPOINT.md`, and `TODO.md` were absent on this inspected branch (404); do not overwrite historical release records on other branches.
- Remaining PENDING/BLOCKED: real stock evidence, authenticated customer/operator field acceptance, tailor and measurement signoff, native Blender geometry/UV, physical devices, independent review and owner approval. Preserve `linen-earth-studio-model-v1`. No paid AI, deployment, live migration or live stock mutation.
- Next 30–40-minute slice: obtain matching-head Full CI and Non-3D QA for the combined result; diagnose failures if any. Check latest primary SHA again before further reconciliation.

## 2026-11-12 23:24 IST — modal collar prohibition reconciliation

- Acceptance criterion: a modal ban of a specific collar variant (e.g. `Must not use English Spread Collar`) rejects only the forbidden canonical variant while preserving the ordinary sibling and existing locked design; regression test covers modal variants. This is software behavior, **not** photographic collar parity or physical tailoring approval.
- Live candidate parent `49c0000bb8a2bd649c253074d6b8b3a314ac38ca` (PR #985), matching-head CI run `43262341804` **PASS**, Non-3D QA run `43262341802` **PASS**. The original checkpoint above predates these successful results.
- Live primary PR #868 inspected at `9fcbcd456aa5c27922875d11b615f6423ed1ce1b`; its CI `43272826741` and Non-3D `43272826825` were **IN_PROGRESS** when checked. Candidate vs primary: 3 primary-only and 6 candidate-only commits; changed files relevant to this slice were compatibility parser and new modal-ban regression.
- Ported exact primary compatibility parser blob `2c9d9a70d92c8704a9207517de318dfba6aca4fa`: `49c0000bb8a2bd649c253074d6b8b3a314ac38ca` → `7dfa1b858aef6997f4ddeddb48add90d5a2244e4`.
- Ported exact primary modal-ban regression blob `335278e4f6ab37a16a102b523310f5607041200e`: `7dfa1b858aef6997f4ddeddb48add90d5a2244e4` → `95ef5e53dec4f5c007536cfedcac78cf3fd241da`.
- **Matching-head checks for the new combined result remain PENDING**. No local tests or browser run were executed during this session. Do not reuse earlier passing CI as proof for the new commit, and do not merge to main.
- Blockers: real stock/provenance, customer and operator acceptance, tailor, device, native Blender geometry/UV, review, owner signoff remain PENDING/BLOCKED. No stock, migration, paid AI, deployment or model identity changes.
- Next 30–40-minute slice: verify CI and Non-3D at the final checkpoint SHA, investigate any failures, compare newer primary head and only then assess safe isolated main intake with no-deploy guard.

## 2026-11-13 — contracted collar prohibition parser slice

- Parent `2197e5f21d2712023b3afc4ba7cb326806b75bb9` (PR #985); implementation result `f171c56d18acbdea590a6ed479f063ae86de17f9`.
- Criterion: prohibited collar variants expressed with contracted negative wording (`shouldn't`, `mustn't`, `can't`) or `cannot`, including `worn` and `included`, must not be interpreted as permitted construction. Ported one-line parser fix from primary PR #868 exact source `4be2bf01a630ccf13c9ba0baa729ebcba0803e5d`, preserving all candidate security files.
- Evidence before change: parent Full CI `43284412715` PASS and Non-3D `43284412902` PASS. Primary source CI `43304508848` and Non-3D `43304508826` IN_PROGRESS when inspected. **No tests run locally and no matching-head CI exists yet for this implementation commit; this criterion remains PENDING verification.**
- Comparison at inspection: candidate and primary diverged by 10 candidate-only and 7 primary-only commits; five differing compatibility/test paths. Only parser implementation was ported this slice; corresponding primary regression test and four other paths still require careful reconciliation.
- Release checklist/checkpoint and TODO files absent on this branch (404). Keep this persistent reconciliation checkpoint instead of inventing or replacing historical files.
- Physical stock, customer/operator field acceptance, tailor, devices, Blender geometry/UV, owner signoff: PENDING/BLOCKED. No main merge, deployment, paid AI, live migrations or stock changes.
- Next slice: port contracted-negative collar regression, run matching-head Full CI/Non-3D, re-check latest primary SHA and ancestry, then reconcile remaining tests.

## 2026-11-13 — contracted collar regression reconciliation

- Acceptance slice: prove that four postposed contracted/negative variant-collar bans reject the forbidden saved ID while preserving a permitted sibling, no silent selection, and no mutation. This tests the parser previously ported from primary; no photographic or tailor approval implied.
- Exact parent `3e5852d3c6c268d98d7c340c9631b5aacaaeeda6`; regression commit `8e63053f63d30c0b42a9736490cb9e9af324fa82`. Only `tests/style-director-collar-variant-ban-sibling.test.ts` changed before this checkpoint commit.
- Parent exact-head CI #43306514649 SUCCESS and Non-3D QA #43306514883 SUCCESS, verified via GitHub workflow results. **New regression commit has not yet passed matching-head CI or browser QA; tests not run locally.** Do not infer new acceptance from parent green.
- Live primary PR #868 at inspection `c9c4e059720f9d2892576d8bc707947b4b44f8c6`, CI #43313766263 and Non-3D #43313766254 IN_PROGRESS. Comparison with candidate parent: 9 primary-only, 12 candidate-only commits, shared ancestor `838c0065f9e638d0420121de722dc166e6e8e46f`; compatibility source and four test files differ. Do not overwrite newer primary or candidate work.
- Historical release checklist/checkpoint and TODO files absent on this draft (404); this existing reconciliation checkpoint is append-only. Remaining physical gates PENDING/BLOCKED: verified stock, customer/operator field evidence, tailor, devices, native Blender geometry/UV, owner approval. No main merge, deployment, paid AI, live stock or migration mutation.
- Next 30–40-minute slice: inspect matching-head CI/Non-3D for checkpoint SHA; repair any regression failures, then reconcile primary-only pocket/placket tests without weakening security. Only consider isolated main intake with dependency proof and no-deploy guard.
