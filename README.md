# LLinen Earth Designer

Current milestone: **Phase 7 — Premium Product UX**.

Implemented:
- premium black / deep-navy editorial website foundation and official LLinen Earth brand intro
- Phase 1 Fashion Knowledge Core
- Phase 2 fabric upload + structured analysis contract
- Phase 3 progressive context consultation
- Phase 4 deterministic Designer Engine with Safe / Elevated / Statement directions
- Phase 5 comparison, controlled refinement, locks, immutable versions and stable design specification hash
- Phase 6 locked-spec visualization compiler with consistent front / back / detail preview set
- Phase 7 premium final-design presentation, saved-design atelier, improved homepage hierarchy and mobile navigation
- local saved-design persistence carrying the exact design version, context, render set and specification hash
- targeted per-view repair flow without changing the locked design
- session persistence and recoverable loading/error states across the core Designer journey

Run locally:

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000` — premium homepage
- `http://localhost:3000/designer` — complete fabric → context → directions → refinement → visualization → save journey
- `http://localhost:3000/designs` — saved-design atelier
- `http://localhost:3000/knowledge` — Fashion Brain

The current fabric analyzer and visualization renderer are deliberate **development adapters**. The renderer proves the production architecture: the finalized design is compiled into a provider-neutral visualization specification, multi-view outputs stay tied to one `specHash`, validation is explicit, and failed views can be repaired locally. A production image-generation provider can replace the development renderer without changing the canonical design contract.

Phase 8 will connect finalized customer designs to the physical LLinen Earth workflow through consultation requests, staff/designer review and optional inventory mapping.
