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
