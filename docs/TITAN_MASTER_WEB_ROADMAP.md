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
