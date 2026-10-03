# Phase 10 implementation record

## Verified on 30 September 2026

Phase 10 is now materially beyond the original foundation brief.

### Shared contracts and Designer intelligence

- **A complete:** shared closed vocabularies, exact normalization, Analyzer v4 enums, v3 adapter and exact pairing protections.
- **B implemented:** Option Library v2 covers shirt type, collar, cuff, placket, pocket, sleeve, fit, length, hem, back, wear and button; trouser type, fit, rise, pleat, waistband, hem and break. Legacy labels remain stable and StyleSpec v2 adapters preserve old saved looks.
- **C implemented:** named scoring weights plus data-driven cross-garment rules are active. High-rise/tuck, wide-trouser proportion, pattern load, camp-collar, formality and climate/drape checks produce explanations.
- Designer search now keeps small occasion-band misses as reviewable/rankable trade-offs rather than collapsing an entire Safe/Elevated/Statement tier. Hard construction conflicts remain blocked.
- Deterministic CI regression now checks Formal, Casual and Semi-Formal top-three output, tier order, distinct pairs and repeated-input stability.

### Fabric Analyzer v4

- Deterministic measurement runs before AI vision:
  - sRGB/LAB dominant colour and palette
  - nearest closed colour family + ΔE
  - pattern orientation, density, scale and contrast
  - pixel repeat/stripe estimates
  - millimetres only when owner/supplier physical scale is declared
  - blur, glare, exposure and framing quality; RGB channel spread is diagnostic only and is not treated as white-balance/cast evidence without a neutral reference
  - SHA-256 content identity + perceptual hash
- **Three-photo protocol is active:** flat image is authoritative for measured colour/pattern; optional macro is used for texture/weave appearance; optional fold is used only for visual fall/structure appearance.
- Macro/fold captures are passed to the model only when their quality checks pass.
- Verified GSM, physical drape class and fibre content are accepted only as declared owner/supplier facts with provenance. They are never inferred from pixels.
- Physical facts and millimetre scale now require explicit provenance at input time: either an HTTPS source record or a short owner/supplier measurement/inspection note. The same validation applies to single and batch Analyzer runs, and provenance participates in the evidence fingerprint.
- Durable queued Analyzer jobs now preserve that same physical-evidence note through enqueue → database job → worker processing; queue submission validates provenance before accepting the job, preventing background-only evidence loss/failures.
- Top-k real textile references are retrieved instead of injecting the whole corpus into every prompt.
- Unreviewed Analyzer intelligence remains conservatively weighted until human review/evaluation supports higher trust.
- Persisted re-analysis now always resets the affected Analyzer profile to `unreviewed` and clears old review notes, preventing a previous approval/correction label from silently carrying over after model output is regenerated for the same evidence fingerprint.
- The Analyzer remains server-only/customer-hidden.

### Private operator workflow

