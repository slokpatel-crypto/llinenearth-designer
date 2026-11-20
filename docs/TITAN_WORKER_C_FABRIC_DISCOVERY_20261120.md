# Worker C — fabric discovery into Designer (2026-11-20)

## Customer gap addressed
The former `/catalog` route silently redirected to Designer, so customers could not browse the shirt/trouser inventory in a dedicated discovery step or carry a deliberate pair into Designer. This implementation replaces the redirect with an accessible, responsive catalogue.

## Implementation
- A new customer-facing `/catalog` page fetches the same current inventory already consumed by Designer, with the same local deterministic multi-term search. It shows separate shirt and trouser grids, selectable swatches, count/filter feedback, selected pair and a clear next-step action.
- The pair is passed only by two bounded catalogue option IDs in `/designer-studio?from=fabric-catalog&shirt=...&pant=...`. A pure validator rejects unknown, duplicate, malformed and cross-garment values, and resolves both against the currently loaded server-backed catalogue.
- Designer applies the pair only once the catalogue is loaded, resets stale private fit/profile/creative/assessment and previous lock lineage, and creates a fresh draft. It does not carry a vault revision, secret, cached stock promise or measured physical fact.
- The catalogue labels live versus fallback-only data. Catalogue visuals do not prove availability, colour accuracy, fibre, GSM, repeat scale or physical drape.

## Compatibility / evidence boundaries
No database migration or new service/dependency; existing Designer, Style Director, shared-recipe and authenticated-vault entrypoints remain distinct. The `/catalog` URL now serves a real discovery page; old links remain valid. No real customer data, production stock or paid rendering is mutated. QA uses synthetic catalogue and mocks.

## Verification
- Pure tests for route contracts, malicious/duplicate params, unknown fabric IDs, category isolation, private-state isolation and route contract.
- New built-Next Playwright UI at 390px/768px/1440px selecting a real fixture pair, checking the Designer handoff, responsive overflow, and recording screenshots. Added to primary CI.
- Full AGENTS.md commands, CI and independent Non-3D UI QA at exact PR head required before any merge.
