# Linen Earth — Roadmap v2 Adapted Status

Date: 2026-10-01
Source of truth: current GitHub repository, not the older ZIP.

## Overall approach

Roadmap v2 is being adapted onto the existing Linen Earth platform. Working modules are retained. New work focuses on the hard gates the roadmap requires rather than recreating existing Phase 10 functionality.

| Roadmap phase | Current adapted status | Main remaining blocker |
|---|---|---|
| Phase 0 — Audit / Stabilize | Engineering complete | merge after CI / review |
| Phase 1 — Premium Shirt Proof | Engineering implementation complete | physical scale measurement + 8-viewer realism + device evidence |
| Phase 2 — Fabric Truth | strong existing foundation | owner / supplier physical evidence coverage and 50-fabric reviewed set |
| Phase 3 — Deterministic Designer | shared proof/customer compositor + option coverage audit + novice completion-study workflow | Phase 1 evidence + five real novice completions within documented target + all visible option reviews |
| Phase 4 — Measurements / Fit | advanced foundation + secure recovery + authenticated ownership + house-ease registry + approved-model runtime activation implemented | real-person accuracy evidence + real finished-garment ease evidence/approval |
| Phase 5 — Lock / Share / Enquiry | lock + share + secure recovery + authenticated customer ownership implemented | five-customer real-flow validation |
| Phase 6 — Style Director | advanced foundation + real-user validation/sign-off workflow | owner-labelled benchmark threshold + real-user evidence/sign-off |
| Phase 7 — Final Render / QA | render outcome + human approval + credit metrics + cross-view identity + owner-cap + approved-pattern coverage workflow implemented | real approval/cost/identity evidence + physical pattern checks on approved patterned renders |
| Phase 8 — Production Bridge | handoff + stock/quote/order + customer ownership + QC + zero-reentry audit + versioned meterage registry implemented | approved physical meterage tables + 10 real zero-reentry deliveries |
| Phase 9 — Hardening | CI/device QA + private-beta + human launch sign-off engineering implemented | real device acceptance + 5 successful beta cases + human sign-off + production READY |
| Phase 10 — Ecommerce | intentionally later | only after Launch 3 |
| Phase 11 — Closed loop | delivered-order outcome capture + human review/threshold-policy engineering implemented | real outcome dataset + recorded human policy/threshold |

## Work completed in this Roadmap v2 branch

