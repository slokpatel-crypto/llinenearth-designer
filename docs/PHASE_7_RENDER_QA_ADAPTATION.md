# Phase 7 — Final Photoreal Render & QA Adaptation

Status: advanced existing implementation; keep and harden.

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

- Measure approval rate over real final renders.
- Record cost per approved render.
- Confirm the QA tolerances on measured stripe/check fabrics.
- Confirm cross-view identity on the target set.
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
- [ ] real render approval-rate target met
- [ ] cost per approved render under owner cap
- [ ] measured-pattern QA calibrated on physical fixtures
- [ ] manual review workflow signed off for production use
