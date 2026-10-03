# DECISIONS.md — Linen Earth

Architecture and product decisions that must persist across coding sessions.

## 2026-10-01 — Adopt Execution Roadmap v2 by adaptation, not rewrite
**Decision:** keep the existing application and map Roadmap v2 onto it. Rebuild only modules that fail the new gates.

**Why:** the current repository already contains the Designer, Analyzer, Style Director foundations, measurements integration, CI, FASHN final-render flow, operator workflows and Supabase migrations. Starting again would discard validated work.

## 2026-10-01 — True-scale preview is the next core gate
**Decision:** the next major engineering proof is the premium shirt preview with measurable physical pattern scale.

**Why:** current preview work is deterministic and much more advanced than a simple colour overlay, but the roadmap's core promise requires repeatable proof that a known stripe / repeat is rendered at the declared physical scale on the garment.

**Rule:** do not market an unverified preview as physically exact. Continue to show approximate / verified scale states from evidence.

## 2026-10-01 — Keep deterministic editing; AI only for final / edge tasks
**Decision:** instant garment-option editing must stay local / deterministic. FASHN remains a final photoreal rendering step, not the live editor.

## 2026-10-01 — Keep advanced garments, hide behind readiness where necessary
**Decision:** do not delete trousers, blazers, suits or the existing wear-type intelligence. If the shirt flow is not yet at the new proof standard, gate less mature garment flows with feature flags or readiness labels rather than removing them.

## 2026-10-01 — Brand spelling
**Decision:** customer-facing brand is **Linen Earth**. New work should use that spelling unless preserving a legacy technical identifier that would break compatibility.

## 2026-10-01 — Durable customer state before public order reliance
**Decision:** browser-only drafts may remain as convenience, but customer-critical designs / measurement profiles / enquiries must have durable server persistence before they are relied on operationally.

## 2026-10-02 — Customer Designer stays photo-first
**Decision:** the photographic studio model is the canonical customer preview in Designer. The flat/vector construction study must not be exposed as an alternate customer-facing model.

**Why:** the premium target is believable fabric on a consistent photographed model. Construction geometry may remain an internal engineering/QA aid, but customer preview should not fall back to a cartoon-like figure.


## 2026-10-02 — Engineering complete is not roadmap complete
**Decision:** a Roadmap v2 phase is only labelled complete when both its engineering contract and its documented real-world evidence gate pass.

**Why:** several phases depend on physical cloth measurements, independent users, tailor checks, render review or real production outcomes that code cannot manufacture.

**Rule:** missing evidence stays open in the Roadmap Readiness control tower. Do not invent thresholds simply to turn a phase green; Phase 2 physical-field coverage remains open until the owner/supplier policy is explicitly documented.

## 2026-10-02 — Fabric Truth thresholds are human-defined
**Decision:** Phase 2 physical evidence coverage for pattern scale, GSM, drape and fibre is controlled by an explicit owner/supplier policy stored in the operator evidence ledger.

**Why:** software cannot decide what proportion of the active catalogue must carry supplier documents or physical roll measurements before Linen Earth treats the evidence base as operationally sufficient.

**Rule:** only an approved, named human policy may satisfy the physical-coverage portion of Phase 2. A review-state policy, missing policy, or model-inferred physical fact cannot complete the gate. The 50 reviewed-fabric target and controlled physical-colour gate remain separate requirements.

## 2026-10-02 — Launch readiness verifies the live backend
**Decision:** Phase 9 must verify the hardened Roadmap v2 capability contract against the live production Supabase database, not only against migration files in Git.

**Why:** a green repository can still be operationally stale if production migrations were not applied. The production evidence RPC is therefore part of the launch gate.

**Rule:** if the backend health RPC is missing, unavailable, or reports any required capability absent, Phase 9 stays evidence-open. The check is read-only and cannot manufacture evidence.

## 2026-10-02 — Production Vercel builds are main-only
**Decision:** automatic Vercel Git deployments are disabled for every branch except `main`. GitHub CI is the default verifier for feature branches; Vercel preview deployments are no longer created automatically.

**Why:** repeated feature-branch pushes exhausted the Vercel deployment rate limit and blocked a valid production milestone from deploying.

