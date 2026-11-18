# Customer saved-design legacy compatibility checkpoint — 2026-11-18

Parent source SHA: `714e06876147536af1b4696609690774f989e288` (observed in preceding run; branch may have advanced before this edit).
Source fix SHA: `4d03b525735ad20594391ef179e656244d59cd09`.
Regression SHA: `6c8c4e5987d979d9d9fa58928e9de32a47585a22`.

Acceptance slice: two distinct legacy versions with no `specHash` must both survive local saved-design deduplication; saving one again must replace only its own version. Previously all absent `specHash` values compared equal and the second save silently discarded the first.

Evidence: committed `tests/saved-designs-legacy.test.ts`; matching-head GitHub workflow lookup immediately after regression commit returned zero runs. **Test not yet verified passing.** Required: full CI, Non-3D, quality, tests, engine, preview-performance, release check and build at exact head.

Blocking release gap: this fixes browser-local legacy data loss only. Ordinary saved designs still use browser-wide localStorage, not authenticated owner-scoped server persistence. Cross-account denial, second-device recovery, independent review and disposable database evidence remain **PENDING**. Real fabric, stock, tailor, customer/device and native Blender evidence remain **PENDING/BLOCKED**; no physical approval is inferred.

Next slice: verify matching-head CI; then implement authenticated server-backed ordinary saved designs and negative cross-account tests on a compatible security branch. Do not merge to main or deploy without isolated intake and all required gates.

## 2026-11-19 — Preserve unknown records on save (pending matching-head verification)
Parent: `a6ac562234bf7bfb6df64bfbc74e51601031139a`. Source commit: `7aec7c1c37fcd01f5d5b0e910f33348d9b2c3a52`. Regression commit: `e1fdaf0c3f63ee1ec4a28792cb01ac63d2a87ef5`.
Acceptance: a new or repeated save must not discard unknown legacy array records; 24-item cap applies to readable designs only. Regression: `tests/saved-design-save-preservation.test.ts`, including null/future-format/string entries and 24 readable designs. Previous parent `a6ac5622` had Full CI #44362766965 and Non-3D #44362767080 successful; those runs **do not** verify this change. Matching-head CI, browser and disposable backend evidence remain PENDING until actually observed. No local tests executed. No live DB, main or deployment changes.
Remaining blocker: ordinary saved designs still use browser-local storage, without authenticated owner-scoped durable CRUD, cross-account denial or second-device recovery. Independent security, measured fabric, stock, tailor, device, native model and customer pilot gates remain PENDING/BLOCKED. Next slice: verify exact-head CI; implement durable owner-scoped saved-design CRUD with disposable-backend isolation tests.

## 2026-11-19 — Exact-head CI verification of preservation regression
Verified parent/head: `6188b7c8d5f0857834d34824273024390db85dd3` (PR #863, `titan-parallel-customer-security`). The GitHub Actions API returned **completed/success** for matching-head CI run [#44374020709](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44374020709) and Deep Engine Non-3D QA run [#44374020758](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/44374020758). This verifies the committed save-preservation regression at that source SHA through those workflows; individual local quality/test/build commands were not independently run in this session. A checkpoint-only commit after this paragraph will require its own matching-head verification.
Criterion: unknown legacy saved-design records remain preserved across saves (source `7aec7c1c37fcd01f5d5b0e910f33348d9b2c3a52`, regression `e1fdaf0c3f63ee1ec4a28792cb01ac63d2a87ef5`). **Not** a durable owner-scoped persistence acceptance. No disposable DB, cross-account, second-browser, independent security or physical evidence was established. Next engineering slice: owner-scoped authenticated ordinary saved-design CRUD and isolation/recovery tests; avoid more localStorage-only fixes unless a new real defect is found. No main merge, deployment, paid AI or live migration.

## 2026-11-19 — Unknown-record ID collision deletion safety
Source parent: `453cca372dca6db4d8c7fd7816a8b0e664f64f88` (last verified checkpoint SHA; concurrent branch movement must be independently reconciled). Source fix: `cba7a1f7558fb6b2c1e404ed8f2db2c76bbf020c`. Regression: `5d4754f25c0c5d3555e5e52f41ac18a49d15ffc0`.
Criterion: deleting a known saved design cannot remove an unknown future-format record that happens to share its ID. Before the fix, deletion compared ID on every object, deleting both. Now deletion requires a recognized SavedDesign. Regression in `tests/saved-design-save-preservation.test.ts` constructs colliding known/future records and asserts preservation.
Evidence: GitHub source and regression commits exist; matching-head CI and local test execution PENDING. This is browser-data safety only, not authenticated persistence. Next: verify exact-head CI and implement owner-scoped durable ordinary saved-design CRUD with disposable backend and two-account/second-browser tests. Physical stock, measured fabric, tailoring, device, customer, native model, independent security and release gates remain PENDING/BLOCKED. No main merge, live migration, deployment or paid AI.
