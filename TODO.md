# TITAN — prioritized execution queue

Prepared: 2026-10-24 (Asia/Kolkata). This is a **planned 8-hour work allocation**, not a background-job runner or a claim that work has executed. Check boxes only after implementation and exact-head verification.

Repository: `slokpatel-crypto/llinenearth-designer`
Starting point: draft PR #372 head `28a50ac`; its original CI and Non-3D QA runs were green when this plan was drafted. Parent PRs are stacked; do **not** merge straight into `main`.

## Eight-hour work allocation — 24 October 2026, IST

| Time | Budget | Focus | Exit evidence |
| --- | --- | --- | --- |
| 01:45–02:30 | 45 min | Repo/PR/CI audit, blockers, highest-risk regression | Reproducible failure list and selected one-file-at-a-time tasks |
| 02:30–04:00 | 90 min | Fabric intake, Analyzer truth, stock/provenance contract | Tests for declared-vs-estimated facts, repeat-mm identity and unknown data |
| 04:00–05:30 | 90 min | Designer Engine, Style Director compatibility | Tested exact-ID outfit rules and reproducibility |
| 05:30–06:30 | 60 min | Measurements, design lock, versioned tailor handoff | Canonical lock/restore/revision tests |
| 06:30–07:30 | 60 min | Existing Real Model Designer technical integrity | Model-identity, projection/UV or measurable geometry preflight; no fake photo approval |
| 07:30–08:45 | 75 min | Operator/release evidence, responsive UI and failure paths | Fail-closed proof checks and 390/768/1440px browser QA |
| 08:45–09:45 | 60 min | Full validation and handoff | Quality/tests/evals/build, clean draft PR and remaining blockers |

**Work sequencing:** Finish one scoped task, add tests, run affected checks, commit on a branch, then pick the next task. If a task is blocked by real supplier/physical evidence, record the blocker and continue to the next code task. The time slots are budgets, not promises of completion.

## 1. Stabilize and audit (highest priority)
- [ ] Compare `main` with stacked draft PRs, including #372; document conflicts and safe integration order.
- [ ] Read current roadmap, `AGENTS.md`, `DECISIONS.md` and all release gates before changing behavior.
- [ ] Verify CI and Non-3D QA on the **new** exact commit, not a green parent only.
- [ ] Investigate existing lint/quality/build warnings, runtime errors and unresolved audit findings.
- [ ] Preserve fixed studio-model identity `linen-earth-studio-model-v1` and canonical `/designer/studio-tucked.webp`.

## 2. Core fabric intake and Analyzer / Fabric Intelligence
- [ ] Trace flat/macro/fold intake, catalogue identity and operator-review flow end-to-end.
- [ ] Check physical repeat mm, fibre, GSM, drape, colour and stock provenance; leave unverifiable values unknown.
- [ ] Harden malformed input, cross-fabric identity, stale replies and partial-batch recovery.
- [ ] Confirm reviewed evidence flows to all relevant Designer routes without losing provenance.
- [ ] Add focused deterministic tests for each issue actually found; do not invent supplier measurements.

## 3. Designer Engine and Style Director
- [ ] Audit shirt/pant option IDs and canonical cross-garment rules; reject incompatible construction.
- [ ] Verify Safe / Elevated / Statement ranking with deterministic scenario snapshots.
- [ ] Fix discovered fabric-selection or design-state regressions, one scoped patch at a time.
- [ ] Preserve quick, no-credit interactive previews; optional AI is only for locked/final workflows.
- [ ] Test saved designs and older StyleSpec adapters for backward compatibility.

## 4. Measurements, lock and tailoring bridge
- [ ] Audit measurement validation, ease and fit warnings with explicit uncertainty labels.
- [ ] Verify exact fabric IDs, garment options, measurements and versions survive lock/save/restore.
- [ ] Verify locked-spec hash prevents silent drift between preview, render and tailor handoff.
- [ ] Add recovery tests for changed selections, lost browser state and stale network responses.

## 5. Real Model Designer: technical-only work
- [ ] Keep original model/photo identity, proportions, garments and customer-visible rollout unchanged.
- [ ] Review production vs prototype 3D separation and model asset integrity/preflight.
- [ ] Test existing body/garment alignment, UV orientation, actual repeat scale and four-view QA contracts.
- [ ] Prepare concrete issues for real Blender geometry/drape corrections when evidence is insufficient.
- [ ] Do **not** claim photoreal, fit, physical fabric or tailor acceptance from software-only tests.

## 6. Operator workflow, UX and production QA
- [ ] Confirm first-ten production evidence is based on actual chronological delivery history and closed field IDs.
- [ ] Confirm refresh failure, stale replies, contradiction and missing live data all revoke readiness.
- [ ] Check responsive screens at 390px / 768px / 1440px, plus console/runtime errors.
- [ ] Run `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`.
- [ ] Record exact tested SHA, passed/failed checks, screenshots where applicable and remaining risks.
- [ ] Open/update a draft PR; **no main merge or production deploy** before full milestone verification.

