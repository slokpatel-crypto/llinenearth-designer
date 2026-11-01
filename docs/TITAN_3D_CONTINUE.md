# TITAN 3D CONTINUE — authoritative working checkpoint

Updated: 2026-11-01. Status: **REJECTED 3D candidate; NOT production-ready**. This checkpoint describes the current continuation, not an approved model.

## Git lineage / concurrency

- Repository: `slokpatel-crypto/llinenearth-designer`.
- Current isolated draft: `work/titan-3d-panel-contact-gate-20261101`, PR **#674**, stacked on draft PR **#673** (`work/3d-readiness-repair-20261101`), itself based on rejected original UV/source PR **#311**.
- PR #673 last verified base/head: `8c8aa33a2308743c166b2890b22a0d4919e93326`; this is the saved untouched candidate baseline from which this branch originated.
- Implementation commits on PR #674: `61755f901e64059577bb03af60850a85f64eae0d` (native gate), `0d14b9950c24f3447ac883560eb4db802e36af0a` (real-Blender BVH regression). The GitHub PR head may advance when this checkpoint is committed; always re-read the exact head and matching-head checks.
- The source preparation depends on the CC0 Blender Human Base Meshes 1.4.1 body, not verified original canonical model geometry.
- The original customer reference `public/designer/studio-tucked.webp`, model ID `linen-earth-studio-model-v1`, and deployed customer experience must not be replaced by this rejected candidate.
- Main `vercel.json` was independently read at 2026-11-01: `git.deploymentEnabled:false`. **The older stacked 3D branch has a different Vercel config (`main:true` under deploymentEnabled); this draft MUST NOT be merged or deployed.** Reinspect the exact main/head config before any future verified intake.

## Exact source asset/evidence references

- Authentic evaluated source scene is built during the native GitHub workflow as `.cache/linen-earth/linen-earth-officewear-authored.blend`, not checked into Git.
- Source scene SHA256 in independently recorded rejected preflight: `302a8dc9e17ce7e9944f237525e12573b204705a357315bcda3bd9ee72edaf13`, Blender **4.5.14 LTS**.
- Source body preparation: `scripts/blender/prepare-linen-earth-body.py`; garment shell authoring: `scripts/blender/author-linen-earth-officewear.py`; independent gate: `scripts/blender/preflight-linen-earth-officewear.py`.
- Last native source artifact: workflow run `41292014186` (source-locked 3D), intentionally failed on candidate release gate, with diagnostic four-angle PNGs, original-vs-candidate comparison and authored `.blend` artifact uploaded. Workflow artifact retention is currently **14 days**; preserve any important source/render evidence in durable approved storage before it expires.
- Evidence: `docs/TITAN_3D_CONTACT_READINESS_20261101.md`, `docs/TITAN_3D_PREFLIGHT_20261101.json`, `docs/TITAN_3D_PANEL_CONTACT_DIAGNOSIS_20261101.md`, `docs/TITAN_3D_VISUAL_REVIEW_20261101.md`, and two rejected torso experiments.
- No exact original photo-source `.blend`, verified side/back photos, model/pose dimensions, pattern pieces or supplier-measured fabric property data located in the inspected repository. Request them if available, but continue independent implementation/QA.

## Completed engineering change, NOT completed garment acceptance

**Defect:** the named body/garment, leg/leg and tucked junction checks omitted numerous distinct garment panel pairs. Independent prior native diagnosis found unreviewed overlaps: torso/L sleeve **231**, torso/R sleeve **186**, L sleeve/L leg **26**, R sleeve/R leg **28**, waist/L leg **49**, waist/R leg **44** crossing triangle pairs. These are geometric counts, not penetration depths or evidence that joins were tailored correctly.

**Correction:** new pure `scripts/blender/garment_panel_contacts.py` enumerates and measures the other **13 of 15 distinct pairs**, leaving the existing tuck and leg/leg gates unchanged. Native preflight now emits all additional pair receipts and blocks missing measurements, unintended intersections and unapproved crossings at proposed sewn joins. No automatic seam approval or invented allowance. `tests/python/test_garment_panel_contacts.py` adds six focused pure tests; `tests/blender/test_world_collision_bvh.py` now checks a genuine Blender overlap and missing-panel behavior through the real evaluated BVH. No body/garment mesh geometry was changed.