**Rule:** the primary project continues only on `main`; duplicate Vercel projects remain ignored by the existing project-ID guard. Create a preview deliberately only when visual/runtime verification needs one.

## 2026-10-02 — Photographic garment edges feather inward
**Decision:** customer-facing fabric, collar, cuff and creative-surface clipping uses inward-only feathered photographic masks rather than hard vector edges.

**Why:** hard path clipping makes otherwise photographic fabric read like a sticker pasted onto the model, especially beside the neck, cuffs and hands.

**Rule:** edge softness may exist only inside the photographed garment silhouette. No feathering may spread fabric onto skin, hands, studio background or neighbouring garments. Flat construction styling stays outside the customer Designer.

## 2026-10-02 — Phase 9 verifies the primary production runtime
**Decision:** launch readiness must verify that the Operator control tower is running from the primary Linen Earth Vercel project in the production environment with an immutable deployment ID and Git commit SHA.

**Why:** repository CI and a healthy database do not by themselves prove that the customer-facing production runtime is the intended deployment. Duplicate linked Vercel projects must not satisfy the launch gate.

**Rule:** Phase 9 stays open on preview deployments, duplicate project IDs, missing deployment identity, missing production URL, or missing Git SHA. The check is read-only and uses Vercel system environment metadata.

## 2026-10-02 — Remaining Roadmap work is evidence-sprint driven
**Decision:** once an active Roadmap phase is engineering-complete, the next work is sequenced from the live evidence gates rather than adding speculative product code.

**Why:** the remaining blockers are primarily physical cloth checks, real users, tailor approval, render review and delivered production outcomes. More code cannot legitimately satisfy those gates.

**Rule:** the Evidence Sprint may prioritize and link real-world collection work, but it must never auto-create, duplicate, infer or promote evidence. Downstream production/outcome work stays later until its real dependencies pass.

## 2026-10-02 — Photographic structure is neutral-luminance
**Decision:** the instant photo compositor must preserve the studio photograph's folds, seams and wrinkles without reintroducing the source garment's original light/dark colour bias.

**Why:** using the raw dark source shirt as a fold layer can make a light selected Linen Earth fabric look artificially charcoal; using the raw pale source trousers can wash darker cloth out.

**Rule:** detail passes are luminance-normalized per photographed garment before blending. The fabric swatch remains the colour/texture source; the studio photo supplies structure and lighting only.

## 2026-10-03 — Customer preview support follows the photo compositor
**Decision:** Phase 3 option coverage must classify support from the actual photographic customer compositor, not from the internal construction-drawing capability map.

**Why:** an internal vector construction model can approximate more collar, cuff, fit and trouser geometry than the premium customer photograph actually shows. Reusing that support status would overstate what the customer sees.

**Rule:** photographed source matches may be marked exact; non-matching cuts stay approximate with an explicit reason. Selected button material is specification-only at instant-preview scale, contrast cloth remains physically unverified, and unsupported visual details are never promoted merely because the internal construction model can draw them.

## 2026-10-03 — Photo approximation is disclosed before final render
**Decision:** the customer Designer shows a compact live summary of how many currently selected cut details directly match a photographed template and which selected details remain approximate.

**Why:** a premium photographic model can still mislead if a customer assumes every collar, cuff, fit or trouser choice has changed geometrically when the current photo only represents some of them exactly.

**Rule:** the disclosure is about photographic representation only. It does not imply physical colour, drape, fit or construction verification, and it must not replace the photographic model with the internal construction drawing.

## 2026-10-03 — Production deploys require an explicit milestone marker
**Decision:** merging engineering work into `main` no longer automatically consumes a Vercel production build. The primary project builds a Git-triggered production commit only when its commit message contains `[deploy]`.

**Why:** Roadmap v2 work is intentionally batched and the user requested production deployment only after meaningful milestones. Rebuilding every small merged batch repeatedly exhausted Vercel's build-rate quota.

**Rule:** feature branches remain disabled, duplicate projects still fail the project-ID guard, ordinary `main` commits exit the ignored-build step successfully, and a deliberate milestone merge/marker such as `[deploy] Roadmap v2 milestone` is required to continue the primary production build. Missing Vercel metadata remains fail-open so an unusual/manual deployment is not silently suppressed.

