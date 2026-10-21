# PROJECT TITAN — Linen Earth Master Web 2.0

**Status:** Draft design-system pilot, not a production release.  
**Working preview route:** `/titan` (not linked from the deployed homepage).  
**Target planning window:** 19 October–17 November 2026 (29 days); estimated hours and final date are not commitments.

## Product decision

Build the new customer experience **around existing engines**, not a rewrite of the customer records, garment geometry, verified fabric stock, or model identity. Keep existing `/designer-studio`, `/style-director`, `/measurements`, `/account`, and operator workflows in place until replacement paths meet feature parity and acceptance checks.

No mandatory per-visit paid AI service: the core customer journey must operate with deterministic engines, standard frontend code and browser rendering. Existing optional external render integrations remain optional and must fail clearly, never silently charge the customer.

## Carry-forward requirements: no quality-for-cost tradeoff

All requirements agreed before TITAN remain in force unless the owner explicitly changes them. A new interface may replace presentation code **only after** proving functional parity; it may never silently remove features to make a timeline or credit budget look better.

1. **Identity:** Retain the existing `linen-earth-studio-model-v1`, source photographic reference, straight natural posture, reduced leg gap, correct sleeve/neck/hand alignment, and four-angle review. Do not substitute a new model or claim native 3D approval without the independent Blender/UV and photographic gates.
2. **Fabric truth:** Preserve real catalogue options, supplier/calibration provenance, measured repeat in millimetres, true pattern and colour scale, exact selected cloth, safe rapid switching and deterministic browser preview. Unknown dimensions must remain explicitly unknown, never estimated as fact.
3. **Design choices:** Preserve shirt/trouser categories, collars, cuffs, plackets, fit, silhouette, waistbands and styling compatibility rules; every preview or recommendation must refer to versioned existing option IDs.
4. **Tailoring:** Preserve separate shirt/trouser measurement guidance, validation, fit constraints, design lock/recovery and consistent tailor-ready handoff. No unverified physical fit or tailor approval claims.
5. **Business continuity:** Preserve accessible `/designer-studio`, `/style-director`, `/measurements`, `/account`, and existing operator journeys; never break saved customer designs or existing database contracts.
6. **Zero mandatory paid AI:** Core design, styling rules, pattern mapping, navigation, account and measurements must function with no paid image-generation credits. Optional final renders may stay behind explicit requests and safe failure handling, never be a prerequisite to the core experience.
7. **Premium and usable:** Mobile-first touch targets, readable contrast, keyboard and screen-reader navigation, reduced motion, stable rendering, image load/error handling and measured performance count as release gates, not polish to defer.
8. **Production discipline:** CI, native 3D gate, real-browser regression evidence, privacy/authorization checks, owner review and major-milestone approval must be satisfied before any homepage cutover, model acceptance or deployment.

A failing gate is a development task, **not** a justification to remove it, lower its thresholds or silently degrade quality. The 29-day window is a planning horizon, not permission to skip evidence.

## Major development tracks

| Track | Outcome | Acceptance boundary |
| --- | --- | --- |
| TITAN Interface | Unified premium frontend, typography, animation, accessible navigation and mobile layouts | Desktop/mobile browser verification, keyboard navigation, reduced-motion support and no regression to deployed routes |
| TITAN 3D | Existing model identity preserved; reliable geometry, UVs, consistent posing and cloth preview | Native Blender release gate and reference-photo agreement; never claim physical fabric fit from software alone |
| TITAN Fabric | Measured repeat/scale provenance, texture switching and inventory truth | Supplier calibration and visible evidence source/quality; missing dimensions explicitly unknown |
| TITAN Intelligence | Deterministic outfits, pairing logic, measurement validation, tailoring handoff | Tests for invalid input, traceable rules and handoff matching customer selections |
| TITAN Commerce | Account, saved designs, order journeys, operator controls and inventory linkage | Auth, authorization, order state transitions, reconciliation and controlled failure paths |
| TITAN Performance | Optimized payloads, rendering responsiveness, SEO/accessibility, CI and rollout | Measured performance budget, tests and explicit release signoff |

## First implementation milestone — TITAN Interface

- Isolated `/titan` route built with reusable journey data, scope-limited styles and working links to real existing routes.
- Responsive layout supports phone, tablet and desktop, with reduced-motion fallback and visible focus styles.
- Labels existing routes as accessible journeys; **does not** claim 3D realism, exact material drape, inventory or commerce features are finished.
- No replacement mannequin, no new AI-render API, no changes to signed-off garment geometry or deployed homepage.
- Keep the route out of search results until the full experience is approved.

