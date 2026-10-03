# Linen Earth — Roadmap v2 Adapted Status

Date: 2026-10-02
Source of truth: current GitHub repository, not the older ZIP.

## Overall approach

Roadmap v2 is being adapted onto the existing Linen Earth platform. Working modules are retained. New work focuses on the hard gates the roadmap requires rather than recreating existing Phase 10 functionality.

| Roadmap phase | Current adapted status | Main remaining blocker |
|---|---|---|
| Phase 0 — Audit / Stabilize | complete | none |
| Phase 1 — Premium Shirt Proof | Engineering implementation complete | physical scale measurement + 8-viewer realism + protected-boundary confirmation + device evidence |
| Phase 2 — Fabric Truth | engineering complete + owner-controlled physical-evidence policy implemented | real GSM / fibre / drape / scale coverage, 50 reviewed fabrics and physical colour evidence against the approved policy |
| Phase 3 — Deterministic Designer | shared proof/customer compositor + option coverage audit + novice completion-study workflow | Phase 1 evidence + five server-timed real novice completions within documented target + all visible option reviews |
| Phase 4 — Measurements / Fit | advanced foundation + secure recovery + authenticated ownership + house-ease registry + approved-model runtime activation implemented | real-person accuracy evidence + real finished-garment ease evidence/approval |
| Phase 5 — Lock / Share / Enquiry | lock + share + secure recovery + authenticated customer ownership implemented | five-customer real-flow validation |
| Phase 6 — Style Director | advanced foundation + real-user validation/sign-off workflow + human-entered clean-case threshold | owner-labelled benchmark threshold + enough real-user clean cases to meet the documented target + sign-off |
| Phase 7 — Final Render / QA | render outcome + human approval + credit metrics + cross-view identity + owner-cap + approved-pattern coverage workflow implemented | real approval/cost/identity evidence + physical pattern checks on approved patterned renders |
| Phase 8 — Production Bridge | handoff + stock/quote/order + customer ownership + QC + zero-reentry audit + versioned meterage registry implemented | approved physical meterage tables + 10 real zero-reentry deliveries |
| Phase 9 — Hardening | CI/device QA + private-beta + human sign-off + DB index hardening + live backend contract + primary production-runtime identity probe implemented | real device acceptance + 5 successful beta cases + human sign-off |
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
- Phase 1 v4 now stores bounded raw photographic-render duration samples and recomputes p95 server-side, so client-supplied sample counts or p95 values cannot satisfy the proof gate.
- Hardened the realism gate to require distinct anonymous viewer codes; repeat ratings from the same viewer replace the earlier rating instead of inflating the sample.
- Recompute Phase 1 physical scale, render-latency p95, independent-viewer realism and protected-boundary acceptance from raw recorded evidence rather than trusting client aggregate/pass flags.
- Added explicit protected-boundary evidence for neck, cuffs/hands, tucked waist/fly and trouser-leg gap; all four must pass before the core proof can be accepted.
- Made target-mobile Device QA acceptance an explicit fifth Phase 1 readiness gate.
- Added auditable proof JSON export.
- Added direct Analyzer handoff for the selected proof fabric.
- Improved photo cloth depth / fold / textile-detail compositing.
- Added evidence-aware verified-vs-approximate scale disclosure in customer preview.
- Added deterministic photo-repeat audit math + tests.
- Removed numeric direction ranking from Style Director candidate UI.
- Added immutable SHA-256 locked design revision contract + verification tests.
- Added Designer lock/export action.
- Added evidence-safe production / tailor handoff contract; packet generation proves locked-recipe traceability only and does not itself claim zero manual re-entry.
- Added Designer tailor-handoff export.
- Added printable tailor tech pack generated from the same locked recipe.
- Added private real production cloth-usage calibration capture before any meterage estimator is allowed.
- Added append-only stock ledger with revision-linked reservation / release / consumption; physical receipts/adjustments now require named provenance, positive-stock readiness rejects legacy provenance-free manual events, every new reservation metre quantity requires a named requester plus source reference, actual consumed metres require a named checker plus cutting/usage evidence, and reservation create/consume/release operations are serialized to prevent duplicate or simultaneous close races.
- Added operator-entered quote ledger and production-order status workflow tied to immutable recipe hashes.
- Added append-only finished-garment QC inspections with a hard delivery gate and automatic rework-to-stitching loop.
- Added immutable delivered-order zero-reentry audits and an evidence scorecard for the first 10 real production orders; current qualifying audits require a named checker plus a concrete production-flow reference, while legacy provenance-free rows stay visible but cannot satisfy the gate.
- Added a versioned meterage calibration registry that requires ≥20 real cuts per garment and explicit owner/tailor approval before activation; model registration and approval now revalidate every case ID against unambiguous real cut records in the append-only operator ledger.
- Meterage evidence now requires `production-usage-v2` real-cut records with named checker + physical cutting reference; legacy/no-provenance cut rows cannot satisfy calibration.
- Added anonymous five-case private-beta evidence capture and append-only human launch sign-offs for Phase 9 hardening.
- Added opt-in secure measurement recovery vault with hashed recovery keys, expiry and deletion.
- Added final-render outcome ledger, human approval desk, automated QA linkage, and credits-per-approved metrics.
- Added cross-view final-render identity evidence and a human-entered owner credit-cap registry with observed cost comparison.
- Added append-only named human sign-off evidence for the final-render manual review workflow; production readiness stays open until a real reviewer approves it.
- Added final-render pattern release coverage: every approved patterned shirt/trouser in the evidence set must have a latest <=8% physical-scale calibration without axis mismatch; solids do not create pattern-calibration debt, while a solids-only set cannot prove the patterned-render gate.
- Added append-only controlled physical fabric colour checks with LAB/hex evidence, CIEDE2000 comparison and a 10-unique-fabric evidence counter.
- Hardened Fabric Truth with field-level physical provenance: overall Analyzer approval alone cannot promote true pattern scale, GSM, drape or fibre; each physical claim must carry its own declared/reviewed provenance.
- Added anonymous Style Director real-user validation evidence for understandability, material distinction, exact stock handoff and explicit human sign-off; approval now also requires a human-entered clean-case target, distinct signed handoff audits, and the database blocks approval until that non-duplicated evidence meets it.
- Added non-replayable signed Style Director → Designer handoff evidence: the exact stock/style payload is server-signed, verified on Designer arrival, SHA-256 fingerprinted in the private audit store, and one audit cannot be reused to inflate multiple real-user cases.
- Added append-only finished-garment ease evidence, a complete 35-cell coverage gate, and a versioned owner/tailor-approved house-ease registry.
- Approved house-ease models now become the single live runtime ease source across assessment, search and brief generation; drafts/retired models never activate and the provisional table remains the explicit fallback when no approved model exists.
- Tightened the shared five-customer beta evidence so each qualifying case must reference a server-audited share/enquiry created only after immutable lock-hash verification, use a distinct locked revision, and have zero blocking bugs; legacy or duplicated evidence cannot satisfy the gate.
- Added customer preview coverage auditing across the actual Designer choices, combining live-preview support, construction status and explicit visual-review evidence.
- Added a five-novice Designer completion study with a server stopwatch, latest-case semantics and a human-entered documented target; manual/operator-entered durations remain historical only and cannot satisfy the gate.
- Added Supabase email-OTP customer accounts, account-owned locked designs and measurement profiles, claim-by-recovery-token migration, and private account listing.
- Propagated authenticated ownership from immutable locked designs into quotes/orders and added private customer production-status tracking.
- Added itemized account-owned quote review and authenticated customer acceptance evidence before production-order creation.
- Hardened Phase 4 self-vs-tailor calibration into a private append-only measurement accuracy registry with server-derived errors, unique-case semantics, physical-source provenance and named checker evidence.
- Physical colour evidence now requires a reviewed Analyzer colour reference plus controlled illuminant, named checker and evidence reference; legacy unproven colour rows no longer satisfy the Phase 2 count gate.
- Added a privacy-safe authenticated customer production timeline from append-only order events without exposing operator notes or event payloads.
- Added Phase 11 post-delivery customer outcome evidence tied to delivered account-owned orders, with wear-confirmed fit evidence and no automatic Designer ranking changes.
- Added a private Phase 11 outcome-review desk with named approve/reject decisions and a human-entered evidence-threshold policy; no threshold is invented and meeting it still does not auto-change Designer ranking.
- Added durable privacy-safe production learning context for verified locked-design orders so post-delivery outcomes remain attributable after temporary vault expiry; measurement/body-profile data are excluded and contextless outcomes cannot satisfy the learning gate.
- Hardened durable outcome learning context integrity: only supported-version context matching the immutable revision, valid recipe hash and complete fabric pair can count toward the human evidence threshold.
- Added phase adaptation records so future coding agents do not rebuild existing systems unnecessarily.
- Added a cross-phase Roadmap Readiness control tower that keeps engineering completion separate from human/physical evidence, links directly to every major gate, and refuses to promote missing data to complete.
- Added an owner/supplier-controlled Fabric Truth evidence policy so Phase 2 physical-scale, GSM, drape and fibre thresholds are explicitly human-defined rather than hard-coded by software.
- Added 12 production foreign-key covering indexes from the live Supabase advisor; the unindexed-foreign-key advisory count is now zero.
- Hardened Supabase private-schema deny-by-default privileges and added that effective client isolation to the live backend-health capability gate; current anon/authenticated schema, table and private-function access is false.
- Added a live production Supabase evidence-contract probe to Phase 9, so readiness fails closed if required hardened RPCs/migrations are absent from production.
- Added a primary Vercel production-runtime identity probe using deployment/project/environment/Git metadata; Phase 9 now fails closed on previews, duplicate projects or untraceable deployments.
- Added an Evidence Sprint operator workflow that converts remaining real-world phase gates into a dependency-aware collection queue while keeping all evidence boundaries intact.
- Added a main-only Vercel Git deployment policy plus duplicate-project guard so feature-branch commit storms cannot consume production build quota.
- Tightened deployment batching with a milestone-only Vercel production-build policy: ordinary `main` merges are ignored and only a deliberate `[deploy]` commit may start the primary production build.
- Tightened the customer photo compositor with inward-feathered photographic garment/collar/cuff/creative boundaries and removed remaining dead customer construction-preview CSS.
- Added neutral-luminance photographic detail passes so the selected fabric keeps its own colour while the studio template contributes folds, seams and wrinkle depth.
- Refined the instant customer compositor to use luminance-first studio shading plus a restrained depth pass, reducing dark/painted overlays while retaining real photographed folds; the preview stage now matches the deep navy studio environment.
- Kept the same full-body photographic mannequin framing inside Designer recommendation cards instead of cropping it with cover-mode.
- Matched Style Director photoreal letterboxing to the same deep navy studio, removing the pale frame around otherwise premium full-body renders.
- Refined white contrast collars and cuffs with luminance-first photographic shading so they keep the real folded/seam depth without inheriting the source garment colour.
- Increased plain-fabric microtexture retention after catalogue-shadow neutralization, so solid linen reads more like woven cloth and less like a flat painted overlay.
- Added a cached colour-neutral photographic relief pass to the instant compositor, restoring real wrinkle, seam, placket, cuff and trouser-crease micro-contrast without importing the source garment colour or spending AI credits.
- Replaced direct source-garment luminance transfer with a cached neutral-gray low-frequency shape map, so broad studio form survives while the selected Linen Earth swatch remains the colour authority and dark/light source-template albedo no longer drives the cloth tone.
- The neutral shape map now self-calibrates from the actual shirt/trouser mask: each garment region is centered on neutral gray before blending, removing the remaining hard-coded source-albedo brightness dependency while preserving relative studio highlights and shadows.
- Removed the remaining direct grayscale source-photo detail passes and their per-template brightness calibration. A neutral two-band relief now carries micro seams/weave plus medium folds, reducing the painted-overlay effect without reintroducing the photographed template garment value.
- White contrast collars and cuffs now use the same garment-local neutral shape and relief maps instead of direct source-photo luminance, preventing a dark source collar/cuff from muddying selected white cloth.
- Final selected-look photoreal rendering now uses the validated locked live preview as the preferred front-render source, so the AI refinement starts from the customer-approved model, cloth placement, garment boundaries and tuck geometry instead of reconstructing them from a raw template; invalid or identity-drifting preview images safely fall back to the canonical studio photograph.
- Customer-facing photoreal now fails closed when automated fidelity QA requests review: the deterministic studio preview stays authoritative, the generated image remains available for human review/repair, and a failed secondary camera view returns to the front rather than replacing it.
- Tightened that gate so selected-look photoreal never flashes on screen before QA completes: fresh, cached and repaired renders remain hidden until automated fidelity QA passes; unavailable/review outcomes stay behind an explicit human-review action, and new secondary views only become active after passing.
- Closed the customer export loophole: a held/review-only photoreal can be inspected but cannot become the saved design asset; Save falls back to the deterministic photographed studio preview until the active selected-look render has an available passing fidelity check.
- Reused completed available fidelity QA with the identical in-session final-render cache, avoiding duplicate inspection latency/cost for the same image while deliberately retrying when a prior QA attempt was unavailable.
- Prevented multi-view credit waste and identity propagation from suspect front renders: three-quarter/side/back generation stays disabled until the front photoreal has an available passing fidelity QA result.
- Added per-view multi-view QA semantics: a cached/generated side, back or three-quarter render is not treated as normally approved merely because the front passed; unavailable checks can be re-run without another generation, while review-state views require an explicit review action and remain excluded from trusted save/export.
- Moved the front-QA prerequisite across the API boundary: secondary generation now requires the exact front job/image pair to match a private server-recorded passing QA hash for the same fabric pair, so a direct browser/API request cannot bypass the customer UI gate. Cached legacy results are backfilled into the outcome ledger before inspection, and a targeted front repair replaces both memory and durable cache entries for the locked design.
- Style Director now feeds that same serialized real-model preview into the selected-look photoreal pipeline for supported shirt/trouser directions; suit/blazer directions cannot spend AI credits until a photographed garment template exists, eliminating the older flat-development-render source from the Style Director customer path.
- Removed the remaining Style Director simulated mannequin fallback: shirt/trouser directions stay photographic, while unsupported suit/blazer categories show the real stock fabric editorially and explicitly leave garment geometry unvisualized until a photographed template exists.
- Removed the Style Director flat alternate-preview action from the customer flow; the live photographed model remains the instant surface and the only optional generated replacement is the explicit photoreal action.
- Consolidated legacy customer routes so `/designer` now opens the photographic Designer, while `/visual` and `/designer-brief` hand off to Style Director; homepage suit/blazer cards no longer open the old simulated visualizer.
- Retired the separate customer-facing Catalog, Atelier, Saved Designs and Fashion Brain routes: they now hand off to the photographic Designer, My Account or Style Director instead of exposing parallel/legacy product experiences.
- Wired accepted Phase 1 photographic calibration into both customer Designer and Style Director previews: patterned cloth only claims reviewed physical scale when fabric evidence and the accepted 1024×1536 studio px/mm fixture are both present; solids remain unaffected and unaccepted proof fails closed.
- The customer preview now revalidates that calibration when the tab regains focus/visibility, so newly accepted or revoked Phase 1 proof is picked up without carrying a stale page-session calibration.
- Because photo scale is part of the rendered design identity, changing calibration also invalidates the current final-design lock/session render signature before another photoreal render can be reused.
- Style Director independently tracks the calibration identity attached to its serialized real-model preview and generated photoreal; if Phase 1 calibration changes while a generated image is displayed, that stale image is discarded and the refreshed photographic preview becomes authoritative again.
- Added photographic option-support truth for Phase 3: exact/approximate status is now derived from the real customer photo templates rather than the broader internal construction renderer, with explicit operator reasons.
- Added a compact customer photo-match summary beside cut controls so selected details that directly match a photographed template are separated from photographic approximations before the user relies on the preview.

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