- `/operator/fabric-analyzer` is now an authenticated private desk.
- It supports flat/macro/fold capture URLs, declared catalogue context, owner/supplier scale, verified GSM/drape/fibre facts, measured result review and approve/reject workflow.
- The same desk now accepts local flat/macro/fold photos directly from the operator device. The browser compresses each capture before the authenticated request, the server enforces strict image/data-size bounds, and raw base64 image payloads are never persisted in the Analyzer profile/store; only the measured content identity and a private direct-capture marker are retained.
- After accepting a profile, the operator can now use **Approve + next fabric** to refresh the live Designer evidence queue and jump directly to the highest-priority remaining stock fabric. This keeps the owner-review session moving without manually returning to Designer Data between every swatch.
- The private desk displays corpus counts, image quality, measured colour/ΔE, pattern evidence, physical-scale state, capture evidence and review priority.
- Quality gates protect the operator authentication and ensure Analyzer internals do not enter customer Designer UI.
- Designer Data Desk now includes an evidence-coverage queue that merges verified merchandising metadata with reviewed Analyzer evidence, prioritizes missing availability/physical-scale/GSM/drape/fibre/formality facts, and never fills missing physical facts by inference.
- Designer Data now supports a bulk CSV worksheet/import path for verified merchandising facts. The export carries current values and evidence-gap notes; import merges only supplied cells into each exact stock fabric so blank spreadsheet cells do not erase prior verification. Physical pattern scale and fibre proof remain routed through Fabric Analyzer.
- Missing Analyzer/physical-evidence rows now hand off the exact catalogue fabric ID into Fabric Analyzer, preloading declared catalogue context while deliberately requiring a separate trusted flat capture before measurement. The resulting reviewed profile is bound back to the exact stock fabric instead of becoming an unlinked analysis.
- Fabric Analyzer now includes a batch CSV workflow. It can export a prefilled worksheet for evidence-gap fabrics, ingest edited CSV rows, process trusted capture/source rows in backend batches of up to 12, bind results to exact catalogue IDs, and still leaves all new profiles in the human-review loop before full Designer trust.
- The Analyzer Desk now exposes the existing external-reference calibration harness: operators can run four known cases at a time, see per-check pass/fail evidence and historical scores, and keep this reference calibration explicitly separate from owner-labelled real-fabric accuracy.
- `/operator/designer-evaluation` now provides a deterministic 48-case ground-truth benchmark across occasion, climate and intention contexts. The operator selects the best of three Designer directions (or none), creating auditable labels that remain evaluation evidence and do not automatically change live ranking weights.
- Designer Evaluation now calculates the next missing benchmark case server-side. Saving a label advances directly to the next unlabelled case (with a manual **Next unlabelled** control), so owner review sessions do not waste time cycling through already-labelled cases.
- The evaluation desk now has an evidence-gated current-engine scorecard. It withholds agreement percentages until at least 40 benchmark cases and 32 selected-direction labels exist, then reports top-1 agreement and top-3 retention against owner-labelled directions; none-of-three cases and unavailable targets remain separate rather than being forced into the accuracy denominator.
- `/operator/fabric-ground-truth` now turns reviewed Analyzer profiles into an explicit owner-labelled fabric set: the operator can approve classifications as-is or correct colour family, pattern family/scale/density/orientation, sheen, visual weight, formality and statement level. GSM, fibre, physical drape and millimetre scale remain outside this correction screen and still require physical evidence.
- Direct device captures intentionally are not stored as raw base64 images. Ground Truth now resolves each stock-bound profile back to the exact catalogue fabric and uses that swatch as a clearly labelled reference when the private source capture was not retained, avoiding broken image placeholders or false claims that the catalogue swatch is the analyzed photo.
- The Ground Truth **All profiles** filter now receives the latest reviewed/corrected/approved stock-bound Analyzer history as well as pending profiles. Previously that UI option was still backed only by the pending-review RPC, so reviewed evidence disappeared from the browser even though its database counts remained visible.
- The 50-fabric Ground Truth readiness target now counts **unique stock-bound fabric IDs**, not raw approved/corrected profile rows. Re-analysis or duplicate profile versions therefore cannot inflate Analyzer readiness or make the project quote an accuracy threshold before 50 distinct fabrics have actually been reviewed.
- Ground Truth now records a separate before/after owner label for each reviewed stock fabric and exposes an evidence-gated Analyzer agreement scorecard. Exact-profile and per-field agreement percentages remain hidden until at least 40 unique labelled fabrics exist, so the UI does not quote a small-sample accuracy number.
- Existing approved/corrected stock-bound Analyzer history can now seed that scorecard after the private history migration is applied: approved profiles become exact owner acceptances, while corrected profiles reconstruct the original shown values from ordered correction feedback. Explicit new Ground Truth labels always take precedence over this backfill.
- Phase 10 Readiness now requires both the 50-unique-fabric reviewed set and the 40-unique-fabric owner-labelled scorecard threshold before marking Fabric Analyzer ground truth complete; it shows the two counts separately so database review volume cannot masquerade as evaluation coverage.
- `/operator/construction-approval` records owner/tailor decisions for expanded owner-provided construction options. Live cut controls now label those options as approved, provisional or not offered without rewriting their source provenance or claiming fit/render accuracy.
- Construction review progress now treats both **approve** and **reject** as completed decisions, and after saving a decision the desk automatically advances to the next pending option instead of leaving the operator on the already-reviewed cut.
- Final selected-look photoreal rendering now refuses any owner-provided construction option explicitly marked rejected; provisional options remain available for experiments while their status stays visible in the live cut study.
- `/operator/device-qa` now turns real-browser testing into auditable acceptance evidence: it reads same-tab live-preview latency samples, requires at least 12 interactions, records viewport/DPR/browser context, and combines the measured p95 target with manual four-view/overflow/readability/model-stability checks. Mobile, tablet and desktop results are tracked separately.
- `/operator/phase10-readiness` now aggregates the evidence queues, Analyzer reviewed-set target, Designer benchmark target, construction decisions, mobile/tablet/desktop acceptance and render-cache learning into one progress view. It deliberately treats real-world evidence as incomplete until the corresponding operator workflow records it.

### Instant preview and model system

