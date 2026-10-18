# 18 October 2026 — isolated, unapproved garment-authoring changes

Branch: `work/3d-authoring-uv-safety-20261018`. Do not merge or deploy as a customer 3D model.

## Task 1 — body/garment construction
- Preserve original photographic Real Model Designer and locked `linen-earth-studio-model-v1`. Changes affect only the Blender **candidate-authoring helper**.
- The generated trouser-leg surface filter now has an explicit left/right split constrained to the candidate hip half-width. This guards against accidentally classifying hands at comparable vertical heights as trouser geometry. The static test does **not** establish the actual mesh is hand-free; native four-angle Blender checking remains mandatory.
- Reject nonfinite/out-of-range clearance and shell thickness input rather than silently clamping an invalid tailored fit.
- **Unresolved:** genuinely straight posture and smaller leg gap in the locked, approved source, sleeve cuff centre spacing (previously measured 574.76 mm versus the 500 ±36 mm guide), sewn collar/cuffs/hem and geometry quality. Do not distort the original body to pass a numeric gate. Re-run independently measured native world-space collision, identity and silhouette checks.

## Task 2 — material / UV behavior
- Previously, every individual garment panel mapped to a normalized 0–1 UV square, so nominal pattern scale changed with panel size. Candidate authoring now records planar UV in mesh **metres**, not a panel-normalized unit square.
- This is only a geometry mapping change: XZ planar UV still compresses perpendicular surfaces and does not solve true material grain, seamless UVs, physical repeat, anisotropic drape, or supplier color/weight.
- Explicit metadata mark repeat and grain verification **false** and UV as `uncalibrated-metric-projection`. No model, shader or live render is marked approved.
- **Unresolved:** real repeat in mm, warp/weft orientation, fabric weight, shrinkage and tailor-approved bending/fit. Native UV-area/degenerate-face verification required before candidate promotion.

## Tasks 3–5 — tailoring, performance, release gates
- Do not replace original photos or activate candidate in the customer Designer.
- Style/tailoring options must keep locked measurements and require owner/tailor signoff.
- Mobile triangle/vertex budget and actual 20-second browser garment-ready receipt remain release-blocking until tested on the **candidate**, not simulated.
- Before approval require native Blender source/identity checks, zero collision tests, four-angle visual parity against the original photographed model, actual fabric calibration, independent tailor approval, browser tests and complete CI.
- The Python unittest added beside this change is a **static authoring-contract regression only**, not evidence of Blender collision or web behavior.

## Evidence ledger
- Commit `8493c90`: candidate source filtering, fail-closed fit bounds, geometry-space UV and unverified evidence flags.
- Commit `146de61`: standalone Python source regression.
- Native Blender tests: **not executed in this commit session**.
- Browser/Next.js suites: **not executed in this commit session**.
- Human photo parity and supplier fabric data: **not available**.
- Production: **BLOCKED**. This branch is intentionally not merged, deployed, or approved.
