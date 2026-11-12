# TASKS.md — Worker A: Design Intelligence

## Assignment from user — 2026-11-12

Worker A owns the following **bounded** scope, as directly assigned in conversation:

1. Validate collar, cuff, placket and styling combinations.
2. Detect invalid designs.
3. Validate body and finished-garment measurements.
4. Generate accurate, reviewable tailor handoff instructions.

Do not alter photographic model identity, Designer Studio UI, stock, auth, 3D, or deploy. Use shared canonical option IDs and pure functions. Do not treat synthetic fixture tests as real fitting approval.

## Current worked milestone: fail-closed Style Director validation sign-off

**Status: implementation committed; targeted software smoke PASS; full CI / integration PENDING.**

Base: `titan-parallel-style-director` at `9fcbcd456aa5c27922875d11b615f6423ed1ce1b`. `main` was `4dd8020abd83429449ff53ea5bb71b046394d86e`; **neither changed**.

- Production flaw: the previous validation summary could produce `validationComplete: true` despite an unresolved latest blocking user-test case, or when the approval predated a newer test.
- Change: refuse validation-complete status while any latest case is blocking, while approval timestamps are older than the latest user-test evidence, or while stored sign-off reviewer/target/time is malformed. Keep existing dedupe and positive-case counting.
- Paths: `src/lib/designer/style-director-validation.ts` and `tests/style-director-validation.test.ts`. No UI, option ID, physical measurements, schema or deployment changes.
- Added regression cases: (1) passing quota with unresolved blocker remains incomplete, (2) latest same-case resolution clears the blocker, (3) later evidence invalidates previous sign-off until a fresh owner decision, (4) malformed sign-offs cannot approve.
- Targeted local smoke: **5 pass / 0 fail** using Node 22 `--experimental-strip-types --test`. The tested local source has Git blob SHA `440ccfc7e12c21d72e276bfb362ff88d16d89c29`, exactly equal to the GitHub committed source blob. The smoke file is an independent, focused harness; it is **not** the repository's full test suite and does not prove the committed test file passed in CI.
- Full gates `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`, real-browser QA and independently reviewed integration: **NOT RUN / NOT VERIFIED** on this exact branch. Its workflows trigger on PR and/or main; no extra PR was opened.
- Physical measurements, approved fabric evidence, sample fitting, signed seam allowances and tailor authorization: **NOT VERIFIED**. No cutting permission.

## Next Worker A priorities

- Reconcile the live collar/cuff/placket compatibility rules in draft PR #868 and the measurement/printable handoff checks in draft PR #861 against a current single integration candidate, keeping their canonical versioned options and clean-history tests.
- Check exact-head CI and real-browser results before counting the new validation gate as software-integrated.
- Validate real body/garment landmarks and obtain independent tailor review before production signoff; never invent missing measurements.
- No percentage gain in overall production readiness can be asserted solely from the new guard. The requested +5 percentage points requires agreed weighted launch gates and actual newly closed verified gates, not lines of code.

## Disposition

One safety defect fixed and targeted-tested. **Not ready for production; not an authenticated owner/tailor sign-off; no merge, deploy or new PR.**

## Worker A integration candidate — 2026-11-12

**Status: merged into isolated candidate branch, not merged to main; combined CI pending.**

- Reviewed `main..titan-parallel-style-director` and `main..titan-parallel-tailor-handoff`: zero shared modified paths. Both start from the same `main` baseline `4dd8020abd83429449ff53ea5bb71b046394d86e`.
- Ported five exact donor blobs from Tailor Handoff head `28290501a7d79bce875fbcde1584886e903c9ea1` into this candidate on Style Director base `9fcbcd456aa5c27922875d11b615f6423ed1ce1b`: `handoff-measurements.ts`, `production-handoff.ts`, `tech-pack.ts`, `tests/handoff-measurement-integrity.test.ts` and `docs/TITAN_PARALLEL_TAILOR_HANDOFF.md`.
- The merge was an atomic Git tree/commit with parent `06cbd29ce29c10d280d8155d3996921d0319ae76`, commit `80a577459a7d1b4132868ced3ae0827cb6808b2e`. The five committed blobs were independently re-fetched and match the donor blobs **bit for bit**.
- Candidate versus primary Style Director branch: **0 behind / 4 ahead**, only eight intended paths: the five Tailor Handoff files, two Style Director validation files, and this `TASKS.md`.
- Donor Tailor Handoff exact head: GitHub **Full CI SUCCESS** and **Deep Engine Non-3D QA SUCCESS**. Style Director donor exact head: **Deep Engine Non-3D QA SUCCESS**, Full CI **in progress** at inspection. These independent source checks do **not** establish that the combined candidate passed.
- Combined candidate full `quality/test/engine/preview/release/build/browser` CI: **not run** (normal workflows use PR/main triggers; no extra PR was opened). Do not call this production-ready until exact combined SHA passes and an integration reviewer signs off.
- No measured body data, certified fabric scale, signed seam allowance, physical fit sample or tailor signoff was supplied. Software validation and unsigned tailor review packets **never authorise cutting**.

**Worker A next acceptance action:** run and inspect exact combined-head Full CI + Non-3D QA with reviewer-authorized integration workflow; resolve failures strictly within Worker A's scope. Separate physical acceptance is still blocked. Do not duplicate older draft PRs or automatically deploy.