**Acceptance test:** on a true authored scene, all 13 independent pair measurements exist and are clean OR a separately authored, independently checked sewn-seam construction explicitly justifies a different gate (not implemented or approved here); existing tuck and leg/leg checks remain in force. Compare against the prior native measured six overlaps; do not relabel them acceptable. A new exact-head source run and tests are required, including preflight JSON with the `allOtherGarmentPanelContacts` field. Do not claim a pass until executed.

## Current model rejection gates

- Cuff/hand center spacing **563.54 mm**; target **500 ± 36 mm** (max **536 mm**). Previous bounded repair only safely moved a small amount without detaching/penetrating the scanned arms. Do not repeat failed larger displacement.
- Unapproved UV tears: sleeve L/R **112/110**, leg L/R **86/42**, and all six fabric panel metric distortion/anisotropy gates fail. Supplier repeats and fabric mechanical properties remain unverified.
- Body shell segmentation is not garment construction. Chest/shoulder/wrist boundaries, collar, placket, yoke/cuffs, trouser waist/seat/fly/leg join remain visually unsuitable.
- Body is generic scan and photographic source identity is unverified; photo has no verified side/back view.
- Previously rejected experiments: rounded-envelope torso (2,948 body torso overlaps, 1,329 tucked overlaps); nearest-body-surface trial (1,637 body torso, 22 tucked, 256 collapsed UV triangles, 80 tears). They are **not** viable repair bases; do not repeat without changing the face topology/body-clearance method.

## Acceptance criteria status

| Criterion | Verified status |
| --- | --- |
| Deterministic canonical customer photo preserved | No changes to customer UI in this draft; no replacement performed |
| Coherent shirt/trouser sewn construction | **FAIL / not authored** |
| All relevant independent body and garment contact measurements | **Partial**: eight baseline counts exist; thirteen new pair gates **implemented, exact-head native results pending** |
| Locked cuff guide & acceptable four-angle silhouette | **FAIL / human parity not verified** |
| Seam authoring, UV metre/scale/grain truth | **FAIL**; no supplier confirmation |
| Supported visible design option geometries | **NOT independently verified** |
| Native Blender scene/PR CI + browser 390/768/1440/mobile | **PENDING for PR #674 exact head** |
| Tailor, measured fabric, owner four-angle review | **PENDING external evidence** |
| Production release readiness | **BLOCKED** |

## Commands and latest known results

- Previous PR #673 recorded local pass for `npm run quality`, **637** Node tests, **113** Python tests, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check` (live checks skipped) and `npm run build`. These are parent-branch results only and **do not certify #674**.
- Previous exact-head 3D source workflow `41292014186` completed source-build and four diagnostic renders, but deliberately **FAILED** the model promotion gate; structural release was not granted.
- For this branch: `python3 -m unittest tests/python/test_garment_panel_contacts.py -v`; full `python3 -m unittest discover -s tests/python -p 'test_*.py' -v`; and source native `.github/workflows/model-source-candidate.yml`. Read CI/Non-3D results for the **last #674 head SHA**, not an older PR head. A failed native geometry gate must remain red until genuine geometry meets acceptance.

## Next implementation action for “3D continue”

1. Check PR #674 and #673 exact new heads and matching-head workflows; inspect the 13 source-pair measurements. If new code/test errors occurred, fix those first. Preserve last verified baseline and don't import unrelated branches.
2. Move to **actual source shirt construction**, before solidification, using one isolated candidate `.blend` and a reproducible Blender experiment: inventory unthickened torso/sleeve boundary loops and actual anatomical neck/armhole opening, construct continuous front/back shoulder/yoke/armhole geometry with deliberately joined sleeve edges (not a nearest-surface envelope). Assert untouched body SHA/vertex positions, no unplanned face-level body penetration, compare six known panel intersections against prior source. Reject if worse.
3. Once armhole topology improves with source-native evidence, add separately modeled collar, placket and cuffs; then trouser seat/waist/fly/leg joins. Re-author UV seams *after* geometry. No guessed fabric dimensions may be represented as measured.
4. Four-angle source renders and independent comparison at each accepted candidate. If native Blender is not locally available, execute on GitHub Actions via a draft PR workflow; do not misstate local execution. Do not deploy or merge.

External input: preferred actual canonical Blender scene and original garment meshes; otherwise owner-supplied front/side/back photo references and measured garment/model dimensions, fabric repeat/grain evidence and tailor approval. Record what is absent and continue independently wherever possible.

**Checkpoint discipline:** after any accepted/rejected experiment update this file with exact branch/commit, commands/results, scene SHA, native artifact/run, renders, decision and *one next action*. Keep all unapproved modeling on a separate draft branch, never silently replace the live model.
