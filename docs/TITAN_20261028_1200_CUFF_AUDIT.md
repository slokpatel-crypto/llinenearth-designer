# TITAN 12:00 IST — source-locked cuff contact reconciliation (2026-10-28)

## Scope and immutable release boundary
Base: draft PR #439, exact original head `abb2dbe21ca52ecaf11359ecb7fbff13b4d129d6`, stacked on unmerged native PR #311. This isolated branch **does not** change `main`, the source body, the original `linen-earth-studio-model-v1` photograph, garment stock, supplier provenance, customer saved designs or production schema. No deploy, merge, paid inference, migration, release approval or human fit signoff.

## Verified source evidence before changes
- Source workflow run `40643316056` at exact #439 head completed **failure** as designed; native fixture tests passed, original-source authoring/preflight ran, diagnostic four-angle render was archived, approved four-angle production render skipped.
- Actual original-source native outer-cuff trial `requestedMmPerSleeve=30` retained `selectedMmPerSleeve=0`: positive contour trials hit approximately 1,198/1,181 sleeve-to-skin BVH pairs in the first 30-mm probe. **No new safe contour was established.**
- Native preflight still measured `sleeveCenterSpacingMm=563.54` versus immutable `500±36 mm` band, plus 112/110 sleeve and 86/42 leg unapproved interior UV discontinuities and unapproved local tangent charts. No supplier repeat/grain, physical drape, four-view photo identity or tailor evidence was established.
- #438 independently fixed a serious cloth/cloth omission in whole-sleeve translation: body BVH alone cannot detect a sleeve entering its own fitted shirt torso. #439 was independently based on #311, and therefore **did not contain** #438's torso gate. The new outer-contour method also had no sleeve/torso check or final BVH TOCTOU recheck. Treat this as a safety/integration defect, not a geometry improvement.

## Implemented changes on isolated draft branch
1. Reconcile the previously independent #438 **whole-cuff** source torso BVH gate into the #439 author, including seam-baseline preservation, bounded zero-baseline-only repair, complete XYZ exception rollback, final recheck and evidence.
2. Restore the independent native preflight sleeve/torso evaluated-mesh receipt validator and its strict type/duplicate/stale-evidence regressions. No evidence gate weakened.
3. Gate **exterior-only cuff** trials against measured shirt torso as well as skin and opposite sleeve. Allow preexisting sewn armhole contact only when neither sleeve's contact count increases. Recheck the retained mesh independently and roll back all XYZ if native collision checks throw or change late. Do not silently move source body/torso or repair a preexisting seam.
4. Extend real Blender fixture tests: torso-clear positive candidate; torso-only penetration with nonzero legitimate baseline; late BVH change; partial Y/Z mutation plus exception; missing fitted shirt torso. Existing cuff sign/symmetry, skin and rollback tests retained.

## Verification required at this branch's exact head
- Run `python -m unittest discover -s tests/python` and the source workflow's real Blender fixture, source authoring and independent preflight. The full `CI` and `Deep Engine — Non-3D QA` jobs must be read at their **matching head SHA**, not inherited from #439 or #438.
- The existing native source preflight is expected to **fail closed** on sleeve spacing, UV and physical/photo gates; this is not a software regression to waive.
- Inspect actual `SOURCE_FIT_OUTER_CUFF_CONTOUR_TRIAL` and `SOURCE_FIT_COLLISION_STAGES_WORLD_SPACE` receipts. The previous positive contour trials penetrated the body; do not assert new geometry success merely because the contact gate is stronger.
- Next geometry iteration should derive source cuff/skin clearance per ring and seam placement from real Blender diagnostics, preserve skin and torso clearance and independently verify UV metric distortion. No fabricated hand pose, supplier dimensions, photographic parity or tailor signoff.

## Release blockers
Native source sleeve centre spacing outside 464–536 mm; unresolved UV discontinuities and tangent charts; four-angle reference parity; vendor-measured repeat/grain, fabric mechanics, true human measurements and tailor signoff; live authenticated Supabase stock/operator evidence; full mobile/desktop release QA and explicit merge/deploy authorization. This remains a **draft-only engineering candidate**, not 95% release proof.

## Independent sequential evidence follow-up
The native preflight originally checked only the whole-sleeve receipt against the **final** evaluated mesh, even though the new exterior contour runs afterwards. This could misattribute or reject an independently safe second-stage mesh. Added strict `validate_outer_cuff_torso_receipts` with source method, original/selected torso counts, physical-approval false flags, unique selected native trial, skin and mutual sleeve contacts, strict 0..36 mm values and duplicate-key rejection. Preflight now verifies final BVH against the exterior receipt and verifies the whole-sleeve receipt against the exterior **baseline**, preserving a genuine two-stage chain. Added positive nonzero/zero and adversarial stale/forged/type-coercion tests. This does **not** certify the physical contour or weaken existing preflight failures.
