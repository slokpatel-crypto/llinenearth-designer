# TITAN operator physical-cut request boundary — 2026-11-02

## M: T2/T5, J5, T6/J6 — isolated security fix (engineering only)

- **Parent live main:** `70111dc9bbad606128b1643de71b021ffac70403`; confirmed `vercel.json.git.deploymentEnabled=false` before branching.
- **Branch:** `work/titan-calibration-origin-json-20261102-1218`, created from that exact main SHA; intentionally independent of the concurrently changing first-ten-delivery PR #791 and older unsquashed stacks.
- **Code commit:** `ac34bf0d6eda235e1e409961f3dfc9417f89224b`; **test commit:** `9806a93b72960f8015a2252527e6cb3365b9c53c`.
- **Defect:** The authenticated physical-cut `POST /api/operator/production-calibration` accepted any parseable JSON request body without checking browser Origin, Fetch Metadata or JSON media type. A cross-site/simple-form request reaching a privileged operator session must never invoke `production_cut_evidence_record`.
- **Fix:** Reuse existing `secureJsonRequestError` before streaming/parsing any body or issuing a privileged RPC. Reject cross-origin or cross-site writes (403), non-JSON media types (415), and invalid/oversized declared content length (413). Preserve existing bounded 32 KiB actual-body reader, authenticated cookie, private/no-store responses, physical evidence normalization, strict UUID acknowledgment, and read-only GET.
- **Regression:** `tests/operator-calibration-request-boundary.test.ts` covers valid same-origin JSON, cross-site/same-site subdomains, form bodies, invalid/oversized length, and route ordering (guard before parse/RPC). Existing operator evidence private HTTP contracts must remain green.
- **Matching-head CI:** **PENDING** for this documentation-inclusive head; run full quality, Node tests, engine, preview performance, release, build, native PostgreSQL and Chromium plus independent Non-3D QA. A source regression is not an authenticated real production test.
- **Physical/human:** **BLOCKED** on genuine supplier roll inventory, physical cutting/tailor measurements and signed evidence, live owner/operator acceptance, real devices, native Blender four-view/UV, five beta testers, ten deliveries, security/privacy review and owner release approval. Do not infer a launch gate PASS.
- **Main intake:** Only after exact-head Full CI and Non-3D success, dependency-complete three-file diff and a fresh no-deploy guard check; no Vercel deploy, live schema migration, stock write, provider charge or physical signoff.
- **Next 30–40-minute slice:** Check the matching-head workflow failures and repair if needed; then reconcile PR #791's first-ten historical snapshot completeness and consider an isolated integration if it is fully green. Do not merge the unsquashed draft backlog.

**Checkpoint note:** The legacy `docs/TITAN_RELEASE_CHECKPOINT.md` and `docs/TITAN_RELEASE_CHECKLIST.md` exist in historical stacked PR #505 but not in the integrated `main` ancestry. This isolated intake keeps its own checkpoint rather than importing or overwriting the old unverified stack.

## Exact-head CI repair — 2026-11-02 UTC

- Initial documentation-inclusive head `d7c7a99ca70771be9960b13d9797d6e4422b68a4`: Full CI `41402483691` **FAIL** in synthetic built-Next evidence HTTP after PostgreSQL, quality, Node tests, engine, preview, release and build passed. The pre-existing synthetic script expected HTTP 400 for an oversized calibration POST, but the new declared-length fail-closed guard correctly returned HTTP **413**. This is a test expectation mismatch, not permission to weaken the request guard.
- Repair parent `d7c7a99ca70771be9960b13d9797d6e4422b68a4` → code/test commit `011d6bcdd49cf93c7024d592738db508832fe5b9`. Update the real built-Next fake-PostgREST regression to expect 413 only for the oversized calibration payload, retain 400 for malformed/small inputs, and assert **zero privileged RPCs** for cross-origin, cross-site and form-media requests.
- Final matching-head Full CI and independent Non-3D QA: **PENDING** on the latest documentation commit. Do not count the failed older head or merge before both complete SUCCESS. Real supplier/tailor/owner and first-ten delivery gates remain **BLOCKED**.