## External evidence / release blockers (must remain unclaimed until proven)
- [ ] Owner/supplier-confirmed repeat, GSM, fibre, physical drape and stock facts.
- [ ] Real tailor construction/fit approval and verified model four-angle physical comparison.
- [ ] Authenticated live Supabase migration verification and genuine oldest-ten delivery audit.
- [ ] Real operator/browser/device acceptance, security/release gate sign-off.
- [ ] Production deployment only after a major clean milestone and explicit approval.

## Later phase — do not implement in this queue
- [ ] Ecommerce and checkout.
- [ ] B2B customer accounts.
- [ ] Additional brand/marketing pages.
- [ ] Notifications and broad marketing automations.

## Progress record
- [x] 2026-10-24: Confirmed connected GitHub repository and latest open draft PR #372.
- [x] 2026-10-24: Confirmed PR #372 head `28a50ac` has passing **CI** and **Deep Engine — Non-3D QA** workflow runs.
- [x] 2026-10-24: Hardened physical-evidence parsing across direct, batch, queue and worker Analyzer paths; malformed/coerced facts now fail closed and persisted jobs are independently revalidated.

- [x] 2026-10-24: Closed the reference-page-only Analyzer evidence-loss gap across direct, batch, queue and worker routes; source-only requests containing submitted verified physical facts or provenance now fail closed instead of silently dropping it. No asset, schema, model or live data changed.

- [x] 2026-10-24: Refactored Analyzer batch CSV parsing into a testable pure module; invalid nonempty GSM, repeat, physics indices and drape labels survive to strict server validation instead of being silently dropped by the worksheet importer. Existing valid decimal values still parse as numbers.

- [x] 2026-10-24: Prevented physical CSV template from promoting provenance-free catalogue GSM and drape into verified claims; only valid operator physical provenance allows prefill, with independent pure tests and HTTPS-only exported evidence URLs.

- [x] 2026-10-24: Rejected malformed and over-limit synchronous Analyzer batch envelopes atomically instead of silently processing only the first 12 rows. Added envelope and route-contract regressions; exact-head CI and browser QA still required.

- [x] 2026-10-24: Strictly parsed Analyzer CSV worksheets: duplicate/empty headings, row-width drift, unclosed quotes and unexpected text after quote now block all rows, surface an operator error and prevent analysis. Ordinary valid quoted provenance and numeric columns remain supported; exact-head CI pending.

- [x] 2026-10-24: Durable 500-job Analyzer queue now rejects malformed/oversized envelopes before enqueuing, rather than silently discarding submitted jobs 501+. Shared size-aware batch validator and regression tests. Production queue/database not touched.

- [x] 2026-10-24: Checked actual Gregorian validity of operator/supplier physical-evidence dates before exporting GSM/drape as verified CSV. Reject impossible days/months, preserve valid leap day; targeted tests added. No real evidence asserted.

- [x] 2026-10-24: Fixed atelier handoff identity collision: two saved design IDs using the same locked spec hash now retain separate customer requests; a duplicate request for the same design/version still replaces its earlier copy. Added pure regression tests, protected 50-item cap; browser-only storage remains non-production.

- [x] 2026-10-24: Atelier browser handoff reader rejects corrupt null/nonobject/incomplete stored rows before new submissions, deduplication or dashboard updates. Valid stored handoffs retain original persistence format; pure recovery tests added.

- [x] 2026-10-24: Hardened Atelier queue browser-read contract beyond top-level fields: invalid garment details, fabric assessments, notes, alternative fabrics and statuses no longer reach React rendering, and legacy oversized arrays are bounded to 50. Initial and switched customer notes/status now synchronize. New regression fixtures added. Exact-head CI/browser QA pending; handoffs remain local-only.

- [x] 2026-10-24: Atelier handoff IDs no longer depend on timestamps alone; new local packets use a fresh 128-bit browser cryptographic nonce, with backward-compatible legacy IDs. Handoff CTA and confirmation now explicitly identify browser-only storage and report write failures without claiming staff delivery. Added deterministic pure/static tests; exact-head CI and browser QA pending.

- [x] 2026-10-24: Analyzer CSV import rejects unsupported/misspelled headings and nonempty rows without fabricId, imageUrl or sourcePageUrl rather than silently excluding source/physical evidence. Blank spacer lines and valid identified rows retain previous behavior; focused fail-closed regressions added. Exact-head CI and operator browser QA pending.