## 2026-10-03 — Private Supabase tables stay RPC-only
**Decision:** the `private` schema remains deny-by-default for `anon`, `authenticated`, `service_role` direct schema/table/function access. Server operations use explicitly granted public `SECURITY DEFINER` RPCs instead.

**Why:** Supabase reports RLS-without-policy INFO on private tables, but adding client RLS policies merely to silence that advisory would widen the attack surface. The intended boundary is stronger: client roles cannot use the schema at all.

**Rule:** migrations explicitly revoke current and default privileges on private schema objects; the live Roadmap backend-health RPC verifies effective anon/authenticated isolation. The informational RLS advisory is expected for these intentionally unreachable private tables.

## 2026-10-03 — Customer pattern scale requires accepted studio calibration
**Decision:** patterned customer previews use Phase 1 px/mm calibration only when the recorded proof is fully accepted; fabric-side physical scale evidence alone is not enough to label the photographic preview scale as verified.

**Why:** repeat millimetres describe the cloth, but the browser also needs a reviewed relationship between physical millimetres and the fixed 1024×1536 photographed model coordinate system. Without both halves, an exact-looking stripe/check can still be physically mis-scaled.

**Rule:** the browser receives only a sanitized four-field calibration contract. Operator notes, viewer IDs, raw realism ratings and other proof evidence remain server-side. Missing, revoked or review-state proof returns an unverified calibration and patterned customer previews stay approximate.

## 2026-10-03 — Generated Style Director images cannot outlive their photo calibration
**Decision:** a Style Director photoreal render is bound to the exact proof-backed studio calibration identity used by the real-model preview that seeded it.

**Why:** the generated image replaces the live preview visually. If Phase 1 calibration is later accepted, changed or revoked while that image is on screen, an untracked generated result could continue representing an older pattern scale even though the underlying evidence changed.

**Rule:** Style Director rechecks the safe customer calibration on focus/visibility. A calibration-identity change discards the generated render and locked preview source, remounts the photographic preview, and requires a fresh serialized source before another photoreal request. No AI credit is spent automatically.


## 2026-10-03 — Every generated camera view owns its QA state
**Decision:** front approval is a prerequisite for generating additional selected-look camera views, but it never substitutes for the fidelity check of the side, back or three-quarter image itself.

**Why:** a secondary image can introduce new garment-boundary, pattern, construction or mannequin-identity errors even when its front source was acceptable. Treating the whole set as approved from one front check would overstate visual evidence and could expose a suspect angle as trusted output.

**Rule:** secondary generation is blocked until front QA passes. Each generated secondary view keeps its own check; pass may display normally, review requires an explicit review action, and unavailable checks may be retried without buying another render. Only a currently passing view is a trusted photoreal save/export source.


## 2026-10-03 — Multiview generation requires server-bound front QA
**Decision:** client UI state is not sufficient evidence for spending credits on a secondary photoreal view. The server must verify that the exact front image submitted as the secondary-view source is the image that received a passing fidelity check.

**Why:** a browser-only gate can be bypassed with a direct API request, and a passing job ID alone could be paired with a different generated image. The private outcome ledger already holds the appropriate evidence boundary.

**Rule:** front inspection stores a SHA-256 identity of the inspected FASHN image inside the private QA payload. Secondary generation supplies the front job ID and image; the server requires a matching front outcome, passing QA, matching shirt/trouser IDs, an allowed selected-look concept, and the same image hash before returning a cache hit or spending a generation credit. Repair replaces stale front caches so later views inherit the reviewed repaired source rather than an older defect.


## 2026-10-03 — Front final-render QA measures protected-region drift
**Decision:** the locked front photoreal is checked deterministically outside the intended garment edit before semantic QA can promote it.

**Why:** FASHN Edit documents black mask pixels as preserve guidance rather than a hard boundary, so a successful garment refinement can still change the faceless mannequin, shoes or studio. Recent virtual-try-on research likewise treats preservation of human/background regions as a separate fidelity problem rather than assuming garment quality guarantees identity stability.

**Rule:** only the aligned front view is compared against the canonical studio reference in protected head/outer-background/floor regions. Normalize the mean pixel delta on the existing protected-region scale, classify it conservatively as strong/review/weak, and combine the result with semantic mannequin consistency using the worse status. Review/weak deterministic drift must hold the render and produce a targeted restore-model/studio repair instruction. Do not apply fixed front-coordinate comparison to three-quarter, side or back views because their geometry intentionally changes.

