# Phase 7 — Final Photoreal Render & QA Adaptation

Status: advanced implementation with provider-credit outcomes, cross-view identity review and owner-entered commercial cap workflow; real evidence remains.

## Existing foundation to keep

- FASHN is reserved for a deliberate final-render step rather than every live edit.
- The selected-look API rejects an unlocked request.
- Server-side resolution re-loads canonical stock and verified Analyzer evidence instead of trusting browser-posted physical facts.
- Rejected construction options are blocked before final rendering.
- Front render is generated / cached first, then 3/4, side and back can be generated from the locked front identity.
- In-memory and durable render caches reduce repeated credit spend.
- A one-pass targeted repair path exists.
- Final render QA reports colour, pattern, fabric, construction and mannequin consistency.
- Measured colour / pattern evidence can be surfaced in QA.
- Rate limits and repair limits protect render cost.
- A failed render does not mutate the customer's selected design.

## Roadmap v2 alignment

The deterministic live preview remains the editing surface. The photoreal renderer is a final confirmation / presentation layer.

The new Roadmap v2 design-lock contract is separate from the render provider. A locked recipe can be exported and verified independently of any FASHN output.

## Remaining work / evidence

- [x] Record provider credits for generated final renders.
- [x] Record human approve/reject decisions for final renders.
- [x] Calculate approval rate and credits per approved render from real outcomes.
- [x] Add measured stripe/check calibration capture against the existing <= 8% physical-scale gate.
- Confirm the QA tolerance with real physical fixtures and owner/tailor evidence.
- [x] Add explicit cross-view identity evidence capture for multi-view concepts.
- Confirm cross-view identity on the target set with real human reviews.
- Continue manual review for cases where automated QA cannot confidently approve.
- Do not call final AI output a physical colour proof; the real swatch remains authoritative.

## Completion gate

- [x] locked-render requirement
- [x] server canonicalization
- [x] physical-evidence enrichment
- [x] rejected-construction guard
- [x] multi-view flow
- [x] durable cache
- [x] targeted repair limit
- [x] structured visual QA
- [x] render approval-rate / credit evidence collection implemented
- [ ] real render approval-rate target met
- [x] credits-per-approved metric implemented
- [x] owner-approved credit-cap registry + automatic comparison implemented
- [ ] cost per approved render under owner cap
- [x] measured-pattern QA evidence capture + <= 8% scale scoring implemented
- [ ] measured-pattern QA calibrated on physical fixtures
- [x] cross-view identity review workflow implemented
- [ ] target-set cross-view identity evidence accepted
- [ ] manual review workflow signed off for production use


## Render outcome evidence workflow

Every newly generated selected-look render now records:
- provider job ID and concept ID,
- view,
- shirt / trouser IDs,
- provider-reported credits used,
- whether it was a repair,
- automated QA result when available.

The private **Final Render QA** desk lets the operator approve or reject each outcome. It reports:
- reviewed / pending counts,
- approval rate,
- total generated credits,
- credits per approved render.

Cached re-use is excluded from provider credit spend. The evidence is kept separate from customer-facing rendering so a review does not mutate the locked design.

The first readiness threshold is intentionally evidence-based: at least 20 human-reviewed final renders and at least 60% approval before the dashboard can mark the approval-rate gate complete. The commercial credit cap remains an owner decision and is not invented in code. The operator can now record that approved cap, and the desk compares it against observed credits per approved render. Multi-view concepts also require an explicit human identity match/mismatch review rather than treating generated views as automatically consistent.
