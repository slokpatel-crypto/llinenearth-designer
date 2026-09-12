# LLinen Earth Designer

Current milestone: **Phase 8 — Fashion Intelligence V2 + Store / Human Designer Handoff**.

Implemented:
- premium black / deep-navy editorial website foundation and official LLinen Earth brand intro
- Phase 1 Fashion Knowledge Core
- Phase 2 fabric upload + structured analysis contract
- Phase 3 progressive context consultation
- Phase 4 deterministic Designer Engine with Safe / Elevated / Statement directions
- Phase 5 comparison, controlled refinement, locks, immutable versions and stable design specification hash
- Phase 6 locked-spec visualization compiler with consistent front / back / detail preview set
- Phase 7 premium final-design presentation, saved-design atelier, improved homepage hierarchy and mobile navigation
- **Fashion Intelligence V2** with structured wear-type taxonomy across shirts, trousers, jackets, suits and Indian formalwear
- LLinen Earth controlled type visuals for the wear library instead of copying commercial fashion photography
- expanded fabric system covering Linen, Linen-Cotton, Cotton Poplin, Oxford Cotton, Cotton Twill, TR/PV, TR-Wool, Tropical Wool, Hopsack Wool, Flannel, Seersucker, Denim, Corduroy, Velvet and Silk Blend
- garment-role / occasion / climate fabric judgement in the Designer Engine
- explicit fabric verdicts and fit scores shown on each Safe / Elevated / Statement direction
- physical-atelier handoff packets that preserve the exact `specHash`, context, garment spec, palette, fabric judgement and customer note
- local staff review queue with request / review / fabric-check / consultation-ready statuses
- ideal fabric-family suggestions to support later mapping to real LLinen Earth stock

Run locally:

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000` — premium homepage
- `http://localhost:3000/designer` — fabric → context → fabric judgement → directions → refinement → visualization → save journey
- `http://localhost:3000/designs` — saved designs + customer-to-atelier handoff
- `http://localhost:3000/knowledge` — visual wear library + fabric intelligence + compatibility matrix
- `http://localhost:3000/atelier` — Phase 8 human-designer review queue

Important terminology: in this project **TR/PV** means polyester–viscose/rayon suiting (often called Terry/Tetoron Rayon in trade usage), while **TR-Wool / TRW** is treated as a polyester–viscose–wool family. Real performance still depends on the exact fibre percentages, yarn, weave, weight and finish, so the system never assumes all fabrics carrying the same trade label behave identically.

The current fabric analyzer and visualization renderer remain deliberate development adapters. Visual analysis estimates appearance only; fibre composition must be confirmed by the user or store. The Phase 8 handoff is browser-persisted for MVP demonstration. Production deployment should move saved designs, customer requests, staff status and inventory mapping into authenticated database-backed workflows.
