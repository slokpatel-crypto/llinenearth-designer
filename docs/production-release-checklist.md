# TITAN — production release acceptance (current, 2026-11-02)

**Launch state: BLOCKED — NOT DEPLOYMENT-READY.** This is the authoritative six-area TITAN acceptance overlay. An npm check, synthetic PostgreSQL test, completed pull request, or successful browser regression is **not** supplier/tailor/customer/production approval. No percentages or estimated completion claims.

**Current integrated baseline:** `main` commit `6985cbda97a28283870a2daea4ab819924f5465c` after documentation PR #765. `vercel.json` has `git.deploymentEnabled=false`. Preserve the original `linen-earth-studio-model-v1` and deterministic customer journey, including previously working features. Do **not** change live SQL, stock, billing or Vercel without explicit approval.

| Area | Evidence required before signoff | Latest verified state |
| --- | --- | --- |
| **T1/J1 — Style Director + option truth** | Every supported collar/cuff/placket/tuck/trouser selection maps to exactly the locked tailoring instruction and stable saved revision, with original model and browser screenshots | **Open:** all-option production acceptance and real tailor signoff not verified |
| **T2/J2 — Measurements + tailor handoff** | Real tailor compares body/garment measurements, ease, fit, consumption, construction and revision packet; discrepant values rejected and signed off | **Open:** individual real tailor and fitting acceptance not verified |
| **T3/J3 — Fabric intelligence + real stock** | Supplier/roll identity, actual composition/GSM/metres/colour/pattern repeat, measured calibration and provenance; safe ledger writes only after isolated Supabase staging migration, backup/restore and reconciliation | **Blocked:** read-only live PostgreSQL 17.6 preflight reported `BLOCKED`: `record_v3` absent and `reserve_v2` replay-payload source guard absent. No staging branch/restore evidence |
| **T4/J4 — Photographic/3D Studio** | Four-angle original-model reconstruction, native Blender/UV/drape evidence, measured pattern scale, mobile/desktop visual review, no prototype mistaken for approved production asset | **Open:** original Blender source, four-angle realism/UV/physical review not independently accepted |
| **T5/J5 — Operator workflow and real QA** | Auth, replay, permission and retry checks plus 5 distinct completed customer tester journeys, accurate fit/stock handoff and 10 real deliveries with QC evidence | **Open:** CI source tests do not substitute for five real testers or ten deliveries |
| **T6/J6 — Release and performance** | Exact integrated-commit Full CI + independent Non-3D, mobile devices/accessibility/security, no paid-AI core dependency, release runbook/restore evidence, explicit owner signoff before production activation | **Open:** source drafts tested separately; no integrated final launch proof, no owner launch approval |

