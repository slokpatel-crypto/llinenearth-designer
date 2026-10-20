# Same-model garment extension preflight

Status: **engineering-only, not a released 3D outfit loader**. The canonical
`linen-earth-studio-model-v1`, `/designer/studio-tucked.webp`, existing six-panel
shirt/trouser model and customer saved designs are unchanged.

## Purpose and truthful result

The layer plan validates garment prerequisites; registration validates a local
path, identity target and material namespace. Neither proves the file contains
usable geometry. This preflight reads exact asset bytes and checks our static
profile plus the independent [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator).

`candidateReady: true` means this technical preflight passed.
`productionApproved` is always `false`. No command loads, enables, publishes,
promotes or replaces an asset. Metadata cannot certify the original body,
supplier dimensions, measured drape, physical fit or owner/tailor approval.

## Single candidate

Use the existing `model-layer-assets.ts` registration shape:

```json
{
  "version": 1,
  "slot": "blazer",
  "modelIdentityId": "linen-earth-studio-model-v1",
  "referenceHeightMm": 1727,
  "coordinateSpace": "locked-model-local",
  "anchor": "torso",
  "glbPath": "/models/garment-extensions/blazer/review-candidate-v1.glb",
  "materialSlots": ["LAYER_BLAZER_FRONT", "LAYER_BLAZER_BACK"],
  "state": "engineering-candidate"
}
```

This is a schema example, **not** an existing or approved garment. Place the
separately authored file at its registered path below `public`, then run:

```sh
npm run garment:layer-check -- path/to/registration.json
```

The report hashes the raw registration file, normalized registration and exact
GLB bytes with SHA-256. It includes actual metre bounds, primitive/vertex/triangle
counts, schema diagnostics and an explicit non-production result. Exit 0 means
candidate checks passed; 1 means failure; 2 means invalid CLI usage. No timestamp
is added, so unchanged inputs produce reproducible evidence. Reads are bounded;
non-regular files and redirected/symlinked asset paths are rejected. No files are
written, no remote GLB resource is fetched and no credentials/paid AI are needed.

## Static export profile v1

This deliberately supports a smaller subset than arbitrary valid glTF:

- GLB 2.0 with exactly one aligned JSON chunk and one embedded BIN chunk, valid
  declared lengths, zero BIN padding and bounds-safe accessors.
- One selected scene. Every node/mesh is reachable once; no cycles, hidden nodes,
  multiple parents or mesh instancing. Bake transforms into the existing
  model-local metre frame (+Y up, floor Y=0); identity group nodes are allowed.
- Triangle primitives with float32 `POSITION`, `NORMAL`, `TEXCOORD_0`. Packed and
  interleaved attributes, unsigned 8/16/32-bit indices and non-indexed triangles
  are supported. Counts, alignment, targets, stride and byte ranges must agree.
- Actual finite vertices/normals/UVs, unit normals, valid indices, non-collapsed
  geometric/UV triangles and binary POSITION bounds matching their declaration.
  UV presence/non-degeneracy is **not measured textile scale**.
- Material names exactly match independent registered `LAYER_<SLOT>_...` slots,
  each assigned to primitives. No original shirt/trouser materials can be reused.
  Scalar PBR factors are allowed; textures/images, animation, skins, morphs,
  cameras, compression and extensions are outside this static profile.
- A broad technical sanity cage rejects metre/millimetre confusion and wrong
  origins: X/Z ±1.727 m, Y 0–1.8997 m. This is **not** an anatomical/fitting
  envelope, collision test or evidence of resemblance to the original model.
- Limits: 8 MiB file, 512 KiB JSON, 60,000 rendered vertices, 80,000 triangles,
  128 primitives, 128 nodes and 512 accessors/bufferViews. Existing base-model
  release conditions are never relaxed.

The CLI additionally runs pinned `gltf-validator@2.0.0-dev.3.10`, a new
**development-only** dependency, with no ignored errors. Validation handles up
to 2,048 issues and fails closed if truncated. Reports keep 32 diagnostic messages
plus total counts and omitted-message count. UV-use information from texture-free
exports must not exhaust the issue budget before actual schema checks finish.
Later rigged/animated/compressed assets require a separately tested profile.

## Whole outfit

Assembly version 1 has **only** `version`, `plan`, `assets`:
`{version: 1, plan: <existing layer-plan object>, assets: [<full registrations>]}`.
This is an engineering wrapper, not a customer saved-design migration. Use the
existing plan `{version: 1, composition: "two-piece-suit", layers:
["shirt", "trouser", "blazer"]}` and the complete blazer registration above.
For a three-piece suit choose `three-piece-suit`, add `waistcoat` and its full
registration. Tie/belt/pocket-square keep the existing prerequisite/anchor rules.
No separate `suit` full-body mesh is introduced.

```sh
npm run garment:outfit-check -- path/to/assembly.json
```

Each selected extension needs exactly one registration; strings, paths, duplicate,
extra, missing, wrong-slot or substitute-body registrations fail the whole set.
Input is normalized to canonical layer order. Every GLB is inspected and hashed.
The **entire extension stack shares** one 8 MiB / 60,000 vertex / 80,000 triangle /
128 primitive budget; adding five assets cannot multiply it. `extensionTotals`
exclude the original model, and `baseModelChecked` is always `false`. Base-only
plans have zero extension work and still cannot certify the base or an outfit.

## Remaining release evidence and compatibility

Before any customer loading: independently establish licensed source provenance,
photographic model identity, native Blender topology/UV and attachments,
shirt/waistcoat/jacket contact and overlap, four-view agreement, measured fabric
scale/drape, mobile/WebGL performance, current CI/browser regressions and
owner/tailor approval. Re-run against final hashes after every geometry change.

There is no dependency in customer rendering, database/schema migration, saved
design rewrite, new mannequin, release-gate relaxation, merge or deployment.
Tests use synthetic triangles only; no unit fixture is published as a garment.
Coverage includes all five slots, packed/interleaved data, all index widths,
every truncation of a test GLB, malformed binary/metadata, graph and namespace
errors, symlink substitutions, budgets, 1,000 seeded mutations, all 384 logical
plans and deterministic whole-stack reports.

## Atomic logical edits

`applyModelLayerEdits(currentPlan, {version: 1, actions: [...]})` is an
engineering-only pure function. Actions are exact `set-slot` objects
(`type`, known `slot`, boolean `selected`) or exact `set-composition` objects
(`type`, known `composition`). Each target may occur once; a batch has at most
seven slot edits plus one composition edit. Add/remove related garments and
change suit composition in the same transaction.

The whole final plan is validated before acceptance. Failure returns the previous
normalized plan with `applied: false`, `changed: false` and no partial slot changes;
corrupt previous state returns `plan: null`. Nothing is silently added, deleted,
downgraded, saved, loaded or approved. Idempotent explicit actions return
`applied: true`, `changed: false`. Valid results use the existing plan v1 shape,
round-trip through its parser and detach caller-owned arrays. This is a logical
editing API for future controlled integration, not a newly enabled customer 3D UI.
