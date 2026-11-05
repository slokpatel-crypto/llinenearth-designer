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
