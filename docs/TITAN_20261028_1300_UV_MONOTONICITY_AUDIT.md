# TITAN 13:00 IST — source UV seam monotonicity guard (2026-10-28)

## Source and release boundaries
Stacked exclusively on draft #440 at `4a2b93fffa91093f26d8091ae2b3588c59a11ed5`; #440 is on #439 and #311, not main. Locked `linen-earth-studio-model-v1` body/photo/geometry and all real stock, supplier, measurement and production records remain untouched. No merge, deployment, schema migration, paid inference or physical approval.

## Verified previous exact-head evidence
#440 matching-head CI `40644706269` and non-3D QA `40644706280` succeeded. Native source workflow `40644706318` ran Blender fixture tests, source author and preflight successfully but its final release gate intentionally failed; approved four-angle production render was skipped, diagnostic four-angle archive ran. Previous original-source preflight measured 563.54 mm sleeve-centre spacing outside the immutable 464–536 mm identity band, and source UV discontinuities 112/110 sleeve and 86/42 trouser-leg. No source physical improvement is claimed.

## Defect and code fix
The full-turn cylindrical phase alignment guarded previously continuous edges and global seam *count*, but could still accept a phase shift that stitched one edge while enlarging a different **already torn** source edge. A sample-limited audit or global max can miss this relocation. Each candidate component now independently compares *every* real shared source-edge endpoint jump against the **latest accepted** UV state; a worsening beyond the configured metre tolerance rejects the whole component. An equal seam count is not proof of repair, so phase changes now require a strict decrease in unapproved shared-edge count.

The local tangent chart aligner previously used a greedy seam-count gain and protected only already continuous edges. A rigid translation fixing two torn edges while enlarging a third was therefore accepted. Every adjacent edge must now be non-worsening; existing source tears are not fungible. Rigid metric UV scale, 8-degree grain-rotation cap, no invented supplier repeat, and nonmanifold rejection remain unchanged.

## Additional topology hardening
Phase and tangent UV aligners now reject ambiguous shared source edges when face winding is inconsistent or edges are nonmanifold. The phase receipt records `invalid_source_topology` without changing UVs; tangent receipts distinguish winding from nonmanifold rejection. New negative fixtures exercise same-direction shared-edge winding. This is source-mesh safety, not a claim of physical seam approval.

## Regressions and verification
New negative fixtures cover a periodic phase candidate that trades one source tear for a larger one, and a tangent face with two agreeing anchors plus one contradictory anchor. Existing positive exact-period and bounded rigid-alignment tests remain. Run `python -m unittest discover -s tests/python`, matching-head CI, and original-source Blender author/preflight. A green software CI does **not** establish sewn seam correctness, fabric repeat, four-angle photographic parity or tailor acceptance.

## Next engineer handoff
Read exact-head CI and native logs; if tests fail, fix only isolated branch and rerun. Next use actual source cut-chain receipts to identify sewing-compatible source edges and chart orientation, without force-stitching tangent faces, scaling fabric UVs to guessed repeat, weakening preflight, or claiming 95%. Maintain independent supplier-measured repeat/grain and human fit/identity signoff gates.
