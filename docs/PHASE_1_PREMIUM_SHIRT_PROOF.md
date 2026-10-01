# Phase 1 — Premium Shirt Proof

Status: implementation active
Route: `/lab/proof`

## What is implemented
- Existing Linen Earth catalogue shirting photos are selectable in the proof.
- Existing photographic mannequin compositor is shown beside the construction proof.
- The current deterministic construction engine is embedded with Front / 3/4 / Side / Back views; Front + 3/4 are the Phase 1 comparison views.
- Live fabric / collar / cuff changes use no AI render call.
- Real mannequin renderer applies reviewed runtime repeat measurements when they exist.
- Unknown physical scale remains explicitly approximate.
- The proof includes a 50 mm construction ruler plus an explicit photographic-model px/mm calibration. The <= 8% physical-repeat error gate is now evaluated in the same 1024×1536 photo coordinate system used by the real mannequin compositor.
- Geometry interaction latency and actual photographic compositor latency are sampled separately with p95 reporting.
- Human realism scoring now uses short anonymous viewer codes so each person contributes only one current rating; re-rating the same code replaces the earlier score. The roadmap target remains at least 6 of 8 independent viewers at 4/5 or 5/5.
- Photo compositing now uses restrained multi-pass fold/seam lighting plus a textile-detail pass to reduce the flat sticker effect.
- Existing reviewed Analyzer catalogue evidence is loaded through `/api/designer/catalog` when available.
- The selected proof fabric links directly to its private Analyzer evidence desk.
- A deterministic photographic-repeat audit reports expected repeat spacing in mannequin pixels when physical repeat evidence exists, and the exact same photo px/mm calibration is passed into the compositor so the audited scale and rendered scale cannot silently diverge.
- Proof evidence can be exported as JSON with scale, performance and viewer-rating results for an auditable acceptance record.
- The operator evidence API recomputes physical-scale error, independent-viewer realism and overall Phase 1 acceptance from the stored raw inputs instead of trusting client-supplied pass/status flags. Legacy click-only realism records therefore remain review evidence until fresh independent-viewer evidence is recorded.

## What this proof does not claim
- It does not claim a photograph has a true physical scale until a measured repeat / swatch dimension exists.
- It does not claim the synthetic collar/cuff geometry is a photographed finished garment.
- It does not infer GSM, fibre content, drape or shrinkage from the catalogue photograph.
- It does not use FASHN for each edit.

## Roadmap gate

### Engineering
- [x] isolated proof route
- [x] current fabric photos
- [x] multi-view deterministic construction engine (Front + 3/4 comparison, Side/Back regression)
- [x] existing real mannequin track
- [x] no AI per edit
- [x] repeat-mm scale plumbing
- [x] <= 8% scale gate calculation
- [x] measured photo-coordinate px/mm is wired into the actual photographic compositor
- [x] p95 edit instrumentation
- [x] real compositor p95 instrumentation
- [x] all current shirt catalogue options exposed
- [x] runtime reviewed evidence path
- [x] proof evidence JSON export
- [x] deterministic photo-repeat audit value
- [x] distinct anonymous viewer-code dedupe for realism evidence
- [x] server-side recomputation of scale / latency / realism acceptance from raw recorded evidence
- [ ] CI green on current branch

### Physical / human evidence
- [ ] measure at least one striped/check fabric repeat in mm
- [ ] enter / review physical scale evidence for the proof fabric
- [ ] verify preview repeat error <= 8%
- [ ] record at least 8 independent realism ratings
- [ ] at least 6/8 realism ratings are >= 4/5
- [ ] run on target mobile hardware and confirm p95 < 300 ms
- [ ] confirm no visible cloth spill at neck, cuffs, waist or trouser gap

## Promotion rule
Do not replace the customer Designer's current renderer solely because the lab route exists. Promote the renderer only after the physical and human evidence items above pass. If the proof fails, iterate inside `/lab/proof` without destabilising the customer flow.