- 66 catalogue cloth assets are prepared at build time with placeholder-first loading.
- The photographic compositor now separates source-garment albedo from lighting: a neutral-gray low-frequency shape map carries broad model/fold form, while separate relief passes restore seam/wrinkle micro-contrast without repainting the selected fabric with the template garment colour.
- That shape map is normalized against the exact photographed garment mask instead of a fixed shirt/trouser brightness multiplier, so new template cloth values can vary without silently tinting or crushing the selected fabric.
- Broad studio shading now uses a linear-light relative-luminance ratio in log space instead of equal sRGB byte deltas. This makes the same relative photographed illumination behave consistently across dark and pale source garments while keeping neutral gray as the compositor baseline.
- The per-panel lighting baseline is now an alpha-weighted log-average in linear light, reducing the influence of isolated bright highlights/specular pixels before relative shading is extracted.
- Seam/weave/fold detail now comes from colour-neutral micro + medium frequency relief rather than direct source-photo grayscale passes; the old shirt/trouser detail-brightness calibration has been removed.
- White contrast collar/cuff previews now borrow only baseline-neutral photographed structure from their own detail region; direct source pixels and detail-specific brightness boosts are no longer used.
- Multi-band fold/seam relief now uses the active garment mask before blur; neighbouring neck, skin and studio pixels are neutralized to the garment mean so edge detail stays photographic without leaking non-cloth luminance into the fabric.
- Directional fabrics on the tucked studio template now follow traced screen-space panel axes: left/right sleeves and trouser legs receive small independent grain rotations while the collar remains cross-cut. This is visual alignment to the photographed garment, not physical cloth evidence.
- Broad shape and relief normalization are now panel-local as well: body, sleeves and individual trouser legs intersect the adaptive colour mask with their traced panel boundary before calculating the photographed lighting baseline.
- Tucked panel pattern transforms now rotate and scale around traced panel-start anchors. This prevents calibrated stripe/check repeats from visibly sliding when sleeve/leg rotation or repeat scale changes; the anchors remain visual geometry, not physical tailoring evidence.
- The untucked studio shirt now uses the same panelized fabric projection principle: torso, sleeves and collar are separate cloth passes with photographed panel direction/anchors, improving directional-fabric realism without claiming physical grain evidence.
- Untucked pleated and wide trousers now project cloth per leg using complementary seam masks whose alpha sums back to the original silhouette. Left/right legs use their own traced screen-space fall and pattern anchors, improving directional-fabric realism without upgrading physical grain evidence.
- Live fabric scale is calibrated against the model when real swatch/repeat millimetres are supplied; otherwise the UI explicitly labels scale approximate.
- Reviewed/declared Analyzer repeat measurements now flow through the runtime Designer catalogue and can override an old approximate build-time tile scale immediately when the tile has a detected repeat; no fabric-tile rebuild is required for that calibration path.
- The same verified physical evidence merge is now reused by selected-look assessment, advanced search, natural-language brief generation, creative generation and operator benchmark/scorecard runs. Verified GSM, drape, fibre and declared physical pattern scale therefore affect material evidence and fit/design reasoning consistently instead of only changing the customer catalogue preview.
- `LiveConstructionPreview` uses deterministic SVG geometry and local state, so garment-option swaps do not require AI generation.
- Front / 3/4 / Side / Back construction study uses the same selected cloth pair and deterministic approximate projection, and supports:
  - shirt type, collar, cuff, placket, sleeve, fit, length, hem, pocket, back, tucked/untucked state and button choice
  - trouser type, fit, rise, pleat, waistband, hem and break
  - body build, height and skin-tone controls
- Saved measurements can inform the body build and Designer fit logic.
- StyleSpec v2 and body profile persist with the Designer draft and flow into the canonical garment specification.

### Final AI Studio and caching

