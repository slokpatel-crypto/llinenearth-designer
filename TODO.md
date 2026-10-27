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
- [x] 2026-10-28 04:00 IST (draft): Pairing and accent rules now fail closed on malformed/unknown weight-class and pattern-scale vocabularies instead of treating invalid index -1 or unknown motifs as a valid pass. The catalogue motif warning explicitly avoids claiming measured physical repeat. Added negative and valid-case engine regressions; exact-head CI pending.
- [x] 2026-10-28 04:00 IST (draft): Corrected hot/humid weight, weight-class and season-tag recommendation language to identify catalogue observations rather than claiming confirmed supplier physical data. Added roll-up and hot-weather negative regressions.
- [x] 2026-10-28 04:00 IST (draft): Prevent Style Director from counting a categorical drape label or raw GSM value as reviewed physical proof. Drape/GSM evidence now requires a finite, bounded, reviewed physics fact tied to the exact fabric ID; estimated, declared, malformed and cross-fabric facts stay unverified. Wide-leg drape warnings remain until genuine review. Added negative and integration regressions. This is an evidence-label correction, not a supplier measurement or drape calibration. Exact-head CI pending.
- [x] 2026-10-28 04:00 IST (draft): Extended pure cross-garment construction guards for short-sleeve shirt families, flat-front versus pleated trouser families, cropped trouser types versus shoe breaks, and roll-up sleeves with short-sleeve hems; the cropped hem guard also rejects slight breaks. All checks use canonical option IDs, preserve customer selections, remain provisional pending tailor approval, and have negative/legacy-default plus engine-wiring regressions. Exact-head CI and operator/tailor acceptance remain separate gates. No production merge or deploy.
- [x] 2026-10-28 03:00 IST (draft): Designer alternative-search requests now use a one-owner abort scope keyed to full selected assessment identity plus search scope. Rapid repeat clicks cannot dispatch duplicate requests; old responses/errors/finally handlers cannot overwrite a new selection or release its in-flight lock. Added delayed-response and source-wiring regressions; exact-head CI/browser QA pending.
- [x] 2026-10-28 03:00 IST (draft): The customer Designer's look-assessment request now snapshots and sends the matching v2 style, measurements and body profile; stale async replies are identity-checked and aborted on subsequent selection changes. Legacy/v2 state commits together to avoid a self-cancel race, and prior fit/production assessment is cleared when the selected identity drifts. Source-wiring regressions added; browser/CI still required.
- [x] 2026-10-28 03:00 IST (draft): Preview-option release coverage now rejects duplicate option IDs, missing identity fields, malformed support/review/construction statuses and non-array runtime input; malformed rows cannot inflate `fullyCleared` or complete the gate. Operator UI shows invalid-row count and an explicit blocking alert. Negative tests added; exact-head CI and real operator review still required.
- [x] 2026-10-28 03:00 IST (draft): Bind selected Creative Lab directions and restored browser drafts to exact fabric IDs, occasion, climate, intention, legacy style and advanced v2 construction. Stale context/advanced-cut concepts now clear instead of carrying prior visual evidence into a new design; abort in-flight concept generation on v2 changes. Pure negative regression cases added. Exact-head CI/browser QA must pass; no physical fit, photographic parity or production approval inferred.
- [x] 2026-10-28 02:00 IST: Added bounded GLB BIN UV payload inspection: nonfinite float coordinates, collapsed UV ranges, invalid strides, truncated buffer views and impossible byte bounds revoke UV readiness even if JSON accessor metadata looks plausible. No fabric physical calibration, native Blender UV stitching or model parity is inferred.\n- [x] 2026-10-28 02:00 IST: Hardened GLB structural inspection to require typed VEC2 UV accessors, valid buffer-view references and per-primitive vertex-count parity; malformed TEXCOORD_0 and normal metadata cannot masquerade as UV-ready. This is metadata integrity only, not native seam/texture value inspection or physical acceptance.\n- [x] 2026-10-28 02:00 IST: Guarded 3D measured-tile labels against UV sampler repeat clamping on either axis of any shirt/trouser panel. Out-of-range recorded tile measurements remain stored but are explicitly shown as approximate in the isolated viewer, with regression tests; no claim of physically verified UV projection or supplier acceptance.\n- [x] 2026-10-28 02:00 IST: Added Blender-independent UV loop validation and native scene preflight gating for collapsed/nonfinite faces, discontinuities on shared mesh edges, nonmanifold topology and absent continuity evidence. Pure negative regressions do not certify sewn seams, grain direction, physical textile scale, four-angle photo parity or drape. Native Blender run and actual repaired geometry remain blocked pending scene/evidence; no production promotion.\n- [x] 2026-10-28: Reviewed Analyzer-to-Designer physical evidence and Phase 2 policy counts now require strictly typed dimensions, provenance and bounded coverage; malformed GSM, drape, fibre, URLs and rejected reviews cannot certify customer facts. Isolated 3D repeat calibration matches deterministic photo preview: swatch width/unobserved repeat cannot certify true scale, and overflow/coercion fails closed. Build-time fabric-scales.json entries now require operator/supplier provenance and typed finite measurements before tile calibration; rounded-zero tiles stay approximate. Added negative regressions. Exact-head CI, supplier evidence and native Blender acceptance remain separate pending gates; no release claim.
- [x] 2026-10-28: Hardened Phase 1 proof against coerced latency samples (`null`, booleans, numeric strings, empty strings) and invalid direct-gate sample counts, p95 values or nonfinite physical repeats; photo calibration overflow/underflow now fails closed instead of throwing or certifying scale. Added raw and recorded-evidence regressions. Exact-head CI/Non-3D QA, genuine render timings and real physical/operator acceptance remain separate pending gates; no release claim.
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

