# TITAN 3D — original trouser-source two-ring falloff research

**Not a production garment. No main merge or deployment.**

## Reproduced physical cause

Official pinned Blender 4.5.14 job [41685340310](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41685340310) on draft [#888](https://github.com/slokpatel-crypto/llinenearth-designer/pull/888) at `82c221935b9be36ffaa9881e9d775a249b38e257`, parent of this branch, measured the exact same original source trouser shell, not just isolated bridge faces:

| Native real-body measurement | Original attached-source control | Original connected source +9mm |
|---|---:|---:|
| All original-source/body BVH pairs | 29,620 | 29,637 |
| Adjacent 6 original trouser-source face/body pairs | **45** | **81**, worse |
| Adjacent original-source contacted area | 1,824.7007mm² | 6,376.1803mm², worse |
| Specific two original bridge faces/body pairs | **17** | **0**, improved |
| Seven cut-edge samples below 7mm | 14/14 | **0/14**, improved |
| Original six neighboring face normal reversals | — | **0** |

Connected +9mm fixes original bridge contact and sampled source edge clearance but worsens actual original adjacent cloth-facing shell geometry. Reject promotion of **both** detached +9mm and attached +9mm. Original full six-panel garment still fails its ten hard physical preflight gates.

## New bounded Blender geometry trial

Branch `work/titan-3d-connected-source-falloff-20261103` is stacked on tested research #888 and retains original unmodified six garments, source CC0 body scan, canonical image and `linen-earth-studio-model-v1`.

Create independent unsaved research-only Blender meshes with **the exact same original 2,656-face source-and-experimental-bridge topology**, original body and +9mm cut-edge relocation:

1. Unchanged source control (no movement).
2. Positive +9mm **four-seam-vertex-only** control, which increased original neighbor collisions.
3. Positive +9mm seam with the neighboring actual source graph's first ring displaced by **50%** of the physically measured nearest-seam-vertex movement.
4. Positive +9mm seam with first ring moved **66%**, second ring **33%**.

This is **topology-weighted displacement**, NOT measured fabric physics, not a tailored sewing pattern, and not a final UV seam. Each ring is identified from actual original trouser/source face connectivity; no synthetic CAD pattern is accepted. Actual Blender BVH intersection counts/area are measured for all real original adjacent faces and whole research shell; original cut-edge samples, all altered source face normals, face-count topology, vertex movement bounds and research/export isolation are checked.

Native workflow must **record any worsening or flipped face normals truthfully**. No expected improvement or zero intersection is hard-coded. A local improvement does not prove full garment fit, continuous cloth contact, UV/scale/grain, 1.6mm thickness, stitching allowances or photographic match.

## Gates

- [x] Verified original source-connected +9mm failure and documented the real collision transfer
- [x] Implemented two independent ring-distributed actual Blender source geometry variants
- [x] Added native Blender provenance, face-normal and contact measurements plus dedicated fail-closed Node regression
- [ ] Obtain new exact-head native source measurements and compare each variant's actual original body BVH/area/normal flips
- [ ] Obtain exact-head Full CI, Non-3D, native collision and source candidate checks; approve only research evidence
- [ ] Production-approved 3D sewn and UV-correct garment, photographer comparison and physical tailoring fit remain blocked

**No automatic merge, no GLB/.blend export, no Vercel deployment.**