### 19 October — functional navigation and occasion quick-start

- Customer routes stay on the **original implementation**: desktop navigation now becomes a keyboard-operable phone disclosure (Escape returns focus to its trigger; outside click closes it; mobile breakpoint retains all four destinations).
- The isolated TITAN entry route now supports six **actual** Style Director first-step occasions. Selecting one carries only that verified occasion into the maintained Style Director, where the remaining questions, stock checks and deterministic outfit logic continue unchanged.
- The Style Director consumes a TITAN handoff only for a **single, exact, allowlisted** occasion from TITAN. Unknown or duplicate values cannot prefill customer state. **Start over** clears the accepted URL handoff and restarts at the first question.
- Updated Chromium checks cover 320px/390px/768px/1440px navigation, mobile disclosure Escape/outside-click, six quick-start links, a real cross-route occasion prefill and reset. Added Node contract tests for valid, malformed and duplicated prefill strings.
- No model geometry, fabric data, customer records, stock, operator approval or deployed homepage was modified; no external AI is needed for navigation or selection. **Matching-HEAD CI/browser success still must be verified**; these changes are draft-only.

### 19 October — working catalogue discovery, no synthetic product truth

- The isolated TITAN page now offers real, searchable Linen Earth shirt/trouser catalogue swatches and collection filters, using the **existing** fabric data and original images only. The preview **does not** claim stock availability, verified physical colour, repeat millimetres or tailoring fit.
- Choosing a swatch transfers its exact allowlisted `fabric` ID and garment category to the maintained `/designer-studio`. The existing Designer restores the customer's previous draft then changes **only the explicitly requested shirt or trouser**, while the complementary fabric, occasion, style and measurement context are preserved. A Style Director handoff remains independently authoritative.
- Duplicate, unsupported, cross-garment or externally supplied query parameters fail closed; no auto-paid rendering or new provider credentials are introduced.
- Node regressions validate catalogue source IDs, filter output, exact URL round-trips and reject corrupted links. Chromium QA checks search/filter UI, actual shirt and trouser transfers with a saved draft, image decoding and responsive layouts.
- Match the **final branch HEAD**, CI/browser artifacts and owner requirements before any verification or cutover claim. This is an **unreleased draft only**.

### QA checklist

- [x] Source implementation exists on a separate draft branch.
- [x] Navigation regression tests authored.
- [x] Real-browser journey, skip-link, touch-target and image smoke wired to both existing CI workflows (execution results still require verification).
- [ ] Matching-head CI, typecheck and Next.js build pass.
- [ ] Screenshot review at 390px / 768px / 1440px; verify contrast and no clipping.
- [ ] Keyboard/assistive navigation review, including first-visit BrandIntro behavior.
- [ ] Verify actual garment, stock and model identity against owner references.
- [ ] Owner explicitly approves homepage replacement.
- [ ] Merge/deploy only after all required gates pass.

## Session handoff protocol

When the owner says **Continue**, take the **highest-priority independent, currently unblocked engineering task**, examine the latest branch/PR state, implement actual changes, test them, and report files/commit/tests/blockers. Aim for 30–60 minutes of useful development where session/tool limits permit; elapsed time itself is not a substitute for tangible code or verified QA.

Do not replace testing with concept renders, inflate progress percentages, claim unverified CI outcomes, or merge/deploy unfinished 3D.


### 19 October — two-swatch discovery comparison (draft)

- The `/titan` catalogue explorer now offers a same-garment, two-reference visual comparison of existing swatch photos. Customers can shortlist, remove, clear, switch between shirting/trouser cloth, and choose either exact ID in the maintained Designer Studio.
- The comparison is intentionally **visual only**. Physical colour in calibrated lighting, repeat scale, material composition, drape, stock and supplier details remain unverified unless independently evidenced. No generated swatches or invented properties.
- Pure transition tests enforce the two-item limit, reject stale / wrong-garment IDs and prevent implicit selection replacement. Chromium regression exercises comparison, keyboard-sized controls, original swatch image decoding, garment switching and clear behavior at 320/390/768/1440px.
- Customer records, saved drafts, source model identity, deployed homepage, paid-AI integrations and existing 3D workflows remain unchanged. **No merge/deploy**; matching-head CI and browser evidence still required.

### 19 October — explicit shirt/trouser pair builder (draft)