- [x] 2026-10-26: Secured the two-key browser measurement/observation save and remote-restore path. Both values are now written as one verified UI operation; on partial failure a pure helper attempts to roll back only unchanged values from this operation (without overwriting another tab), and UI does not activate a partially stored fit. Honest separate remote-retrieved/local-storage failure messaging added. Quota, read denial, undo denial, and concurrent edit regressions included. Browser/CI acceptance still required; localStorage has no true atomic transaction.

- [x] 2026-10-26: The locked-design Studio client now displays server-provided unconfirmed account-link status beside the recovery token, preserving copied/manual-copy messages. Source ordering regression added; authenticated browser acceptance still required.

- [x] 2026-10-26: Main Measurements save and Use in Designer now commit measurements plus manual observations through the guarded pair writer. Partial browser writes keep React state inactive, attempt non-clobbering rollback, disclose incomplete recovery, and block Designer navigation. Added source regression and release-contract coverage; real blocked-storage/concurrent-tab device acceptance remains required.

- [x] 2026-10-27: Named customer activation resets unrelated posture evidence; save/activate/delete recover partial writes without knowingly overwriting concurrent edits. Invalid history blocks mutation; confirmed writes are read back. Runtime regressions cover customer switching, failed activation/deletion and corrupted history.
- [x] 2026-10-27: Measurement vault uses synchronous request locking and locks edit/token controls during recovery. LocalStorage getter denial preserves remote recovery credentials; successful recovery clears stale local-save errors.
- [x] 2026-10-27: New measurement-recovery scenarios passed locally in Chromium at 390/768/1440, with synthetic vault responses, storage denial, rollback and duplicate dispatch. No console errors or horizontal overflow. Latest runtime download failed; isolated Playwright 1.56.1 / Chromium 141 succeeded without changing project dependencies. Remote exact-head CI, authenticated vault and physical acceptance remain pending.

- [x] 2026-10-27: Physical provenance rejects coerced array/object/boolean/number fields; corrupt evidence cannot authorize verified CSV values. Template GSM stays blank outside the existing supported range. Added normalization and CSV integration regressions; no supplier evidence invented or changed.

- [x] 2026-10-27: Deleting an unchanged, linked named customer now removes their associated manual tailor observations as well as measurements; stale/independently edited manual fits and other customers' records are preserved. Regression tests cover successful removal, rollback on denied deletion, and identity isolation. Draft #402; exact-head CI/browser acceptance and real tailoring evidence remain release gates.
- [x] 2026-10-27: Analyzer CSV header validation now applies to single-row/header-only worksheets; malformed evidence column names cannot bypass checks when zero data rows are parsed. A single leading supplier UTF-8 BOM is accepted without weakening field validation. Deterministic tests added. Stacked draft #403; exact-head CI and operator device acceptance remain pending.
- [x] 2026-10-27: Owned measurement/design vault actions reject malformed UUIDs before authentication or database RPC, using the same strict normalizer as recovery-token issue/parse. Coerced arrays, invalid UUID versions/variants and trailing data fail closed; token/schema formats are unchanged. Exact-head CI and authenticated live Supabase acceptance remain pending.

