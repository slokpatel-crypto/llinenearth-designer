# Phase 2 — Fabric Upload & Analysis

## Goal
Let a customer upload one fabric photo and receive a structured, editable fabric profile while clearly separating visual estimates from facts that require confirmation.

## Implemented
- Premium fabric-upload studio on `/designer`
- Drag/drop and device image upload with 10 MB guardrail
- Immediate local fabric preview
- Capture guidance for lighting, framing and drape
- Structured fabric-analysis contract
- `/api/fabric/analyze` provider adapter boundary
- Confidence scores per observation
- Color palette strip
- Material/color correction controls
- Explicit cautions for fiber composition, weight, stretch and hand-feel
- Development-mode analysis adapter so UI and schema can be tested before a production vision provider is selected

## Production follow-up
Replace the development adapter with the selected vision model/provider. The frontend contract should remain unchanged. Persist original assets, structured analysis, user corrections and provenance once the database/storage layer is connected in the next backend hardening pass.

## Phase 2 acceptance intent
1. Upload -> analysis -> structured profile works end-to-end.
2. Uncertain technical properties are not presented as verified facts.
3. User corrections are separate from original machine observations.
4. Invalid files fail gracefully.
5. The Designer remains usable if the analysis provider fails.