- Choose one real **shirting reference and trouser reference** in the isolated two-slot outfit builder on `/titan`. The browser-local choices survive garment-tab switching and display original source swatch images; they are **not** a simulated finished garment, physical drape or calibrated colour claim.
- Only an explicit click transfers both allowlisted IDs with `?source=titan&shirt=<id>&trouser=<id>` to the existing Designer. The Designer recovers the saved draft, then updates **only those two garments**. It retains occasion, styling, fit, body profile, measurements and the independent Style Director handoff.
- Unknown, duplicated, mixed, swapped or incomplete query keys fail closed; legacy single-garment transfer still preserves the complementary garment. No database schema, pricing, supplier-stock promise, model identity, paid renderer, main homepage or deployed customer record changes.
- Node tests cover strict parser round-trips/rejections. Chromium regression tests a true shirt/trouser selection, cross-tab persistence, actual Designer selection, image decoding and 44px controls. Matching-head CI and owner review remain mandatory.

### 19 October — shareable two-cloth shortlist (stacked draft)

- Customers can reopen exactly one existing shirt reference and one existing trouser reference through a TITAN URL. This is **not** a share of a saved outfit, measurements, profile or price, and does not call a paid renderer.
- Link generation reuses the real Designer's catalogue-role validation. Import accepts only one each of `source=outfit`, `shirt=<catalogue-id>`, and `trouser=<catalogue-id>` with no extra or duplicate keys; invalid and cross-role references never prefill either slot.
- An explicit subsequent click into Designer Studio continues to use the existing strict `source=titan` garment-pair handoff. Merely opening a shared link does not mutate customer drafts, measurements, accounts, fabric inventory or styling state.
- Node tests enumerate all authored valid shirt/trouser pair combinations and reject malformed inputs. Chromium QA verifies a real shared-page reload, restored IDs and rejection of swapped garments at phone width, as well as 44px share-link tap targets.
- Stack this work on unreleased draft TITAN PR #315; matching-HEAD CI/browser runs, security/privacy review and owner acceptance are required before integration. No homepage cutover, 3D signoff, merge or deployment is authorized.

### 19 October — shared-link navigation and clipboard hardening

- A cloth-pair share link deliberately performs a real document navigation to the **same** unreleased `/titan` route. Unlike a client-side same-path transition, it must revalidate the query and reconstruct exactly the two public references while discarding any transient comparison/search state.
- If clipboard access is denied or unsupported, the actual, fully qualified current link receives keyboard focus and is selected for manual copying; fallback success messages are keyed to the precise selected pair and cannot misreport a previous pair.
- Browser QA now exercises permission-denied copying, selected manual fallback text and isolation of stale comparison/filter state across a shared-link navigation, in addition to direct reload and invalid garment-role links.
- These safeguards preserve all earlier feature and model contracts. They neither validate physical stock nor make the candidate production-ready. Matching-head workflows and explicit release approval remain required.

### 19 October — deterministic, catalogue-only pairing guidance (stacked draft)

- A customer who selects **exactly one** existing shirt or trouser swatch on `/titan` sees three editorial references for the missing garment. Each suggestion uses a real, correctly typed catalogue ID and an auditable plain-text rule; no generated image, per-visit AI API or fabricated supplier measurement.
- Pure `suggestTitanPairings` rules are deterministic, fail closed for unknown or swapped garment IDs, and intentionally **do not** claim calibrated colour matching, measured drape, physical stock, fit approval, or Style Director authority. The current valid catalogue provides three distinct suggestions for each existing shirt or trouser entry.
- Suggestions are explicitly **opt-in**. The selected anchor fabric remains unchanged; the user must click a 48px target to complete the two slots. No choice silently overwrites an already complete pair or persists to a saved Designer draft, measurement, account, customer profile or database.
- The existing explicit Designer handoff remains unchanged. Initial image references are original catalogue swatches with the unavailable-photo fallback. Phone, tablet and desktop layout maintain readable explanatory text, with no paid renderer.
- A garment-tab switch now resets a stale search filter, preventing the previous garment's search text from hiding all the new garment options.
- Node tests exhaustively cover all catalogue anchors, each suggestion's actual IDs/role, deterministic output, non-mutation, bad IDs and intended patterned/plain paths. Chromium QA checks forward and reverse pairs, touch target size, no replacement of the anchor, saved draft isolation, and search reset.
- Keep this branch stacked on unreleased share-link PR #316. Matching-head CI/build, real-browser artifacts, owner acceptance and all physical/native gates remain required. No merge/deploy.


### 19 October — device-only reference lookbook (stacked draft)

