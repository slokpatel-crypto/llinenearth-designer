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
- The proof includes a 50 mm construction ruler plus an explicit photographic-model calibration derived from two raw fixture measurements: a known real length in millimetres and the same reference measured in the 1024×1536 photo in pixels. The <= 8% physical-repeat error gate is evaluated in that same photo coordinate system.
- Geometry interaction latency and actual photographic compositor latency are sampled separately with p95 reporting.
- Human realism scoring now uses short anonymous viewer codes so each person contributes only one current rating; re-rating the same code replaces the earlier score. The roadmap target remains at least 6 of 8 independent viewers at 4/5 or 5/5.
- Photo compositing now uses restrained multi-pass fold/seam lighting plus a textile-detail pass to reduce the flat sticker effect.
- Existing reviewed Analyzer catalogue evidence is loaded through `/api/designer/catalog` when available.
- The selected proof fabric links directly to its private Analyzer evidence desk.
- A deterministic photographic-repeat audit reports expected repeat spacing in mannequin pixels when physical repeat evidence exists, and the exact same photo px/mm calibration is passed into the compositor so the audited scale and rendered scale cannot silently diverge.
- Proof evidence can be exported as JSON with scale, performance and viewer-rating results for an auditable acceptance record.
- The operator evidence API recomputes photographic px/mm from the stored raw fixture pair, requires a short auditable owner/supplier physical-evidence note, then recomputes physical-scale error, independent-viewer realism and the core proof decision instead of trusting client-supplied calibration or pass/status flags. Hardened records use the explicit `linen-earth-phase1-proof-v3` schema; legacy v1 / click-only evidence cannot satisfy the current core gate.
- The core proof now also requires a recorded protected-boundary review for the neck opening, cuffs/hands, tucked waist/fly and trouser-leg gap. Roadmap readiness then treats target-mobile acceptance as a separate fifth gate. A strong desktop/browser proof cannot mark Phase 1 complete until the private Device QA workflow has an accepted mobile result.

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
- [x] photo px/mm is derived from raw mm + pixel fixture measurements, not accepted as an arbitrary pass value
- [x] physical scale cannot count toward acceptance without an auditable measurement/provenance note
- [x] p95 edit instrumentation
- [x] real compositor p95 instrumentation
- [x] all current shirt catalogue options exposed
- [x] runtime reviewed evidence path
- [x] proof evidence JSON export
- [x] deterministic photo-repeat audit value
- [x] distinct anonymous viewer-code dedupe for realism evidence
- [x] server-side recomputation of scale / latency / realism acceptance from raw recorded evidence
- [x] versioned v3 proof schema prevents legacy weaker evidence from being treated as current acceptance
- [x] protected neck/cuff/waist/trouser-gap review is explicitly recorded and recomputed in the core gate
- [x] Phase 1 readiness explicitly depends on accepted target-mobile Device QA evidence
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
