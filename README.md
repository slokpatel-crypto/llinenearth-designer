# LLinen Earth Designer

Current milestone: **Phase 9 complete — all planned MVP phases 0–9 are implemented**.

Implemented:
- premium black / deep-navy editorial website foundation and official LLinen Earth brand intro
- Phase 1 Fashion Knowledge Core
- Phase 2 fabric upload + structured analysis contract
- Phase 3 progressive context consultation
- Phase 4 Designer Engine with Safe / Elevated / Statement directions
- Phase 5 comparison, controlled refinement, component locks, immutable versions and stable design specification hash
- Phase 6 locked-spec visualization compiler with consistent front / back / detail preview set and targeted repair
- Phase 7 premium final-design presentation, saved-design atelier, improved homepage hierarchy and mobile navigation
- Phase 8 Fashion Intelligence V2 with 27 structured wear types, 15 major fabric families, fabric/occasion/climate/garment judgement and physical atelier handoff
- Phase 9 deterministic quality benchmark suite, CI quality gate, recoverable global error/loading states and human-reviewed learning loop
- customer feedback capture on saved designs; feedback is queued for review and never mutates the Fashion Brain automatically
- `/quality` dashboard showing benchmark health, Fashion Brain coverage, saved designs, handoffs and review queue
- CI now runs `npm run quality` before the production Next.js build

Run locally:

```bash
npm install
npm run quality
npm run dev
```

Open:
- `http://localhost:3000` — premium homepage
- `http://localhost:3000/designer` — fabric → context → fabric judgement → directions → refinement → visualization → save
- `http://localhost:3000/designs` — saved designs + customer feedback + atelier handoff
- `http://localhost:3000/knowledge` — visual wear library + fabric intelligence + compatibility matrix
- `http://localhost:3000/atelier` — human-designer review queue
- `http://localhost:3000/quality` — Phase 9 quality, regression and learning dashboard

Important terminology: in this project **TR/PV** means polyester–viscose/rayon suiting, while **TR-Wool / TRW** is treated as a polyester–viscose–wool family. Real performance still depends on exact fibre percentages, yarn, weave, weight and finish, so the system never assumes all fabrics carrying the same trade label behave identically.

## Production boundary

The **planned MVP product architecture is complete**, but some production infrastructure intentionally remains provider-neutral rather than falsely simulated. The current fabric analyzer and visualization renderer are development adapters, and browser storage is used for saved designs, feedback and atelier handoffs. A production launch would replace those adapters with authenticated persistence, real store inventory/SKU integration, a selected vision provider, a photorealistic image-generation provider, observability and deployment configuration. Those can plug into the contracts already implemented without redesigning the Fashion Brain or Designer workflow.