- [x] 2026-10-24: Replaced unsupported `align-items:end` on the Analyzer operator panel with `align-items:flex-end`; added CSS regression, addressing the recurring Autoprefixer mixed-support build warning without changing model or physical evidence. Exact-head build must confirm no warning.

- [x] 2026-10-24: Analyzer operator batch client now verifies that every 200 response accounts for each submitted row exactly once via ordered per-item status, matching total and success/failure counts. Inconsistent/partial acknowledgements show an error rather than incrementing success totals. Focused pure and UI/API contract tests added. Exact-head CI and browser QA pending.

- [x] 2026-10-24: Saved Designs remounts the browser-local Atelier handoff panel when design ID or locked version changes; a saved/sent packet and unsent customer note from design A can no longer appear under design B. Static React key wiring regression added. Exact-head browser QA pending.

- [x] 2026-10-24: Saved Designs now filters corrupted/legacy localStorage entries at the browser-read boundary before list rendering or save/dedup, validating required design, brief, visual render and handoff shape. Valid older drafts retain order/format and prior 24-design cap. Pure corrupt-entry and compatibility regressions added; exact-head CI/browser validation pending. Not durable production storage.

- [x] 2026-10-24: Local design feedback now differentiates customers by `(designId,specHash)` rather than spec alone, with collision-resistant random packet IDs and guarded browser-read status/reasons. Existing reviewed feedback remains compatible, 100-row cap preserved, and pure regressions added. Exact-head checks and staff browser acceptance pending; no production feedback inbox claimed.

- [x] 2026-10-24: Fabric Studio scan now snapshots the selected upload/consent, invalidates async work on file, stock, fabric-range, garment, source changes and unmount; stale classifier/provider replies can no longer replace a newer fabric profile, and canceled preflight avoids starting an obsolete optional AI request. UI wiring tests added. Exact-head CI/browser QA pending.

- [x] 2026-10-24: Operator Analyzer batch prevents duplicate in-flight ingestion via an immediate ref lock independent of React state; CSV textarea, file picker and template actions are locked during a run, including a second guard after asynchronous file reading. Tested source lifecycle and `finally` unlock. Exact-head CI/browser QA pending.

- [x] 2026-10-24: Operator Analyzer CSV file imports now obey most-recent intent. Late file reads cannot replace a newer selected file, manual CSV edit, or in-flight batch source; read failures are reported without clearing the worksheet, and same-file reselection is supported. Exact-head CI and operator device QA remain required; no merge/deploy.

- [x] 2026-10-24: Analyzer batch error copy now distinguishes verified prior-chunk acknowledgements from unknown current-chunk outcomes; failure to refresh the operator view after all chunks succeed no longer falsely says batch ingestion failed. Pure numeric/message regressions and UI integration tests added; retry remains human-reviewed (not exactly-once), with CI/browser verification pending.

- [x] 2026-10-24: Local named customer-measurement records now skip corrupted null/nonnumeric/invalid nested entries, deduplicate IDs, preserve valid legacy customers and enforce the existing 20-profile limit. New profiles get random 128-bit nonce IDs, while browser save/use/delete failures show errors rather than false confirmation; pure and UI regressions added, exact-head CI/browser acceptance pending.
- [x] Guard linked-active customer profile deletion by exact profile ID and snapshot digest; leave older unlinked Designer snapshots intact (no ownership inference).

- [x] 2026-10-24: Secure measurement vault now exposes the issued recovery/delete token before any browser-local writes. Browser quota/security failure leaves token available and reports server success separately; clipboard denial preserves manual-copy fallback. Pure truth-message and UI sequencing tests added. Exact-head CI and browser permission simulation pending.

- [x] 2026-10-24: A newly activated named customer measurement profile now links its exact Designer legacy snapshot by profile ID + local integrity digest. Deleting the profile clears only its unchanged linked snapshot, not another customer or independently edited measurements; older unlinked snapshots remain intact. Added pure identity/edited-state regressions and UI wiring checks. CI/manual browser acceptance pending.

- [x] 2026-10-25: Consolidated strict stored measurement and manual-tailor-observation validation across secure-vault store/load, Measurements browser restore, Designer browser restore and Designer API observations. Corrupt numbers, unknown keys/categories and invalid timestamps now fail closed without manufactured evidence. Added shared pure/wiring regressions; physical tailor/vault/browser acceptance remains external.

- [x] 2026-10-26: Hardened measurement and locked-design vault store recovery: remote store success issues the token before optional owner linking, linking RPC false/rejection no longer becomes a misleading 503, and unconfirmed ownership is explicitly reported. Measurement UI now preserves the displayed recovery token and warns about unconfirmed account linking. Malformed/unsupported request envelopes return 400 instead of 503. Pure injected-RPC regression and route/UI contract tests added. Exact-head CI, authenticated browser recovery/claim tests, real Supabase outage simulation and deployment approval remain pending.
