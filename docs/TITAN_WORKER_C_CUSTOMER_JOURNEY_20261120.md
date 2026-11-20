# TITAN Worker C — Customer journey continuation checkpoint (2026-11-20)

## Scope delivered

Connect the existing fabric-first Designer, account-owned immutable design vault, signed design-only sharing and locked-design WhatsApp enquiry without creating new persistence systems.

Customer paths:
1. New customer: `/designer-studio` fabric discovery + deterministic Studio editing -> existing locked-revision download -> existing secure vault store while signed in -> `/account`.
2. Returning signed-in customer: `/account` -> **Continue in Designer** for the selected vault entry -> server `loadOwned` (owner-scoped) -> independent browser hash check -> validate saved fabric IDs and StyleSpec v2 / legacy reconstruction -> editable Studio draft -> new immutable lock with `parentRevisionId` set to saved revision.
3. Existing locked revision: `/account` -> **Copy secure share link** from the saved original (signed, expiry controlled by existing share endpoint) or **Prepare WhatsApp enquiry**; customers explicitly choose to open and send the prefilled message.

## Explicit boundaries

- The URL holds the opaque vault UUID only. Recovery token, email, measurement values, customer account token, share secret and raw recipe never enter navigation URLs. The existing server API enforces authenticated ownership and recipe integrity.
- Unrecognized version, missing fabric ID, invalid style option or context fails closed with a visible notice. No automatic nearest-fabric substitutions or undocumented contract upgrades.
- Account resume is an *editable fork*, not a release or a mutation of stored locked evidence. Creative work must be reviewed anew; physical fit, drape, colour, meterage, inventory, approved tailor handoff and external real-customer acceptance remain unresolved.
- No new DB migration, live-data mutation, paid API, new library dependency or Vercel deployment.
- Existing customer security PR #863 and existing hardening work on share/audit boundaries should be reconciled independently before treating any portion as production-secure.

## Tests

- `tests/customer-resume.test.ts`: accepted/invalid vault identifiers, versioned resume, defensive clone, old saved recipe compatibility, unsupported/unknown options and owner-only transport source.
- `scripts/verify-customer-journey.cjs`: real built Next.js + headless Chromium, synthetic-only owner/vault/catalog/share/enquiry API fixtures at 390/768/1440, no horizontal overflow, no paid calls, explicit unauthorized recovery failure, screenshot/evidence outputs under `artifacts/preview-lifecycle/customer-journey`.
- `.github/workflows/ci.yml` invokes new browser smoke alongside the existing preview lifecycle gates.
- Still require exact-commit `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`, Actions browser screenshot review and independent authorization before merging main.

## Merge criteria

Only merge when exact final PR head receives completed/success Full CI, applicable non-3D UI workflow, no failures or stale checks, independent review, and current main ancestry/diff inspection. No deployment from this work.
