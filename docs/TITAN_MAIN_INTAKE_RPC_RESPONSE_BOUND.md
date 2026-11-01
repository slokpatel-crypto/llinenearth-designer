# TITAN main intake 7 — bound actual operator PostgreSQL RPC response streams

**Date:** 2026-11-01 UTC. **Criteria:** T5/J5 production operator safety; T6/J6 deterministic verification. **Compatible parent:** main-intake #663 exact `5870f2a3dc3df9993eb0463c80b2a353cfbe9280`, itself stacked on #662 → #661 → #660 → already-main #659 and #658. The original M150 giant draft stack is NOT imported or represented as main-ready.

## Production-blocking defect

The privileged `src/app/api/operator/production/route.ts` continued to parse upstream SQL RPC bodies using unbounded `response.json()`. A service-role RPC can return an oversized, chunked or falsely length-declared body, consuming memory before the operator request can fail safely. The new #661 import-free streaming helper already enforces an actual decoded byte cap, but had not been wired into the real handler.

## Scoped implementation and reproducible acceptance

- **Parent → runtime:** `5870f2a3dc3df9993eb0463c80b2a353cfbe9280` → `b5186792f702232457021cf3627099db120fba7c`: reuse the reviewed `readBoundedJsonResponse` helper for every operator SQL RPC; enforce 2,097,152 actual decoded bytes before JSON parsing, regardless of Content-Length. Keep existing 8-second timeout, operator authentication, action/RPC behavior and generic private error handling.
- **Runtime → regression:** `b5186792f702232457021cf3627099db120fba7c` → `7bf17ad9b2cb40aa84fb347599d80d176822f26d`: source contract plus real streaming Response tests for valid chunked JSON, falsely small Content-Length, oversized stream, malformed JSON, invalid UTF-8, absent stream and invalid limits.
- **This checkpoint commit:** inspect exact live PR head; its SHA cannot be embedded into its own content. GitHub CI full Node/quality/engine/preview/release/build/browser, independent Non-3D and both disposable PostgreSQL checks are **PENDING** on the final SHA until verified. No local full repository checkout was available.
- **Acceptance:** source no longer calls `response.json()` for privileged RPC; oversized/malformed upstream data fails closed. This is code-level only, not evidence of real stock or live operator acceptance.
- **Remaining engineering:** operator GET still returns raw optional QC/outcome/learning rows and catches all optional RPC failures; separate narrow fail-closed validated-envelope/projection and missing-function-classification slice is required. No claims about full T5/J5 completion.
- **Main intake:** parent #663 and all small prerequisite intakes must independently pass exact-head CI and be reviewed/merged in order. Before ANY main update re-check live main `vercel.json` `git.deploymentEnabled===false`, ancestry, isolated diff, signed HTTP/browser checks and no unrelated unverified files. **This PR must remain draft** until those checks.
- **BLOCKED human/physical:** verified supplier stock/metres and repeat, authenticated owner/customer/operator, tailor fit/QC, Blender source/four-view/UV, real devices, five beta users, ten actual deliveries, staging migration/restore/security/privacy and owner release/deployment approval. No live SQL, migrations, provider charges, production deployment, main backlog merge or replacement of `linen-earth-studio-model-v1`.
- **Next 30–40-minute slice:** inspect matching-head CI and repair any failure; then validate and project operator GET optional evidence only after full envelope verification, without silently swallowing gateway errors.
