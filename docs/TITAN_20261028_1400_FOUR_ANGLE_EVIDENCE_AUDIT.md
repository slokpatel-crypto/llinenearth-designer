# TITAN 14:00 IST — source-bound four-angle visual evidence (2026-10-28)

## Independently verified starting point

Draft #441 at `89f4f4f500068a8a91b2d253c64e0c59cc716228` passed exact-head web CI (run 40650719505) and non-3D browser QA (40650719563). Native Blender run 40650719510 successfully executed the source author, preflight and four diagnostic camera renders, but the final **production candidate gate failed as intended**. Preflight measured 563.5 mm sleeve spacing against 500 ± 36 mm, 112/110 unapproved sleeve shared-edge UV discontinuities, and independent metric distortion across the garment. Source-rendered PNGs are **diagnostics**, not photograph parity or physically calibrated fabric. No existing 3D/photo source was changed.

## Defect closed

The comparison-sheet script previously accepted any PNG over 12 KB as the candidate, without checking it came from the same source Blender scene or matched the four-angle manifest. A stale, swapped or partial render could therefore be archived as if it were the current scene's four-angle review evidence, even though the receipt correctly disclaimed human approval.

- `scripts/qa/model_turntable_evidence.py`: fail-closed pure-Python verification of locked identity, original .blend SHA-256, all four exact camera yaw/view/file pairs, PNG dimensions and per-view SHA-256, non-duplicated frames, and exact front frame. The comparison script also requires the checked-out canonical `public/designer/studio-tucked.webp` photograph rather than an arbitrary supplied image. Reject duplicate JSON keys, non-finite numbers, coerced approval booleans, path traversal, missing frames and any forged approved flag.
- `scripts/qa/model-reference-contact-sheet.py`: require manifest and source scene; verify **all four** PNGs are decodable using Pillow before archiving the front comparison. Record manifest/source/per-view hashes in the review receipt; still explicitly unapproved.
- `.github/workflows/model-source-candidate.yml`: wire manifest and original scene into the actual native CI archive step, trigger on the new verifier, and syntax-check QA scripts.
- `tests/python/test_model_turntable_evidence.py`: positive complete-source fixture and adversarial negative regressions, including canonical-photo substitution.

This proves artifact binding only. Distinct PNG hashes are not photographic parity, source model likeness, true fabric physics, supplier calibration, body/cloth collision safety or tailor approval. The canonical `linen-earth-studio-model-v1` image and all geometry remain unchanged. No paid provider, production data, migration, merge or deployment.

## Handoff

Inspect **matching-head** Python and native workflow results. If a verifier regression fails, repair only this isolated branch and rerun. Next address actual garment source geometry/UV distortion rather than relaxing the release gate; maintain owner/tailor photographic review and real fabric measurements as separate evidence.
