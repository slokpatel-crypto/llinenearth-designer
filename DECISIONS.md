# DECISIONS.md — Linen Earth

Architecture and product decisions that must persist across coding sessions.

## 2026-10-05 — Style Director signs the complete garment recipe

**Contract:** handoff v2 signs both legacy controls and canonical StyleSpec v2, including shirt/trouser types and construction. The same spec travels through the result, explicit photoreal request, Designer assessment and saved draft used by the isolated 3D lab. Live edits remain deterministic.

**Lifecycle:** malformed or inaccessible browser drafts cannot prevent URL restoration. A late opening assessment cannot overwrite an edited recipe or enter recommendation memory. Verification belongs to the original recipe; edits hide its audit badge, and a network failure never claims a matched handoff.

**Compatibility:** existing v2 saved drafts and legacy-only URLs still restore. Old v1 tokens do not certify canonical garment types; their designs open without verified-handoff status. New links must be regenerated for v2 verification. No database migration or dependency change. Photographic preview limits and the production 3D asset gate remain in place.

**Evidence:** behavioral tests cover generated recipe round trips, signed nested fields, expiry and the HTTP boundary. Chromium checks malformed/stale/blocked drafts, delayed assessment/audit responses, exact Designer-to-3D continuity and zero paid calls at 390/768/1440px.


## 2026-10-05 — GarmentViewer M1 stays isolated until realistic geometry passes QA

**Decision:** continue the reusable 3D viewer idea as an isolated `/lab/garment-viewer` milestone. Preserve the public `/visual -> /style-director` redirect and the current photographic Designer. M1 proves stable model identity, separate shirt/trouser PBR materials, Linen Earth swatch replacement, texture scale, roughness/normal detail, four camera views and touch/orbit behavior without AI credits.

**Geometry:** the generated block GLB is temporary engineering geometry, not a customer realism surface. Do not promote it to Designer/Style Director. The next milestone replaces only geometry/UV quality with the approved realistic office-wear model while retaining the material/camera contract.

**Dependency:** the lab pins Google `<model-viewer>` 4.3.1 for GLB/PBR/camera plumbing. Linen Earth generates the temporary GLB itself; no third-party mannequin asset is used.

## 2026-10-04 — Preserve both controls and banner; use a calm three-second reveal

**Owner preference:** keep the existing thread-and-logo homepage banner alongside the new premium buttons. Save their approved combined version at `checkpoint/brand-animation-and-premium-controls-20261004`; a preview cropped above the banner must not be treated as removing it.

**Timing:** both the opening and replayable banner begin with 1.2 seconds of quiet white artwork. Background threads/light start after that hold; the unchanged logo begins at 1.5 seconds and finishes at 2.6 seconds. All movement finishes by 3 seconds of visible playback. Reveal the caption gently; use restrained offsets and easing, without a loop or additional dependency.

**Behavior:** first keyboard/pointer/wheel interaction can still dismiss the opening immediately. Keep once-per-session display, offscreen/hidden-tab pause, replay, complete static no-JavaScript artwork and live reduced-motion cancellation. Browser evidence checks the actual white hold, native animation end times, path movement, replay and original responsive/lifecycle regressions. No outfit, fabric, Designer, recipe or schema changes.

**Completed tracks:** pause/resume only unfinished Motion handles. A completed native track has committed its final style and cancelled its underlying animation; replaying that handle would resurrect its first keyframe. Browser tests wait for pending native pause tasks to settle, retain the strict frozen-pixel/clock checks, and prove that the finished logo and threads remain intact during a late offscreen pause/resume.

## 2026-10-04 — Richer controls and explicit Designer clarification drafts

**Controls:** add original compass/garment/weave icons, circular arrow details, an inset tailoring line, a finite light sweep and press feedback to the homepage actions, brand replay and Ask Designer. Keep labels and destinations authoritative, illustrations decorative, disabled controls quiet and reduced-motion controls static. Server markup contains the complete controls; no extra animation dependency or per-frame JavaScript is introduced.

**Legibility:** scope the Designer header eyebrow style to its direct text container. Decorative action spans inherit the button foreground and 12px type rather than the 6px eyebrow treatment. Browser checks require readable size, at least 4.5:1 enabled-label contrast, matching icon foreground and contained text at all three supported widths.

