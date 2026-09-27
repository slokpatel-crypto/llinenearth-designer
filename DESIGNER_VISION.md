# Designer: end goal and calculation map

## Product goal

Designer should take a real cloth, a person, and a moment, then propose materially different, wearable outfits with an explanation and an honest account of what still needs checking. A mature version could guide shirts, trousers, jackets, suits, and Indian tailored garments through separate category rules. It would use a consistent model for visual previews and a human stylist for final review of ambiguous, cultural, or physically unverified decisions.

The current implementation is an **experimental shirt-and-trouser recommender**. It has 50 catalogue shirtings and 16 catalogue trouser fabrics. These are visual references, not confirmed physical inventory. Owner taste approval exists only for a Sky Blue shirting plus Beige suiting colour pairing in a semi-formal setting. That approval does not cover stock, cut, or comfort.

## How the engine should think

1. **Observe the cloth.** Record colour under controlled lighting, fibre percentages, weave, measured GSM, drape, opacity, surface and sheen, air permeability or verified climate comfort, motif scale, available metres, and the garment roles it can support. Image-derived guesses carry their own provenance and cannot fill measured fields.
2. **Understand the brief.** Occasion, actual venue, time, local climate and indoor conditions, desired visual impression, movement needs, fit preference, measured body, care constraints, and budget only where supplied. Ask the next question if its answer could change the design.
3. **Enforce feasibility.** Reject impossible garment/fabric roles, contradictory cuts and accents, out-of-stock garments once inventory is verified, unsuitable measured comfort, and owner-approved hard constraints. Unknown is a separate state, never a pass.
4. **Compose.** Select one visual focus, choose a colour relationship, distribute volume between garments, fit cloth drape to the chosen cut, and compare comfort with context. Offer different valid directions and say what each gains or sacrifices.
5. **Show the result.** A fabric-aware visual stays clearly labeled illustrative until a photographed or validated texture-to-garment render can preserve weave, grain, motif scale, construction and folds. Rendering is a separate on-demand cost decision.
6. **Learn deliberately.** Record the exact inputs, fired rules, version, proposed direction, customer response and owner's corrections. A human reviews changes to LLinen Earth's taste rules. Do not automatically train on clicks or retailer/film/show imagery.

## Current calculations, stated exactly

| Calculation | Current implementation | Interpretation and limit |
| --- | --- | --- |
| Shirt formality | `0.7 × mean(collar, cuff, placket, fit) + 0.3 × mean(known colour, known pattern)` on datasheet's 1–5 scale | Provisional owner-datasheet weighting, not a scientifically learned score. Missing colour/pattern leaves structure dominant. |
| Trouser formality | `0.7 × trouser-type score + 0.3 × mean(known colour, known pattern)` | Does not infer formality from GSM or price. |
| Shirt–trouser alignment | `abs(shirt score − trouser score) ≤ 1` for Semi-Formal/Formal, or `≤ 2` for Casual/Smart-Casual | CR-1, a working taste constraint; independent occasion-band check also applies. |
| Design fit | `max(0, 100 − 35 × high flags − 16 × medium flags − 7 × low flags)` | A provisional rule trace for comparison, not a calibrated probability of aesthetic success. A strong conflict still requires review. |
| Material evidence | `verified facts / 16 facts` across two cloths: actual colour, motif scale, exact composition, GSM, drape, opacity, climate suitability and available metres per cloth | Coverage only. Catalogue photos and “60 Lea” do not verify any of these; the current score is 0/16. A physical check can increase it. |
| Climate | With a selected climate, check both fabrics' confirmed comfort tags; any known mismatch flags, missing tag is unknown, two matches pass. | GSM alone is not a warmth measure; the current cloths have no verified comfort tags. |
| Alternatives | Keep the customer's chosen fabrics and cut first; derive alternate cuts from the same cloth, discard high-rule conflicts and cuts outside the occasion band; order remaining cuts by provisional design fit, then the requested visual intention. | 1–3 directions, depending on validity. This does not pretend to have stock-safe alternate cloth. |
| Repairs | For known cut conflicts, propose one small documented change, e.g. cropped hem with cropped trouser or spread collar with French cuff. | A material/colour problem cannot be silently repaired by inventing stock. |

The older `confidenceScore` field remains for event compatibility and is capped by unresolved rule count. Customer-facing presentation now shows design fit and separately counted material evidence so one number cannot hide missing facts. The `preliminary` label means an idea worth discussing, **not** a production-ready garment.

## Peak calculation architecture (planned, not implemented)

