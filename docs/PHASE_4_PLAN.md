# Phase 4 — Designer Engine MVP

## Goal
Turn the structured fabric + context brief into three distinct, scored outfit directions before image generation.

## Implemented
- Deterministic Designer Engine with explicit hard-context logic
- Safe / Elevated / Statement portfolio
- Fabric-role selection rather than forcing the uploaded material onto every garment
- Structured shirt, trouser, layer and footwear outputs
- Explicit score breakdown: fabric, climate, occasion, aesthetic, coherence, originality
- Diversity through different silhouette/construction choices
- Concise reasons and one tradeoff per direction
- `/api/designer/generate` structured API boundary
- Premium direction-card UI with Elevated prioritized
- Session persistence for generated candidates
- Failure/retry state without losing the brief

## Current engine policy
Phase 4 intentionally uses deterministic curated rules for the MVP. This makes hard constraints reproducible and testable. A language model can later help generate hypotheses, but canonical garment fields and final scoring remain structured.

## Acceptance intent
1. Three directions are materially different, not recolors.
2. Hot/outdoor constraints reduce inappropriate structure.
3. Formal contexts preserve appropriate tailoring.
4. Score components are explicit and persist with candidates.
5. Rationale describes observable design choices rather than hidden reasoning.