**Designer:** when a question has conflicting construction, an unsupported reference, unsupported garment or unclear task, offer up to three relevant questions from the existing supported option library. Selecting one prepares a new editable question and retains the original question plus its previous starting point for restoration. Carry the request's interpreted occasion/context and existing cloth/construction basis into the follow-up. A choice is not a submission, an outfit application or a human judgement. Restore, main-outfit changes and navigation cancel stale work through the existing request scope.

**Compatibility:** `designer-advice-v1` gains an optional clarification object. Old callers still receive the same task/results contract; no database migration, persisted recipe, physical-fabric claim or provider call changes. Clarification is assistance with supported tasks, not universal reference-image understanding. Browser verification covers draft preparation/restoration, late responses, unchanged model pixels, proposal/request context, human-feedback counts and responsive motion controls.

## 2026-10-04 — Original thread motion around the real brand logo

**Decision:** add a finite, replayable homepage brand signature and replace the long opening fade with a 2.4-second thread-and-logo reveal. Use the existing `motion/mini` runtime for native path/opacity/transform choreography; original SVG threads surround the unchanged uploaded logo. Reference the [Motion animation API](https://motion.dev/docs/animate), [Magic UI travelling beams](https://magicui.design/docs/components/animated-beam) and [Anime.js line drawing](https://animejs.com/) for movement principles rather than importing another UI or animation framework.

**Interaction:** signature motion plays once when at least a quarter of its artwork enters view and can be replayed. Its longest sequence lasts 3.8 seconds of visible playback. Pause when offscreen or the document is hidden; cancel and restore the complete static artwork if reduced motion is requested, including a live preference change. The intro remains once per tab session and yields immediately to the first keyboard, pointer or wheel interaction. Content and the real logo remain available without JavaScript or session storage. Observers, native animation controls and listeners are cleaned up on navigation.

**Boundary:** these abstract graphics express the brand; they do not depict cloth scale, garment fit, measured drape or manufacturing detail. No catalogue, photograph, Designer contract, saved recipe, dependency or schema changes. Existing keyboard targets and focus treatment remain in use. Browser review includes normal/reduced motion at 390/768/1440, actual changing path pixels, replay, offscreen pause/resume, live reduction, first-interaction dismissal and a short recorded animation.

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

## 2026-10-04 — Assemble cloth panels before applying garment coverage
**Problem:** repeated panel/silhouette feathering left old cloth at boundaries; complementary leg alpha composed with source-over could still lose coverage at the fly. Tucked interior-mask recovery could classify the neighbouring garment at the waistband. Broad-light filtering also blurred bright background into the garment before masking, while weak relief flattened the photographed folds.

**Decision:** assemble base torso/sleeve/leg panels into one garment canvas and apply its antialiased adaptive silhouette once, without a second blur that exposes original cloth. Keep panel-local lighting normalization, grain rotation and repeat anchors. The tucked source palette explicitly rejects the other garment at overlapping geometry and gives known source cloth full interior coverage. A small traced sleeve seam overlap closes the shoulder-panel gap; the curved shirt hem includes its last photographed cloth pixels while palette rejection protects the trouser waistband. Both broad lighting and relief substitute the garment-local mean outside coverage before filtering. Narrower relief bands and stronger shared, colour-neutral compositing preserve photographed seams/folds without blending original navy/beige cloth back into selected swatches.

**Compatibility:** the same model/photos, real catalogue references, scale evidence, save/lock recipes and provider budget remain in use. No dependency, schema or persisted-data migration. This improves coverage and depicted photographic form; it does not measure fabric-specific drape, simulate fit/body shape, warp repeats or establish physical sample acceptance. Existing static contracts are updated to the new renderer and backed by baseline-versus-current Chromium pixel evidence, protected-region checks and 390/768/1440 responsive review.

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

## 2026-10-03 — Neutral photographic folds retain fabric coverage
**Decision:** recover coverage inside the traced tucked garment independently of tiny source-cloth RGB differences; retain the existing colour/brightness rejection at uncertain boundaries.

**Why:** near-neutral folds punched holes in the colour mask, exposing the original dark shirt as blocky patches through a pale selected fabric. A blurred geometric mask supplies conservative interior coverage, with neck clearing and bright mannequin/floor rejection still applied. Prepare it once per photograph and reuse it on every edit.

**Rule:** preserve the real swatch texture, repeat scale, panel grain, mannequin and source fold geometry. This corrects compositing; it does not measure a new fabric's mechanical drape. Exact drape requires mechanical or captured drape evidence ([Rodriguez-Pardo et al., 2023](https://arxiv.org/abs/2304.06704)); a flat RGB swatch alone does not provide that evidence. Existing saved designs remain compatible; no dependency or persistence schema changes. Browser checks cover the previously exposed folds and unchanged head/shoes/studio pixels at all three widths, separately from physical acceptance.

**Collar completion:** the neck clear zone also removed real inner collar folds. For self-fabric collars, restore selected cloth in the same bounded region where cool source chroma or very dark source shadows confirm collar cloth, then draw the original traced wings. The dark-shadow fallback belongs only to this photographed template: its warm mannequin neck is brighter than those near-black, hue-quantised cloth folds. Do not use interior geometry to recover neckline pixels, because it also contains skin. Browser probes include the recovered collar folds and unchanged shaded neck, head, hands, shoes and studio.

## 2026-10-03 — Designer questions produce grounded advice and judged revisions
**Decision:** extend the existing brief endpoint with a versioned `designer-advice-v1` response for callers supplying the selected construction, occasion and context. Dispatch design, critique, comparison, refinement, fit, construction, material and production-preparation tasks through pure functions using the existing stock, rule engine, fit assessment, negotiation and option library.

**Why:** the original one-line interface always proposed three catalogue directions, even for a critique or a question about the selected outfit. It omitted the current construction and occasion, and did not connect a judgement to an actionable revision. Applying a searched direction also sent the previous StyleSpec into canonical assessment.

**Rule:** explicit retained fabrics/details and the latest judgement instruction override defaults and learned taste. Compare available cloth or closed construction options; explain recorded construction guidance, provisional fit targets, conflicts and missing evidence. Hold an apply action with a blocking conflict. Unknown tasks/categories ask for a supported brief. Material answers never infer GSM, fibre, shrinkage, colour verification or exact mechanical drape from a flat image. Advice and revision never call paid image providers. A preview changes only after Apply, and assessment receives that exact versioned construction; late answers, errors and applied-choice assessments cannot write into a changed context.

**Human learning:** one newest human judgement per recommendation and distinct fabric/construction recipe; scope preferences to occasion. Selecting, saving and automated visual QA are not endorsements. A single judgement drives its next revision immediately; stable future preferences still require at least four distinct human reviews and a clear winning signal. Generic colour, cloth and formality feedback requires an instruction rather than an invented intent. Preserve the user's selected fabric/cut when the retained constraints leave no meaningful change.

**Compatibility/storage:** requests without the new current-construction fields retain the existing `linen-designer-brief-v2` response and three-direction flow. New response fields include task advice, versioned proposal construction, change summaries, provisional fit targets and apply eligibility; these are an additive API contract, not a database migration. Human feedback and advice audit use the existing bounded `designer_feedback`/`designer_override` event payloads and queue. Existing local profile version 1 stays readable, with conservative recalculation from human feedback; this is personal preference adaptation, not a globally retrained model. Measurements remain local unless explicitly exported through existing flows. No application dependency or persistence schema change.

**Verification:** task scenarios cover constraints, comparisons, evidence honesty, provisional measurement targets, latest-instruction priority, corrections, duplicate ratings, automated-QA exclusion and occasion/tie handling. Engine evaluation measures 55 deterministic task requests with explicit exclusion of API/image latency and physical acceptance. CI posts 13 actual HTTP contracts against its isolated server: all eight tasks, judged revision, legacy v2 compatibility and invalid construction/stock/ambiguous feedback. Real Chromium uses the actual model/Canvas and deterministic fixtures at 390/768/1440px, then delays responses through text/choice/reset/unmount changes, same-frame duplicate actions and exact-construction canonical assessment. Browser UI/provider responses are mocked; physical, device and owner acceptance remain separate.

## 2026-10-04 — Designer intent follows supported construction and the primary task
**Decision:** resolve natural construction names through the existing option IDs and closed selectable choices. Recognize full labels and bounded aliases across collar, cuff, placket, shirt fit/wear, trouser shape, rise, waistband, break and button material. An outfit request retains its primary design intent when it also mentions comfort, cloth or construction.

**Rule:** enclosing specific phrases win over generic aliases, so soft button-down and extra-high rise remain specific choices. Scope trouser fit adjectives separately from shirt fit; unsupported separate trouser-fit requests and contradictory construction instructions ask for clarification. Named comparisons evaluate those choices or ask for a supported pair instead of substituting point/spread or flat/pleated defaults. Revisions explain the recorded guidance for changed details, including provisional options.

**Constraints:** filter excluded colours and pattern families before ranking, preserving exclusions when a cloth is locked; an unsatisfiable retained cloth produces no proposal. Negated expression stays restrained. White contrast collar/cuffs and vegetable-ivory button material are construction details, not requests for replacement body fabric. Whole-word interpretation prevents photograph from becoming hot weather. These changes preserve the legacy brief response and existing saved StyleSpec contracts; no application dependency, database migration, paid-image call or upgraded physical claim.

**Verification:** pure regression tests cover every current selectable label, aliases, overlap, garment roles, compound intent, exclusion-first ranking, locked-cloth conflicts, named comparisons, contradictions and source guidance. CI adds six actual HTTP contracts and exercises named collar/placket/button request → explicit Apply → exact canonical construction at 390/768/1440px. Browser responses remain deterministic fixtures; actual fabric, drape and device evidence remain separate.


## 2026-10-04 — Designer executes garment briefs, capsule tasks and personal construction preferences
**Decision:** extend the existing deterministic workspace, not a parallel chat engine. Compile bounded creative goals, garment scope, role-specific cloth requirements and capsule occasions into closed construction choices. Apply explicit construction and companion locks before catalogue ranking and fit checks; missing numeric material data cannot satisfy a GSM/Lea request. Creative goals and learned choices are secondary to hard instructions and compatibility, with disclosed fallback when a soft treatment cannot be supported.

**Learning:** keep one latest distinct human recipe judgement per occasion. Use relevant supporting/opposing construction evidence and a clear winner; targeted fit/detail rejections do not reject unrelated liked details. Show the derived preferences and allow opt-out. Saves, repeated clicks, automated image QA and prior-revision navigation do not train personal taste. This is browser preference adaptation, not global model retraining.

**Workflow:** every capsule option carries its own occasion/context through judging and Apply. Cloth-only revisions preserve the actual judged construction. Keep up to six prior advice revisions within the current brief, with explicit Apply still required. Cards disclose photographic construction approximations using the existing shared photo-support contract.

**Compatibility:** additive advisor-v1 and browser-profile-v1 fields; unchanged StyleSpec v2 and legacy brief response, existing feedback event queue, no database migration, dependency or provider call. Read `docs/DESIGNER_ENGINE_EXECUTION.md` for the acceptance scope and remaining physical, preview-asset, broad-interpretation and real-user gates. Software success must not be described as universal designer intelligence or 100% physical readiness.

## 2026-10-04 — Develop a proposal without applying or judging it

**Decision:** let customers explicitly choose a returned direction as the starting point for subsequent Designer questions. Carry the exact proposal fabric IDs, closed construction choices and its own occasion/context through the existing validated brief API. Keep the applied outfit authoritative until explicit Apply; selecting a starting point is neither approval nor a negative judgement and adds no preference evidence.

**Ownership:** snapshot only the question context, not a new saved design or stock record. A human judgement always refers to its actual target proposal, taking priority over the earlier starting point. Read personal preferences for the brief's parsed occasion using the same parser as the API, so a business follow-up to a casual proposal cannot inherit casual-only feedback. Question edits and preference changes cancel pending answers while keeping the chosen starting point; manual changes to the applied outfit, reset/unmount, explicit Apply and returning to the current outfit clear it. Return focus to the brief when a proposal is chosen so mobile users can continue from long card lists.

**Compatibility and verification:** no new API request schema, StyleSpec version, database migration, dependency or paid call. Transient starting points do not provide durable account memory or unrestricted chat history. Pure context/engine cases, actual HTTP follow-up/comparison contracts and responsive Chromium flows cover exact proposal context, no implicit feedback, canonical Apply and stale-response cancellation.

**Capsule correction:** a full learned construction for one occasion must not remove other requested occasions. Each capsule slot starts from its own occasion's construction; only the slot matching the brief's parsed occasion receives that profile's learned construction. Explicit construction and retained customer choices remain authoritative in every slot. The existing incomplete-wardrobe disclosure still applies when hard constraints or stock genuinely prevent a requested look.

## 2026-10-04 — Creative craft workflow and personal research memory

**Decision:** adapt the existing Creative Lab and final-render loop. Add `linen-earth-creative-craft-v1` as an optional field on CreativeDirection and the v1 canonical garment specification. Its closed zone/motif/stitch IDs, catalogue-backed accent fabric, thread colour, proposed repeat, width and coverage survive locking, reconstruction, recipe hashing, production handoff and the printable tech pack. One accent panel is supported per recipe; its real swatch becomes the third separated FASHN reference. Legacy two-swatch renders and recipes without craft remain compatible. No new dependency or database table is introduced.

**Customer flow:** a craft question routes to Creative Lab; explicit controls and the brief take precedence over preferences. Generate and judge produce deterministic placement illustrations; neither applies an outfit nor starts a paid render. Applying carries the exact recipe into the existing model, assessment and explicit final-render action. The model preview identifies unsupported craft as specification-only; the placement illustration shows the new craft geometry. These views are not evidence of exact stitch execution or physical drape. A later cloth/sample review remains mandatory before production.

**Ownership:** dedicated creative-profile handlers validate the signed customer session, reject stale UI owner bindings, and append account-derived events to the existing service-only `style_events` ledger. Unowned historical browser feedback is never imported or attributed on login. Opt-in settings, an explicit learning reset cutoff and latest distinct human concept judgements are read per owner. Settings are fetched independently of the bounded review window so opt-out/reset cannot fall off that window. Renderer mismatches and automatic QA are excluded from taste learning. The previous pooled creative-feedback read is removed. Reset stops use of prior taste; historical audit records remain in the ledger.

**Research:** one daily cron plus an authenticated operator control collects at most two rotating primary sources. The existing DNS/IP-pinned, redirect-validated public page fetcher is reused, with bounded content and timeout. This scheduled collector makes zero paid model calls. Source hash, URL, fetch date and explicit keyword-hypothesis provenance accompany inactive candidates; a human must read, improve and activate each candidate in the existing research desk. An atomic deterministic daily ledger ID prevents duplicate/concurrent/manual runs spending a second batch. A claimed unfinished run needs operator inspection; retries do not silently bypass its daily budget. Daily activation needs the deployed route, `CRON_SECRET` and the operator's enabled setting; it is paused by default. Explicit operator synthesis remains a separate existing paid action.

**Verification:** pure craft/ownership/revision/lock/handoff cases, HTTP handler tests with an isolated ledger adapter, real HTTP contracts on CI, and responsive Chromium flows at 390/768/1440 cover the story. Live Postgres rollback probes verify the ledger accepts the payload shapes, a duplicate primary-key claim remains singular, RLS is enabled, client SELECT/INSERT are revoked and service SELECT/INSERT remains available. No production feedback or candidate was inserted by these probes. Source-token architecture gates now verify the extracted component, ownership and free research budget instead of the retired swatch-only cards and inaccurate background-learning message.

## 2026-10-04 — Branded public-site motion and premium controls

**Decision:** use the existing Motion dependency's small DOM animation entry point for one-time homepage reveals. Keep the uploaded Linen Earth logo, existing typefaces and local editorial photographs; add scoped warm-paper backgrounds, a fine brass line and control hover/press/focus treatments. Decorative motion does not transform the Designer's photographic canvas or fabric swatches. No dependency, API, material claim or render charge is introduced by this polish.

**Accessibility and lifecycle:** content is visible in server output; the optional opening logo mounts only after JavaScript confirms the session and motion preference. Unavailable session storage is tolerated. Reduced-motion changes cancel entrance animations and restore visible styles, keyboard focus completes decorative reveals, and listeners/animations are cleaned up on navigation. Background entrances finish once; no continuous ambient animation or scroll hijacking is added. Chromium checks cover 390/768/1440, normal/reduced motion, focus, no-JavaScript content, disabled storage, navigation and absence of paid provider calls.

**Browser correction:** remove the blanket root loading boundary, which left the static homepage behind a streamed loading placeholder when JavaScript was disabled. Existing action-level loading feedback remains. Replace the unrelated business-desk homepage fallback with the existing full-body studio image; keep its wording as a studio illustration and preserve the configured final-model endpoint. Catalogue photography and the Designer's model assets are unchanged.

## 2026-10-04 — Craft on the existing photographic preview

**Decision:** render the existing optional craft recipe locally on the same studio photograph. Resolve its accent ID against the current available catalogue and its base IDs against the applied shirt/trousers. Reuse actual swatch tiles, neutral garment relief and inward boundary masks. Compose craft after contrast details, with a separate bounded motif grid for the four existing motifs and three proposed stitch treatments. Image loads run together; ownership is invalidated before paint and cancelled edits cannot paint a newer design or enable its render controls. No dependency, schema, paid call or recipe migration is introduced; recipes without craft retain their existing pixels.

**Truth boundary:** every new craft placement is approximate. Illustrative motif spacing, mark width and density respond to the proposed recipe without asserting calibrated physical dimensions. The pocket remains specification-only because the source shirt has no pocket. Untucked waistbands/upper pleats remain hidden, and flat-front trouser pleats are not fabricated. Unsupported details stay in the saved recipe and drafting illustration. Physical drape, shrinkage, stitch tension and production approval still require the exact cloth sample.

**Scale disclosure:** visible patterned accents use the same independent physical-repeat and studio-calibration checks as the base cloth. Verified base fabrics cannot upgrade an unverified accent. The proposed craft-dimension note remains visibly readable in the compact model panel regardless of cloth-scale status.

**Reference replacement:** the existing bounded swatch-tile cache includes the loaded image URL, crop pattern and colour fallback. Updating a catalogue reference under the same fabric ID therefore refreshes both base garments and craft panels instead of reusing an earlier cloth tile. Base and accent reference metadata also participate in preview ownership/final-render cache identity, so the replaced cloth invalidates readiness and cannot inherit an earlier render.

**Verification:** pure cases cover catalogue reconstruction, stale bases, garment compatibility, hidden placements and bounded deterministic geometry. Chromium verifies real canvas pixels, protected skin/background, all supported zones/motifs, no provider calls, responsive application, and late accent loads. These are software placement checks, not physical acceptance.


## 2026-10-04 — Preserve the banner Replay placement

**Decision:** the premium button base sets relative positioning, which overrode the signature Replay button's original absolute placement and put it over the caption. Give the existing scoped premium Replay rule absolute positioning so its original responsive bottom-right offsets apply. The brass styling, keyboard focus, 44px target, three-second motion, logo and thread artwork are retained.

**Verification:** add actual browser geometry checks at 390/768/1440 for caption clearance, the bottom-right inset, target height and containment. Existing timeline, strict pause/resume, reduced-motion and Designer/photo/Style Director verification remains unchanged. No dependency, data, API or deployment guard changes.


## 2026-10-07 — M7.30 mannequin hand anatomy refinement

**Decision:** keep the locked Linen Earth studio identity and existing palm/forearm proportions, but replace the mitten-like hand read with deterministic articulated finger and thumb geometry generated inside the same zero-credit GLB build. Four fingers now extend continuously from each palm with small mirrored spacing/length differences; the thumb sits on the body-facing side and is mirrored per hand. No face/body identity, garment scale, camera, fabric, API or paid-render behaviour changes.

**Acceptance boundary:** this is a mannequin realism refinement, not a scanned anatomical hand claim. Finger geometry must remain subordinate to sleeve/cuff fit, preserve hand clearance from the trouser silhouette and stay consistent in front / 3/4 / side / back views. The production label advances to M7.30; existing model-contract, material, pattern-scale and browser gates remain authoritative.


## 2026-10-07 — M7.31 dress-shoe silhouette refinement

**Decision:** replace the generic scaled sphere used for the visible shoe upper with a deterministic multi-station dress-shoe shell. The new upper narrows through the heel, gains instep volume, tapers toward a lower rounded toe and adds a separate compact heel block above the existing sole. The locked 1727 mm mannequin stance, leg spacing, floor contact, camera system and zero-credit material path remain unchanged.

**Acceptance boundary:** this is a premium mannequin shoe silhouette, not a footwear sizing or last-design system. It must improve front / 3/4 / side readability without changing the garment fit contract or introducing paid rendering.


## 2026-10-07 — M7.32 neck and jaw transition refinement

**Decision:** stop reusing a scaled copy of the head as the visible neck. The mannequin now has a dedicated tapered neck shell that narrows toward the jaw while preserving the locked collar height, head position and 1727 mm identity. This removes the bulbous neck read in 3/4 and side views and gives collar variants a cleaner human-like support surface without adding facial detail.

**Acceptance boundary:** the mannequin remains intentionally faceless and identity-locked. This refinement changes only the visible neutral neck geometry; collar selection, neck gasket behaviour, garment scale, camera, fabric mapping and zero-credit rendering stay unchanged.


## 2026-10-07 — M7.33 exact white contrast collar and cuff rendering

**Decision:** carry the existing StyleSpec v2 `collarFinish` choice into the reusable 3D garment viewer instead of dropping it during Designer → 3D handoff. The live viewer now supports the same three closed choices already used by Designer: self-fabric, white contrast collar, and white contrast collar + cuffs. Contrast pieces keep the active construction geometry and linen normal/roughness behaviour, but deliberately detach the selected shirt colour/pattern texture and render as neutral off-white cloth. The collar neck-gasket follows the collar finish so no coloured seam appears at the neck.

**Compatibility:** no schema migration, new dependency, provider call or AI credit. Existing saved StyleSpec v2 recipes remain valid; missing collarFinish defaults to self-fabric. Switching back to self-fabric restores the prepared real shirt texture to the active collar/cuff materials.

**Verification:** static quality gates protect the exact handoff and texture-detach path; responsive browser QA verifies the saved collar + cuffs choice reaches the new control, remains observable on the viewer shell, and collar-only contrast remains a distinct state.


## 2026-10-07 — M7.34 fit-specific tucked waist geometry

**Decision:** stop rendering a tucked shirt with the same lower-torso shell used for untucked wear. Every shirt fit now gets a dedicated tucked torso geometry that compresses depth at the waistband, slightly cleans the lower width and adds low-amplitude deterministic cloth bunching above the trouser waist. Back constructions keep their own tucked geometry so darts, side pleats and box pleats survive the tuck instead of reverting to a plain back.

**Rendering rule:** tucked and untucked torso shells are mutually exclusive. Sleeve, collar, cuff, placket, yoke, pocket and fabric-scale systems remain independent and reuse the same locked model identity.

**Acceptance boundary:** this is a deterministic visual fit model, not a body-physics simulation. It must remove the obvious shirt/trouser shell intersection while preserving instant updates and zero AI-credit rendering.


## 2026-10-07 — M7.35 English Spread / British collar

**Decision:** add an explicit English Spread / British Collar instead of treating every British business collar as the generic spread shape. The shared Designer library, vocabulary and reusable 3D tailoring library now expose the same option.

**Geometry basis:** the collar uses the current Proper Cloth English Spread reference dimensions: 2.75 in point length, 4.88 in spread, 0.38 in tie space, 1.00 in front band height and 1.38 in rear band height. The 3D shell uses a conservative spread angle between the existing semi-spread and broad spread families, with the same fused / soft-fused / soft-unfused construction variants.

**Rendering:** the collar remains compatible with self-fabric, white contrast collar, and white contrast collar + cuffs, uses the existing physical-scale fabric texture path, and adds no AI/provider cost.


## 2026-10-07 — M7.40 explicit extra-high / Korean trouser rise

**Decision:** the 3D tailoring library now exposes the Designer's existing Extra-High Rise as a real geometry-backed option instead of collapsing it into ordinary high rise.

**Geometry:** the explicit `extra_high` rise shifts the shaped trouser waist shell and all rise-attached fly, button, waistband, pleat and pocket details by 60 mm. Rise-shell generation is now data-driven for every non-mid rise, so future supported rise values do not require hand-written low/high mesh branches.

**Preset:** `Korean High-Rise Tapered` now selects `extra_high` directly. The change stays deterministic, uses the same locked model and fabric materials, and adds no AI/provider cost.


## 2026-10-07 — M7.41 rise-aware tucked-shirt waist junction

**Decision:** tucked shirt geometry is now generated per shirt fit and trouser rise rather than using one fixed waist-compression zone for low, mid, high and extra-high trousers.

**Fit rule:** the shirt compression/bunching zone follows the active trouser waistband top. This keeps the shirt visually inside the waistband across low rise through Korean extra-high rise, while preserving the selected shirt back construction and the same locked mannequin.

**Rendering:** tucked materials are now keyed by `fit + rise`; untucked geometry is unchanged. The system remains deterministic, instant and zero-credit.


## 2026-10-07 — M7.42 360-degree cuff shells

**Decision:** replace flat front-facing cuff plates with closed elliptical cuff shells that wrap the full wrist so cuffs remain believable in front, 3/4, side and back views.

**Construction:** square, rounded, mitered and cocktail families now use separate wrap geometry while preserving the existing measured cuff widths/lengths, fused/soft construction scaling, buttons/cufflinks and white-contrast cloth behavior.

**Acceptance boundary:** cuff shells improve visible tailoring form; they are not a physical button-opening simulation. No model identity, camera, fabric-scale or provider-cost change.


## 2026-10-07 — M7.43 raised-back 360-degree collar bands

**Decision:** replace the thin generic neck gasket behind dress collars with a true wrap-around collar band. The band sits lower at the front and rises at the back, so spread, cutaway, point, button-down and related collars now keep a believable neck silhouette in side and back views.

**Construction:** collar-band geometry is keyed by both collar family and fused/soft construction. Soft constructions reduce band height/depth and follow the same drop as their collar leaves. White-contrast collar choices continue to recolor both the collar leaves and matching band together.

**Acceptance boundary:** this remains deterministic tailoring geometry, not cloth simulation. Camp, one-piece and mandarin collars keep their dedicated construction paths.


## 2026-10-07 — M7.44 360-degree trouser turn-up shells

**Decision:** replace flat box-like trouser turn-up cues with closed elliptical hem shells that wrap each leg. Turn-ups now read as actual folded fabric in front, 3/4, side and back views.

**Fit rule:** the wrap shell remains keyed by trouser fit, break and 4 cm / 5 cm turn-up choice. Its width still follows the selected leg hem scale and its vertical position still follows the selected break.

**Acceptance boundary:** this improves visible tailoring geometry without adding cloth simulation, AI credits or a new model identity.


## 2026-10-07 — M7.45 360-degree waistband hardware

**Decision:** waistband hardware now follows the waist around front, sides and back instead of being drawn only on the front plane.

**Construction:** belt-loop trousers use seven perimeter loops; side adjusters sit on the actual side quarters with tangent rotation; brace-button trousers carry front and rear pairs. Every hardware set continues to follow low, mid, high and extra-high rise positions.

**Acceptance boundary:** this is deterministic tailoring geometry. Extended tabs and drawstrings remain front constructions by design; no cloth simulation, AI credit or model-identity change is introduced.


## 2026-10-07 — M7.46 hip-wrapped trouser pocket openings

**Decision:** front trouser pocket openings now follow the hip perimeter instead of sitting on one flat front plane.

**Construction:** on-seam pockets sit closest to the side seam, slant pockets sit on the front-side quarter, jean scoop pockets sit farther forward and frogmouth pockets stay mostly frontal. Rear welt/jetted pockets are explicitly back-facing. All pocket positions continue to follow the selected trouser rise.

**Acceptance boundary:** these are visible pocket-opening constructions, not simulated pocket bags. The change improves front/3/4/side/back tailoring readability with no AI/provider cost.
