# DECISIONS.md — Linen Earth

Architecture and product decisions that must persist across coding sessions.

## 2026-10-01 — Adopt Execution Roadmap v2 by adaptation, not rewrite
**Decision:** keep the existing application and map Roadmap v2 onto it. Rebuild only modules that fail the new gates.

**Why:** the current repository already contains the Designer, Analyzer, Style Director foundations, measurements integration, CI, FASHN final-render flow, operator workflows and Supabase migrations. Starting again would discard validated work.

## 2026-10-01 — True-scale preview is the next core gate
**Decision:** the next major engineering proof is the premium shirt preview with measurable physical pattern scale.

**Why:** current preview work is deterministic and much more advanced than a simple colour overlay, but the roadmap's core promise requires repeatable proof that a known stripe / repeat is rendered at the declared physical scale on the garment.

**Rule:** do not market an unverified preview as physically exact. Continue to show approximate / verified scale states from evidence.

## 2026-10-01 — Keep deterministic editing; AI only for final / edge tasks
**Decision:** instant garment-option editing must stay local / deterministic. FASHN remains a final photoreal rendering step, not the live editor.

## 2026-10-01 — Keep advanced garments, hide behind readiness where necessary
**Decision:** do not delete trousers, blazers, suits or the existing wear-type intelligence. If the shirt flow is not yet at the new proof standard, gate less mature garment flows with feature flags or readiness labels rather than removing them.

## 2026-10-01 — Brand spelling
**Decision:** customer-facing brand is **Linen Earth**. New work should use that spelling unless preserving a legacy technical identifier that would break compatibility.

## 2026-10-01 — Durable customer state before public order reliance
**Decision:** browser-only drafts may remain as convenience, but customer-critical designs / measurement profiles / enquiries must have durable server persistence before they are relied on operationally.

## 2026-10-02 — Customer Designer stays photo-first
**Decision:** the photographic studio model is the canonical customer preview in Designer. The flat/vector construction study must not be exposed as an alternate customer-facing model.

**Why:** the premium target is believable fabric on a consistent photographed model. Construction geometry may remain an internal engineering/QA aid, but customer preview should not fall back to a cartoon-like figure.


## 2026-10-02 — Engineering complete is not roadmap complete
**Decision:** a Roadmap v2 phase is only labelled complete when both its engineering contract and its documented real-world evidence gate pass.

**Why:** several phases depend on physical cloth measurements, independent users, tailor checks, render review or real production outcomes that code cannot manufacture.

**Rule:** missing evidence stays open in the Roadmap Readiness control tower. Do not invent thresholds simply to turn a phase green; Phase 2 physical-field coverage remains open until the owner/supplier policy is explicitly documented.

## 2026-10-02 — Fabric Truth thresholds are human-defined
**Decision:** Phase 2 physical evidence coverage for pattern scale, GSM, drape and fibre is controlled by an explicit owner/supplier policy stored in the operator evidence ledger.

**Why:** software cannot decide what proportion of the active catalogue must carry supplier documents or physical roll measurements before Linen Earth treats the evidence base as operationally sufficient.

**Rule:** only an approved, named human policy may satisfy the physical-coverage portion of Phase 2. A review-state policy, missing policy, or model-inferred physical fact cannot complete the gate. The 50 reviewed-fabric target and controlled physical-colour gate remain separate requirements.

## 2026-10-02 — Launch readiness verifies the live backend
**Decision:** Phase 9 must verify the hardened Roadmap v2 capability contract against the live production Supabase database, not only against migration files in Git.

**Why:** a green repository can still be operationally stale if production migrations were not applied. The production evidence RPC is therefore part of the launch gate.

**Rule:** if the backend health RPC is missing, unavailable, or reports any required capability absent, Phase 9 stays evidence-open. The check is read-only and cannot manufacture evidence.

## 2026-10-02 — Production Vercel builds are main-only
**Decision:** automatic Vercel Git deployments are disabled for every branch except `main`. GitHub CI is the default verifier for feature branches; Vercel preview deployments are no longer created automatically.

**Why:** repeated feature-branch pushes exhausted the Vercel deployment rate limit and blocked a valid production milestone from deploying.

**Rule:** the primary project continues only on `main`; duplicate Vercel projects remain ignored by the existing project-ID guard. Create a preview deliberately only when visual/runtime verification needs one.

## 2026-10-02 — Photographic garment edges feather inward
**Decision:** customer-facing fabric, collar, cuff and creative-surface clipping uses inward-only feathered photographic masks rather than hard vector edges.

**Why:** hard path clipping makes otherwise photographic fabric read like a sticker pasted onto the model, especially beside the neck, cuffs and hands.

**Rule:** edge softness may exist only inside the photographed garment silhouette. No feathering may spread fabric onto skin, hands, studio background or neighbouring garments. Flat construction styling stays outside the customer Designer.

## 2026-10-02 — Phase 9 verifies the primary production runtime
**Decision:** launch readiness must verify that the Operator control tower is running from the primary Linen Earth Vercel project in the production environment with an immutable deployment ID and Git commit SHA.

**Why:** repository CI and a healthy database do not by themselves prove that the customer-facing production runtime is the intended deployment. Duplicate linked Vercel projects must not satisfy the launch gate.

