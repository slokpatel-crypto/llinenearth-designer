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

## 2026-11-13 — pocket negative wording regression port

- Acceptance slice: preserve locked-pocket mismatch behavior for five additional negative phrasings (`must not be worn`, `should not be included`, `shouldn’t be selected`, `can’t be used`, `cannot be chosen`) without changing a saved design. Ported only the test cases from primary PR #868, not the newer primary implementation or unrelated tests.
- Exact parent `131b2d4d99fb908cf32d24943b07db13ca75ac16` → test commit `5eaf80aa202a5c4501a852de8298c3657a98f676`. Affected criterion: Style Director pocket compatibility and deterministic locked-design preservation. File: `tests/style-director-pocket-postposed-bans.test.ts`.
- Inspected primary head `dac74278f4a24a13491bd84993400ea737fba032`, with Non-3D QA #43322223761 SUCCESS and Full CI #43322223858 IN_PROGRESS at inspection. Primary and candidate diverged (10 primary-only, 14 candidate-only commits, common ancestor `838c0065f9e638d0420121de722dc166e6e8e46f`). Candidate checkpoint SHA `131b2d4d99fb908cf32d24943b07db13ca75ac16` and preceding test SHA `8e63053f63d30c0b42a9736490cb9e9af324fa82` had no matching PR-triggered workflow runs returned by the workflow query.
- **New test commit NOT VERIFIED**: no local tests, build, release check or browser QA executed; no matching-head CI result yet. Do not treat primary success or older candidate success as proof. GitHub PR #985 was non-mergeable before this change; no main intake approved.
- Historical release checklist/checkpoint and TODO remain absent (404) on inspected draft. All physical/customer/stock/operator/tailor/Blender/device/owner gates PENDING/BLOCKED. No deploy, paid AI, live database or stock mutation.
- Next 30–40-minute slice: inspect matching-head CI/Non-3D for `5eaf80aa202a5c4501a852de8298c3657a98f676`, diagnose any failing pocket tests, then reconcile primary-only pocket locked-ID regression and placket compatibility without losing handoff security. Recheck live heads before any further edits.


## 2026-11-13 — persisted trust provenance hostile-record regression

- Acceptance slice: verify that Style Director trust scoring fails closed on inherited approvals, accessor getters, revoked/throwing proxies and rejected provenance, while accepting explicit frozen approved/corrected records. No supplier or physical approval is inferred.
- Exact parent `20b656018a9516701f792472a4daadab6f7f1bd8` → regression commit `0c2ce68c4d992be16d3cd4c5a60118222047e588`. Added only `tests/style-director-trust-provenance.test.ts` using the inspected primary PR #868 test source at `b47edf3dca83638ea7e5e221f7556dae2fec4e28`; candidate already contained the corresponding trust-scoring implementation.
- Live primary `b47edf3dca83638ea7e5e221f7556dae2fec4e28` vs candidate parent: diverged by 12 primary-only / 16 candidate-only commits, common ancestor `838c0065f9e638d0420121de722dc166e6e8e46f`. Primary CI #43331077713 and Non-3D #43331077871 were in progress at inspection. Candidate parent returned no matching PR workflow runs. **New regression is unverified: no local tests or matching-head CI/browser/release/build/disposable DB evidence.** Do not merge main.
- `AGENTS.md` and `DECISIONS.md` inspected; `docs/TITAN_RELEASE_CHECKLIST.md`, `docs/TITAN_RELEASE_CHECKPOINT.md`, and `TODO.md` returned 404 on candidate. Historical release evidence must not be invented. Remaining T/J release acceptance and real stock, customer/operator, tailor, device, native Blender and owner signoff remain PENDING/BLOCKED.
- Next 30–40-minute slice: check matching-head workflows for checkpoint SHA, diagnose failures; reconcile remaining primary compatibility changes only after exact-head evidence. No deployment, paid AI, live migration, stock mutation or model identity change.


## 2026-11-13 — unreadable/incomplete trust provenance regression reconciliation

