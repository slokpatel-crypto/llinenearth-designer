# TITAN Reference Look — Independent Shirt and Trouser Samples (2026-11-17)

Stacked on draft #987, not production-ready and not approved for merge/deploy.

## New customer behaviour
- A single locally supplied photo supports independently sampled shirt and trouser colours.
- Selecting the other garment does not reuse a colour from the first. Each target has its own catalogue matches and a visible sampled/not-sampled status.
- A customer can clear one selection without losing the other; replacing the photo clears both.
- Existing photo-patch median logic and deterministic CIE76 catalogue ID rankings are unchanged.

## Boundaries
- No remote upload, semantic garment detection, material recognition, verified colour, stock confirmation, fit recommendation, persistence or completed Designer handoff.
- Existing M1 browser photo click flow remains; full keyboard canvas access, mobile visual QA and true outfit-to-versioned-recipe handoff remain outstanding.

## Verification required
- Added pure regression tests for distinct targets, clear-one behaviour, input fail-closed and non-mutating RGB samples.
- Amended Playwright browser smoke to enforce isolation and persistence at 390, 768 and 1440 px without weakening any existing checks.
- Exact-head CI, npm quality/test/engine/preview/release/build, responsive screenshots and independent review must pass before considering merge.
