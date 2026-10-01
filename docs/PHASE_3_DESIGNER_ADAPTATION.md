# Phase 3 — Deterministic Designer Adaptation

Status: current implementation is already beyond the Roadmap v2 starting point. Keep the existing engine and swap in the proved preview path only after Phase 1 passes.

## Existing foundation to keep

- Stable StyleSpec v2 option IDs.
- Shirt and trouser option library.
- Cross-garment rules.
- Occasion / climate / intention context.
- Real stock fabric IDs.
- Safe / Elevated / Statement direction logic.
- Deterministic live construction preview.
- Front / 3/4 / side / back views.
- Body preview derived from measurements.
- Current catalogue fabric tiles.
- Physical scale evidence can override approximate render scale at runtime.
- Preview performance instrumentation.
- Existing Designer benchmark / regression suite.

## Roadmap v2 adaptation

The customer Designer does not need a greenfield rebuild.

The remaining preview work should be proved in `/lab/proof` first. Once the Premium Shirt Proof passes physical scale, latency and realism gates, promote the winning photo/render improvements into the customer Designer behind the same StyleSpec and fabric contracts.

## Important boundary

A construction option can be:
- supported,
- approximate / provisional,
- rejected / not offered.

The UI must not make a provisional SVG approximation look like a verified finished garment. Final tailoring still requires physical measurements and tailor review.

## Completion gate

- [x] stable option IDs
- [x] deterministic rules
- [x] no AI call on instant option edits
- [x] multiple deterministic views
- [x] real stock fabrics
- [x] physical-scale evidence path
- [x] body-profile linkage
- [x] preview performance instrumentation
- [x] regression / evaluation foundation
- [ ] Phase 1 premium preview promoted after evidence passes
- [ ] five novice users complete a liked design in the roadmap target time
- [ ] all customer-visible supported options pass construction / preview review