## 2026-10-03 — Instant cloth shading uses neutral shape maps
**Decision:** the customer photo compositor derives broad garment form from a neutral-gray, low-frequency studio lighting map normalized against the actual photographed garment region, rather than blending the photographed source garment luminance/albedo directly into the selected fabric.

**Why:** direct template luminance can make pale Linen Earth cloth inherit the dark source shirt or make darker cloth inherit a pale trouser base. A fixed brightness multiplier is also fragile across shirts, sleeves, trousers and future studio templates. Region-normalizing the photographed cloth around neutral gray keeps relative studio highlights/shadows while removing the source garment's base value.

**Rule:** the catalogue swatch remains the colour/texture authority. The studio photograph may contribute garment-local neutral broad lighting plus colour-neutral multi-band fold/seam relief only. Direct source-photo detail blending, source-garment colour/value, and arbitrary per-template albedo/detail-brightness multipliers must not be used to make the selected cloth look photographic. White contrast collars/cuffs follow the same rule and derive depth only from their own normalized detail region. Relief blur must also be garment-local: non-garment pixels are replaced by the garment-region mean before frequency extraction so skin/background edges cannot manufacture cloth shadows. Directional pattern orientation may follow traced screen-space panel axes for visual realism, but those rotations are photo geometry only and must never be treated as physical grain or scale evidence. When a photographed garment is split into traced panels, shape/relief normalization must use the intersection of the adaptive cloth mask and that exact panel path; whole-shirt or both-leg baselines are not reused for an individual sleeve or leg. Pattern rotation and repeat scaling on those panels must be anchored to a traced screen-space panel start rather than the canvas origin, so calibration changes do not re-phase stripes/checks across the photographed seam. That anchor is still visual geometry only and does not prove physical grain placement. The same rule applies to untucked photographed shirts: when torso, sleeves and collar have distinct traced geometry, they must be projected as distinct fabric panels rather than one globally oriented shirt texture. Untucked photographed trousers follow the same principle per leg; where the source mask is divided at the center seam, the two prepared alpha masks must be complementary so the split cannot create a gap or double-painted textile.

## 2026-10-03 — Photographic shading follows relative illumination, not byte deltas
**Decision:** the neutral shape map derives studio shading from the photographed garment's relative linear-light luminance ratio around its local cloth baseline, encoded in log space around neutral gray.

**Why:** diffuse image formation is better approximated as reflectance multiplied by shading. Equal sRGB byte differences do not represent equal illumination changes on dark and pale source garments, so additive normalization can make the same studio light read differently when the template cloth changes.

**Rule:** convert photographed grayscale samples to linear-light sRGB before comparing them to the garment baseline; map only the relative illumination ratio back to the neutral shape layer. Keep the selected catalogue swatch as the colour/texture authority, clamp extreme ratios, and do not promote this 2D approximation to a physical BRDF or measured sheen claim.

## 2026-10-03 — Photo garment baseline uses log-average linear luminance
**Decision:** the neutral photographic shape map estimates each garment/panel baseline with an alpha-weighted log-average in linear-light space.

**Why:** the compositor treats shading as relative illumination. A plain arithmetic mean of gamma-encoded pixels lets a small bright highlight or specular patch pull the baseline upward and flatten the rest of the cloth. A log-average in linear light better matches the multiplicative shading model while leaving a uniformly lit garment unchanged.

**Rule:** derive the baseline only from pixels inside the active garment/panel mask, ignore invalid or near-transparent samples, convert sRGB bytes to linear light before averaging in log space, and convert the resulting baseline back to sRGB only for the existing neutralization interface. This is a rendering heuristic, not a measured material property.

## 2026-10-03 — Final-render handoff preserves textile detail with WebP
**Decision:** the deterministic locked customer preview and the split shirt/trouser fabric context use high-quality WebP rather than introducing JPEG generations before the final FASHN render.

**Why:** the final renderer depends on fine weave, slub, stripe/check edges and colour separation that can be softened by repeated JPEG encoding. Current FASHN guidance accepts WebP inputs and recommends preserving original format/quality when possible, so the handoff should avoid avoidable lossy transcodes while staying small enough for the existing request path.

