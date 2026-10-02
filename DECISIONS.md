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

## 2026-10-02 — Patterned photo scale needs accepted fixture proof
**Decision:** a patterned customer preview may use measured photo-space scale only when the latest Phase 1 proof is fully accepted and provides the approved `photo-1024x1536-fixture` calibration.

**Why:** a measured fabric repeat alone does not prove how millimetres map onto pixels in the photographed mannequin coordinate system.

**Rule:** the browser receives only a sanitized calibration tuple (verified state, px/mm, coordinate system, proof version). Operator notes, viewer identifiers and raw proof evidence remain server-side. Missing or review-state proof fails closed to approximate scale; solid fabrics are unaffected.
