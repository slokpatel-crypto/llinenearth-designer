# TITAN — isolated launch-evidence HTTP integrity checkpoint (2026-11-02 UTC)

This document records **engineering evidence**, not physical or launch acceptance. Canonical T1–T6/J1–J6 release gates remain pending until actual customer, operator, stock, tailor, device, native 3D, security and owner proof exists. The historical stacked acceptance checklist lives at `docs/TITAN_RELEASE_CHECKLIST.md` on the older TITAN draft ancestry; current clean main retains `docs/production-release-checklist.md`.

## Scope and ancestry

- Criterion: **T6/J6** launch beta/checklist evidence transport, security and write acknowledgment; also safeguards **T5/J5** operator evidence.
- Live `main` parent at branch creation: `78deb0916f0253be12bdbf71c97fea332975d43d` (Vercel `git.deploymentEnabled=false` verified).
- New independent main-based branch: `titan-main-launch-readiness-http-failclosed-20261102`; PR **#785** (draft).
- Code + regression commit: `45d4fe86a396c505ff7dc730f30274491d12c3d1` (parent `78deb0916f0253be12bdbf71c97fea332975d43d`). This documentation commit advances the branch head again; fetch the live head and its matching-head CI before any merge.
- Exactly two source/test files in the functional change: `src/app/api/operator/launch-readiness/route.ts` and `tests/launch-readiness-private-http-contract.test.ts`. No overlapping production calibration/preview/stock changes imported from #783/#784 or the older #771 draft stack.

## Reproduced production-integrity defect and repair

- Previously `launch-readiness` accepted unbounded and malformed upstream evidence lists, read unbounded incoming POST bodies, reflected raw PostgREST response details in logs/errors, and treated any RPC JSON as a successful beta/checklist creation acknowledgment.
- The operator route now rejects cross-site and non-JSON writes, caps incoming decoded JSON at 32 KiB and upstream at 4 MiB, validates a 500-row object-array envelope, redacts remote error details, applies `private, no-store` on every response, and requires a canonical scalar creation UUID before claiming a recorded beta/checklist event.
- An ambiguous remote write fails with HTTP 503 and explicit ledger reconciliation guidance. Invalid client input is 400/413/415/403 rather than a misleading upstream-style failure. The previous action payloads and successful response field names remain compatible.
- New Node regression asserts request origin/size/malformed-body behavior, upstream size/type rejection, canonical ACK, redaction and source wiring.

## Verification status and next action

- **PASS:** GitHub code commit and branch ancestry recorded at the exact SHAs above; the parent `vercel.json` explicitly disables Git deployment.
- **PENDING:** Full CI, independent Non-3D/browser QA, quality, full Node tests, engine, preview-performance, release check, build and exact-head review. Parent or other PR workflows cannot certify this new commit.
- **BLOCKED physical/owner:** real supplier stock and measured fabric, production Supabase migration/restore, tailor/garment measurements, original Blender four-angle/native QA, device acceptance, five actual customer beta cases, ten real deliveries, security/privacy human approval and owner launch approval. No synthetic data counts toward these gates.
- **Next 30–40-minute slice:** inspect exact-head CI/browser failures and repair if needed; if fully green, compare PR #785's diff and main ancestry, verify `vercel.json.git.deploymentEnabled===false` on the latest main, then consider only an exact-SHA guarded isolated merge. Do not deploy to Vercel, mutate live SQL/stock, or invoke paid AI.