**Rule:** browser locked-preview serialization uses WebP at high quality with Canvas fallback semantics; server validation still accepts JPEG/PNG/WebP but canonicalizes an accepted 1024×1536 locked source to near-lossless WebP. Fabric-context resizing uses lossless intermediates and one near-lossless WebP output. Each fabric-context panel must use contain-fit framing so the complete stock swatch remains visible, and shirt/trouser panels must be separated by a neutral gutter rather than touching or carrying text labels. Keep the current request-size guard and identity checks; this improves source fidelity but does not bypass render QA or upgrade physical-fabric claims.

## 2026-10-03 — Final FASHN renders use PNG
**Decision:** the FASHN edit pipeline requests PNG output for the final front render, repairs and secondary views.

**Why:** these generated images are quality assets and can themselves become the source for later repair/view generation. FASHN documents PNG as the higher-quality output option, while JPEG trades some image fidelity for smaller/faster delivery. Keeping the generated chain in PNG avoids another lossy generation around fine weave and pattern edges without increasing the number of render calls.

**Rule:** keep the existing 1k balanced generation settings and credit gates unchanged; change only the output encoding to PNG. Customer exposure still depends on the existing fidelity QA, and PNG output does not imply verified physical colour or pattern scale.

## 2026-10-03 — FASHN Edit preserves source framing
**Decision:** the final-render Edit call no longer sends a forced 4:5 aspect-ratio field.

**Why:** the current FASHN Edit API documents image, prompt, mask, image_context, resolution, generation_mode, seed, num_images, output_format and return_base64, but not an aspect-ratio override. The locked customer preview already has the full-body 1024×1536 framing we want, so an unsupported/extra 4:5 field risks unnecessary reframing or future request incompatibility.

**Rule:** let FASHN Edit derive output geometry from the submitted source image and keep full-body framing instructions in the prompt. Use a separate supported reframe step only if Linen Earth intentionally wants a different export aspect ratio later; do not couple that to the fidelity render itself.

## 2026-10-03 — Final front edit is garment-mask guided
**Decision:** the locked selected-look front render supplies FASHN Edit with a mask generated from the same 1024×1536 photographed shirt/trouser geometry used by the deterministic compositor.

**Why:** FASHN Edit documents white mask pixels as the priority edit region and black pixels as preserve guidance. The selected look needs cloth realism refinement, while the faceless head, hands, shoes and navy studio should stay as stable as possible. Reusing the existing traced garment geometry focuses the edit without adding another generation or inventing a second segmentation system.

**Rule:** generate a binary PNG mask server-side from the exact active shirt/trouser photo-template paths; pass it only to the locked front refinement where source and mask coordinates are aligned. Repairs and alternate camera views do not reuse the front mask because generated geometry may have moved. Treat the mask as guidance, not a hard boundary; the existing automated fidelity QA remains mandatory.

## 2026-10-03 — Fabric chroma is not white-balance evidence
**Decision:** Fabric Analyzer image quality no longer penalizes a large RGB channel spread as a `strong_color_cast` by itself.

**Why:** a saturated navy, burgundy or green fabric naturally has unequal RGB channel means. Without a known neutral grey/white reference in the same light, that imbalance cannot distinguish the cloth's real colour from an illumination cast. Treating chroma as white-balance evidence unfairly downgraded strongly coloured fabrics.

**Rule:** keep the existing channel-spread value only as a diagnostic compatibility field. Do not turn it into a colour-cast issue or quality penalty unless a future capture protocol supplies a known neutral reference. Physical colour verification remains a separate controlled evidence workflow.

## 2026-10-03 — Async preview results belong to one committed design
**Decision:** the browser owns one cancellable generation/repair/view/QA chain per committed design signature, including its accepted studio calibration. A signature change or unmount invalidates that lifecycle before the next frame is painted.

**Why:** resetting the visible render when a selection changes is insufficient if an older network response can later repopulate the preview, approve old QA, overwrite loading state or invoke creative feedback for the replacement look.

