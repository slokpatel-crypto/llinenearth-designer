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

## 9. Native Real Model Designer candidate QA (not a release approval)
- [ ] Run the existing identity-locked Blender scene through `scripts/blender/preflight-linen-earth-officewear.py`; resolve sleeve spacing, body/garment collisions, UV continuity and physical silhouette failures on the actual asset.
- [ ] Render to a **fresh** output directory with `scripts/blender/render-linen-earth-model-qa.py`. The renderer blocks when native preflight fails; it validates and atomically publishes front, three-quarter, side and back candidate frames plus `model-qa-native-preflight.json` and `model-qa-manifest.json`.
- [ ] Verify the exact .blend SHA-256, preflight-script SHA-256, native preflight report SHA-256, canonical reference-photo SHA-256, reported sleeve/leg spacing, UV seam counts, body intersections, frame SHA-256, PNG integrity, dimensions and camera yaw. Run `python3 -m unittest discover -s scripts/blender -p 'test_*.py' -v` for software-only negative cases.
- [ ] Independently compare all four actual renders to the original `/designer/studio-tucked.webp` and record human photo/garment review. Obtain physical repeat, drape and tailor approval separately. A valid candidate manifest is **not** four-angle parity, real physical proof or release signoff.

**Independent offline recheck** (using the exact original .blend and the preflight script from the rendering run):
```bash
python3 scripts/blender/model_qa_evidence.py \
  --manifest artifacts/model-qa-<unique-run>/model-qa-manifest.json \
  --source-blend .cache/linen-earth/linen-earth-officewear-authored.blend \
  --preflight-script scripts/blender/preflight-linen-earth-officewear.py \
  --reference-photo public/designer/studio-tucked.webp
```
A passing offline recheck validates recorded file identity only; it cannot prove the native preflight was honestly run or replace independent visual/physical review.

**Rejected candidate diagnostics (never promotion evidence):** when native preflight fails, invoke the renderer explicitly with `--diagnostic-rejected` and a separate, fresh `--output-dir`. This preserves four-angle debugging images and a hashed **failed** native report with `nativePreflightPassed: false` / `rejectedDiagnostic: true`; it exits with code **2** after writing diagnostic artifacts and does not clear the geometry gate. The independent CLI requires `--allow-rejected-diagnostic` to check those files and returns exit code **2** while labelling them REJECTED; do not use that as a passing release check. The older #311 native workflow must be adapted to pass the flag and use separate fresh directories before integration.