- [x] 2026-10-27: Recovery-token load/delete in measurement and locked-design vaults no longer depend on optional legacy session introspection. Owned/claim operations still require account identity; malformed credentials still fail before auth/RPC. Draft #406, exact-head CI and authenticated provider acceptance pending.
- [x] 2026-10-27: Locked revision verification handles corrupt runtime envelopes and unserializable nested payloads by returning failed integrity instead of throwing through vault APIs. Existing valid lock generation is unchanged. Draft #407, real vault and release acceptance pending.
- [x] 2026-10-27: Optional customer identity resolution on vault store is best effort. Legacy Auth outages do not prevent independently working secure copy creation; ownership uncertainty is surfaced while preserving the issued recovery credential. Account-owned actions remain mandatory-auth. Draft #408, exact-head CI and real Supabase outage acceptance pending.

- [x] 2026-10-27: Identical garment recipes locked in the same second now receive distinct 64-bit nonce-suffixed design revision IDs. Recipe hashing, parent links and compatibility with older stored IDs remain unchanged. Draft #409; exact-head CI and production handoff acceptance pending.
- [x] 2026-10-27: Measurement and locked-design vault per-process rate caches are bounded to 4,096 entries, opportunistically evicting expired oldest keys with constant per-request work; the existing 30 requests/minute per cache identity threshold remains. Memory safety is not distributed rate-limit security: edge/backend enforcement and authenticated threat-model review remain release blockers. Draft #410; exact-head CI pending.

- [x] 2026-10-27: Increased premium 390px phone navigation from 8px to 11px labels while retaining the five real destinations, fixed bottom clearance and compact two/three-line wrapping; static regression added. Draft #411. Requires fresh exact-head Chromium 390/768/1440 screenshots and touch-device acceptance; does not imply general accessibility sign-off.

- [x] 2026-10-27: Both account-owned vault listing routes now screen malformed rows and ID/date envelopes before exposing results; design listing additionally requires the SQL index recipe hash and revision ID to match the independently verified locked payload. Corrupt rows are skipped without assigning a different design identity. Draft #412; exact-head CI, authenticated Supabase list/load acceptance, and supplier/tailor verification remain release gates.

- [x] 2026-10-27: Hardened measurement and locked-design vault read responses for both recovery tokens and authenticated account load: only one well-formed, unexpired timestamped RPC row is accepted; duplicate/malformed/expired envelopes fail closed instead of returning arbitrary or stale records or causing a service-level exception. The design account-claim follow-up uses the same guarded read before optional production ownership propagation. New pure and route-wiring regressions added. Exact-head CI, authenticated live Supabase recovery/claim and mobile browser acceptance still required; no schema, merge or deploy.

- [x] 2026-10-27: Hardened instant fabric preview scale promotion: only an actual declared repeat with a detected positive finite pixel period can turn a tile into a verified physical-width render. A declared swatch-width record, stale nondetected repeat, overflow, nonfinite width or invalid texture dimension cannot silently become measured patterned scale or pass the photo repeat audit. Deterministic regressions added. Supplier repeat proof and customer-device visual acceptance still external; exact-head CI pending. No schema/model/photo replacement or deploy.

- [x] 2026-10-27: Design and measurement secure vaults now require literal boolean RPC acknowledgements for claim, owned delete and token delete. Malformed truthy JSON cannot masquerade as a confirmed claim/deletion or trigger production-ownership propagation. Added pure boundary and both-route wiring regressions. SQL/schema unchanged; exact-head CI and live authenticated/browser checks remain mandatory. No merge or deploy.

- [x] 2026-10-27: Secured account-owned measurement/design vault list expiry semantics. Shared Postgres offset-bearing timestamp parser now rejects stale/expired, ambiguous date-only and impossible created-after-expiry list rows; both endpoints reuse the guard without changing the Supabase schema. Added timestamp-boundary, timezone and route-compatibility regressions. Exact-head CI and authenticated real database/browser validation pending; no main merge or deploy.
