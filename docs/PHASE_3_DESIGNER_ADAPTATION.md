# Phase 3 — Deterministic Designer Adaptation

Status: current implementation is already beyond the Roadmap v2 starting point. The Phase 1 proof and customer Designer already share the same photographic compositor; promotion is therefore evidence/coverage controlled rather than a second render-engine swap.

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

The Premium Shirt Proof and customer Designer now use the same photographic compositor and physical-scale helpers. Once the proof passes physical scale, latency and realism gates, the shared path can be treated as promoted without copying code. A private Customer Preview Coverage desk audits every actual customer-selectable style choice against preview support and any required construction approval.

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
- [x] shared proof/customer photo-preview architecture implemented with no duplicate compositor
- [x] customer-visible preview coverage audit engineered against the actual Designer choices
- [ ] Phase 1 premium preview promoted after real evidence passes
- [ ] five novice users complete a liked design in the roadmap target time
- [ ] all customer-visible supported options pass construction / preview review