- Acceptance slice: preserve fail-closed Style Director trust scoring for unreadable proxy descriptors and incomplete frozen approval records, with zero execution of hostile getters. Added the two latest primary regression cases without changing production code or physical truth.
- Exact parent: `61445ee21913034e9614592f1f3df6a4bb3e0d61`; test result: `a55cd65215312baa37b08b92bb6409445f96af3c`. Primary source `7e11a031f36a347d30738f9d989d3d00f0bb90fb`, source test blob `3bde264dc6b19f4d3cc425cfd1219e7ef585aca9`.
- Primary source matching-head CI #43339115140 and Non-3D #43339114142 were IN_PROGRESS at inspection. Candidate parent workflow query returned no PR-triggered runs; combined status returned no statuses. **No tests or browser QA executed locally, and no matching-head CI is proven for the new commit. Criterion PENDING verification.**
- Live candidate and primary diverged (primary-only 13 commits, candidate-only 18 before this port); six primary-side changed paths require further careful reconciliation. No safe isolated main intake proven.
- Release checklist/checkpoint and TODO missing on this branch (404); AGENTS.md and DECISIONS.md inspected. Preserve historical checkpoints on their own branches.
- Stock truth, customer/operator field acceptance, tailor, Blender native geometry/UV, device screenshots and owner approval remain PENDING/BLOCKED. No main merge, deployment, live stock/migration, paid AI or model identity changes.
- Next 30–40-minute slice: verify exact new checkpoint SHA Full CI/Non-3D, then compare current primary and candidate tests; reconcile one independent compatibility test group only after checking current ancestry.

## 2026-11-13 — Malformed provenance regression parity

- Parent SHA: `42248b5cd70974a8c8ba825b6767b4ef189e709f`; implementation SHA: `359319bd918df23a5634f6e36a0b93198096e2c3`.
- Acceptance slice: preserve primary Style Director malformed primitive, hostile getter, and inherited frozen approval fail-closed regression cases in the security reconciliation draft (`tests/style-director-malformed-provenance.test.ts`). Exact test content copied from live primary branch; no production source or physical approval altered.
- Live branch comparison before commit: primary was 18 commits ahead and candidate 20 commits ahead of common ancestor `838c0065f9e638d0420121de722dc166e6e8e46f`; candidate had zero returned pull-request workflow runs at its previous exact SHA. This is a regression port, not a verified test pass.
- Verification: no local test runner or browser QA executed in this connector session; full CI/Non-3D matching-head result PENDING. Do not count release criteria passed.
- Blockers: branch divergence, missing matching-head CI, real stock/customer/operator/tailor/device/Blender evidence. Next slice: reconcile remaining primary-only tests and run full matching-head CI/Non-3D and security gates before any main intake.

## 2026-11-13 17:17 IST — exact-head verification blocker audit

- Candidate PR #985 exact head `23f7684656d9d5cd7c31517dd2f4fc5add4dcab4`, base recorded `9977af060f5e1687392fa4bfb96140f652ad496d`, mergeable=false. Primary PR #868 live head `68bfa27291cbd2a2fba10c732d7899220deff2f0`; legacy stacked PR #505 remains `3652fb5db6e0f63b8be363edb964fed78f7aadf0` (not assumed current integration target).
- Comparison primary→candidate: common ancestor `838c0065f9e638d0420121de722dc166e6e8e46f`, 24 primary-only / 22 candidate-only commits, 12 differing paths. No blind merge/rebase/overwrite; retain the handoff-security files and regression suites.
- Workflow query (pull_request-triggered runs, first page only) returned zero runs for exact candidate SHA. This is **insufficient to conclude Actions never ran**; investigate PR event delivery, workflow permissions, and alternative events/check suites. Primary current head has Full CI `43419511199` and Non-3D `43419511151` both IN_PROGRESS at inspection. PR #505 historical SHA has CI `40937854790` SUCCESS and Non-3D `40937854714` SUCCESS, but these do not validate PR #985.
- Read AGENTS.md, DECISIONS.md and this checkpoint. Historical docs/TITAN_RELEASE_CHECKLIST.md, docs/TITAN_RELEASE_CHECKPOINT.md and TODO.md return 404 at candidate head. CI workflow does include pull_request trigger; root cause of absent candidate runs not proven.
- Criterion: matching-head Full CI, browser/Non-3D, security, disposable PostgreSQL, build/release verification remains BLOCKED/PENDING. No code fix or test execution this session; no new acceptance criterion passed. Next bounded slice: establish why candidate PR has no observable PR-triggered runs (check actual Actions/check-suite records and permissions), then run exact-head verification; only reconcile primary changes once compatible source and tests are compared.
- Real stock, authenticated customer/operator field evidence, tailor, physical devices, native Blender geometry/UV, independent review and owner signoff remain PENDING/BLOCKED. No main update, deployment, paid AI, live migration or stock change.