- **Hard gate:** `eligible = role ∧ available_metres ∧ cut_compatibility ∧ physical_use ∧ owner_constraints`. A missing critical measurement yields *pending verification* rather than eligible.
- **Separate objective vector:** `[occasion fit, thermal comfort, drape/cut fit, colour and pattern composition, intended expression, wearability]`. An owner's reviewed examples and real feedback would calibrate the weights; no universal fashion weight is assumed today.
- **Three useful choices:** find non-dominated options, then require visual and structural diversity. State why a more expressive option sacrifices restraint or why an airy option needs less structure. Never present small numeric differences as meaningful without validation.
- **Known uncertainty:** report coverage and provenance for each input; treat image-derived appearance and verified physical data as different evidence classes. Validate colour under consistent lighting before adding perceptual colour-distance metrics. A metric for two digital images under comparable viewing conditions cannot certify the physical cloth.
- **Validation:** compare outputs against blinded stylist judgments and real customer use, examine disagreements by occasion and cloth, approve changes with versioned before/after examples, and watch for genericness or cultural stereotyping.

## Research that informed questions, not rules

| First-party source | Design lesson we infer | Boundary |
| --- | --- | --- |
| [V&A, *Fashioning Masculinities*](https://www.vam.ac.uk/articles/about-the-fashioning-masculinities-exhibition) | There is no timeless single silhouette for all identities or settings. | Do not copy a museum garment into the catalogue. |
| [Netflix, *Wedding Season* costume designer](https://www.netflix.com/tudum/articles/wedding-season-outfits-indian-dresses) | A look can use a subtle palette echo and should respond to the real event and person. | Fictional wedding styling is not an Indian dress code. |
| [Issey Miyake, Spring/Summer 2025](https://eu.isseymiyake.com/blogs/news/17671) | Cloth movement and silhouette need to be designed together. | These runway materials are not LLinen Earth stock. |
| [ISO 9237](https://www.iso.org/standard/16869.html) | Air permeability is measured on actual fabric. | A product photo cannot supply it. |
| [CIE, colour differences in images](https://cie.co.at/publications/methods-evaluating-colour-differences-images) | Comparison needs consistent viewing conditions. | Approximate catalogue HEX is not a spectrophotometer reading. |

The light studio includes [two Met Museum Open Access objects](https://www.metmuseum.org/hubs/open-access) as **CC0 archive illustrations**, credited beside the images. Only LLinen Earth's own catalogue swatches are used for selectable fabric.

## Live studio model on the website

Designer now replaces its earlier SVG outfit sketch with a photographic, faceless mannequin in a light gallery setting inspired by the owner's uploaded reference. Two neutral full-body assets were made **once** for the site: a single-pleat straight-leg trouser and a single-pleat wide-leg trouser. The model has the same position, point-collar regular shirt, visible front placket and single-button barrel cuff in both assets. These fixed assets are already in `public/designer/`; a customer's selection does not generate an AI image, use FASHN, or make an external rendering request.

The browser loads the selected local catalogue swatches, samples cloth away from printed names, repeats a cloth tile, multiplies it against the neutral photograph to keep its folds, and clips shirt and trouser separately. Selections update on screen without pressing Assess; a PNG can be saved with `canvas.toBlob()`. The two garment layers allow every catalogue shirting to be paired with every catalogue suiting. With 50 shirtings, 16 trouser fabrics and two shown trouser silhouettes, the current asset set can compose up to `50 × 16 × 2 = 1,600` cloth/silhouette combinations. This count does **not** mean 1,600 physically approved garments or fully faithful construction variants.

The styling controls still include all choices in the datasheet. Only point collar, single-button barrel cuff, visible placket, regular untucked shirt, pleated straight leg and pleated wide leg have matching photographic templates. The UI names any selected detail the photo cannot show, including a two-button or French cuff, other collars, hidden plackets, other leg cuts and the waist hidden beneath the shirt. A new collar, cuff, jacket, skirt, back angle or trouser cut needs a corresponding aligned photo asset, garment mask and QA before it can be shown as such. A garment component atlas can scale those pieces independently: combinatorial fabric choices do not require combinatorial photos, but visually distinct construction does require distinct photographed or validated garment geometry.

The cut descriptions come from the provided shirt/trouser datasheet and are cross-checked with [Proper Cloth's collar reference](https://propercloth.com/reference/dress-shirt-collar-styles/), [cuff reference](https://propercloth.com/reference/dress-shirt-cuff-styles/) and [Permanent Style's trouser construction guide](https://www.permanentstyle.com/the-guide-to-suit-style). These are research sources, not imagery copied into the product. The studio asset is a single image-based model prepared during development; its apparent fit and folds are not measurements of the customer's body or chosen fabric. Catalogue swatches contain folds and text, and pattern repeat and colour accuracy require calibrated photos and physical verification.

## Next data needed before a dependable customer release

Verify physical stock/metres, exact composition and GSM, drape, opacity, photographed physical colour under consistent light, motif scale, comfort against the local event climate, and cut measurements on actual wearers. Collect a small owner-reviewed set of accepted and rejected examples across occasions. A render model and outfit advice should each be evaluated independently against real cloth.
