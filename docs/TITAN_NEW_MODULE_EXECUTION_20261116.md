# TITAN Roadmap v2 — new-module execution audit (2026-11-16)

Source of architectural truth: AGENTS.md, DECISIONS.md, docs/ARCHITECTURE_AUDIT.md on main commit 4dd8020abd83429449ff53ea5bb71b046394d86e. The older roadmap is adapted to existing code; **do not erase or rebuild a working module**. This is a path-level audit, not a complete feature-by-feature production certification.

## Already started; should be completed, not restarted
- Phase 0 CI/architecture: working quality and release gates.
- Phase 1 true-scale shirt proof: /lab/proof and live preview groundwork exist; physical proof and real-device acceptance remain open.
- Phase 2 fabric truth: Analyzer, catalogues, stock and provenance contracts exist; supplier-measured evidence remains separate.
- Phase 3 Designer: real Designer Studio and versioned options already exist; photographic accuracy is under active development.
- Phase 4 measurements: Measurement Studio and provisional fit-construction exist; verified tailor input is still required.
- Phase 5 locks, sharing and enquiry: versioned locks and active customer handoff work exist.
- Phase 6 Style Director: substantial deterministic code and dedicated active draft PR #868.
- Phase 7 final render: FASHN integration and QA foundations exist.
- Phase 8 operator/production: order workflows, signed handoff and **finished-garment QC core** already exist (src/lib/designer/finished-garment-qc.ts). Do not build a duplicate module.
- Phase 9 verification: CI, operator readiness and security exist; this does not imply public launch approval.

## Greenfield work started by this branch
**Reference-look colour discovery M1** is an independent extension from the roadmap's reference-look matching capability, not another maintenance fix.

Files:
- src/lib/designer/reference-look-matcher.ts: pure CIE76 colour ranking against existing catalogue fabric IDs plus robust pixel-patch median sample.
- tests/reference-look-matcher.test.ts: invalid colour, deterministic ties, duplicate IDs, transparent/malformed pixel data and colour sampling regressions.
- src/components/ReferenceLookMatcher.tsx and CSS: customer selects a local reference photo, taps a garment colour and sees the closest real catalogue entries for shirt/trouser. Images remain in the browser; no AI API calls.
- src/app/reference-match/page.tsx: new customer route; homepage and shell links expose it.

**Truth boundary:** photo colour is affected by lighting/screens, and static swatch hex is not measured colour truth. No garment semantic recognition, look reproduction, physical fabric scale, inventory promise, body fit, saved design, order or automated image delivery is claimed. Selecting a suggested fabric still happens in the existing Designer; the route does not silently alter saved designs.

## Next unstarted-or-not-proven scopes to audit before development
- Reference look M2: user-assisted multi-zone garment segmentation and actual selected fabric IDs into versioned style specification, not unverified background guesses.
- Deeper customer/commercial intelligence and post-delivery outcomes: inspect existing feedback/events before creating a new schema or dashboard.
- Ecommerce/checkout: Roadmap Phase 10+ explicitly follows product proof; do not pretend payment or public order readiness exists.
- Multi-image fabric fusion and automatic calibration: verify existing code before deciding which parts are actually absent.

Each new module must get its own concrete acceptance gates, pure tests, meaningful customer/operator vertical slice and matching-head CI before merging. Existing production blockers (Blender/physical fabric/tailor/real-device verification) stay explicit and are **not** cleared by these new features. Do not merge into main or deploy Vercel without normal release approval.
