# LLinen Earth Designer

Current milestone: **Phase 6 — Visualization MVP**.

Implemented:
- premium dark editorial website foundation
- official LLinen Earth brand intro
- Phase 1 Fashion Knowledge Core
- Phase 2 fabric upload + structured analysis contract
- Phase 3 progressive context consultation
- Phase 4 deterministic Designer Engine with Safe / Elevated / Statement directions
- Phase 5 comparison, controlled refinement, locks, immutable versions and stable design specification hash
- Phase 6 locked-spec visualization compiler
- consistent front / back / construction-detail preview set on model `LE-MODEL-M01`
- render validation signals and average cross-view consistency score
- targeted per-view repair flow without changing the locked design
- visualization session persistence and failure recovery

Run locally:

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000` — home
- `http://localhost:3000/designer` — complete fabric → context → directions → refinement → visualization journey
- `http://localhost:3000/knowledge` — Fashion Brain

The current fabric analyzer and Phase 6 renderer are deliberate **development adapters**. The Phase 6 SVG renderer proves the production architecture: the finalized design is compiled into a provider-neutral visualization specification, multi-view outputs stay tied to one `specHash`, validation is explicit, and failed views can be repaired locally. A production image-generation provider can replace the development renderer without changing the canonical design contract.
