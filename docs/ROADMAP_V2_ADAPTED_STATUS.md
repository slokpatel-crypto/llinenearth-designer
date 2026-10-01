# Linen Earth — Roadmap v2 Adapted Status

Date: 2026-10-01
Source of truth: current GitHub repository, not the older ZIP.

## Overall approach

Roadmap v2 is being adapted onto the existing Linen Earth platform. Working modules are retained. New work focuses on the hard gates the roadmap requires rather than recreating existing Phase 10 functionality.

| Roadmap phase | Current adapted status | Main remaining blocker |
|---|---|---|
| Phase 0 — Audit / Stabilize | Engineering complete | merge after CI / review |
| Phase 1 — Premium Shirt Proof | Engineering implementation complete | physical scale measurement + 8-viewer realism + device evidence |
| Phase 2 — Fabric Truth | strong existing foundation | owner / supplier physical evidence coverage and 50-fabric reviewed set |
| Phase 3 — Deterministic Designer | strong existing foundation | promote proved preview only after Phase 1 passes |
| Phase 4 — Measurements / Fit | advanced foundation | real-person accuracy study, tailor ease calibration, durable persistence |
| Phase 5 — Lock / Share / Enquiry | lock + share + secure recovery vault implemented | authenticated customer-account ownership |
| Phase 6 — Style Director | advanced foundation | owner-labelled benchmark / real-user validation |
| Phase 7 — Final Render / QA | advanced foundation | approval-rate, cost and physical-pattern QA evidence |
| Phase 8 — Production Bridge | safe handoff contract implemented | validated meterage, live stock, quote engine, production orders |
| Phase 9 — Hardening | strong engineering foundation | real device / beta / production deployment evidence |
| Phase 10 — Ecommerce | intentionally later | only after Launch 3 |
| Phase 11 — Closed loop | ongoing | post-launch evidence |

## Work completed in this Roadmap v2 branch

- Added persistent agent operating rules and architecture decisions.
- Audited the actual current repo and rejected a full rewrite.
- Added isolated `/lab/proof` Premium Shirt Proof.
- Connected current Linen Earth fabric photos.
- Connected the existing photographic mannequin.
- Connected runtime physical-repeat evidence to the photographic compositor.
- Added <= 8% pattern-scale gate.
- Added geometry and real-compositor p95 measurements.
- Added 8-viewer realism gate.
- Added auditable proof JSON export.
- Added direct Analyzer handoff for the selected proof fabric.
- Improved photo cloth depth / fold / textile-detail compositing.
- Added evidence-aware verified-vs-approximate scale disclosure in customer preview.
- Added deterministic photo-repeat audit math + tests.
- Removed numeric direction ranking from Style Director candidate UI.
- Added immutable SHA-256 locked design revision contract + verification tests.
- Added Designer lock/export action.
- Added evidence-safe production / tailor handoff contract.
- Added Designer tailor-handoff export.
- Added printable tailor tech pack generated from the same locked recipe.
- Added phase adaptation records so future coding agents do not rebuild existing systems unnecessarily.

## Evidence we cannot manufacture in code

These remain intentionally open because they require a person, physical cloth or a real device:

- real stripe/check repeat measurements in millimetres,
- physical colour checks,
- owner / supplier GSM, fibre and drape evidence,
- 8 independent realism ratings,
- target-device QA,
- real-person measurement accuracy,
- tailor-approved ease calibration,
- real render approval / cost observations,
- live stock / reservation behaviour,
- actual production order outcomes.

## Promotion rule

A later phase may continue engineering while a physical gate is waiting, but no customer-facing claim is upgraded from approximate / provisional to verified until its evidence gate passes.