**Rule:** every async response checks its request lifecycle before state/cache writes, follow-up inspections or feedback callbacks. Fetches share an AbortSignal, stale errors and finally blocks cannot affect a newer chain, and a synchronous lock prevents same-frame duplicate generation dispatch. Cancellation is a browser correctness boundary; it cannot promise to refund or stop provider work already dispatched server-side. No shared schema or persistence contract changes.

**Verification runtime:** CI installs pinned Playwright 1.63.0 in a temporary test-only prefix after the production build. It uses real Chromium, local photographs and Canvas at 390/768/1440px, with delayed mocked provider/QA responses that deliberately ignore cancellation. This does not add an application dependency or change package/schema contracts. The screenshots and lifecycle report are retained as CI artifacts; synthetic QA approvals, desktop viewport emulation and unverified calibration must never satisfy physical-fabric or real-device acceptance gates.

## 2026-10-03 — Brand surfaces share the intact original logo
**Decision:** restore the original 890×242 Linen Earth PNG from branding commit `52984409` unchanged and serve it as one content-hashed public asset. Header, opening animation, favicon and social metadata share its source and intrinsic dimensions.

**Why:** the assembled base64 image had a bad palette CRC and a truncated image stream. It exposed metadata to permissive decoders but failed actual browser/pixel decoding, leaving the brand surfaces broken. Reusing its year-cached alias alone would also leave cached failures visible.

**Rule:** preserve the recovered image bytes; verify full pixel decoding and the URL's content hash in tests. Keep the old public image URL as a short-lived redirect to the canonical asset. Browser checks must decode the header and opening logo and validate icon/social metadata at all three responsive widths. No new dependencies, brand redesign, fabric claims or deployment milestone.

## 2026-10-03 — Style Director requests belong to the current journey and look
**Decision:** reuse the cancellable preview request scope for each committed questionnaire step and selected look/calibration. A restart creates a fresh journey even when the first question is already visible.

**Why:** clearing the results on restart or look selection did not stop an older response from displaying another look, recording a discarded render as completed, reopening previous recommendations or clearing a newer request's loading state. Clicking the already selected look also cleared its source preview without asking the compositor to rebuild it.

**Rule:** check ownership after each async boundary and before result, error, loading or style-memory writes. Pass the request's AbortSignal to fetch, invalidate before paint and on restart/selection, and synchronously lock each action against duplicate clicks. Local photo callbacks must belong to an enabled selected look, including while exit animations retain the previous view. Reselecting the active look preserves its prepared source. Server/provider work already dispatched may continue after browser cancellation. No new application dependencies, schema, physical evidence or deployment milestone.

## 2026-10-03 — Style Director photoreal promotion requires fidelity QA
**Decision:** inspect the exact generated front image/job against the same locked shirt, trousers and construction before it replaces the live photographic outfit or enters completed style memory.

**Why:** Style Director used the selected-look generator but bypassed its inspection step, so a wrong fabric, construction or model could appear as a completed final visual.

**Rule:** require an available passing check with every fidelity dimension strong and no major artifact. Missing, malformed, contradictory, unavailable or review checks keep the live outfit visible. Retain the generated image only within the current look/calibration lifecycle so Retry photoreal check repeats inspection without generating another image or recording another render request. Successful QA disables further generation of that same result. Generation and inspection share the request scope; stale approvals/errors cannot display an old image, unlock a new request or complete memory. No dependencies, persistence schema, physical acceptance or deployment changes.

## 2026-10-03 — Live model framing follows the finite preview surface
**Decision:** anchor the Style Director Canvas to its preview frame, matching the contained generated-image surface.

**Why:** a percentage-sized Canvas inside the centered grid could retain an intrinsic row taller than the tablet preview; `object-fit:contain` alone did not stop the model's feet from being clipped by the parent.

**Rule:** keep the Canvas absolutely contained by the preview bounds. Browser checks measure the rendered intrinsic-image bounds inside the clipping frame at 390/768/1440px for initial/selected live looks, held QA and approved images. This changes CSS framing only; Canvas pixels, serialized locked sources, calibration, garment geometry and fabric claims stay identical. No dependencies or schema changes.

**Verification:** real Chromium CI exercises the questionnaire and photographed Canvas at 390/768/1440px, then deliberately delivers mocked responses after cancellation. Reports separate these code regressions from physical, device and owner acceptance; the calibration-change case uses a synthetic API fixture only.