- Opt-in **save, reopen and remove** for at most six combinations of actual existing shirt/trouser catalogue IDs. Each card shows separate source swatch photographs (with the existing honest missing-photo fallback), **never** a fabricated garment render.
- Only a namespaced browser-local `linen-earth:titan-reference-lookbook:v1` entry is written, and **only after a click**. A strict versioned decoder rejects invalid schemas, unknown or swapped IDs, extra fields, duplicate references and oversized payloads. There is no server write, authenticated account save, stock reservation, paid AI or customer-attribute storage.
- A saved reference persists across refresh on the **same device**; it is never automatically applied to the Designer or current outfit slots. Explicit **Reopen** updates the two ephemeral TITAN slots; Remove deletes only the selected bookmark and leaves the current selections untouched. Storage-denied browsers show an error rather than claiming success. Other browser tabs re-read the same local reference list.
- Touch-friendly controls, keyboard focus, responsive source-photo cards and live status messages. Node validation covers all extant catalogue combinations, schema tampering, capacity, deduplication, nonmutation and save/remove. Chromium checks save/reload/reopen/remove and that the existing Designer draft was never mutated.
- Source-of-truth remains the existing catalogue and maintained Designer. This convenience feature does **not** count as an account-sync workflow, realistic 3D outfit, verified stock, supplier repeat, verified colour, physical drape, model/UV release approval or tailor fitting.
- This work is stacked on the still-unreleased `/titan` branches. CI/build/real-device QA, physical/native quality gates, privacy and owner signoff must complete before any merge, homepage cutover or production deployment.


### 20 October — modular garment layer contract (stacked draft)

- A deterministic `resolveModelLayerPlan` now defines a future-proof composition contract on the **same locked `linen-earth-studio-model-v1` identity**. Current shirt and trouser are distinct existing-preview layers; belt, tie, waistcoat, blazer, and pocket square are separate, ordered attachment slots with mandatory parent garments. The contract has no body replacement, second mannequin or paid model generation.
- A **suit is a composition**, not a second full-body mesh: two-piece needs shirt + trouser + blazer; three-piece additionally needs waistcoat. Pocket square cannot float without a blazer; a tie needs a shirt; a belt needs trousers. Attachment order, deterministic normalization and prerequisites are independently unit-tested.
- The existing Designer and 3D garment-library views now include planned **waistcoat** and **accessories** families. They remain non-selectable as working 3D garments. Existing saved shirt/trouser designs, measurements, catalogue handoff, released studio model, customer routes and 3D files are unchanged.
- The versioned import contract rejects duplicate/unknown slots, unsupported compositions, extra fields, model replacement, injected measurements/stock/GLB URLs. A valid **logical** layer composition always returns `productionApproved: false`; an extension needing a new asset exposes its exact missing slots. Independent modeled geometry, anchoring/weighting, UV, contact/collision, mobile performance, fit and real-tailor approval remain required before switching on these layers.
- Tests cover 384 subset/composition plans plus injection cases, prerequisite rules, fixed identity, deterministic order and all current-base choices. Matching-head CI and browser proof are needed before integration. **No merge, deploy or 3D promotion.**

### 20 October — asset-byte and complete-extension-set preflight (stacked draft)

- Added a baked-static candidate GLB profile with real byte/range, finite geometry/normal/UV, nondegenerate triangle, scene graph, material namespace and technical metre-frame checks. Metadata declarations alone no longer satisfy this engineering step.
- Read-only `garment:layer-check` and `garment:outfit-check` hash the exact registrations/files, apply independent pinned Khronos schema validation, reject local asset substitutions and enforce one combined performance budget for all selected extensions. Two-/three-piece suit plans remain compositions on the original fixed model.
- Assembly wrapper v1 is engineering-only; it does not migrate saved designs, load assets, establish physical fit or certify the original body. Every report retains `productionApproved: false`; assembly reports explicitly retain `baseModelChecked: false`. See `MODEL_LAYER_ASSET_PREFLIGHT.md`.
- Fixed sparse-array bypasses and froze canonical attachment descriptors; added comprehensive corruption, byte-mutation, whole-plan, CLI/hash and aggregate-budget regressions. Strict repository typechecking also covers the older operational tests that Next's production checker skips.
- No replacement model, invented cloth evidence, paid AI requirement, customer-facing mesh activation, merge or deployment. Native Blender, physical textile/tailor and real-browser release evidence remain independent requirements.

### 20 October — transactional addon composition editing (stacked draft)

