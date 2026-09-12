# Phase 5 — Compare, Refine & Versioning

## Goal
Turn a selected Phase 4 direction into a controlled design workspace where customers can compare options, lock components, refine only intended fields, undo changes and finalize an immutable design specification.

## Implemented
- Original Safe / Elevated / Statement comparison drawer
- Selected direction becomes immutable baseline `DV-001`
- Lock controls for shirt, trouser, layer, footwear, aesthetic and palette
- Quick refinements: More Italian, More formal, More relaxed, Quieter, Bolder, Change trousers only
- Natural-language refinement input with deterministic intent matching
- Scope-aware rules for requests such as `change trousers only`
- Locked fields excluded from subsequent refinement
- Every refinement creates a new version with parent ID and exact change delta
- Undo/redo navigation through version history
- Branching behavior: refining after undo trims the abandoned future branch
- Final design lock with stable LLinen Earth specification hash
- Session persistence for refinement versions and locks
- `/api/designer/refine` boundary for future model-assisted refinement while preserving canonical deterministic rules

## Acceptance coverage
1. `Change trousers only` changes the trouser and preserves unrelated fields.
2. `More formal` changes relevant construction/styling fields coherently.
3. Locked components cannot be modified by the refinement engine.
4. Undo returns to the exact previous version object.
5. Every refinement records field-level before/after deltas.
6. Finalization produces a stable design hash and disables further mutation of that version.
7. The finalized structured specification is ready to become the source of truth for Phase 6 visualization.

## Current limitation
Natural-language refinement is intentionally narrow and deterministic at this phase. A language model can later translate open-ended user language into the same structured refinement actions, but it must not bypass locks or mutate canonical state directly.
