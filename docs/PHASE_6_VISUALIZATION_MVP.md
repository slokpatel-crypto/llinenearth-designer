# Phase 6 — Visualization MVP

## Goal
Visualize only a finalized `DesignVersion`. The locked design remains canonical; the render layer may represent it but may not silently redesign it.

## Implemented
- `compileVisualizationSpec()` converts a finalized Phase 5 version + brief into one stable visualization contract.
- One persistent model identity: `LE-MODEL-M01`.
- One catalogue camera set: `LE-CATALOGUE-V1`.
- Three required MVP views: front, back and construction detail.
- Every render carries explicit validation signals for locked spec, model/camera identity, fabric role/palette and cross-view consistency.
- A targeted repair endpoint regenerates only the selected view and preserves the render set's design hash.
- Designer Journey persists the locked `DesignVersion` and `RenderSet` in the session.
- Visualization failure never destroys the design state.

## Development renderer
The current renderer is deterministic SVG. This is intentional for Phase 6 development because it lets CI test the entire visualization contract without external credentials, nondeterministic model output or paid image calls.

The renderer is **not presented as photorealistic production AI output**. It is labeled in the UI as the development visualization adapter.

## Production-provider seam
A future production provider should consume `VisualizationSpec` and return the same normalized `RenderSet` shape. Provider-specific prompts, masks, seeds, references and repair calls should stay behind that adapter boundary.

## Acceptance checks
- A non-finalized version is rejected by `/api/visualization/render`.
- Front/back/detail outputs share one `specHash`, `modelId` and camera set.
- Garment names and palette are sourced only from the locked Phase 5 version.
- Repairing one view leaves the other views and canonical design untouched.
- Render validation is visible to the user.
- The user can leave visualization and return to the locked design without losing state.

## Next
Phase 7 upgrades the proven vertical slice into the full premium final-design product experience, saved presentation flow and broader responsive UX.
