# TITAN Roadmap v2 — Phase 11 Outcome Quality Insights (2026-11-20)

## Why this is a new tool
Phase 11 already has authenticated customer feedback capture, independent operator review, a human-approved minimum evidence policy, and durable per-order garment context. Those modules were inspected **before development** and are reused, not rebuilt.

The missing capability was a customer/production quality **explorer** that answers which construction families are represented among legitimately reviewed outcomes without accidentally learning from stale, forged, or untraceable cases. This draft builds that customer-facing operations tool at `/operator/quality-insights`.

## Customer / operator workflow
1. A private operator page first validates the existing operator session on the server; unauthorized sessions redirect to the operator login.
2. The client reads the existing authenticated `/api/operator/customer-outcomes` with `cache: no-store`; no new table, SQL RPC or customer mutation is introduced.
3. Deterministic `summarizeCustomerQualityInsights()` chooses the latest valid outcome **per production order**, refuses conflicting latest timestamps, and requires an unambiguous latest human approval.
4. A candidate must match `linen-earth-production-learning-context-v1`, its revision ID, a 64-digit recipe SHA-256, both actual fabric IDs and well-formed shirt-fit, trouser-shape and occasion context. Missing lineage is excluded.
5. The UI reports confirmed worn fit separately from overall customer satisfaction; only actual worn-confirmed outcomes contribute to fit counts.
6. Operator can switch between Shirt fit, Trouser shape and Occasion cohorts in a responsive table. It shows **counts only**, not causal rankings or confidence intervals.
7. It displays the latest valid human minimum. Reaching that minimum is **review-only**, not an authorization for automatic Designer weight changes. Missing human policy and capped upstream data fail closed.

## Privacy and truth boundaries
The resulting summary does **not** include outcome IDs, customer names, contact details, free-text feedback notes, body measurements, or individual order identifiers. Data is shown inside an authenticated private operator route; no public API or client export introduced.

Existing outcome RPC reads cap results at 1,000 outcomes, 5,000 reviews and 100 policies. A response at one of these limits is explicitly labelled a **partial snapshot**; it cannot satisfy the evidence-readiness gate. Even smaller snapshots are retrospective descriptions, not statistically proven defect rates, representative samples or release approval.

**No material or tailoring claims:** physical stock truth, garment fit and owner approval remain separate, and existing clothing rules, delivery states, prices and production databases are untouched.

## Changed paths
- `src/lib/designer/customer-quality-insights.ts`: pure review/lineage/dedup/cohort engine
- `src/app/operator/quality-insights/`: authenticated page, client explorer and responsive CSS
- `tests/customer-quality-insights.test.ts`: positive/negative tests for stale outcomes, policy, lineage, ambiguous timestamps, snapshot caps, provenance and sample isolation
- Links from existing Operator Desk, Production Desk and Outcome Review
- This checkpoint and `DECISIONS.md`

## Acceptance
Run the repository's exact-head `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`, and CI's Non-3D browser QA. Inspect the private tool at 390/768/1440 widths and challenge unauthorized access, malformed upstream responses and partial data. No production merge or Vercel deploy until exact-head checks, an independent review and the owner's release gates pass.

**Provenance:** the new tool is read-only and non-public. Existing human review records can describe potential trends, but a future explicitly approved scoring rule must remain a separate versioned, gated change.