- Added persistent agent operating rules and architecture decisions.
- Audited the actual current repo and rejected a full rewrite.
- Added isolated `/lab/proof` Premium Shirt Proof.
- Connected current Linen Earth fabric photos.
- Connected the existing photographic mannequin.
- Connected runtime physical-repeat evidence to the photographic compositor.
- Wired an explicit photo-coordinate px/mm calibration into both the photographic compositor and its repeat audit so measured scale and rendered scale use the same coordinate system.
- Added <= 8% pattern-scale gate.
- Added geometry and real-compositor p95 measurements.
- Hardened the realism gate to require distinct anonymous viewer codes; repeat ratings from the same viewer replace the earlier rating instead of inflating the sample.
- Recompute Phase 1 scale and realism acceptance server-side from raw recorded evidence rather than trusting client pass flags.
- Made target-mobile Device QA acceptance an explicit fourth Phase 1 readiness gate.
- Added auditable proof JSON export.
- Added direct Analyzer handoff for the selected proof fabric.
- Improved photo cloth depth / fold / textile-detail compositing.
- Added evidence-aware verified-vs-approximate scale disclosure in customer preview.
- Added deterministic photo-repeat audit math + tests.
- Removed numeric direction ranking from Style Director candidate UI.
- Added immutable SHA-256 locked design revision contract + verification tests.
- Added Designer lock/export action.
- Added evidence-safe production / tailor handoff contract.
- Added Designer tailor-handoff export.
- Added printable tailor tech pack generated from the same locked recipe.
- Added private real production cloth-usage calibration capture before any meterage estimator is allowed.
- Added append-only stock ledger with revision-linked reservation / release / consumption.
- Added operator-entered quote ledger and production-order status workflow tied to immutable recipe hashes.
- Added append-only finished-garment QC inspections with a hard delivery gate and automatic rework-to-stitching loop.
- Added immutable delivered-order zero-reentry audits and an evidence scorecard for the first 10 real production orders.
- Added a versioned meterage calibration registry that requires ≥20 real cuts per garment and explicit owner/tailor approval before activation.
- Added anonymous five-case private-beta evidence capture and append-only human launch sign-offs for Phase 9 hardening.
- Added opt-in secure measurement recovery vault with hashed recovery keys, expiry and deletion.
- Added final-render outcome ledger, human approval desk, automated QA linkage, and credits-per-approved metrics.
- Added cross-view final-render identity evidence and a human-entered owner credit-cap registry with observed cost comparison.
- Added final-render pattern release coverage: every approved patterned shirt/trouser in the evidence set must have a latest <=8% physical-scale calibration without axis mismatch; solids do not create pattern-calibration debt, while a solids-only set cannot prove the patterned-render gate.
- Added append-only controlled physical fabric colour checks with LAB/hex evidence, CIEDE2000 comparison and a 10-unique-fabric evidence counter.
- Added anonymous Style Director real-user validation evidence for understandability, material distinction, exact stock handoff and explicit human sign-off.
- Added append-only finished-garment ease evidence, a complete 35-cell coverage gate, and a versioned owner/tailor-approved house-ease registry.
- Approved house-ease models now become the single live runtime ease source across assessment, search and brief generation; drafts/retired models never activate and the provisional table remains the explicit fallback when no approved model exists.
- Tightened the shared five-customer beta evidence so each case must prove design lock → signed share/exact-look enquiry with zero blocking bugs; legacy generic completion cannot satisfy the gate.
- Added customer preview coverage auditing across the actual Designer choices, combining live-preview support, construction status and explicit visual-review evidence.
- Added a five-novice Designer completion study with real elapsed-time evidence, latest-case semantics and human-entered documented target; no timing threshold is invented in code.
- Added Supabase email-OTP customer accounts, account-owned locked designs and measurement profiles, claim-by-recovery-token migration, and private account listing.
- Propagated authenticated ownership from immutable locked designs into quotes/orders and added private customer production-status tracking.
- Added itemized account-owned quote review and authenticated customer acceptance evidence before production-order creation.
- Added a privacy-safe authenticated customer production timeline from append-only order events without exposing operator notes or event payloads.
- Added Phase 11 post-delivery customer outcome evidence tied to delivered account-owned orders, with wear-confirmed fit evidence and no automatic Designer ranking changes.
- Added a private Phase 11 outcome-review desk with named approve/reject decisions and a human-entered evidence-threshold policy; no threshold is invented and meeting it still does not auto-change Designer ranking.
- Added durable privacy-safe production learning context for verified locked-design orders so post-delivery outcomes remain attributable after temporary vault expiry; measurement/body-profile data are excluded and contextless outcomes cannot satisfy the learning gate.
- Added phase adaptation records so future coding agents do not rebuild existing systems unnecessarily.

## Evidence we cannot manufacture in code

These remain intentionally open because they require a person, physical cloth or a real device:

- real stripe/check repeat measurements in millimetres,
- physical colour checks,
- owner / supplier GSM, fibre and drape evidence,
- 8 independent realism ratings,
- target-device QA,
- real-person measurement accuracy,
- tailor-approved ease calibration,
- real render approval / cost observations,
- live stock / reservation behaviour,
- actual production order outcomes.

## Promotion rule

A later phase may continue engineering while a physical gate is waiting, but no customer-facing claim is upgraded from approximate / provisional to verified until its evidence gate passes.
