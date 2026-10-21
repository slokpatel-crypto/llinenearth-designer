# TITAN — standalone 3D model check versus production approval

The command `npm run garment:model-check -- <model.glb> [model.viewer.json]` is an **asset structural validator**, not a customer-release authorization. Its machine-readable JSON maintains `ready` for compatibility with the existing candidate export pipeline, but reports `mode: "structural_validation"` and **always** reports `productionApproved: false` and `promotionEvidenceEvaluated: false`. `--candidate` continues to identify the engineering candidate check and to use its original success/exit-code policy.

The standalone script cannot inspect independently stored QA evidence, therefore a structurally clean GLB/manifest is **not** enough to turn on a public 3D model. The separate, asset-bound `garmentViewerPromotionReadiness` gate in `src/lib/garment-viewer-readiness.ts`, surfaced through the operator evidence workflow, evaluates these technical QA signals:

- Measured stripe and check samples within the physical-scale tolerance (currently ≤8%).
- Interaction measurements for the **exact** GLB and manifest revision (at least 12, p95 below 300 ms).
- Independent realism ratings (at least 6 strong reviews from 8 distinct viewers).
- The four required observed garment boundaries: neck, cuffs, waist, trouser gap.

**Additional human sign-off:** owner/tailor verification of the physically measured garment, silhouette and model identity is required before any customer cutover. The technical readiness function does **not** currently enforce that separate owner/tailor sign-off, so its `ready` result is not sufficient authorization for deployment.

The readiness evidence is tied to `modelId`, `modelSha256`, and `manifestSha256`; evidence from an older revision does not approve a new model. The CLI cannot substitute fabricated approvals for these records. No new assets, model identity, physical measurements, customer routes, AI services, or deployment flags are introduced by this check.

**Operator rule:** `ready: true` from this CLI means *passed this command's structural validation only*. A customer promotion decision requires a separate exact-revision readiness record, real physical verification, and owner/tailor sign-off. Keep the lab and public viewer boundaries unchanged until those checks exist.
