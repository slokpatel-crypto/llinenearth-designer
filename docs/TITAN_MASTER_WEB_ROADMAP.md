# PROJECT TITAN — Linen Earth Master Web 2.0

**Status:** Draft design-system pilot, not a production release.  
**Working preview route:** `/titan` (not linked from the deployed homepage).  
**Target planning window:** 19 October–17 November 2026 (29 days); estimated hours and final date are not commitments.

## Product decision

Build the new customer experience **around existing engines**, not a rewrite of the customer records, garment geometry, verified fabric stock, or model identity. Keep existing `/designer-studio`, `/style-director`, `/measurements`, `/account`, and operator workflows in place until replacement paths meet feature parity and acceptance checks.

No mandatory per-visit paid AI service: the core customer journey must operate with deterministic engines, standard frontend code and browser rendering. Existing optional external render integrations remain optional and must fail clearly, never silently charge the customer.

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

### QA checklist

- [x] Source implementation exists on a separate draft branch.
- [x] Navigation regression tests authored.
- [ ] Matching-head CI, typecheck and Next.js build pass.
- [ ] Screenshot review at 390px / 768px / 1440px; verify contrast and no clipping.
- [ ] Keyboard/assistive navigation review, including first-visit BrandIntro behavior.
- [ ] Verify actual garment, stock and model identity against owner references.
- [ ] Owner explicitly approves homepage replacement.
- [ ] Merge/deploy only after all required gates pass.

## Session handoff protocol

When the owner says **Continue**, take the **highest-priority independent, currently unblocked engineering task**, examine the latest branch/PR state, implement actual changes, test them, and report files/commit/tests/blockers. Aim for 30–60 minutes of useful development where session/tool limits permit; elapsed time itself is not a substitute for tangible code or verified QA.

Do not replace testing with concept renders, inflate progress percentages, claim unverified CI outcomes, or merge/deploy unfinished 3D.