**Release controls and next actions:** Keep the stock v3 stack (through draft PR #771) outside `main` until its full dependency chain and matching-head checks are satisfied; even passing CI cannot authorize migration. The connected database currently has working v2 functions, but `fabric_stock_write_ready_v1()` and `fabric_stock_record_v3(...)` are absent. The more restrictive server-side write gate is **in draft, not on integrated `main`**; do not assume the current v2 API is read-only just because draft tests pass. Next concrete external input is an **approved separate Supabase staging environment with restorable backup**, followed by verified real supplier rolls, a tailor, five testers, ten deliveries and owner approval. Continue independently testable engineering while these are pending.

**Interpreting commands:** `npm run release:check` is a **static code-contract check only**, not permission to deploy. `npm run release:check:live` is an older website/provider check; its optional FASHN configuration is **not a requirement of TITAN's deterministic, no-paid-AI core**. Optional final photoreal provider workflows must be gated independently and never substitute for the local preview or truthful physical evidence.

---

## Archived 1.0 checklist — historical baseline, not TITAN launch authorization

The checks below document the September 2026 website/desktop/provider release process. Its historical checked entries and FASHN requirement are **not** current TITAN production acceptances; use the six-area gate above for the launch decision.

This is the final release sequence. Do not mark a stage complete until its verification passes.

## 1. Code baseline
- [x] `main` contains the Style Director, Live Visual, Operator Desk and LLinen Earth OS.
- [x] GitHub CI is green.
- [x] `npm run release:check` passes.
- [x] Production dependency audit has no high/critical vulnerabilities.

Verified on 2026-09-22 against `main` commit `c11eb2994f1306b8aa87266ea2f2eef6044606ae`; GitHub Actions CI run `35528804411` completed successfully and the CI workflow includes the high-level production dependency audit plus release readiness gate.

## 2. Customer website
- [ ] Vercel production deployment points to the latest `main` commit.
- [ ] Homepage intro, Style Director and Live Visual load on desktop and mobile.
- [ ] Garment cards open the correct Live Visual garment.
- [ ] WhatsApp, Instagram and Google Business links work.
- [ ] No broken editorial/fabric images.

## 3. FASHN
- [ ] `FASHN_API_KEY` exists in the Production environment.
- [ ] Enable it in Preview too when visual QA is required before production.
- [ ] `/api/homepage-model?status=1` returns `configured: true`.
- [ ] Homepage model response uses `X-LLinen-Render: fashn-model-create`.
- [ ] Generated model is visually checked for realistic anatomy, fabric drape and premium menswear presentation.
- [ ] Live Visual/FASHN flow is tested with at least one shirt, trouser, suit and blazer case.

## 4. Supabase cloud memory
- [ ] A production Supabase project is connected.
- [ ] Apply `supabase/migrations/20260920_style_events_hardening.sql`.
- [ ] Configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel.
- [ ] Configure the operator sync/session secrets from `.env.example`.
- [ ] `npm run cloud:check` passes.
- [ ] Schema health reports version 5, RLS enabled, browser roles blocked and service role SELECT/INSERT only.
- [ ] Website event reaches the desktop after sync.
- [ ] Desktop event reaches the cloud and is not duplicated on retry.

## 5. LLinen Earth OS
- [ ] Version is 1.0.0 in Tauri, npm and Rust metadata.
- [ ] Windows workflow completes on `main`.
- [ ] Download the NSIS `.exe` and `SHA256SUMS.txt` artifact.
- [ ] Verify checksum before installation.
- [ ] Install on a clean Windows machine.
- [ ] Verify desktop lock and 15-minute idle lock.
- [ ] Verify automatic backup and manual backup verification.
- [ ] Verify crash recovery/system report.
- [ ] Confirm Ctrl+K search, Guide and + New walk-in work.

## 6. Real shop flow smoke test
Use one disposable test customer and complete this full flow:
1. New walk-in.
2. Add phone/name and occasion.
3. Record measurements.
4. Select a real fabric and physically verify metres.
5. Create order and value.
6. Record deposit/payment.
7. Add fitting/trial appointment.
8. Move order through cutting → tailoring → trial → ready → collected.
9. Export tailoring job card.
10. Confirm paid/balance values.
11. Confirm the customer timeline is complete.
12. Confirm cloud sync preserves the timeline after restart.

Delete/close only the disposable test record after the release decision; do not edit historical production ledger rows directly.

## 7. Inventory launch audit
- [ ] Review all imported/structured fabric entries.
- [ ] Mark unavailable/catalog-only colours correctly.
- [ ] Verify physical metres for fabrics promoted as in stock.
- [ ] Resolve duplicate legacy swatches.
- [ ] Confirm website colour labels match the shop’s real rolls.

## 8. Release decision
Run:
```bash
npm run release:check
RELEASE_URL=https://<production-domain> npm run release:check:live
```

The second command must run with the production Supabase and LLinen secret environment variables available.

Release is approved only when:
- web CI is green,
- Windows installer workflow is green,
- FASHN health is configured,
- Supabase cloud check passes,
- and the real shop-flow smoke test succeeds.
