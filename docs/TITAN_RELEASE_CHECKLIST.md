# TITAN integrated release acceptance checklist

**Authority:** This document is the current TITAN gate, superseding the dated 1.0 checklist for readiness claims; the older `docs/production-release-checklist.md` remains historical/operational reference. No percentage scoring. Update `docs/TITAN_RELEASE_CHECKPOINT.md` after every milestone. **Merge and production deployment require separate explicit owner approval.**

## Integration policy

- Candidate originates from the newest **compatible stacked draft**, not from stale `main`. Record a full commit SHA, base, upstream PR chain and comparison against the last checkpoint. Confirm that each independent sibling fix is present; never overwrite a newer head with an older PR. Preserve all working features, backwards-compatible locked revisions and the original `linen-earth-studio-model-v1` and `public/designer/studio-tucked.webp`.
- Every code claim must cite evidence **at exactly the integrated candidate SHA**. CI for a parent or sibling is not proof for a new head. A green job only covers commands explicitly run there.
- Every evidence claim is one of `PASS` (specific acceptance check and evidence link at exact SHA), `PENDING` (not independently verified), or `BLOCKED` (known failure or missing external prerequisite). Synthetic browser stock, mocked data and source tests can only pass the *code* check, never prove physical availability or human signoff.
- Run no production database writes, migrations, paid AI rendering, main merges or production deployments during unattended drafts. Continue independent engineering when an external criterion is blocked.
- Gate release on ALL required criteria below, including real human checks, on one integrated release SHA; no overall percentage and no inferred approval.

## Six agreed workstreams — measurable criteria

| ID | Workstream | Required acceptance checks |
| --- | --- | --- |
| T1 | Style Director & Deep Engine | Every shipped collar/cuff/placket/fit/trouser combination uses shared typed rules, rejects incompatible or unbuildable selections, reconstructs versioned options from a saved/locked design; `npm run eval:engine`, Designer snapshots, options regressions and operator/tailor review pass on the candidate. |
| T2 | Measurements & tailor handoff | Invalid, missing or non-finite measurements cannot be locked; valid owner-scoped saved/locked revisions survive fresh session/recovery; tech pack and tailor job card match selected fabrics, option IDs, finished targets and recipe hash with no manual re-entry; genuine tailor fit/ease and physical garment review signed off. |
| T3 | Fabric truth & stock | Catalogue IDs, color/pattern/repeat and measured-vs-supplier-vs-estimated provenance remain explicit; **no bundled or synthetic swatch implies physical stock**. Exact verified rolls, metres and operator sold-out veto are confirmed against live supplier/shop ledger; invalid, stale, incomplete or unreachable ledger fails closed in Designer AND `/api/inventory`. |
| T4 | Photographic Designer Studio | The canonical original model/photo and deterministic no-per-edit-paid-AI preview are unchanged; actual fabric selection and option changes render correctly at 390/768/1440px, across front/approved views, without JS exceptions or pattern-scale false claims. Native Blender preflight, four-view source identity/UV/geometry and physical drape approvals are independent required gates before describing a 3D asset as realistic/approved. |
| T5 | Customer/operator production & release | An authenticated *real* owner runs select → measure → save → lock → recovery → explicitly consented share/enquiry → operator receipt → quote → production/tailor packet → status/trial/collection, preserving immutable IDs, owner boundaries, real WhatsApp-send semantics, receipts, payments/ledger and audit. Five real novice/beta cases and first-ten genuine no-reentry deliveries, policy/security/privacy/owner signoffs and production-environment smoke test are recorded. |
| T6 | Performance, tests & release documentation | On the SAME integrated SHA: `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`, audited dependencies, browser 390/768/1440 and Non-3D QA succeed; test genuine device performance/console/network and Windows installer/desktop sync where shipped. Document deployment env, backups, rollback, recovery, compatible migrations, verification and exact PR/CI references. |

## Critical end-to-end journeys (all required; no silent substitution)

- **J1 Browse/select:** catalogue and legacy API never advertise unverified stock; image URLs and physical-scale claims pass origin/provenance checks; empty real ledger shows unavailable, not fake stock.
- **J2 Preview/customize:** original model photo; all marketed controls visibly change deterministic previews and maintain correct fabric mapping and front/approved views at target widths.
- **J3 Measure/save/lock/recover:** typed measurements, unique revision lineage and owner-scoped persistent recovery verified against live Supabase; a browser-only save is not a durable success.
- **J4 Share/enquire:** valid authenticated, consented locked revision only; bounded same-origin payloads and bounded cloud receipts; audit receipt is validated; prepared WhatsApp URL is **not** a sent message or operator acceptance.
- **J5 Produce/deliver:** operator sees the **same** locked design, confirmed stock/metres, validated quote, tailor handoff and immutable order status/payment/delivery receipts; evidence comes from real human-run test.
- **J6 Operational launch:** integrated commit reproducible, no high/critical dependency issues, physical-device/native tests and security/privacy approvals completed, rollback tested, owner explicitly approves merge AND later production deployment.

## Baseline evidence and known blockers (2026-10-29)

- Latest verified stacked source before this checklist: PR #499 → #500 → #501, exact SHA `b15cfd5002688ab4bf44782fb0c91a118a765ce6`, based on original `main` `b1c9d102219005da6f2584ea275a80e8dc021a37`. It contains the integrated strict physical stock and legacy-gallery URL origin safety work; it is not merged into main.
- Exact `b15cfd5` successful GitHub Actions CI run `40925675133`: quality, full Node tests, engine, preview-performance, static release check, build, browser; Non-3D run `40925675204`: studio/browser and image regressions. This evidence is **not transferable** to subsequent commits.
- **BLOCKED human/physical:** live genuine supplier rolls and provenance, owner/customer/operator authenticated Supabase walkthrough, physical measurements/tailor, native Blender four-view approval, real devices and latency evidence, real beta and first-ten outcomes, privacy/security, Windows packaging where required, owner release approval. Mocked browser fixture does not resolve these.
- **PENDING draft integration:** re-run exact-head CI and browser jobs after each code milestone; do not mark T1–T6 or J1–J6 complete on parent CI.

## Checkpoint and resumption contract

Each milestone must append: UTC time; criterion ID; branch; exact parent and resulting commit SHAs; files changed; reproduction/implementation; **named** verification and run IDs/links/results at that SHA; PASS/PENDING/BLOCKED; remaining blockers; next precise independent action. If interrupted, fetch current branch head and live CI again, compare to checkpoint, reconcile competing pushes before editing, and continue the first unpassed priority journey. Never force-update a branch or silently merge siblings.

**Release decision:** `deployment-ready = all required T1–T6 and J1–J6 checks PASS on one integrated SHA, including human/physical evidence`. `merge-approved` and `production-deploy-approved` are two separate explicit owner decisions.