**Rule:** Phase 9 stays open on preview deployments, duplicate project IDs, missing deployment identity, missing production URL, or missing Git SHA. The check is read-only and uses Vercel system environment metadata.

## 2026-10-02 — Remaining Roadmap work is evidence-sprint driven
**Decision:** once an active Roadmap phase is engineering-complete, the next work is sequenced from the live evidence gates rather than adding speculative product code.

**Why:** the remaining blockers are primarily physical cloth checks, real users, tailor approval, render review and delivered production outcomes. More code cannot legitimately satisfy those gates.

**Rule:** the Evidence Sprint may prioritize and link real-world collection work, but it must never auto-create, duplicate, infer or promote evidence. Downstream production/outcome work stays later until its real dependencies pass.

## 2026-10-02 — Photographic structure is neutral-luminance
**Decision:** the instant photo compositor must preserve the studio photograph's folds, seams and wrinkles without reintroducing the source garment's original light/dark colour bias.

**Why:** using the raw dark source shirt as a fold layer can make a light selected Linen Earth fabric look artificially charcoal; using the raw pale source trousers can wash darker cloth out.

**Rule:** detail passes are luminance-normalized per photographed garment before blending. The fabric swatch remains the colour/texture source; the studio photo supplies structure and lighting only.

## 2026-10-03 — Customer preview support follows the photo compositor
**Decision:** Phase 3 option coverage must classify support from the actual photographic customer compositor, not from the internal construction-drawing capability map.

**Why:** an internal vector construction model can approximate more collar, cuff, fit and trouser geometry than the premium customer photograph actually shows. Reusing that support status would overstate what the customer sees.

**Rule:** photographed source matches may be marked exact; non-matching cuts stay approximate with an explicit reason. Selected button material is specification-only at instant-preview scale, contrast cloth remains physically unverified, and unsupported visual details are never promoted merely because the internal construction model can draw them.

## 2026-10-03 — Photo approximation is disclosed before final render
**Decision:** the customer Designer shows a compact live summary of how many currently selected cut details directly match a photographed template and which selected details remain approximate.

**Why:** a premium photographic model can still mislead if a customer assumes every collar, cuff, fit or trouser choice has changed geometrically when the current photo only represents some of them exactly.

**Rule:** the disclosure is about photographic representation only. It does not imply physical colour, drape, fit or construction verification, and it must not replace the photographic model with the internal construction drawing.

## 2026-10-03 — Production deploys require an explicit milestone marker
**Decision:** merging engineering work into `main` no longer automatically consumes a Vercel production build. The primary project builds a Git-triggered production commit only when its commit message contains `[deploy]`.

**Why:** Roadmap v2 work is intentionally batched and the user requested production deployment only after meaningful milestones. Rebuilding every small merged batch repeatedly exhausted Vercel's build-rate quota.

**Rule:** feature branches remain disabled, duplicate projects still fail the project-ID guard, ordinary `main` commits exit the ignored-build step successfully, and a deliberate milestone merge/marker such as `[deploy] Roadmap v2 milestone` is required to continue the primary production build. Missing Vercel metadata remains fail-open so an unusual/manual deployment is not silently suppressed.

## 2026-10-03 — Private Supabase tables stay RPC-only
**Decision:** the `private` schema remains deny-by-default for `anon`, `authenticated`, `service_role` direct schema/table/function access. Server operations use explicitly granted public `SECURITY DEFINER` RPCs instead.

**Why:** Supabase reports RLS-without-policy INFO on private tables, but adding client RLS policies merely to silence that advisory would widen the attack surface. The intended boundary is stronger: client roles cannot use the schema at all.

**Rule:** migrations explicitly revoke current and default privileges on private schema objects; the live Roadmap backend-health RPC verifies effective anon/authenticated isolation. The informational RLS advisory is expected for these intentionally unreachable private tables.

## 2026-10-03 — Customer pattern scale requires accepted studio calibration
**Decision:** patterned customer previews use Phase 1 px/mm calibration only when the recorded proof is fully accepted; fabric-side physical scale evidence alone is not enough to label the photographic preview scale as verified.

**Why:** repeat millimetres describe the cloth, but the browser also needs a reviewed relationship between physical millimetres and the fixed 1024×1536 photographed model coordinate system. Without both halves, an exact-looking stripe/check can still be physically mis-scaled.

**Rule:** the browser receives only a sanitized four-field calibration contract. Operator notes, viewer IDs, raw realism ratings and other proof evidence remain server-side. Missing, revoked or review-state proof returns an unverified calibration and patterned customer previews stay approximate.

## 2026-10-03 — Generated Style Director images cannot outlive their photo calibration
**Decision:** a Style Director photoreal render is bound to the exact proof-backed studio calibration identity used by the real-model preview that seeded it.

**Why:** the generated image replaces the live preview visually. If Phase 1 calibration is later accepted, changed or revoked while that image is on screen, an untracked generated result could continue representing an older pattern scale even though the underlying evidence changed.

**Rule:** Style Director rechecks the safe customer calibration on focus/visibility. A calibration-identity change discards the generated render and locked preview source, remounts the photographic preview, and requires a fresh serialized source before another photoreal request. No AI credit is spent automatically.
