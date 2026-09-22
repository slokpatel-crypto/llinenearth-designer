# LLinen Earth 1.0 Production Release Checklist

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