## 2026-11-13 19:20 IST — bounded handoff UTF-8 / cancellation regression

- Acceptance slice: reject signed-handoff requests exceeding 64 KiB **by UTF-8 bytes**, not characters, and stop consuming/cancel the source stream on overflow. The previous tests covered the ASCII boundary but not multibyte payloads or cancellation. Added two focused regression cases to `tests/style-director-handoff-request-bounds.test.ts`.
- Exact parent `2481f9b984eed41efc82d7458a8041d7da8ad2ad` → test commit `7542585c4ac19d3aabaed44fc65aa225bb271621`. No production code, workflow, model, stock or migration changes.
- At start of slice: PR #985 head was the exact parent above; primary PR #868 was `b93c7332f22c77ce78f8ebe9c3c6bbe9ef32b9aa`, diverged 26 primary-only / 23 candidate-only commits, 12 differing files. Primary matching-head CI `43436665275` and Non-3D `43436665226` IN_PROGRESS when inspected.
- Candidate parent PR-triggered workflow query returned zero runs and combined statuses returned an empty array. This workflow connector only returns the first page of PR-triggered runs; absence is not proof no GitHub Actions exist. **New tests not executed locally; new commit has no proven matching-head CI, browser, security, release or disposable database evidence. Criterion PENDING.**
- Historical release checklist/checkpoint and TODO.md absent on candidate (404). AGENTS.md, DECISIONS.md and this existing checkpoint inspected. Preserve all physical/customer/operator/stock/tailor/Blender/device/owner gates PENDING/BLOCKED. No main merge, deploy, paid AI or live mutations.
- Next bounded slice: run focused request-boundary tests and matching-head CI/Non-3D on the new head, diagnose workflow visibility using an unfiltered/paginated GitHub Actions or check-suite view, then reconcile primary-only changes after a fresh SHA comparison.

## 2026-11-14 01:21 IST — explicit placket ban sibling regression

- Exact candidate parent `c0b8eac1513078bcfe944fe031e4c9eaccf06b81` → test result `953ecceb87d822d189f294659b343bdbae52020c`. Ported additive test from primary PR #868 SHA `aeb3549d2170f33a04e86fd98f941230b1c584d0` (source blob `a7f9a84282c5a24a24a0fc3cd530d0bb6d3ed3af`). Only `tests/style-director-placket-locked-state.test.ts` changed.
- Acceptance criterion (PENDING executable verification): explicit prohibitions of standard, hidden, French, covered and contrast plackets must reject the banned locked canonical ID, preserve permitted siblings and leave frozen saved designs unchanged. This is deterministic compatibility coverage, not photographic or tailor acceptance.
- Live ancestry at inspection: primary `aeb3549d2170f33a04e86fd98f941230b1c584d0`, shared base `838c0065f9e638d0420121de722dc166e6e8e46f`, 32 primary-only / 25 candidate-only commits before this port. Candidate pull-request-triggered workflow lookup returned zero runs at parent; primary CI #43495053832 and Non-3D #43495053701 IN_PROGRESS. These are NOT test evidence for new result. No local tests or browser QA executed; matching-head CI/Non-3D/release/build/security/disposable DB remain PENDING.
- Historical release checklist/checkpoint and TODO remain absent on candidate (404). Stock, customer/operator acceptance, tailor, physical devices, native Blender geometry/UV and owner approval remain PENDING/BLOCKED. No main merge, deployment, paid AI, stock or database mutation.
- Next 30–40-minute slice: establish exact-head CI/Non-3D execution (including whether PR workflow trigger/permissions suppress it), execute regression, and reconcile remaining primary-only compatibility cases without overwriting candidate security. Do not merge main without verified isolated intake and no-deploy guard.
