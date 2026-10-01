# ARCHITECTURE_AUDIT.md — Roadmap v2 adaptation

Date: 2026-10-01
Repository: `slokpatel-crypto/llinenearth-designer`
Roadmap target: Linen Earth Execution Roadmap v2

## Executive result
**Do not rebuild from scratch.** The current repo is already well beyond the roadmap's assumed starting point. Keep the existing application, preserve tested Designer / Analyzer / Style Director work, and make the premium true-scale shirt preview the next hard gate.

## Stack found
- Next.js 15.5.x
- React 19
- TypeScript 5.9
- Vercel-oriented Next.js deployment
- Supabase migrations / persistence work
- FASHN SDK for final photoreal rendering
- Sharp for image processing
- GitHub Actions CI already present

This is compatible with Roadmap v2. No stack rewrite is justified.

## CI / quality status
Existing `.github/workflows/ci.yml` already runs:
1. locked dependency install
2. production dependency audit
3. `npm run quality`
4. `npm test`
5. `npm run eval:engine`
6. `npm run eval:preview-performance`
7. `npm run release:check`
8. production build

Roadmap Phase 0 should therefore **strengthen and document the existing CI**, not replace it.

## Existing modules worth keeping

### Designer / Style Director
Status: **advanced / keep**
- closed option vocabulary and compatibility foundations
- deterministic ranking / rule evaluation
- Safe / Elevated / Statement directions
- canonical garment specification
- deterministic regression / evaluation harness
- real customer-facing Designer UI already exists

Action: adapt future roadmap rules to existing contracts. Do not create a parallel Designer.

### Fabric Analyzer
Status: **advanced / keep and extend**
- deterministic colour / LAB / pattern analysis
- repeat / stripe estimates
- evidence provenance
- explicit physical-scale evidence path
- operator review and ground-truth workflow
- catalogue binding and private Analyzer desk

Action: Roadmap Phase 2 becomes a calibration / ingestion hardening phase rather than a greenfield Analyzer build.

### Measurements
Status: **advanced foundation / calibrate + persist**
- current measurements influence body profile and Designer fit logic
- `fit-construction.ts` already creates provisional finished-garment targets from body measurements plus explicit house ease ranges
- `block-strategy.ts` already selects provisional starting block families and flags posture / shoulder / seat / mobility issues
- the code clearly labels these as provisional and requires tailor verification

Action:
- do **not** rebuild the ease engine
- calibrate the existing provisional ranges against Linen Earth tailor data / measured finished garments
- version any owner-approved ease-table change
- move customer-critical profiles from browser-only storage to durable authenticated persistence before public reliance

### Final render / QA
Status: **advanced foundation / keep**
- FASHN is already positioned as the final photoreal step
- multi-view final output and deterministic QA checks exist
- render caching exists
- measured evidence can flow into final-render QA

Action: continue evidence-gated QA; do not move FASHN into instant edits.

### Operator / evidence workflows
Status: **strong / keep**
- private fabric analysis
- designer evaluation
- construction approval
- device QA
- readiness aggregation

Action: use these workflows as the real-user / real-device gates required by Roadmap v2.

## Main module requiring focused rebuild / replacement

### Premium true-scale live shirt preview
Status: **hard-gate work required**

The repository already has:
- deterministic SVG / photo-based construction previews
- prepared fabric tiles
- approximate / evidence-aware pattern scaling
- multiple view support
- photo clipping / masking work

But Roadmap v2 requires a stronger proof:
- one known shirt
- known 5 mm / 10 mm stripe or repeat
- measured px-per-mm calibration per view
- premium believable cloth appearance
- physical-scale error measured against a fixture
- mobile edit latency target
- user realism review

**Decision:** do not throw away the current preview code. Build the proof slice alongside it, reuse the existing mannequin imagery, fabric assets, option vocabulary and evidence model, then replace / promote the winning renderer only after it passes the gate.

## Important architecture debt

### 1. Large UI files
Some Designer / preview files carry substantial UI + orchestration logic.

Risk: slow iteration and accidental regressions.

Action: while touching a feature, extract pure logic and renderer helpers behind stable interfaces. Do not start a broad refactor before the preview proof.

### 2. Browser-local customer state
Browser storage is still used in parts of the customer flow.

Risk: drafts / measurements can disappear on browser reset or another device.

Action: keep local autosave as convenience, but move customer-critical locked state to durable server persistence before Launch 1 is treated as operational.

### 3. Legacy brand spelling / identifiers
The repository contains historic `LLinen` identifiers / copy.

Action: new customer-facing copy uses **Linen Earth**. Preserve legacy technical identifiers where renaming would break data or deployment paths; migrate deliberately later.

### 4. Current code is ahead of the uploaded ZIP
The GitHub `main` branch contains newer Phase 10 work than the previously shared ZIP.

Action: GitHub `main` is the source of truth for implementation work. Do not base Roadmap v2 changes on the older ZIP.

## Top risks, ranked

1. **Preview looks composited / flat or cannot prove physical scale** — critical product risk.
2. **Physical fabric evidence incomplete** — cannot honestly claim exact scale / drape / GSM.
3. **Scope expansion across shirts + trousers + suits before shirt gate passes** — execution risk.
4. **Large UI modules make renderer changes brittle** — engineering risk.
5. **Customer-critical state still browser-local in places** — reliability risk.
6. **Real-device evidence not complete** — mobile experience risk.
7. **Owner / tailor approval data incomplete** — construction claims risk.
8. **Final AI renders can drift from deterministic design** — fidelity / cost risk.
9. **Production deployment can lag healthy main branch** — release risk.
10. **Legacy naming and old assumptions can leak into new roadmap work** — consistency risk.

## Roadmap remap

| Roadmap v2 phase | Adapted action in this repo |
|---|---|
| Phase 0 | Document current architecture, agent rules, decisions; keep existing CI |
| Phase 1 | Build measurable Premium Shirt Proof on top of current assets |
| Phase 2 | Extend existing Analyzer into verified fabric-truth pipeline |
| Phase 3 | Reuse current option library / rules / Designer; swap in proved preview |
| Phase 4 | Calibrate existing ease / finished-target engine, version owner-approved ranges, and harden persistence |
| Phase 5 | Durable lock / reconstruct / share / enquiry hardening |
| Phase 6 | Reuse current Style Director; tighten buildability + evaluation |
| Phase 7 | Reuse FASHN + QA + caching; improve acceptance gates |
| Phase 8 | Add production bridge on same canonical spec |
| Phase 9 | Use existing operator QA / CI / security work to harden launch |
| Phase 10+ | Ecommerce / closed loop after product proof |

## Immediate next task
Create `/lab/proof` (or an equivalent isolated proof route) for the shirt renderer. It should use:
- one base shirt
- front + three-quarter views
- 3 collars
- 3 cuffs
- 3 fabrics, including known-scale stripe fixtures
- explicit px-per-mm calibration
- a 50 mm debug ruler
- measured scale-error output
- edit-latency instrumentation
- no AI network call on edits

**Gate:** do not promote the renderer into the customer Designer until scale accuracy, latency and realism checks pass.

## Phase 0 status after this commit
- [x] Existing repo chosen as base
- [x] CI found and preserved
- [x] AGENTS.md added
- [x] DECISIONS.md added
- [x] Roadmap-to-code audit written
- [x] Preview proof route implemented
- [ ] Real-device / human realism gate recorded (instrumentation is implemented; physical reviews are still required)
