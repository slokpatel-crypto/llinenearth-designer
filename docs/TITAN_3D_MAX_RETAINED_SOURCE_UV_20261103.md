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
