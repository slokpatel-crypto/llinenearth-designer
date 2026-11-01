# TITAN main intake 8 — optional production evidence 404 must fail closed

**Date:** 2026-11-01 UTC. **Criteria:** T5/J5 operator evidence integrity, T6/J6 testability. **Parent:** narrow main-intake #664 exact `9dacbb1b1579f65ed4bb441c68394d0cf6b7e5d8`; its parent is #663 → #662 → #661 → #660 → already merged #659/#658. Do NOT import the original multi-thousand-commit M150 draft stack into main.

## Demonstrated defect and fix

The existing privileged GET `/api/operator/production` swallowed every optional QC/customer-outcome/learning RPC error, including generic gateway 404, permission failures, malformed responses, and upstream 503, and returned `configured:true` with empty evidence. A transport failure is not evidence that production QC or customer outcome rows do not exist. Preserve historical compatibility **only** for an actual bounded PostgREST HTTP 404 JSON error with literal `code: PGRST202` (missing function); all other optional failures reject the whole ledger as private 503. Keep quote/order RPCs mandatory and the original authenticated operator flow.

## Exact commit trail

- Parent `9dacbb1b1579f65ed4bb441c68394d0cf6b7e5d8` → `8ffc0ec839f3c40a397db42731f70529f1260bbc`: pure bounded missing-function classifier, reusing existing decoded-stream helper with 4,096-byte cap and JSON media-type requirement.
- `8ffc0ec839f3c40a397db42731f70529f1260bbc` → `d5ac8c8f6edebbe7c103f16afea53cedd800b2dc`: actual production route GET fails closed on optional errors, with explicit three-RPC missing-function compatibility.
- `d5ac8c8f6edebbe7c103f16afea53cedd800b2dc` → `23bdf1c85ddef45148b10d3475d658aa7d116fcd`: Node behavioral tests for valid/mismatched/oversized/malformed 404 and source-contract assertion of GET route wiring.
- `23bdf1c85ddef45148b10d3475d658aa7d116fcd` → `9e0ee9b220b8ed1c9d4b1302cf4f5fbdbf544a9f`: explicitly type the verified optional empty-list compatibility value.
- This checkpoint is a separate commit; verify its exact PR SHA from GitHub. Full matching-head CI/Non-3D and signed authenticated built-Next HTTP are **PENDING**; source changes are not physical or human acceptance.

## Remaining gates and next bounded slice

Before any isolated main update, sequentially merge only dependency-complete individually green reviewed intake PRs, re-run matching-head full CI/Non-3D and relevant signed HTTP/browser, verify live main `vercel.json git.deploymentEnabled===false`, preserve no-deploy. This child remains **draft** pending evidence.

**Next 30–40-minute task:** add signed built-Next authenticated GET fixture for literal PGRST202 versus generic 404/503, verify private 503 and absence of fabricated empty evidence. After that, validate full production GET envelope and privacy-project optional QC/outcome rows only after validation; raw SQL rows must not be trusted as approved production evidence.

**BLOCKED/PENDING real-world:** verified supplier roll/metre stock, authenticated owner/customer/operator acceptance, tailor fit and physical QC, native Blender four-view/UV/model calibration, real devices, five novice betas, ten genuine deliveries, staging migration/restore, privacy/security and owner launch/deploy approvals. No Vercel deploy, live SQL/migration, stock mutation, paid AI or change to the canonical `linen-earth-studio-model-v1` photo.
