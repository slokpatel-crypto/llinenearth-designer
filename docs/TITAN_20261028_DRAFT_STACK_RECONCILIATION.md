# TITAN draft ancestry reconciliation — 28 October 2026

**Scope:** source-level selective compatibility review, not a Git merge or proof of a production-ready site. Older PRs #444–#447 and newer #448–#452 diverge at merge-base `41850a5cc9cbd9978c6e91280d2d7af59a2406cb`. A blind merge is unsafe. Keep the older drafts intact and target the most recent Designer branch; do not merge into `main` or deploy.

## File-level decisions

| Older draft | Newer source | Safe resolution / evidence |
| --- | --- | --- |
| #444 vault secure request helper, mutation entry points | `src/lib/secure-json-request.ts` exists; Designer and measurement vaults had switched back to unbounded `request.json()` | Reuse shared secure helper and restore origin / Fetch Metadata, JSON media type and stream byte caps at **both** current vault entry points. Preserve newer owner-link recovery guarantees, vault ID parsing, row-envelope validation and default legacy behavior. |
| #444 measurement vault profile validator | Newer `validStoredMeasurementProfile`, `validStoredTailorObservationProfile`, `vault-request-identifiers` | Do **not** replace newer validated conversion/read logic with older helper `measurement-vault-payload.ts`. The earlier file is deliberately not copied. Test its important invariants on the current path instead. |
| #444 operator stock and production request checks | Newer stock mutation helper already bounds request bytes and stock snapshot invariants; production POST lacked a bounded secure request | Keep newer stock ledger validation and recover the secure JSON boundary on production POST. Preserve locked revision / recipe-hash verification and physical QC gate. |
| #445–#447 first-ten delivery SQL and API | Newer `20261103_production_first_ten_delivery_audit.sql` JSON v2 with `historyValid`, event chronology and separate recent-order browsing | **Do not apply** superseded `20261028121038_authoritative_first_ten_delivery_audit.sql` or overwrite the v2 RPC. Preserve uncapped oldest-ten basis and fail-closed incomplete history. |
| #447 audit revision/hash and corrupted/partial receipt detection | Newer `validProductionFirstTenAuditBasis`, `summarizeProductionDeliveryEvidence` and cloud gate | Port matching revision ID, SHA-256 recipe hash, original order creation, unique evidence IDs, valid incident vocabulary, timestamp and contradictory re-entry checks into the current v2 basis and live cloud check. Keep physical/tailor signoff separate from code-level integrity. |
| #448–#451 assessment/search/brief request safety | Current newer head includes strict literal fabric selectors, fit parsing, regression HTTP checks, fixed photo identity | Preserve these edits; no older branch can overwrite them. Exact prior #451 head passed CI and Studio QA, but each later change requires its own green head. |

## Validation boundary and remaining work

- Source code changes and focused regression tests are staged in draft PR #452; no migration executed; no customer data changed.
- Latest production code must pass quality, complete Node tests, engine and preview checks, static release check, production build and pinned real Chromium. A parent PR's green result is not evidence for this head.
- The complete **Git ancestry** reconciliation of all historical drafts has **not** been completed; cherry-picking the older overlapping SQL or vault routes would regress the current schema/behavior. Review old PRs individually against the chosen integration base; obtain exact-head checks before one deliberate milestone integration.
- Real Supabase configured-owner lock/recovery and production RPCs, customer consent, current stock truth, actual tailor evidence, native 3D sleeve/UV preflight, multi-device physical acceptance and owner approval remain unverified blockers.

## Next precise engineering step

Confirm PR #452 exact-head green. For any failing regression, repair the current path rather than weakening tests. Then trace account-owned locked revision -> measurement recovery -> enquiry -> operator view with a configured test Supabase environment; record missing config as a blocker and never claim end-to-end durability from mocks.