- FASHN remains the final photoreal render step rather than the instant option-change renderer.
- The locked deterministic preview and paired fabric-context image now avoid repeated JPEG generations: the browser hands off high-quality WebP (with Canvas fallback), the server preserves it as near-lossless WebP after identity validation, and fabric-context resizing uses lossless intermediates before one WebP encode. This retains more fine weave/stripe/check detail for the final renderer without changing credit usage.
- The paired fabric-context image also keeps the entire shirt/trouser source swatches visible with contain-fit panels and a neutral gutter rather than cover-cropping them together. This preserves repeat/edge evidence and gives the renderer two clearly separated cloth references without adding text that could leak into the image.
- FASHN final front renders, repairs and secondary views now request PNG output instead of JPEG, so generated images can feed later QA/view steps without another lossy encoding generation. Resolution, generation mode and credit count remain unchanged.
- The FASHN Edit request no longer forces an undocumented 4:5 aspect-ratio override. Final rendering now preserves the locked source model's 2:3 full-body framing; any future social/export crop should be a separate explicit reframe operation rather than changing the fidelity source.
- Locked selected-look front rendering now sends a binary garment-priority mask built from the same photographed shirt/trouser paths as the deterministic 1024×1536 preview. This tells FASHN Edit to focus refinement on cloth while preserving the faceless head, hands, shoes and studio as strongly as possible; no extra generation is added, and repair/alternate-view calls deliberately do not reuse the front-only mask.
- Final render requests are canonicalized server-side against stock fabric IDs and the locked StyleSpec/body profile.
- Multi-view final output remains Front / 3/4 / Side / Back with visual inspection.
- Measured render evidence is carried into final rendering and QA prompts.
- Deterministic final-render QA now checks owner-measured stripe/repeat scale against the selected body-height anchor, with conservative tolerances to catch gross AI rescaling without claiming tailoring-CAD precision.
- The photoreal viewer now exposes structured Colour / Pattern / Fabric / Construction / Model QA states plus measured colour ΔE and detected pattern axis when available, so review/repair decisions are visible rather than hidden in backend logs.
- Front-view final QA now includes a deterministic protected-region delta over head/outer studio/floor zones. It catches model/background drift outside the garment edit before the semantic critic can approve the render, while side/back/three-quarter views remain governed by their own semantic/identity checks because they intentionally move those pixels.
- Generation, repair, secondary-view and QA requests now belong to the exact committed design lifecycle. Changing fabric/construction or studio calibration, or leaving the preview, aborts the old browser request chain and discards delayed responses before they can populate the current image, QA state, session cache or loading state. A synchronous request lock also prevents duplicate same-frame generation clicks. Browser cancellation does not claim to reverse a provider generation already dispatched on the server.
- Style Director uses the same lifecycle boundary for its questionnaire and optional photoreal requests. Restart, look/calibration changes and unmount discard old recommendations/renders before they can update the current view or completed style memory. Same-frame clicks dispatch one request; reselecting the current look preserves its prepared photographic source.
- Style Director now inspects the exact generated front image against the locked outfit before displaying it or recording completed style memory. Review, unavailable, malformed and contradictory QA keep the live photographic preview visible; inspection retry reuses the generated image without another render credit. Look/calibration changes, restart and unmount invalidate held images and delayed QA as well as generation.
- Durable Supabase render caching is implemented, including cache keys tied to fabric, canonical construction, body profile and source render identity.
- Popular-pair cache observability exists so pre-render decisions can be made without blindly spending render credits.

### Evaluation / CI

The original Linen Earth logo is restored as one intact, content-hashed public PNG shared by the header, opening animation, icons and social metadata. Full pixel decoding and content identity are checked in unit tests; the browser suite also verifies actual image decoding and branding metadata rather than accepting a successful image request as proof that it displays.

The main CI now runs:

1. production dependency audit
2. static quality/privacy gates
3. unit tests
4. deterministic Phase 10 rule evaluation
5. deterministic Designer top-three regression
6. release-readiness checks
7. production Next.js build
8. Chromium preview lifecycle regressions and responsive Designer/Style Director checks at 390/768/1440px, with screenshot/report artifacts

Browser verification mocks provider and automated-QA responses while rendering real local photographs and fabrics through Canvas. It gates code correctness without consuming paid render credits or recording owner/device acceptance.

On 3 October, the async preview lifecycle change passed 346 unit tests, a clean TypeScript check, rule/snapshot/performance evaluations, static quality/release gates and the production build. Separate actual React DOM regressions (mocked drawing/network, zero paid calls) covered delayed generation/QA/repair/view responses, revisiting a previous fabric, duplicate clicks and unmount. The local execution environment denied browser socket startup, so Chromium checks and screenshots run in CI against the production build instead. Viewport emulation, synthetic QA approvals and unverified studio calibration do not satisfy the owner/physical-device evidence gate.

## Still owner/physical-evidence dependent

These items should not be invented in code:

1. Real swatch width or pattern repeat in millimetres for each stock fabric that needs true-scale rendering.
2. Owner/tailor approval of provisional Korean/baggy trouser proportions and any new construction option before calling it an offered house style.
3. Owner-labelled 40–50 fabric ground-truth cases and 40–60 outfit preference cases for meaningful Analyzer/Designer accuracy percentages.
4. Verified GSM, fibre content and physical drape for each roll where supplier records or physical inspection support them.
5. Run `/operator/device-qa` on the target phones/desktop hardware and record accepted sessions; the code can capture/validate the evidence, but the physical devices still have to be tested by a person.

## Deployment status

Code is on `main` and the full CI/build passes. Vercel production deployment is still separately blocked by the previously observed Vercel build-rate limit; do not treat the latest `main` as production until a later deployment is verified READY.
