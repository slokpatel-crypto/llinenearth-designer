# TITAN 3D — canonical mannequin source handoff (not production approval)

## Why this exists

The customer-facing original `/designer/studio-tucked.webp` is a **single faceless mannequin photograph**, while the native Blender source currently used for 3D testing is a **different, face-bearing CC0 Realistic Male scan**. Matching a model ID, screenshot aspect ratio, or 1727 mm target height does NOT make the two identical. Independent native run 41304802002 rejected both attached back-shoulder patterns (2204/2230 Body collisions), after the back-waist attempts in run 41303366000 also failed. The best experimental source-section sleeve trial still intersects its generic scan 1954 times and the waistband 72 times. None may be promoted to customer production.

## Exact external evidence needed to resume original-identity geometry

1. **Original model mesh**, preferably the exact Blender `.blend` used for the faceless Designer Studio mannequin. This cannot be guessed from the front photograph or replaced by a similar downloaded scan. Keep the original in a local private folder; do NOT place commercial model assets or owner photos in a public GitHub commit.
2. **Four actual model views** rendered from one unchanged source mesh at front (0°), three-quarter (35°), side (90°), and back (180°). These must be four distinct image files; relabelling one front photo four times is not evidence.
3. **Real tailoring pattern/measurements** for the shirt shoulder, armscye, sleeve cap, back yoke, cuff, collar, tuck and trouser waist/seat/fly. Mark unknown values unknown. Confirm fit with the actual tailor rather than inferring seam allowance from screenshot pixels.
4. **Fabric provenance and dimensions**: actual GSM/composition, measured repeat size and grain/stripe direction, supplier information, garment usage and physical drape verification. Do not estimate unknown physical facts as measured.

## Local source evidence intake without AI credits

The independent intake program hashes source files; it never creates assets, uploads anything, certifies photo parity or edits the model:

```powershell
python scripts/blender/canonical_model_source_intake.py `
  --identity-spec public/model-identity/linen-earth-studio-model-v1.json `
  --reference public/designer/studio-tucked.webp `
  --source-blend "E:\\PrivateModels\\linen-earth-original.blend" `
  --front "E:\\PrivateModels\\front.png" `
  --three-quarter "E:\\PrivateModels\\three-quarter.png" `
  --side "E:\\PrivateModels\\side.png" `
  --back "E:\\PrivateModels\\back.png" `
  --output "E:\\PrivateModels\\titan-model-intake.json" `
  --require-review-packet
```

Missing the model or a view produces an explicit BLOCKED packet. Non-Blender bytes masquerading as `.blend`, copied/duplicate views, an invalid canonical photo or mismatched identity spec also fail. A complete packet means only **eligible for independent human visual review**, never photo parity, tailoring fit, fabric truth or production readiness. An independent owner/tailor visual comparison and a new original-body source/native QA run are still necessary.

The GitHub lightweight workflow `.github/workflows/canonical-model-source-intake.yml` deliberately tests the present repository's missing owner master and three hidden reference views as BLOCKED, stores a non-approval SHA256 evidence JSON, and never writes the live customer image. It does not test the owner's private computer files.

## Private human review packet required for measured GLB export

The model source must be SAVED as a `.blend` first. Render four distinct angles from that exact source, then gather a deliberate manual model-identity review from the owner. The production exporter now requires `LINEN_OWNER_MODEL_REVIEW_RECEIPT` pointing to a private JSON receipt in the same folder as the four images. Keep it outside public GitHub.

Example *schema* (never fill unverified assertions with `true` merely to bypass a gate):

```json
{
  "schemaVersion": "linen-earth-owner-four-angle-review-v1",
  "canonicalModelId": "linen-earth-studio-model-v1",
  "ownerConfirmsSameFacelessStudioModel": false,
  "reviewerName": "",
  "reviewedAt": "2026-11-01",
  "manualVisualChecks": {
    "facelessHead": false,
    "shouldersAndArms": false,
    "backTuckAndWaist": false,
    "legsAndShoes": false
  },
  "sceneBlendSha256": "<64 lowercase hex chars of SAVED original source>",
  "canonicalReferenceSha256": "<64 lowercase hex chars of studio-tucked.webp>",
  "viewPaths": {
    "front": "front.png",
    "three-quarter": "three-quarter.png",
    "side": "side.png",
    "back": "back.png"
  },
  "renderSha256": {
    "front": "<source front image digest>",
    "three-quarter": "<source three-quarter image digest>",
    "side": "<source side image digest>",
    "back": "<source back image digest>"
  }
}
```

On Windows, calculate actual hashes with `Get-FileHash -Algorithm SHA256 "E:\\PrivateModels\\linen-earth-original.blend"` and each photo and view; use lowercase hexadecimal digests. A hash binds the **bytes** used for review but **does not authenticate the reviewer**, establish photo likeness automatically, or prove it is the owner's original asset. Human verification must happen independently.

To export with a private approved packet, set `$env:LINEN_OWNER_MODEL_REVIEW_RECEIPT = "E:\\PrivateModels\\owner-reviewed.json"` in the Blender/export terminal. The exporter requires a full named review, the reviewed original `.blend` SHA, reference SHA and all four independently fingerprinted view files *before* running the existing native source geometry gate. Incomplete, stale, relabelled or tampered evidence is blocked. **Do not store the receipt's hash inside the same .blend that the receipt hashes:** this would create an impossible cyclic SHA-256 dependency. Never mark owner approval for the current CC0 scanned person.

Even after external source review succeeds, zero body/waist/leg intersections, physically measured garment panels and fabric scale/grain, browser/mobile QA and actual tailor/owner signoff remain separately required. This is not a green-light release checklist.

## Resume criteria

Do not continue adjusting guessed waist x/y, arbitrary back-shoulder inset row counts, or generic CC0 body proportion in hope of matching a photograph. Once a genuine source review packet is supplied, verify that all four views show the same identity **and** actually match the original faceless studio mannequin, then build measured 3D shoulder/armhole/back-tuck patterns around that approved source. Native Blender topology, body/garment BVH, truthful 1:1 UV grain, browser responsiveness and actual tailoring QC must all pass. Keep any incomplete 3D change in a draft branch. Do not merge or Vercel deploy merely because intake passes.
