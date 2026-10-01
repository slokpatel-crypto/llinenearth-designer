# Phase 2 — Fabric Truth Adaptation

Status: advanced foundation already exists; calibration and ingestion hardening remain.

## Existing code we keep
The current repository already contains the main Roadmap v2 fabric-truth building blocks:
- 66 catalogue swatch images in the current stock library.
- deterministic crop / tile generation in `scripts/build-fabric-render-assets.mjs`.
- measured colour and pattern analysis.
- repeat detection and pattern orientation.
- explicit physical-scale states instead of silently claiming exact scale.
- reviewed Analyzer records and provenance.
- operator review / correction workflow.
- runtime enrichment of Designer fabrics from reviewed Analyzer evidence.
- server-side catalogue API used by the Designer and Phase 1 proof.

This means Roadmap v2 Phase 2 is **not a new Analyzer project**. It is the work of turning existing image analysis into trustworthy, measured physical fabric records.

## Physical truth rules
1. A catalogue image can supply appearance evidence, but it cannot prove physical dimensions by itself.
2. `repeatMm`, `stripeWidthMm`, swatch width, GSM, drape, opacity and composition must keep their provenance.
3. Unknown physical scale remains approximate.
4. Reviewed physical scale may override approximate render scale without regenerating the underlying catalogue image.
5. Lea yarn count is not treated as GSM.
6. Customer-facing exact-scale claims require verified physical evidence.

## Current acceptance state
### Engineering
- [x] fabric stock catalogue
- [x] prepared render tiles
- [x] deterministic pattern orientation / repeat detection
- [x] provenance-aware Analyzer records
- [x] operator review path
- [x] Designer runtime enrichment
- [x] verified repeat can drive live/photo preview scale
- [x] unknown scale remains visibly approximate
- [ ] bulk physical-measurement completion for the first launch fabrics

### Physical work still required
For the first shirt launch set:
- [ ] identify the initial 50 real fabrics
- [ ] physically measure repeat / stripe width where visible patterns exist
- [ ] record real swatch width when using swatch-width calibration
- [ ] verify colour under a repeatable capture setup
- [ ] measure / confirm GSM where operationally needed
- [ ] record drape / opacity from physical cloth rather than image inference
- [ ] confirm composition from supplier / product documentation
- [ ] owner review before marking the fabric publish-ready

## Promotion rule
A fabric may appear in the Designer before all physical facts are known, but the UI must distinguish:
- visually available / catalogue evidence
- reviewed metadata
- physically verified evidence

Exact pattern-scale badges require verified physical scale. Missing physical evidence must never be filled by AI guesswork.