- Added pure, bounded, versioned logical layer/composition transactions. Coordinated suit/accessory edits apply together only when the final existing plan is valid; otherwise the prior normalized plan is returned intact.
- Never silently add prerequisite clothes, drop dependent accessories, downgrade suit composition, repair corrupt prior state or accept duplicate targets/injected assets or physical claims. No customer UI, saved-design, actual mesh, identity or database mutation.
- Explicit added/removed IDs, no-op detection and v1 plan round-trips support future controlled extension editing. All valid existing layer/composition states are checked against the canonical validator, with atomic removal/restore and malformed-command regressions. Production approval is always false; independent asset/native/physical/browser gates and no-merge/no-deploy remain unchanged.


### 20 October — reversible concept-only garment layer planner

- `/titan` now includes a **planning-only** interface for all seven canonical
  garment slots on the **existing** Linen Earth model identity. It uses the
  versioned `applyModelLayerEdits` engine from the stacked engineering branch.
- An explicit **Apply layer plan** action submits every changed selection and
  composition in one transaction. No auto-parent insertion, secret accessory
  removal or one-step suit downgrade. Invalid prerequisites keep the last
  valid plan intact while leaving the draft editable; **Discard edits** restores
  only that valid plan, **Reset plan** returns to separate shirt + trousers.
- All three compositions and every addon category have accessible controls and
  a responsive, read-only layer-order summary. Actual Chromium regression in
  `verify-titan-interface.cjs` checks a two-piece suit, failed parent removal,
  edit discard, three-piece suit and reset at 320/390/768/1440px.
- **Strict boundary:** this is a UI for a local logical plan, NOT a rendered
  suit/waistcoat/accessory, quote, saved customer record, measurement, stock
  claim or physically tailored look. The original model photograph and viewer
  are not touched. No GLB is loaded, saved design is changed, network/paid AI
  call is required, or production approval is implied.
- The draft is stacked on #320; no homepage activation, merge or deployment
  without full matching-head CI/Chromium tests and independent native model,
  asset, calibrated fabric and owner/tailor release evidence.


### 20 October — versioned local bookmarks and shareable outfit-layer references (stacked drafts)

- A new, **explicit-only device bookmark** library supports up to six logically valid garment compositions without touching real saved Designer drafts. Each v1 entry is only composition plus canonical garment IDs, independent of cloth, body, customer and asset data. Reload shows a list but does not apply any stored outfit. Strict schema/version/byte budgets reject poisoned/future storage; clearing unreadable data is an explicit action.
- A new **shareable editorial plan link** (`/titan?layer-plan=v1-C-HH`) contains only the seven-slot canonical bitmask and suit composition ID. Pure round-trip tests enumerate every valid composition. Duplicate/malformed/unsupported or physically impossible link values cannot cause a plan update.
- Received shared links populate an **unapplied local draft**; the customer must explicitly click Apply to change the temporary layer plan. The link never gives a new accessory asset a rendering license, never writes Designer/local bookmarks automatically and never certifies model fit, physical drape, fabric stock or order readiness.
- Copy action includes accessible manual URL fallback, mobile touch controls and real-browser checks at 320/390/768/1440px. Build and browser verification must pass on each exact draft HEAD before considering changes integrated.
- Draft-only work remains stacked on unreleased TITAN branches. Next real model milestone remains verified garment assets + native Blender/UV seams + fabric provenance + four-angle identity + tailor approval. **No merge or production deployment.**


### 21 October — one-click wardrobe starting points, still draft-only

- The isolated TITAN layer planner adds five real, validated *logical* starting structures: existing shirt/trouser pair, belted separates, two-piece suit, three-piece suit, and full seven-slot accessory composition.
- Presets are authored against the same canonical versioned garment slots and must pass the existing model-layer contract. A pure preview runs the exact atomic edit transaction and reports added/removed layers, composition changes and **all** still-unverified extension assets. Rejected/injected/future or corrupted inputs cannot be used to stage a plan.
- Clicking a starting structure **only replaces the pending local draft**. Nothing changes in the applied plan until the user presses Apply. The choice does not save a bookmark, alter the real Designer or model, call any paid renderer, load a new GLB or promise stock/fit/physical tailoring.
- Unit tests cover every structurally valid existing seven-layer/composition state against each preset, including unchanged, invalid, non-mutation and no-op states. Existing real-browser TITAN QA now exercises draft/apply/revert, full seven-layer selection, touch targets and responsive 320/390/768/1440px layouts.
- No new dependency, persistence version or schema. This remains stacked on the unreleased TITAN Intelligence draft. Independent asset/native/photo/physical proof, exact-head CI/browser verification, privacy review and owner approval are still mandatory. **No merge or production deploy.**
