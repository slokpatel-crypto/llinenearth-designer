# TITAN 3D — maximum retained real source-edge UV forest comparison

**RESEARCH ONLY. No approval of cut fabric, model fit, tailoring seams, physical textile grain, UV charts, or production export.**

## Authoritative parent

This isolated branch stacks on draft [#896](https://github.com/slokpatel-crypto/llinenearth-designer/pull/896) exact `0b9f94cd2d52ed3487aac05d197409c1e7dd5698`. Locked Studio model `linen-earth-studio-model-v1`, canonical original photo, six original production garment meshes, body geometry, original stage UV (none), `LinenEarthExport`, inventory and all other workstreams are unchanged.

The pinned Blender 4.5.14 original source job [41702187405](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41702187405) **PASSED as diagnostic/rejection evidence**, not as a garment fit gate. On the genuine original 2,650 source quads / 2,717 original source vertices:

| Actually measured source-geometry research finding | Native result |
|---|---:|
| Original two-owner quad shared edges | **5,234** |
| Real original source connected components | **3** (1,220, 715, 715 faces) |
| Real-face UV BFS spanning tree edges joined | **2,647** |
| Remaining original UV cycle seams, all unclosed | **2,587** |
| Combined REAL original mesh edge geometry length of proposed unclosed UV cuts | **40,750.56966mm** |
| Original UV candidate cut graph connected networks | **66** |
| Candidate source vertices touched by unclosed UV cut graph | **2,653** |
| Branching cut graph junction vertices (degree 3 or more) | **134** |
| Largest unclosed UV chart gap | **1,516.99436mm** |
| Real original source BVH body-contact pairs | **29,600**, unchanged |
| Original source left/right stage UV layers | **0 each** |
| Original full six-production-mesh hard preflight blockers | **10** |

**40.75 metres is a SUM OF UV-DISCONNECTED ORIGINAL MESH EDGE GEOMETRY, not a real textile cutting requirement.** The source remains unfit/UV-unapproved; do not mistake these metrics for a manufacturer handoff.

## New independent true mesh-alternative

Instead of joining the first neighbor encountered in original face-index BFS, `scripts/blender/source-trouser-max-retained-uv.py` applies **Kruskal's maximum spanning forest on ACTUAL original source two-face edges, weighted by REAL 3D source edge length** (geometry metres expressed in mm). It keeps all original components connected while preserving their longer shared edges. Maximum retained edge length is equivalent to minimizing the 3D length of **omitted non-tree original mesh edges** among forest selections. This is a mathematical lower bound for this particular face-tree technique, **NOT an optimal practical cutting pattern**.

To make this a REAL Blender geometry comparison rather than a number-only heuristic:

1. Existing `source-trouser-dual-tree-uv.py` now optionally accepts the selected shared-edge forest, fails closed on missing, duplicated, noncanonical, nonshared or cycle/disconnected selections, and rigidly joins source quads along those exact original faces without rescaling.
2. Official pinned Blender constructs a **SECOND independent unsaved, nonexport 2,650 original-quad / 10,600 research UV-loop mesh**. It traces actual body contacts, exact original source 132 open edges, 8 original unmatched cut edges and 3 components. No original six garment asset changes.
3. Run the existing full source UV cut network audit on BOTH strategies. Measure real original 3D source edge lengths and actual **unclosed** UV candidate cuts, seam branching/networks, largest/rms UV gaps. We do NOT assume the alternative improves seams: geometry may have long cycle gaps or new unclosed paths.
4. Compare the actually measured BFS original 40,750.56966mm versus Kruskal-weighted true unclosed cut-network length. The max-tree `minimumOmittedOriginalSourceEdgeLengthMm` is a bound on all forest omissions; actual unclosed UV edges may differ only when non-tree loops happen to close naturally.
5. All textile/genuine tailor cutting, source UV continuity, cloth physics, measured grain/repeat, source-to-bridge UV, body fit, original-model photographic identity and production flags remain false. No Vercel deployment or main merge.

## Native Blender experiment — verified actual weighted source geometry

Original pinned Blender 4.5.14 [exact-code run 41703890457](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41703890457) **COMPLETED SUCCESS as diagnostic/rejection evidence**, not a physical garment approval. It used exact source code commit `5874517bc65814fefe7da58d80f894f618e6772f`, original 2,650 quad faces, original 2,717 source vertices, original scanned body BVH, and independent unsaved Blender research UV witnesses.

| Real original-source comparison | Old breadth-first UV forest | New maximum-retained true-3D-edge-length forest |
|---|---:|---:|
| Genuine source connected components | 3 (1,220 / 715 / 715 faces) | same |
| Strictly joined original shared source tree edges | 2,647 | 2,647 |
| Remaining non-tree shared original source edges | 2,587 | 2,587 |
| Naturally closed original non-tree UV edges | **0** | **2** |
| **Actually unclosed** original source UV seams | **2,587** | **2,585** |
| Total original 3D mesh lengths of those UV candidate edges (mm) | **40,750.56966** | **32,491.00439** |
| Longest 2D UV seam gap (mm) | **1,516.99436** | **1,072.40848** |
| RMS unclosed seam gap (mm) | **168.47247** | **102.53023** |
| UV cut-candidate graph connected networks | **66** | **40** |
| **Branching UV-cut vertices, degree≥3** | **134** | **323** — **WORSE** |
| Real source/body BVH face intersection pairs | **29,600** | **29,600**, unchanged |
| Actual source loop UV research geometry | 10,600 loops | 10,600 loops |
| Production fabric/fit/cut approval | false | false |

**Measured cut candidate length decreases by 8,259.56527mm (~20.27%).** This DOES NOT make the weighted tree a tailored pattern: its high-branching topology is substantially worse (323 vs 134 potential cut junctions), even though the total cut-candidate length, UV seam gaps and number of connected cut networks improve. These changes are all in *research UV loop coordinates*; original garment geometry, production UV, actual material and tailor cutting remain untouched.

Independent maximum-retained selection physics-free graph metrics:

- Total real original two-owner shared source-edge length: **77,338.40804 mm**
- True original source edge length retained in max spanning forest: **44,828.26310 mm**
- Theoretical minimum total omitted source-edge length for any spanning forest on that actual source graph: **32,510.14494 mm**
- Actual measured unclosed weighted cut network: **32,491.00439 mm**, slightly lower because two non-tree UV edges happen to close within the research 0.001mm numerical threshold
- Distinguish these *source mesh* lengths from any approved cloth cut seam lengths, which do not exist

The longest weighted remaining UV gap is still **1,072.40848 mm**, and 2,585 face junctions remain unclosed. Weighted source/body intersections remain 29,600; original six garment hard preflight fails ten gates. Both original 1,325-face trouser-stage meshes still have no original production UV layer. The max-weight alternative is a **diagnostic UV topology improvement on length metrics with a worsening of seam branching**, not garment production readiness.

### Acceptance

- [x] Measured real original UV cut network length, components and junctions from parent Blender run
- [x] Added deterministic pure maximum-retained-original-edge graph selector and actual source-mesh validation
- [x] Added safe explicit-tree option to original 3D quad UV joining routine
- [x] Added SECOND native unsaved research source UV mesh and old-vs-new same-body metrics
- [x] Added Python planar/curved real-topology fixture, adversarial original source tests, Node and native assertions
- [x] Exact-code native Blender source experiment verified 8.260m shorter UV candidate edge length and 445mm lower worst UV gap, but more branching junctions (323 vs 134), no physical approval
- [ ] New exact-head Full CI, Non-3D and independent collision QA pass as diagnostic engineering evidence only
- [ ] Genuine continuous low-strain original trouser pattern UV, selected manufacturing cuts and seams, measured fabric grain/repeat, source collision removal, original photo and tailor QA all **outstanding**
- [ ] Resolve original ten six-piece mesh hard production preflight failures

**No production merge/deploy. No physical approval. No fabric fact invented.**

## 2026-11-07 bounded two-cut compensation survey

The complete 24-candidate one-cut scan found only ranks **0, 2, 6, 15 and
18** within the rank-zero 33.40768mm real source-edge comparison budget. This
follow-up evaluates all **10 unique pairs** from exactly that measured set.
Each pair sequentially opens two distinct genuine retained component-0 tree
edges and applies only rigid UV translations; original 3D vertices, faces,
body BVH evidence, source assets and exports remain unchanged.

A pair is research-eligible only if a complete overlap scan strictly improves
the 6,957-pair baseline, exactly two new UV seams are measured, combined added
real source-edge length is at most **66.81536mm**, maximum UV gap does not
exceed the 1,072.40848mm baseline, and cut-network branch junctions do not
exceed 323. A least-bad result is never selected: if no pair passes every
condition, `strictSelectedCandidate` remains null. These are comparison bounds,
not physical seam allowance, fabric width, grain, fit or tailor approval.

Native Blender results and exact-head CI must be recorded before interpreting
the survey. No candidate is saved, exported, merged or deployed automatically.

### Pinned native result: no compensating pair passed

Official Blender 4.5.14 source workflow
[#42371539640](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42371539640)
completed successfully on exact code commit
`dfdeab18f6469254015820983e6a4bfa82055cad`. It evaluated all 10 pairs with
complete 5,300-triangle overlap scans. Every pair reduced observed overlap
pairs, by **223 to 342**, and every pair stayed within the 66.81536mm combined
edge-length budget. Nevertheless **0/10** passed the hard comparison contract:

| Native two-cut result | Measured value |
|---|---:|
| Baseline overlap pairs | 6,957 |
| Candidate overlap-pair range | 6,615–6,734 |
| Baseline maximum UV gap | 1,072.40848mm |
| Candidate maximum UV-gap range | **2,025.45830–3,187.69328mm** |
| Baseline branch junctions | 323 |
| Candidate branch-junction range | **324–327** |
| Strictly eligible candidates | **0** |

Ranks `[0,18]` produced the largest overlap reduction, 6,957 to 6,615, but
raised maximum gap to 3,024.44334mm and branch junctions to 324. Ranks
`[15,18]` had the least maximum-gap damage, but still raised it to
2,025.45830mm and raised branch junctions to 325 while reducing overlaps by
259. `strictSelectedCandidate` is therefore null; no least-bad pair is
promoted. Sequential outside packing of more balanced subtrees is rejected as
a path to UV continuity. A next bounded experiment must constrain rigid
placement by the original maximum-gap envelope instead of adding more cuts.

This is diagnostic rejection evidence only. Original source geometry/body
contacts, the canonical Real Model Designer identity, production assets and
all physical/tailor approval gates remain unchanged and false.


## 2026-11-05 follow-up: bounded junction-aware source UV candidate

**Research experiment only; no production geometry, UV or fabric approval.**
The original maximum-length tree demonstrably reduced unclosed UV candidate length but raised cut-network branching from 134 (BFS) to 323. A practical manufacturer pattern cannot be inferred from length minimization. The next controlled research question is whether a **single deterministic original shared-edge swap** yields a better *chosen* combined geometry-branch surrogate, and what its independently measured original 2D UV gaps actually do.

On the **existing PR #897 branch**, changes are restricted to the original-source Blender graph selector, existing research Blender driver, dedicated Python/Node regression tests, official pinned native-source workflow and this checkpoint:

- Added a bounded candidate search (maximum 48 real omitted original shared edges) that considers one forest-tree edge exchange at a time. Scoring is actual source 3D omitted-edge length in mm **plus a specified virtual 100-mm-per-excess-branch-arm research penalty**. This penalty is *NOT measured seam allowance, fabric waste, labour cost, physical dimension or tailoring proof*. Parent face connectivity, 2,650 actual quads, original cuts and source coordinates are preserved.
- Candidate selection is deterministic and fail-closed on bad weights, bounds, malformed original mesh and disconnection. A swap is accepted only if the research surrogate strictly improves; it may retain the original tree unchanged. It does **not** claim to optimize actual UV closure or real-world garment quality.
- The real native Blender driver passes original source vertices/faces to the selector, reconstructs 2D diagnostic UV loops against the same original quads and audits actual UV gap, 3D original candidate edge lengths, branch vertices and source boundary IDs. It does **not** save or export any new garment or UV source, alter the original locked scanned body or alter existing rejected experiments.
- Native original-source workflow now checks full 2,650-face/5,234-shared-edge/3-component/2,647-tree-edge provenance, 132 open original source edges, 29,600 unchanged source/body pair baseline, the non-worsening surrogate objective, actual reconstructed UV audit consistency, and every false physical/production flag.
- Existing weighted tree and rejected 7/9/11 mm collision experiments remain untouched. New outcomes are unverified until official native Blender and exact-head CI finish. **Do not supply predicted numeric improvement as a measured finding.**

**Scoped commits:** `b530d426` selector; `ad959293` Python fixtures; `e3f408d5` genuine source driver; `a46ddcb2` Node invariant guard; `7e898981` native workflow. The first changed-code head `7e8989810cbb2df060e7d8fdee335590f6277762` triggered Full CI #42015818336, source-rejection #42015818171, Non-3D #42015818071 and collision #42015818036; at checkpoint those were pending or in progress. They **do not** certify this subsequent documentation-only commit; inspect its own exact-head jobs after this checkpoint update.

**Next experiment / acceptance:** inspect exact-head native original-source JSON and CI logs; report measured branch/cut length and worst UV gap compared with both weighted and BFS, reject if branch count or actual UV overlap remains unacceptable. Then examine a true multiobjective low-strain unwrap with measured body clearance and supplier/tailor UV constraints. The original 20 bridge-body contacts, 29,600 unchanged source/body pairs, 132 source open edges and ten production preflight blockers remain as documented, with no production promotion. **NO MERGE / NO VERCEL DEPLOY.**


## 2026-11-05 pinned native result: one-swap trade-off, NOT an improved pattern

**Evidence:** Official exact-code original-source Blender 4.5.14 workflow [#42015981305](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42015981305), at commit `8acdf589dd86b90c5e2cdf4378d69ee2a7e4141a`, completed **SUCCESS as diagnostic source rejection**. Real source has 2,650 quads, 2,717 original vertices, 5,234 shared edges, three source-face components, 132 actual source open boundary edges, 29,600 unchanged original source/body BVH pairs. Existing ten six-production-garment physical preflight blockers and twenty experimental bridge/body collisions are *not repaired*.

| Measured actual original source UV | Weighted tree | One-swap branch-aware trial | Correct interpretation |
|---|---:|---:|---|
| Retained source UV tree edges | 2647 | 2647 | Real source topology preserved |
| Unclosed source UV cycle seams | 2585 | 2585 | No new seam closure |
| Candidate cut-network branch junctions | 323 | **322** | One fewer branched original vertex |
| Candidate cut-network source mesh length | 32491.00439 mm | **32491.07090 mm** | Worse by +0.06651 mm |
| Maximum UV seam gap | 1072.40848 mm | 1072.40848 mm | No improvement |
| RMS source UV seam gap | 102.53023 mm | **102.74000 mm** | Worse by +0.20977 mm |
| UV cut-network components | 40 | 40 | No improvement |
| Physical sewn model/fabric/fit approved | false | false | Never inferred |

The bounded 48-candidate one-edge exchange selected authentic shared edge **[143,582]** for retention and removed **[124,462]**. Its virtual score fell from 72,310.14494 to 72,110.21144 using a *chosen unverified* 100-mm-per-excess-branch-arm penalty. That single derived score improvement does **not** demonstrate real sewing, UV grain, cloth fit or reduced measured UV damage. Actual measured multi-metric Pareto comparison is **rejected** because edge length and RMS gap worsened. The pinned Blender workflow passed evidence checks, not production approval.

### Source-truth hardening applied after measurement

- Pure `compare_measured_original_source_uv_research_candidates` measures independent actual length/junction/gap/seam-count differences from native original source reports, rejects nonfinite metrics, inconsistent original source topology, forged physical or production flags, and false UV-overlap certificates. No claim of overlap-free UV is made.
- Native source Blender captures `independentMeasuredUvParetoComparison` separately from the virtual research objective; official source workflow asserts **no measured Pareto improvement and an actual trade-off** on the unchanged pinned original mesh. Dedicated Python negative fixture tests and Node script-invariant guards added.
- Commits: `ef9ec00d`, `9f1adc02`, `9ae49ccc`, `80c0f541`, `b2ffa7d9`. At the time of this checkpoint, exact-code commit `b2ffa7d91ee81163f9570f733c739b6da9a0f1d0` has native Blender collision QA **SUCCESS** #42017066601; source-candidate #42017066460, Full CI #42017066664 and Non-3D #42017066611 still in progress. These checks **do not certify this following checkpoint-only commit**. Verify newest head separately before research acceptance.

**Remaining native acceptance item:** actual low-strain/overlap-controlled UV geometry tied to verified source panels and a truly sewn, collision-cleared crotch with legitimate thickness, fabric grain/repeat and tailor signoff. New code cannot auto-approve original research or export to `LinenEarthExport`. Preserve canonical `linen-earth-studio-model-v1` and the original photo. **Draft. No merge, no deploy, no physical approval.**


## 2026-11-05 next native acceptance: measure actual UV triangle interior overlap

Prior pinned original-source Blender evidence proves the one-swap junction trial is **not** a strict measured source-UV Pareto improvement (322 vs 323 junctions, but +0.06651mm unclosed source-edge mesh length and +0.20977mm RMS 2D seam gap). It also proves a major unresolved gap: two-dimensional triangle **interior overlaps** had *not* been measured, so the 2,647 UV tree edge joins are NOT evidence of a usable physical flat pattern.

New scoped source-only research adds \`scripts/blender/source-trouser-uv-overlap-audit.py\`. For **both the existing weighted UV source tree and the one-swap branch UV tree**, the official Blender driver feeds their *actual* reconstructed original-source 2,650 quads and 10,600 UV loops into the same deterministic UV audit:

- Each original 2D quad is two verified finite, consistently oriented triangles. A bounded 100mm **numerical broadphase grid** only speeds candidate search; it is **not** physical textile repeat, seam allowance or grain.
- True triangle intersection area is calculated from clipped UV polygon interiors, ignoring mere edge touches. Any witnessed overlap reports the original source face IDs, native face-triangle indices, measured 2D overlap area in mm², first 12 witnesses, observed pair counts and an overlap-area **sum that may double-count** multiply stacked source triangles.
- The narrow-phase is bounded to 100,000 actual triangle-pair checks; if exhausted, \`auditTruncated=true\` and all pair counts/areas are expressly **lower bounds**. Incomplete scans may never claim no overlaps. Even a complete zero-intersection 2D research result cannot certify a production fabric pattern or physical garment.
- Python fixture tests prove 2,650 non-overlapping separated face islands, deliberately stacked real-source UV faces, budget-exhaustion fail-closed reporting, malformed topology, inverted/degenerate/nonfinite UVs, and invalid budgets. Node guards prove native workflow source hooks and rejection flags. Pinned native workflow verifies source 2,650 quads/5,300 triangulated 2D faces, pair bounds, witness provenance, unknown-safe approval flags, plus unchanged existing native body collision/preflight gates.
- No original \`LinenEarthExport\`, garment source coordinates, scanned body, canonical photo/model \`linen-earth-studio-model-v1\`, production UV layer, fabric fact or deployed code is modified. The audit remains **research-only** and does not invent real tailoring instructions.

**Current staged commits:** \`70ae54d8\` pure intersection diagnostic, \`6718c07c\` Python geometry/adversarial tests, \`86b91d88\` original-source Blender driver wiring, \`6eddd57f\` pinned official workflow, \`31ab9bb1\` Node safeguards. Native measurements and exact-head full CI must be inspected before any assertion about overlap count or comparative result. All physical/fit/textile/six-garment production approvals remain false. **No merge, no GLB promotion, no Vercel deploy.**


## 2026-11-05 verified source UV interior overlap results — both physically rejected

Official checksum-pinned Blender 4.5.14 original-source native diagnostic workflow [#42018980430](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42018980430) **SUCCESS** at tested code head \`31ab9bb161fb6c09409825846656d6570fb099b6\`. The complete original geometry-only source audit examined **all 5,300 source UV triangles** for both the weighted Kruskal UV tree and the 48-candidate one-edge branch-penalty tree; neither scan hit its **100,000 candidate-test cap**, so observed exact 2D source-triangle pair counts are complete under this implemented strict-area tolerance. These are **UV reconstruction research numbers**, not source garment physics or textile consumption.

| Real original-source reconstructed 2D UV metric | Weighted tree | One-swap branch-aware trial |
|---|---:|---:|
| 2D source UV triangles audited | 5,300 | 5,300 |
| Narrow-phase candidate triangle pairs tested | 26,896 | 27,158 |
| Positive-area UV triangle-overlap pairs observed | **10,238** | **10,409** |
| Distinct overlapping original source-face pairs | **4,164** | **4,237** |
| Sum of clipped triangle-pair overlap area (mm²) | **127,276.94499** | **129,183.99200** |
| Largest single observed triangle-pair overlap area (mm²) | 416.77621 | 416.77621 |
| Audit truncated | **false** | **false** |
| No-overlap claim for this research UV layout | **false** | **false** |
| Production garment/fabric/tailor/UV approved | **false** | **false** |

**Observed branch trial regression:** +171 overlapping triangle pairs, +73 distinct overlapping source-face pairs, +1,907.04701 mm² in summed pairwise clipped overlap area. Sums can double-count the same 2D space under layered triangles, and must **not** be advertised as textile wastage, required cutting fabric, fit dimensions or body-contact area. Even complete coverage of these research loops cannot certify production UVs, sewing, physical repeat/grain or cloth drape. Earlier weighted-tree/BFS comparison remains separate.

### Machine-checked rejection

\`compare_original_source_uv_overlap_evidence\` explicitly validates original-source face/triangle counts, finite integer metrics, complete-vs-truncated scan state and false physical approvals. It returns a comparable overlap delta **only when both scans completed**; otherwise \`candidateOverlapTrianglePairDelta=null\` and worsening/improvement/overlap-free conclusions remain \`null\`. Research driver carries this result alongside the source native Pareto verdict. Python tests reject forged production flags, fabricated completion, invalid source counts and negative overlap numbers. Node and pinned native workflow assertions fail closed if the *pinned original model* unexpectedly reports a clean UV layout or the worsened trial is mislabeled as improved.

New scoped commits: \`11c92df1\` pure comparator, \`169ba149\` adversarial fixtures, \`e2aa4448\` original-source Blender report wiring, \`34016c59\` pinned native failure gate, \`ef1cd846\` Node regression. The earlier original source/audit code \`31ab9bb1\` verified the above actual metrics. Later commits must pass their own exact-head source QA, CI and Non-3D; old native results do not certify later heads.

**Next research goal:** actually reconstruct a connected, non-self-overlapping **original source** UV topology with low seam length, no masked distortion, true seam ownership and source collision clearance. Current 2,585 unclosed tree seams, ten production preflight hard blockers, 20 experimental bridge/body intersections, original 29,600 source/body BVH pairs and lack of physical textile/tailor evidence persist. Do not replace original production UV/GLB/model or claim worn fit. **No merge, Vercel deploy or production approval.**


## 2026-11-05 disconnected original-source UV component packing trial

**Baseline reverified:** official exact-head \`67a3476aae7f725797b319392718795c51de1ee8\` completed four SUCCESS workflows: full CI, Non-3D QA, standalone pinned Blender collision QA and source-rejection native QA. This includes the measured 10,238 weighted UV and 10,409 branch-aware overlapping source-triangle pairs. They are **source research diagnostics**, not production UV certification.

**Next bounded physical-source research implementation (this branch, original source untouched):**

- \`scripts/blender/source-trouser-component-uv-pack.py\` traverses the **genuine 3D original face shared-edge graph** rather than source photo regions or synthetic model garment parts, identifies face-graph connected components, and rigidly translates their entire existing research UV charts to mutually disjoint 2D bounding boxes. On the scanned original, prior native reconstruction established three true components with face counts **[1220,715,715]**. Those counts are independently rechecked in pinned native QA. A chosen 5mm **numerical display margin** is not real cloth repeat, fabric width, seam allowance or pattern spacing.
- The operation never scales, rotates, stretches, re-meshes or modifies a single source vertex, face, canonical photo, model ID \`linen-earth-studio-model-v1\`, garment UV layer, production mesh, Blender saved scene, GLB or source/body collision BVH. Within each genuine component, all triangular metric edges and UV cycle seam gaps must remain unchanged. Native source driver independently repeats the actual UV cut-network audit to detect seam damage.
- The existing 5,300-source-triangle, capped 100,000-pair UV overlap diagnostic runs on **both packed** and **both unshifted** original research UV variants; the complete-scan-only source comparison rejects any increased observed overlap. A truncated scan stays **unknown** and never asserts improvement.
- Pure Python tests start from existing original-source-like 53×50 finite planar geometry, prove the one-component identity case, build a **clearly synthetic software fixture** with two genuine disjoint face-graph regions by giving the second half new test vertex IDs, intentionally overlay their UVs, and verify geometry-only packing separates them. Adversarial invalid/degenerate/nonfinite UV, nonmanifold face and fabricated margin checks fail closed. Dedicated Node invariant tests and pinned official native checks cover model/source truth and false production approvals.
- **This does not fix** within-component overlaps, missing physically closed UV cycle seams, garment source body contact, original crotch repair, cloth grain, texel scale or the ten remaining full production preflight blockers. All evidence is **researchOnly**; all tailor, physical fit, material and production approval flags remain false.
- Implementation commits: \`099d7a9a\` pure original-source component pack; \`e2120d9e\` Python geometry fixtures and negatives; \`cd802236\` native source driver seam/overlap comparisons; \`88b4d48c\` pinned workflow; \`6165b9fd\` Node guard. Native original-source measurements on those commits remain **unverified until exact-head workflow completes**. Do not invent overlap reduction before native evidence.

**Research gate:** reduce 2D cross-component intersections with no changed original mesh, cut-network length, seam closure, face triangles or physical flags. Inspect exact-head pinned Blender source evidence before recording numeric improvement. This is a step toward geometry-only UV research, **not** a source garment production pattern. **NO MERGE / NO VERCEL DEPLOY / NO SOURCE EXPORT OR PHYSICAL CUT APPROVAL.**

## 2026-11-05 verified component-packing measurement — real improvement, still unapproved

Source: official checksum-pinned original-source Blender 4.5.14 workflow [#42023534600](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42023534600), **SUCCESS** at tested code head `6165b9fdb6dc1920ff68b2f349dd9a99dee2b355`. Both bounded 2D original-source triangle scans completed, with **no truncation**.

| Original-source research UV result | Unpacked | Rigid component-packed | Improvement |
|---|---:|---:|---:|
| Weighted tree overlapping triangle pairs | 10,238 | **6,957** | **3,281 fewer** |
| Branch-aware one-swap overlapping triangle pairs | 10,409 | **7,128** | **3,281 fewer** |
| Original 3D face-graph source components | [1,220, 715, 715] | [1,220, 715, 715] | unchanged |
| Triangle edge distortion caused by UV packing | n/a | **0 mm** | never stretched |
| Physical tailor/fabric/source-body fit or production approved | false | false | unchanged |

Both tree variants remove exactly **3,281 cross-component 2D UV triangle-pair overlaps**, solely by moving *whole* disconnected authentic source-face-graph UV components into separate 2D bounding boxes. Their rigid trial transforms are **research UV coordinates, not real garment/cutting dimensions**. The chosen numerical 5mm component display separation must **not** be treated as supplier repeat, fabric width, grain, seam allowance, minimum cloth spacing, or production consumption.

**Still invalid for real manufacturing:** 6,957 weighted and 7,128 branch-aware *remaining* positive-area overlap pairs; 2,585 original-source unclosed cyclic UV seams, unchanged original crotch collision research, 29,600 original source/body BVH pairs, ten hard production preflight blockers, absent verified fabric calibration and tailor approval. No source-body 3D geometry changed; no GLB/UV production export or original `linen-earth-studio-model-v1` photo replacement. No claim of overlap-free/strain-free fully sewn trouser panels.

Research code proof: `source-trouser-component-uv-pack.py` computes true original face-graph connected components; dedicated planar two-component artificial test validates reversible rigid translation and error handling; native Blender compares actual independently reconstructed overlap counts **and** re-audits unchanged UV cut network/gaps. Follow-up commits `4ce59db2`, `270295e7`, `2e00f31b` additionally reject contradictory shared-edge winding and test that rejection. The measured complete source result above is certified only at its **tested code head**; later heads (including this documentation-only commit) require their own exact-head native source, collision, full CI and Non-3D checks.

**Next acceptance item:** Reduce **within-component** original source UV overlap without disguising cyclic seam disconnection, metric strain, true cloth grain or actual body collision. Retain current component-packing improvement as a **research-only witness**, not a promoted production pattern. Draft PR #897 remains open; **no merge, Vercel deployment, source export or physical fit approval**.

## 2026-11-06 bounded component-0 one-cut subtree trial

The next isolated experiment opens exactly one genuine retained UV-tree edge
inside the measured 1,220-face source component 0. The deterministic selection
maximizes the smaller side of that tree cut (bounded at 610 faces), then rigidly
translates only that smaller subtree beyond the packed research layout. The
official native run must report the removed original vertex edge, its actual 3D
source length, moved/stationary face counts, overlap delta, and exactly one new
unclosed UV seam. Triangle edge length may not change by more than 0.000001mm.

This tests whether one balanced chart split removes more measured internal UV
intersection than the exact source-edge cut length it exposes. It does not call
the resulting subtrees tailor panels, select physical seam allowance, infer
fabric width/repeat/grain, change any source/body geometry, save a Blender
scene, export a GLB, or alter `linen-earth-studio-model-v1`. A lower overlap
count is not sufficient for production: the remaining cyclic seams, body
collisions, physical cloth behavior and tailor approval stay hard rejected.
Exact-head pinned Blender evidence is required before recording any numeric
result. **Research only; no merge, export, deploy or physical approval.**

First exact-head source run `42217686837` correctly failed before emitting a
measurement: the existing cut-network auditor rejected candidate UV loops when
they were paired with the unchanged 2,647-join baseline tree report. The fix
now supplies a derived diagnostic report with 2,646 retained joins and one
additional unclosed seam; it does not weaken the auditor or rewrite the
baseline evidence. A fresh exact-head native run is mandatory.

## 2026-11-07 capped component-0 tree-cut survey

The balanced 610/610 split reduced 230 overlap pairs but worsened maximum UV
gap, cut length and branch count. The next bounded survey therefore evaluates
the first **24** deterministic most-balanced genuine component-0 retained-tree
cuts against the same packed weighted baseline. Every candidate receives a
complete 5,300-triangle overlap audit and an independently reconstructed
source cut-network report.

A candidate is only research-eligible when all five checks pass: overlap count
strictly falls; exactly one new seam opens; its real edge is no longer than the
33.40768mm rank-0 comparison budget; maximum UV gap does not exceed the
baseline; and cut-network branch junctions do not increase. These are bounded
software comparison rules, not tailor tolerances or physical pattern approval.
If no candidate passes, the result must explicitly remain `null` rather than
selecting the least-bad cut. Source geometry, body BVH, production UV, saved
scene, GLB, model identity and physical approval flags remain unchanged.

## 2026-11-05 next bounded diagnostic — attribute remaining overlap by real source component

The packed weighted layout still has 6,957 positive-area triangle overlaps and the branch-aware layout has 7,128. Before changing another UV tree, the overlap audit now derives component ownership only from genuine shared 3D source edges and reports, for every authentic source component, its face count, internal overlapping triangle/face pairs, pairwise area sum and largest observed overlap. Cross-component counts remain separate. Complete packed scans must report zero cross-component overlaps and reconcile every remaining overlap to exactly one component; capped scans remain lower bounds.

This attribution does not split faces, infer trouser panels, alter UV coordinates, source vertices or collision geometry, or declare the largest component a real cutting piece. It identifies the measured dominant software-reconstruction defect for the next isolated UV experiment. Exact original-source Blender results and matching-head CI are required before recording component numbers. Physical grain, repeat, seam allowance, sewn crotch, body clearance and tailor approval remain pending. **Research only; no export, merge or deploy.**

## 2026-11-08 rank-18 constrained placement survey

The capped one-cut evidence left rank 18 as the only tested component-0 cut
inside the 33.40768mm rank-zero source-edge budget without adding a cut-network
branch junction. Its full rigid outside-pack translation reduced overlap but
exceeded the original 1,072.40848mm maximum-gap envelope. The next bounded
experiment therefore tests exactly 16 deterministic fractions of that same
translation, from 1/16 through 16/16. It neither searches arbitrary coordinates
nor changes the selected genuine source edge.

Each fraction must complete the full 5,300-triangle overlap scan, expose exactly
one independently measured seam, retain the real-edge budget, and stay at or
below both the original maximum-gap and branch-junction baselines. Only a
strict overlap reduction passing every bound may be selected; otherwise the
selection remains `null`. Fractional translation is a software research
coordinate, not physical panel placement, fabric width, repeat, grain, seam
allowance, supplier data or a tailor tolerance.

The operation is rigid and leaves source vertices, faces, IDs, body BVH,
production UVs, saved Blender scene, GLB and the exact Real Model Designer
identity unchanged. All physical fabric, body-fit, tailor and production flags
remain false. Exact-head pinned Blender evidence is required before recording
numeric results. **Research only; no export, deployment or unapproved merge.**

Pinned Blender 4.5.14 source run `42477964533` passed at exact remote head
`934a1026cca18c12fff882d2531853056a65b342`, but rejected every fraction:
**0/16 eligible** and `strictSelectedCandidate=null`. All rows retained 323
branch junctions, exactly one new seam and the measured 33.28815mm source edge.
Only fractions 14/16 through 16/16 reduced overlap; the best result was 6,845
pairs versus the 6,957 baseline. Those fractions raised maximum gap to at
least 2,102.30188mm. Even the smallest 1/16 move raised gap to 1,144.84851mm,
above the 1,072.40848mm baseline. No UV was exported or promoted.

## 2026-11-09 rank-18 near-zero placement survey

The previous measurement leaves one bounded interval untested: translations
smaller than 1/16 of the deterministic rank-18 outside-pack move. This survey
tests exactly 16 fractions from 1/256 through 16/256. It retains the same full
5,300-triangle overlap scan, one-real-seam proof, 33.40768mm rank-zero edge
budget, 1,072.40848mm maximum-gap envelope and 323 branch-junction ceiling.

The survey selects a row only when overlap strictly improves and every other
gate passes. Otherwise selection remains `null`; there is no least-bad fallback.
This closes the measured near-zero interval for this one fixed translation
direction, not arbitrary 2D placement, cloth nesting or garment pattern design.
Source geometry, body collision state, model identity and production files are
unchanged. Physical fabric, fit, tailor and production approval remain false
until separate real evidence exists. **Research only; no export or deployment.**

## 2026-11-09 fail-closed true seam-origin evidence (research only)

The preceding exact source head `b28cda8d4824572752b46f58666425b2d620f5b3`
passed **all four matching-head CI workflows**: native collision #42630099281,
real-source rejection #42630099105, Full CI #42630099118 and Non-3D QA
#42630099371. This verifies the previous independent numerical gate, not the
new implementation below.

The earlier official native source report at `4937c3c` rejected **all 16/16**
rank-18 near-zero fractions, selecting none. Baseline: 6,957 overlapping UV
triangle pairs / 1,072.40848mm max gap / 323 branch junctions. At 1/256,
6,939 overlaps but max gap 1,076.92613mm (+4.51765mm); at 5/256, 6,923
overlaps but max gap 1,095.01047mm (+22.60199mm). The candidate edge
[1703,1738] remains a genuine **33.28815mm source-mesh edge**, not an
approved physical cut. A lower overlap count cannot override a gap regression.

**New isolated fix:** the pure source-tree UV repack previously assumed that
moving an authentic retained 3D tree edge necessarily created exactly one NEW
UV seam. Its input might already have disconnected UV endpoints, or an
arbitrarily tiny positive translation could leave endpoints coincident within
research numerical precision. Before reporting a new seam the helper now:

1. Checks both original shared vertex endpoints on both source face owners are
   UV-joined within 0.001mm research-coordinate tolerance; pre-split input
   fails closed.
2. Requires a finite translation greater than 0.001mm and checks both
   resulting source-edge endpoints actually differ by more than 0.001mm.
3. Preserves source vertices, faces, UV research-only separation, original
   production geometry, Blender identity and all explicit false physical
   certification flags. The numerical tolerance is NOT garment seam allowance,
   fabric repeat, grain, measurement or fit proof.

Added positive/negative pure fixture coverage for a detectable tiny trial,
pre-existing forged UV disconnection and sub-tolerance positive fractions;
static Node QA protects the invariants. Scoped files: research subtree helper,
its Python fixture, its Node source regression and this checkpoint. No
original Blender source mesh/model is saved, no export or production promotion.

**New code-head verification is pending:** inspect latest exact-head native
Blender source rejection workflow, collision QA, Full CI and Non-3D QA. A
passing diagnostic workflow is not production approval. All ten original
six-piece hard preflight failures, original source/body contacts, 2,585+
research UV cycle seams, real fabric/drape and tailor signoff remain blockers.
**DRAFT / NO MERGE / NO DEPLOY / NO CUTTING APPROVAL.**

## 2026-11-09 source position provenance hardening (continued)

The isolated research helper must not turn boolean `True`, text `"0.0"`,
null/non-numeric or complex-valued input into apparently measured original
mesh vertex positions via Python's `float(...)` coercion. Only actual finite
numeric triplets are accepted before the immutable original-source UV cut
trial. The tightened validation remains compatible with genuine Blender
numeric vectors and existing pure synthetic numeric fixtures.

Scope: `scripts/blender/source-trouser-component0-subtree-uv-trial.py`,
`tests/python/test_source_trouser_component0_subtree_uv.py`,
`tests/crotch-trouser-component0-subtree-uv-native.test.ts`, and this
checkpoint. Added negative fixture cases for boolean, string, null, complex,
short and nonfinite source positions. The previous head
`58677078a2ab2ea443f5a7c1c21b58973917f6f6` had already passed
native collision QA #42637002100, while its source, full CI and Non-3D
results were still in progress when this next isolated edit began; do not
attribute those statuses to new commits.

The numeric-gated UV experiment, locked `linen-earth-studio-model-v1`,
existing source geometry, body BVH, approved asset isolation and all physical
fit/garment UV/fabric/tailor gates remain unchanged. New exact-head source,
collision, CI and non-3D runs must be independently checked. No source
fabric facts invented; **DRAFT / NO MERGE / NO DEPLOY / NO CUTTING.**

## 2026-11-09 original face/UV/forest input provenance hardening

The genuine original-source dual-tree UV builder used `int(v)` on
source face IDs, `float(v)` on UV chart coordinates, and `int(...)`
on explicit retained-tree edge IDs. These coercions could turn strings,
fractional indices and booleans into plausible topology or metric evidence
before the existing source-graph and UV validation. The input-trust
boundary is now strict: original face and cut IDs are literal
nonnegative Python integers (never booleans), metric UV coordinates
are finite actual numeric values (never booleans/text), and manually
supplied tree edges must carry literal canonical integer vertex IDs.
Only genuine numeric UV values are converted to float *after* validation.

Added synthetic and negative regression coverage for fabricated
face IDs, original cut IDs, UV values and explicit retained-tree IDs.
Source guard `tests/crotch-trouser-dual-tree-uv-native.test.ts` pins
the absence of the formerly unsafe coercions. Scope is restricted
to the research-only original-source dual-tree helper, its dedicated
Python/Node tests and this checkpoint. No saved source mesh, UV layer,
GLB, geometry, photo/model identity, fabric physical claim, source
metric, test threshold, production approval or release gate is changed.

New exact-head native Blender, full CI, collision and Non-3D verification
is required. A passing native diagnostic source test does not constitute
overlap-free pattern geometry, original crotch/body clearance, source
topology repair, measured textile grain or tailor signoff. All production
gates remain blocked. **Draft PR #897 / no merge / no deploy / no cutting.**

## 2026-11-09 genuine source triangle-collapse diagnostic

**Research only; this is not a production UV cut or fit repair.**

The original-source maximum-retained 3D edge selector previously validated
nonzero shared-edge lengths but had no independent face-interior area check.
Four distinct vertex IDs and nonzero edges do **not** prove either of the two
real original quad triangulations has nonzero area; a collapsed triangle can
still appear in the retained-edge graph and distort a claimed source metric.

The selector now validates the two original **3D** triangles for each of the
2,650 authentic source quads using the actual vertex vectors and cross-product
area, rejecting nonfinite or collapsed area at a purely numerical
`0.000001 mm²` floor. The floor is not cloth tolerance, thickness, seam
allowance or fabrication approval. It records
`minimumOriginalSourceTriangleAreaMm2` as a diagnostic source-geometry
measurement, distinct from textile consumption or physically approved fabric
area. Actual body BVH, face/vertex layout, UV research mesh and cut selection
remain unmodified.

The same entrypoint now refuses bool, numeric-string or fractional original
face/cut IDs and coerced source point values, matching the strict original
dual-tree research trust boundary. Added deterministic planar/curved fixture
assertions plus negative synthetic collapsed-face and forged-identity
regressions. Scoped modified files: source selector, dedicated Python and Node
research tests, and this checkpoint only.

The prior tested commit `a913ef95b6bda0e32c5763ba300910b143470ef3`
had Native Blender collision QA PASS #42638598399 while remaining exact-head
source/Full CI/Non-3D jobs had not yet finished at inspection; no success from
that head can be transferred to this new commit. Inspect exact-new-head
workflows and original-source Blender evidence before interpreting or
reporting native min-area measurements. Any source collapse or regressed
compatibility is a blocker, not a reason to weaken the numerical gate.

Genuine source model identity `linen-earth-studio-model-v1`, Blender source,
production UV/GLB, fabric provenance, body clearance, tailoring and physical
acceptance remain unchanged and **unapproved**. Original ten hard six-garment
preflight blockers and UV overlap/seams remain unresolved.
**DRAFT / NO MERGE / NO DEPLOY / NO PHYSICAL CUTTING.**

## 2026-11-09 rank-18 reversed rigid-translation probe (four true-source experiments)

**Why this research was added.** The preceding independently measured native
Blender rank-18 outward movement of 1/256 reduced original UV triangle
overlap pairs from 6,957 to 6,939, but increased maximum unclosed UV gap
from 1,072.40848mm to 1,076.92613mm. All 16/16 tested outward near-zero
fractions violated the maximum-gap nonregression gate; none qualified.
Less overlapping fabric-UV area **alone** is insufficient.

**Actual isolated experiment.** The pure component-0 retained-tree UV trial
now permits a *validated explicit* direction sign of +1 (preexisting outside
pack, default) or -1 (research-only opposite direction). It still requires
a true UV-joined genuine retained source edge, a measurable newly opened
source seam, immutable 3D face/vertex identities, unchanged intra-face
metric edge lengths, a finite displacement and strict input values. No
unbounded signed fractions or textual/bool direction coercions are accepted.
The Blender research driver evaluates only four predetermined *opposite*
rank-18 displacement fractions: 1/256, 2/256, 4/256, 8/256, against the
unchanged full-scan original maximum-retained UV baseline.

For every candidate the existing full-face overlap audit and authentic
3D source UV seam/cut audit record source-edge length, 5,300-triangle
overlap pairs, maximum UV gap, cut-network length, branch junctions,
authentic newly opened seam count and unchanged source/body evidence.
Strict research eligibility still simultaneously requires **complete
overlap reduction, no maximum-gap regression, no branch increase, an
actual exactly-one new seam, and the established rank-0 source-edge budget.**
An empty eligible set remains a valid rejected experiment, not a failure
to be masked or optimized away. The new isolated JSON evidence is
`researchOnlyComponent0Rank18OppositePlacementSurvey`. Independent native
workflow assertions rederive all numerical acceptance gates and check
research-only / nonexport / nonproduction flags. Dedicated pure Python and
Node tests cover valid negative direction, metrics, nonmutation, strict
sign validation and workflow/driver evidence markers.

**Current verification:** the preceding real-source Blender workflow
#42639416251 and collision QA #42639416296 passed at source head
`54308ef165129cdefc6caba3707321d475bd710c`; Full CI and Non-3D
were still running when this further research edit began. That prior
native success is **not** verification of the new opposite-direction trial.
Review the *new exact PR head* native source, collision, Full CI and
Non-3D results and save measured candidates before drawing conclusions.

This is **not** a signed/approved fabric pattern, garment cut, texture
mapping, true cloth grain, 3D crotch/body collision repair or physical
tailor signoff. Original production Blender model
`linen-earth-studio-model-v1`, source faces, all UV/GLB export assets
and physical blockers are unchanged.
**DRAFT / NO MERGE / NO DEPLOY / NO CUTTING APPROVAL.**

## 2026-11-09 bounded orthogonal UV chart translation (new 2D direction)

The previous **official native Blender** research at commit
`ff9a4f9918ccf9af136e560310536c9545c0967c` ran all four rank-18
opposite-direction trials on the genuine source mesh and selected **none**.
The unchanged baseline measured 6,957 overlapping UV triangle pairs,
1,072.40848mm maximum unclosed UV gap and 323 source branch junctions.
Moving rank 18 in the negative outside-pack direction by 1,2,4,8 / 256
reduced the maximum gap by 4.51624, 9.03106, 18.05634 and 36.08897mm,
respectively, **but increased** overlap by 39, 56, 79 and 140 triangle
pairs. All opened one actual source edge of 33.28815mm with no branch
increase, but none passed the complete overlap-improvement gate.
**This rules out those sampled moves, not every possible chart.**

**Next genuinely different 2D research hypothesis:** Instead of advancing
or reversing along the original full outside-pack displacement vector,
rigidly translate the same genuinely retained rank-18 subtree *orthogonal*
to that vector, in two signed directions. Evaluate precisely four fixed
pairs of (fraction, sign): (1/256,+1), (1/256,-1), (4/256,+1),
(4/256,-1). The trial function implements exact perpendicular
`(-full_dy, full_dx)` and only accepts the strings `outside` or
`perpendicular`, with an explicit exact integer +/-1 direction sign.
It still demands that both real source retained-edge UV endpoints were
actually joined before the trial and measurably separated afterwards;
source points, face IDs and true 3D cut edges stay immutable. Each source
quad is translated as a rigid chart—no stretching or reorientation.

The native driver saves only
`researchOnlyComponent0Rank18OrthogonalPlacementSurvey` in its
**non-exporting research evidence**. For each row it performs the
complete original 5,300-triangle UV overlap scan plus true-source
cut-network/gap/branch audit. The unchanged strict research gates are:
full-scan overlap reduction, nonincreasing maximum gap,
nonincreasing branch junctions, actual one new seam and the same
rank-zero true source-edge length budget. The native CI script independently
recomputes all raw numeric comparison and direction assertions rather than
trusting candidate-supplied boolean flags. The four candidates may all be
rejected; that is an acceptable research result. Synthetic Python tests
check both axes, +/- signs, exact orthogonality, source nonmutation, no
new approvals and forged axis/sign rejection. Node QA pins source, driver,
workflow, and regression markers.

Scope: existing 3D pure trial helper, Blender research driver, native 3D
source workflow, dedicated Python and Node tests, this checkpoint. No
customer-facing preview changes, production UV exports, user model
replacement, clothing source geometry edits or physical signoff.
**Verification pending at the new exact PR head:** full native Blender
source evidence, collision QA, Full CI, and Non-3D QA. The old
`ff9a4f99` source and collision success is not proof of this new experiment.
`linen-earth-studio-model-v1` and all physical preflight, real
textile calibration and tailor acceptance gates remain protected.
**DRAFT / NO MERGE / NO DEPLOY / NO CUTTING APPROVAL.**

## 2026-11-09 rank-18 genuine-cut midpoint rotation of intact source subtree

**Verified trigger, exact prior head `e2de391d5a022bae5c145004ad789b7321c1b0dc`:**
Native Blender source rejection evidence [#42643211919](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42643211919) **SUCCESS as research execution**. None of four +/-90-degree *translations* passed existing strict UV acceptance: +1/256 overlap 6,980 / max gap 1,073.64677mm; -1/256 6,974 / 1,071.18922mm; +4/256 6,974 / 1,077.47514mm; -4/256 6,980 / 1,067.64622mm. Baseline was 6,957 / 1,072.40848mm, 323 branch junctions, original 33.28815mm selected source edge. All four worsened overlaps. Prior source and collision checks passed; prior general CI and Non-3D had not fully completed at the next push. Do not claim any rejected geometry succeeded.

**New actual research mechanism, not another 1-D chart translation:**
The pure component-0 retained source-tree UV experiment now optionally rotates all original selected moving faces around **the midpoint of the shared UV coordinates of the genuine source cut edge**. The original face-tree cut candidate identity, original source 2,650 quads/3 components, real 3D cut edge length, joined-before and open-after source seam proofs, numerical orientation and within-triangle metric checks remain unchanged. A finite rotation must be within +/-5 degrees and is incompatible with any alternate translation sign, translation axis or translation fraction. Original default translation behavior remains unchanged and the source and original production UVs are never written.

The native pinned Blender driver measures **four fixed** rank-18 midpoint pivot angles: -2, -1, +1, +2 degrees. Each signed rotation keeps every original UV triangle's two intrinsic edge lengths, diagonal and orientation unchanged. It records both authentic source seam endpoint opening gaps and the selected original cut UV length; for angle \(\theta\) both gaps must agree within existing numerical tolerance with \(L\sin(|\theta|/2)\), where \(L\) is the actual source edge UV length. An independently recalculated native workflow checks this geometry identity, plus complete 5,300-triangle overlap scan, genuine 3D source cut-network length and exactly-one new seam, no maximum-gap regression, no branch increase and the original rank-0 real source-edge length budget. Any one failed gate makes the candidate ineligible even if another number improves. Strict selected candidate may validly be null.

Research-only evidence key:
`researchOnlyComponent0Rank18MidpointRotationSurvey`. Source helper, native Blender research-only driver, Python pure test (including forged angle and mixing mode rejection), Node regression, native CI verification and this checkpoint were changed. **No** original Blender source/mask, body scans, physical textile data, photo model, production UV/GLB, source geometry, confidence threshold, merge or deployment is changed. The new exact PR head still requires full matching-head native source, native collision, CI and Non-3D evidence, and measured 4-row scientific outcome; no physical fit, sewing, cutting, UV panel, fabric/grain or tailor signoff exists.
**DRAFT / NO MERGE / NO DEPLOY / NO CUTTING APPROVAL.**

## 2026-11-09 native midpoint-rotation result and strict cut-audit source provenance

**Native predecessor evidence:** Official actual source Blender run [#42645646130](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42645646130) **COMPLETED SUCCESS** on exact source head `b98fb6a082c072a1f6e2ac33ae4289dfd86663d8`, as a *diagnostic/rejected research experiment*, not production. Actual rank-18 original seam length 33.28815mm and source seam pivot midpoint (862.49684, 691.56754)mm. All four rigid rotations opened both original UV seam endpoints exactly as predicted by the rigid geometric formula, with 0mm original triangle-edge stretch, no new branch junctions, one genuine newly opened seam, and no body/production-source change.

| Actual authentic source rotation | Full overlap triangle pairs (Δ against 6957) | Max unclosed gap mm (Δ against 1072.40848) | Each actual source seam endpoint gap mm | Strict eligible |
|---|---:|---:|---:|---|
| -2 degrees | 6955 (-2) | 1077.36559 (+4.95711) | 0.58096 | no: max gap worse |
| -1 degree | 6956 (-1) | 1074.92376 (+2.51528) | 0.29049 | no: max gap worse |
| +1 degree | 6980 (+23) | 1069.82000 (-2.58848) | 0.29049 | no: overlaps worse |
| +2 degrees | 6994 (+37) | 1067.15858 (-5.24990) | 0.58096 | no: overlaps worse |

**All 4 rejected**, `strictEligibleCandidateCount=0`, `strictSelectedCandidate=null`. This sampled geometry tradeoff means only that these true-source local rigid motions do not pass the existing scientific eligibility gates; it says nothing about untested source seams or physically verified panel construction. Original model `linen-earth-studio-model-v1`, original UV and body BVH remain unchanged.

**Follow-on fail-closed original source audit hardening:** The research-only
`source-trouser-uv-cut-network.py` independently measures cut-network
length, branch structure and seam gap, and feeds all strict candidate
comparison gates. Previously it coerced source positions, quad IDs and
UV coordinates using `float(...)` and `int(...)` *before* validation.
Although upstream source libraries had been secured, the independent audit
still admitted coercible boolean/text/fractional impostors. Its input
boundary now rejects all nonnumeric, nonfinite or boolean 3D/UV positions,
accepts only literal integer original face and actual crotch-cut vertex
IDs, then converts genuine numeric source positions. No threshold,
UV metric, geometry, original ID, source edge, body, or production asset
was changed.

`tests/python/test_source_trouser_uv_cut_network.py` now includes adversarial
original face and cut IDs, 3D points and UV coordinates; the dedicated
`tests/crotch-trouser-uv-cut-network-native.test.ts` pins the code guards.
The original authentic `2650` face, 8 cut-edge, actual two-owner edge
counts, all native cut-network branch/gap/overlap checks and physical
non-approval flags remain the same. New exact-head pure tests and pinned
native Blender, collision, Full CI and Non-3D gates must be inspected
separately; do not inherit the predecessor's successful native evidence.
**Draft / NO MERGE / NO DEPLOY / NO CUTTING APPROVAL.**

## 2026-11-09 genuine source cut-network graph topology classification

**Problem:** Original source research already measured total UV cut edge
count, 3D source-edge lengths, largest seam gaps, total graph components
and branch junctions, but did not distinguish a single open edge path
from a loop or complex branched/cyclic network within each connected
source cut component. Multiple translation and rigid midpoint-rotation
trials on rank 18 were correctly rejected because overlap reduction
and maximum seam-gap nonregression could not both be achieved.

**New source-only geometric evidence:** The existing pure original-source
UV cut-network auditor now classifies the connected subgraph of
**authentic original 3D source edges** for each independently measured
UV discontinuity component. It computes exact undirected edge count
from actual source vertex adjacency, graph cycle rank `E - V + 1`,
actual source-boundary vertex contacts, degree-one ends away from the
original mesh boundary, and junctions of degree three or more.
A component is only a mathematical `simple-open-path` when it has two
degree-one ends, no branches and no cycles; `simple-closed-loop` when
all vertices have degree two and one graph cycle; otherwise it is
`branched-or-compound`. A graph path classification does **not**
approve seam allowance, sewability, grain or source 3D/body fit.

The source report aggregates `uvCutGraphCycleRank`,
`uvCutGraphSimpleOpenPathComponentCount`,
`uvCutGraphSimpleClosedLoopComponentCount`,
`uvCutGraphBranchedOrCompoundComponentCount`,
`uvCutGraphInteriorDegreeOneSourceVertexCount`, and
`uvCutGraphComponentsWithoutActualOriginalOpenBoundary`. Each largest
component also reports its actual topology class, Euler rank and
boundary/endpoint counts. An additional independent Euler identity
check rejects contradictory source graph accounting. Existing original
mesh face/vertex/cut IDs, UV gap and acceptance thresholds, production
source, locked scanned body and all false physical approval flags stay
identical; the audit remains measurement-only.

Dedicated Python unit tests cover a three-vertex open path, a four-edge
closed cycle, a three-spoke branched tree, asymmetric/invalid graph
rejection, zero-cut original planar UV, and a curved authentic 2,650-face
synthetic source grid. Native CI independently rechecks Euler rank using
`unclosedSharedUvCutCandidateEdges - uvCutCandidateSourceVertexCount +
uvCutCandidateGraphComponentCount`, topology-class totals, boundary
endpoint bounds and component identities on the actual unchanged original
Blender trouser source. Node QA pins the helper, native assertions and
negative regressions.

**Verification:** previous exact head
`9e6cc415ee84d880c30d746d712b963bffd9876e` had succeeded on native
collision while source/Full CI/Non-3D were still in progress at start.
The new source topology report and measured original cut-network
cycle/path counts require the **new exact-head** pinned Blender run
before citation as physical-source facts. Preserve any branch/cycle
blockers; do not reinterpret a mathematical simple path as a factory
seam or approve the UV/cloth. No production mesh or saved UVs changed.
**Draft PR #897 / no merge / no deploy / no physical cutting.**

## 2026-11-09 connected actual source-panel cut graph and priority junctions

The existing original-trouser source UV cut graph classifier added in the
prior checkpoint originally trusted a supplied graph component to be
connected before applying the Euler identity `cycle rank = E - V + 1`.
A disjoint three-vertex path plus a three-vertex closed loop has 5 edges,
6 vertices, two ends, no branch, and appears mathematically as `cycle
rank = 0` under this invalid connected-component assumption; it could be
misclassified as a single open panel-edge path. Two disjoint three-edge
loops likewise appear to have `cycle rank = 1` and could masquerade
as one closed source-panel loop. These are synthetic topology forgeries,
NOT genuine original-source measurements.

The classifier now independently traverses the *actual supplied source
graph* from one original vertex, verifies that every component vertex
is visited exactly once and that no input source IDs are repeated, and
rejects disconnected or asymmetric/invalid cut-graph evidence. Only
then does it use `E - V + 1` for a connected path/ring/compound network.
Dedicated pure Python negative fixtures reproduce both false-simple
cases and duplicate vertex IDs; Node static QA pins them. Full actual
Blender source main graph traversal already constructs connected
components; the new independent check prevents future callers or
corrupt reports from silently replacing that property with a guess.

**New genuinely source-anchored junction diagnostics:** The cut-network
report now enumerates all vertex degrees >=3 from ORIGINAL, shared
3D source mesh edges, and records its top 12 highest-degree junctions
in deterministic rank order. For each source vertex it includes
`originalSourceVertexIndex`, `sourceUvCutGraphDegree`, the original
`realOriginalSourcePositionMm`, sum of lengths of its adjacent ORIGINAL
3D UV-disconnected source edges, and whether it lies on the ACTUAL
original mesh boundary or on the eight GENUINE crotch cut edges.
The report also includes the total maximum junction degree, junction
count at real boundary, and junction count incident to true crotch cut
source vertices. These are measured research identification aids for
real source-panel topology, not invented tailor sewing points, pattern
lines, clearance allowances or grain measurements.

Pure Python tests independently check source IDs, finite 3D coordinates,
positive incident-edge lengths, deterministic sort, no-cut planar
fixture zeros, and count bounds on the curved original-size grid.
Pinned native CI independently checks junction ranking, original
source ID bounds, degree histogram maximum, real mesh unit positions,
source-provenance flags and graph topology count invariants against
the unchanged 2,650 original quads. The analysis remains nonexporting,
nonproduction and preserves the original scanned body/model identity.

**Verification status:** The prior `f03c80abe44e8c64dfb6b08fae7cc71b65ae1ef1`
head had native collision QA passed, while its native source and
Full CI/Non-3D checks were unfinished at initial inspection and may
have been superseded by these commits. The new exact head requires its
own pure, pinned native Blender source and collision, Full CI and
Non-3D checks and MUST produce measured original-source junction
values before any statement about their actual 3D locations. Existing
source UV overlap, real body collision, source garment topology,
physical fabric and tailoring/cutting gates are **NOT approved**.
**Draft PR #897 / NO MERGE / NO DEPLOY / NO CUTTING APPROVAL.**

## 2026-11-09 exact edge-disjoint maximal source cut-chain reconstruction

The previous **native Blender** actual-source UV graph diagnostic at head
`f03c80abe44e8c64dfb6b08fae7cc71b65ae1ef1` measured 2,587
UV-disconnected original shared mesh edges distributed across 66 connected
source cut networks. Exactly 60 are mathematical simple open paths,
0 simple closed loops, and 6 are branched-or-compound source-edge
networks, with 134 degree-three-plus source junctions and 257
degree-one ends away from the actual original boundary. Source graph
cycle rank was zero. Native source QA [#42648374544](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/42648374544)
passed as *diagnostic execution*, not manufacturing approval. These
counts are topology evidence, not externally measured garment fit.

**Actual source-reconstruction analysis added:** The original UV
cut-network auditor now walks each connected source-edge graph and
partitions its genuine original UV-disconnected edges into
**edge-disjoint maximal chains**. Chain interiors may only use degree-two
original mesh vertices; endpoints must be real graph degree-one or
degree-three-plus junction vertices. Pure all-degree-two connected
cycles are represented as **closed** paths, never silently sliced open
into a manufactured seam. A source junction incident to a loop
returns to the same authentic vertex. Every original cut edge must
appear **exactly once**. An independent chain-count and edge-count
identity, plus the full unrounded native 3D source edge-length sum,
must exactly reconcile with the original measured cut-network totals;
otherwise the candidate report is rejected.

Reports include total maximal source chain count, closed-loop chain
count, full genuine-edge coverage, longest chain length in actual mesh
millimetres, original source ID endpoints and measured source edge
lengths for the 12 longest real original-edge chains. Each graph
component records its minimum original source vertex ID, number
of maximal chains and exact edge coverage. The original 3D source
vertices/faces, cut edge ownership, UV loop measurements, body scans,
locked Studio model, production UV exports and original approval
gates remain untouched. These source chains are **NOT sewn panel
outlines, cut lines, seam allowances, physical fabric or acceptable
drape**. Intersecting panel bodies and physical tailoring remain
independently blocked.

Dedicated Python regressions prove single open chain, authentic
closed ring, 3-spoke branch, loop returning to a real branch junction,
disconnected/malformed network rejection, planar zero cuts,
full-size curved synthetic mesh, and exact original source-edge
coverage. Native Blender workflow independently verifies source
vertex ID bounds, chain count/edge conservation, rank/length ordering,
closed-chain bounds, maximal chain component accounting and false
production approval. Node QA pins the source, tests, and native
assertions. **Run the new exact-head pinned Blender CI before claiming
actual garment-source maximal-chain counts or chain endpoints.**
No merge, production deploy, model replacement, UV save or physical
cutting approval.

## 2026-11-09 original-source chain path evidence (ordered vertex identities)

The previous maximal-chain report inventoried authentic original source
UV-disconnected edges without inventing cut/sewing seams and without
changing original Blender geometry. However, its top 12 chain records
exposed only start/end source vertex IDs, a count and accumulated 3D
length: those summaries cannot independently reconstruct an actual
original-source chain between endpoints. This is especially limiting
for the six genuine branching networks.

**Scoped research evidence improvement:** Each maximal chain now
retains an ordered `originalSourceVertexPath` of all original mesh
vertex IDs; the existing research report exposes complete paths for
the top 12 genuine 3D source chains, alongside their current original
source endpoint IDs, real 3D length, and boundary/branch classification.
Every reported segment must be one of the actual audited original mesh
UV-cut edges and must occur exactly once across *all* source chains,
not merely the top 12. The full graph inventory and unrounded 3D edge
length conservation still must match the original authenticated
source network, with no fabricated or skipped edges.

Dedicated Python tests reconstruct each top-12 reported chain from
the original 2,650-quad face-edge index and genuine 3D point array;
verify ordered vertex counts, literal integer ID ranges, original
source adjacency, no shared/repeated genuine edges between those paths,
and the resulting exact real source polyline length against the
reported millimetres. Native pinned Blender CI checks the ordered
ID sequence, edge count, endpoints, unique edges and production
rejection flags; Node QA pins source, Python and native assertions.

**Actual pre-existing source vertex targets** (native prior successful
run `9df982cb5e34deb2e7d4e1bf59b1ad5cc28f51ac`,
source run #42649658975) include top degree-four original junction
source vertex 1738 at (194.70231, -3.34208, 709.66053)mm, 1739
at (193.49441, -4.06225, 749.72326)mm and 1737 at
(194.71668, -0.58617, 668.41441)mm. None of the 134 native branch
junction vertices were on the original boundary or eight genuine
crotch cut edges. These source-mesh positions are not fabricated
tailor marks, verified fabric dimensions or approved pattern seams.

**Verification:** This path update requires its own exact GitHub PR
head pinned native source tests, actual Blender reconstruction
diagnostics, native body collision, Full CI and Non-3D QA. Do not
transfer the previous exact-head passes. The source model
`linen-earth-studio-model-v1`, original production UV/GLB, physical
fabric and fit/cutting approval state remain unchanged.
**DRAFT / NO MERGE / NO DEPLOY / NO CUTTING APPROVAL.**

## 2026-11-09 trace each real UV-cut chain to its original source network

**Evidence from last exact-head successful original-source Blender diagnostic**
`1f629eac4ec06698419d87d947f1316bbbe29b57`
(run #42651365657): **390** edge-disjoint source UV-cut chains exactly cover
**2,587** genuine UV-disconnected original source edges in **66** connected
source networks. **Six** original cut networks are branched/compound.
Two of those contain **530** original UV-cut edges and **117** maximal
chains each, with **50** genuine branch vertices each. Native collision
QA was successful as *rejection evidence*, not fit/physical clearance
approval. The previous `7d1db77` update extended top chains to full
source-vertex IDs; its exact-head Blender/CI checks were still running
when this new branch-component work began.

**Provenance gap closed in this continuation:** The top-12 longest source
chains were traceable vertex-by-vertex, but their records lacked a
source-component identifier. A long chain in a mathematical simple
open path could be mistaken for a branch of one of the six complex
networks. The original source UV-cut graph now attaches every maximal
chain to its **actual connected source component**, identified by that
component's minimum original source vertex ID. It independently
reconciles that component's sum of **real original 3D cut edge lengths**
against the sum of its owned maximal-chain lengths (before rounding),
with exact source-edge count equality. Component owners must be unique
and the branched component's total paths/edges must agree with the
actual source graph. No synthetic source ID or fictitious cut edge is
used to fill a gap.

The research report includes the full
`actualBranchedOriginalSourceUvCutNetworks` inventory (six expected on
the measured source, but no fake guaranteed count), with each component's
genuine ID, branch junction count, edge count, chain count, and measured
real source cut-network length. The separate
`actualLongestBranchedOriginalSourceUvCutChains` contains the top 12
longest chain *paths belonging to those genuine branched components*,
including their ordered original vertex ID paths, endpoint IDs,
source-edge counts and actual 3D length. This is useful for targeting
topology cleanup without conflating simple open paths with branching
locations.

Dedicated Python and Node regressions plus native CI independently
validate component uniqueness, true branch classification, path owner
membership, positive real component length and original edge coverage;
zero-cut planar fixtures retain empty branch inventories.
The original `linen-earth-studio-model-v1` model, source mesh,
unchanged body scan, original UV and production files are not modified.
These remain **research cut graphs**, not actual sewing paths,
approved fabric panels, guaranteed textile length, fit clearance,
cloth grain or factory cutting instructions.

The new exact PR head must pass its OWN pure Python and pinned native
Blender source/collision, Full CI and Non-3D QA; prior-head success must
not be transferred. Original UV overlap, body intersection, 3D source
geometry and garment physical validation remain blocked.
**DRAFT / NO MERGE / NO DEPLOY / NO CUTTING.**

## 2026-11-09 pinpoint largest authentic UV gaps on branched source paths

**Starting evidence:** The official earlier native 3D source run
`1f629eac4ec06698419d87d947f1316bbbe29b57` found 390 original
mesh source-edge chains covering all 2,587 UV-disconnected shared edges,
including six branched/compound networks, with two 530-edge networks
requiring 117 maximal chains each. Original source geometry/locked
scanned body, physical fit and UV production status are still rejected.
The immediate predecessor's component-owned chain implementation was
committed; its general CI required one static Node test-marker correction.
Neither prior native diagnostic nor a passing static unit test is
manufacturing approval.

**New evidence-only work:** Every true-source maximal cut chain now also
identifies its *largest measured UV discontinuity* (mm) and the exact
original mesh source edge vertex ID pair causing that maximum. The
measure is computed from the original per-face UV-loop mismatches of the
same actual 2,650 source quads, not a fabricated seam allowance or
supplier fabric repeat. Each connected source network independently
records its maximum actual original UV gap, and the combined per-chain
maximum must reproduce the original global UV gap within numerical
rounding. Source edges are unique and graph-connected, with the
unchanged true 3D point and edge identities preserved.

`actualHighestGapBranchedOriginalSourceUvCutChains` reports the
twelve most severely discontinuous authentic paths *within the actual
branched networks*, sorted by original measured UV gap (not by physical
seam length), then real 3D chain length and original source IDs for
determinism. Both the existing longest-path branched ranking and new
highest-gap ranking retain their exact component IDs and full ordered
source vertex paths. The output can identify exact edges for further
source-UV reconstruction experiments, not assert factory cut or 3D
sewing approval.

Dedicated pure Python tests verify real original edge adjacency, the
per-component/chain gap range, actual worst-gap edge membership in
the ordered source path, the branch-component owner ID and stable
severity ordering, and empty planar network behavior. Native pinned
Blender source workflow independently checks measured gap bounds,
original edge membership, rank ordering and protected physical
nonapproval. Node source QA pins the same source helper, Python
and workflow checks.

The **new exact GitHub PR head** requires its own native source,
collision, Full CI and Non-3D verification. No original Blender
source mesh, UV/GLB export, body scan, customer preview, textile
provenance, thresholds, production build, physical fit or tailoring
approval changed. **Draft / no merge / no deploy / no cutting.**

## 2026-11-09 genuine source seam two-endpoint UV mismatch vectors

**Reason to add**: The prior genuine original-source UV audit identified
six branched/compound 3D source-edge cut networks and their worst-gap
paths but recorded only a **scalar maximum UV gap** per true original
source edge. Such a scalar cannot distinguish a single nearly rigid
displacement of two chart edges from endpoints moving in different
directions. No signed UV offsets, physical fabric grain, scanner-scale
seam allowances or approved cutting paths were established.

**New strictly original-source evidence:** For each of the unchanged
2,587 source UV-disconnected, *genuine two-owner original mesh edges*,
the research auditor computes two signed 2D owner-to-owner UV
displacements, in research millimetres, from each endpoint of the same
original edge. It independently verifies that the larger displacement
norm equals the previously measured actual original edge UV mismatch.
For each maximal original chain it records face-owner IDs of the
maximum-gap source edge, both signed source-UV offset vectors,
their Euclidean relative endpoint drift, the original vertex edge
pair and its actual graph component. This evidence flows into the
`actualHighestGapBranchedOriginalSourceUvCutChains` research report,
without reordering any path, modifying any UV, or inferring a
tailor-ready physical panel.

Dedicated pure Python tests independently reconstruct both original
owner-face UV loop coordinates for every ranked branched path's worst
original source edge, enforce literal matching face IDs, signed
owner-to-owner vectors, both per-endpoint norms, observed maximum
gap and Euclidean relative drift; the corresponding native Blender
CI also independently recomputes these numerical identities from
the reported vectors and validates two distinct original source
face IDs. Static Node regressions pin these source, synthetic and
native evidence checks. The acceptance gates for actual source UV
overlap, source cuts, unclosed gap, branch degree and real body
clearance are NOT relaxed.

**Important interpretation:** A near-constant source UV offset
between both endpoints may suggest a locally rigid chart
displacement *for this research UV edge only*; a changing offset
shows relative endpoint mismatch. Neither automatically gives a
valid unwrap, physically verified textile scale or collision-free
garment. Original 3D vertex/face IDs, scan, source body and locked
`linen-earth-studio-model-v1` remain unchanged. No sewing pattern
export, replacement mesh, GLB write, merge, deployment or cutting
approval. **Pending new exact-head native Blender/Full CI results.**
