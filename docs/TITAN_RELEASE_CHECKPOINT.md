# TITAN release execution checkpoint — append only for milestones

Canonical criteria: [TITAN_RELEASE_CHECKLIST.md](./TITAN_RELEASE_CHECKLIST.md). This checkpoint is evidence bookkeeping, NOT production approval. All timestamps UTC. After an interruption fetch the branch's **current** head, PR and exact-head workflow runs and reconcile with the latest record; this document can trail its own final commit by one SHA. Never transfer a parent run to a child head.

## 2026-10-29 — M0: compatible integration baseline identified (CODE-VERIFIED on old head)

- **Source branch:** `work/titan-legacy-gallery-origin-guard-20261029-2322`; upstream stacked draft PRs #499 → #500 → #501 (plus their ancestor chain); original main `b1c9d102219005da6f2584ea275a80e8dc021a37`.
- **Exact reviewed source commit:** `b15cfd5002688ab4bf44782fb0c91a118a765ce6`. The comparison to main is ahead 793 commits, behind 0; these drafts remain outside main. Verified PR #501 head is based on PR #500 head `008a8b55a190e86a8e85369f8b46cd905c2ccaa2`, and PR #500 on #499 `9c4d31d3848aa72ff83fc1a87d2b3134edc1d135`. No sibling was blindly merged.
- **Exact-head automated evidence:** GitHub Actions CI `40925675133` PASS (quality, npm test, engine, preview-performance, release:check, build, browser); Non-3D QA `40925675204` PASS (fixed photo, browser/responsive and source QA). Links: https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/40925675133 and https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/40925675204 . No native Blender or physical-human approval asserted.
- **Accepted engineering baseline:** strict physical inventory ledger, operator veto, safe same-origin legacy gallery scan; **J1 code evidence only**, physical J1 BLOCKED pending real stock. T1–T6/J1–J6 not complete.
- **Next:** persist six-workstream gates and close a bounded-response vulnerability on J4 share/enquiry.

## 2026-10-29 — M1: persistent release acceptance criteria (documentation committed; release gate pending)

- **Branch:** `work/titan-release-gates-handoff-20261029`, created without replacing any existing upstream draft, from exact `b15cfd5002688ab4bf44782fb0c91a118a765ce6`.
- **Resulting commit:** `176618fd2b92d26dd255392d63e2fe7ffbd8a5ea` (parent `b15cfd5002688ab4bf44782fb0c91a118a765ce6`).
- **Change:** `docs/TITAN_RELEASE_CHECKLIST.md` defines independently measurable T1–T6 and customer J1–J6, non-paid deterministic preview, exact-SHA CI, human/physical blockers, versioned release and separate merge/deploy approvals.
- **Verification:** GitHub contents write returned the exact commit SHA. Local build, tests and this commit's GitHub CI: **PENDING**; do not infer green from M0.
- **Next:** harden J4 upstream verified-owner read and share audit receipts, add regression tests and exact-head CI.

## 2026-10-29 — M2: bound customer lock/share/enquiry cloud evidence (code committed, CI pending)

- **Criterion:** J4 / T5 / T6. Two owner-scoped saved-revision RPCs were using unrestricted `response.json()`; share receipt also used unrestricted `audit.json()`. An oversized or malformed upstream body could exhaust request memory or delay a safe fail-closed result. This is a source defect, NOT physical acceptance.
- **Sequence (parent → result):**
  - `176618fd2b92d26dd255392d63e2fe7ffbd8a5ea` → `33b2f894b3fc6ab95ac7cd81489ae566cda1dd8d`: enquiry read bounded at 256 KiB via the existing decoded-stream-safe helper.
  - `33b2f894b3fc6ab95ac7cd81489ae566cda1dd8d` → `11fb56ee1c207bb35c0749233c93de4850f32a1f`: share audit JSON bounded at 4 KiB and malformed audit cannot become `audited:true`.
  - `11fb56ee1c207bb35c0749233c93de4850f32a1f` → `7d22b937ad2e78e8edc77152b7d196ba663ba60a`: exact source guards and positive/negative bounded payload regressions.
  - `7d22b937ad2e78e8edc77152b7d196ba663ba60a` → `71977605913d11743e2bc7b036f03d71e3f8c700`: correct source regex matching, preserving existing handoff assertions.
- **Files:** `src/app/api/designer/enquiry/route.ts`, `src/app/api/designer/share/route.ts`, `tests/locked-handoff-request.test.ts`; reused `src/lib/designer/bounded-json-response.ts`, no dependency/schema change and no new AI call.
- **Verification:** fetched and reviewed corrected test assertions from branch. All actual local unit/test/build commands and exact-new-head CI are **PENDING**. Do not call J4 complete until authenticated real Supabase lock, recovery, consent, and operator handoff is exercised.
- **Remaining blockers:** no real signed-in customer/operator, physical inventory/measurements, tailor/native 3D/device signoffs, real beta/first-ten outcomes or owner approval have been established; old branch evidence is not a substitute.
- **Next independent action:** wire checklist into the static release gate, open draft stacked PR, and examine this PR's fresh exact-head CI and browser logs. Correct failures on this branch. Then continue J3 authenticated persistence/handoff review without production writes.

## Resumption / approval boundaries

- **Current working branch:** `work/titan-release-gates-handoff-20261029`; latest observed source/test commit before this documentation checkpoint: `71977605913d11743e2bc7b036f03d71e3f8c700`. Always resolve GitHub head, not this text, before changes.
- **PENDING:** matching-head CI; browser 390/768/1440, quality, tests, engine, preview, release, build; genuine human/operator stock and all release signoffs. Base #501's passed runs apply only to `b15cfd5`.
- **Forbidden without explicit user approval:** merge into main, force update existing branches, publish/deploy production, run supplier-facing or real paid image jobs, change production Supabase records or apply migrations.


## 2026-10-29 — M3: require release records in the static code gate (CI pending)

- **Criterion:** T6 documentation/reproducibility. Parent source SHA before this milestone: `35b01c64422f0490222c6ada430186a9b248ada2`.
- **Commits:** `6a6fbaaf61bc49ec5140cd6570b92f1acd105bdf` adds checklist and checkpoint to `scripts/release-readiness.mjs` required files; `d939b09a0d20459957251c8fe3ba8b43573967a0` adds automated six-area/J1–J6 and bounded customer-handoff source guards; `48122ea15faca4b067bdda937d217af953b820e9` corrects regex escaping in new test. File contents were reread in the connected repository.
- **State:** automated exact-new-head quality/Node/engine/preview/build/browser/Non-3D CI **PENDING** until the draft PR check completes; static file presence does not substitute for live physical/human approvals. No `main` merge or production deploy.
- **Next:** open a draft PR stacked on #501 (do not retarget earlier PRs); verify its actual head SHA and both GitHub Actions runs. Repair failures on the new branch and then assess next J3 customer recovery path, preserving signed-in owner boundaries and backwards compatibility.


## 2026-10-29 — M4: J3 design + measurement vault recovery bounds and CI repair

- **Prior checked head:** `bcae649a36e5e1284092a985f1b65a5e0802d9cf` on draft PR #502. Exact-head CI run `40930530543` **FAIL** at `npm run release:check` because the old release script required `verifiedLockedHandoffAuditId(await audit.json().catch(()=>null))`. Up to this failure: quality, Node tests, engine and preview-performance were green; build and browser were not run. Exact-head Non-3D QA `40930530459` also failed. These are failures, not approvals.
- **Repair commit** `bf7dbe5fa50f7bf19d45391d620102c313330837`: replace the obsolete static share source token with `verifiedLockedHandoffAuditId(await readBoundedJsonResponse(audit,4 * 1024).catch(()=>null))`; require enquiry's 256 KiB bound. Preserves and strengthens the check rather than removing it.
- **J3 implementation commits:** `aad3b1882cfe57879d5dd07504776cd9a18a053d` (design vault), `e6244e8295f73b63fb7760d738b4de6a3e920e0e` (measurement vault), `69fdf2ef2df0ccda3821c484f3b9ab0b7f808298` (tests). Replace both vaults' unrestricted upstream JSON and error text reads: 256 KiB for single owner/token/store/claim RPCs, 4 MiB for owned lists; preserve eight-second abort and no-store. Invalid/oversize/failed responses remain 503 and never return a success-shaped vault record. Positive/negative tests and source wiring added. No owner/physical evidence fabricated.
- **T2 / J3 / T6 state:** source fix committed; full automated tests and owner-account recovery acceptance **PENDING** at the new integrated head. Do not call the entire journey PASS from synthetic tests.
- **Next:** await **exact-new-head** CI and Non-3D QA on PR #502, read failed step/log if any and repair rather than masking gates. Once both automated workflows pass, continue independent customer/operator and physical QA issues without production writes. Human supplier, tailor, Blender, devices, beta, live Supabase and owner release remain BLOCKED.


## 2026-10-29 — M5: deterministic original-model homepage without paid per-visit rendering

- **Criteria:** T4 original fixed Studio model/no-per-edit-paid-AI; T6 release invariants.
- **Defect reproduced by source review:** `src/app/page.tsx` displayed `<img src="/api/homepage-model"...>`. When `FASHN_API_KEY` was set, normal homepage visits called the FASHN model-generation provider; missing key returned original fallback. This violated the essential no-paid-AI core contract despite having an existing original photo.
- **Commits:** `43c5a85fcc2e41713ef68f1010fe39c4e6ba18b9` changes the default hero image to `/designer/studio-tucked.webp`, preserving original model. `cc988eccaa6d110e59b5e5fc270df484f0ed8df6` adjusts static/live release contract to require the canonical homepage and treat provider configuration as **optional** (health route still validated, Supabase readiness still mandatory). `990419e2f3f61da476f4b4c0c70ca187cd9002f7` adds automated source regressions guarding against accidental paid per-visit calls. The explicit render API remains available, but is not invoked by normal homepage loading.
- **Verification:** repository write SHA confirmed for all three; exact-new-head CI, static release gate, build and responsive browser acceptance **PENDING**. This is a confirmed code change, not a claim of signed-off photographic physical parity.
- **Outstanding:** owner-run customer journey, real verified supplier stock, native Blender/identity/human four-angle review and device/beta/production evidence. No provider charges, production changes, merge or deployment initiated.
- **Next:** verify exact new head on draft PR #502; inspect CI and browser failures, repair them; continue independent T5/J5 operator audit without live data mutations.


## 2026-10-29 — M6: bounded operator stock and production customer journey transport

- **Criteria:** J1 verified stock service transport; J5 operator quote/order and customer outcome, status and lineage transport; T5 security and T6 regressions.
- **Demonstrated defect:** upstream authenticated `src/app/api/operator/stock/route.ts`, `src/app/api/operator/production/route.ts` and `src/app/api/customer-account/production/route.ts` all buffered `response.json()` without decoded byte limits and read unbounded error response bodies via `response.text()`. A malfunctioning or compromised upstream could allocate unbounded memory even when individual requests carried strict input limits.
- **Commits:** `60b582d1888b6d970e3260757344f643d1a0ed15` operator stock (4 MiB physical snapshot/256 KiB mutation), `7552624dec5701d7cb204d7488829a01f5323c13` operator production (4 MiB list/256 KiB mutation), `6a69fd30743f0f29e2373b7626675fd7d64b314b` customer production (4 MiB owned list/256 KiB mutation), `4db618bc552d3710c9c72b238294c65c36abbeb3` positive/negative pure/source regression tests. Existing shared UTF-8 fail-closed reader reused; eight-second network abort/no-store/owner/operator authorization preserved. Upstream failure text is no longer buffered or echoed.
- **Verification:** new SHA commits confirmed by GitHub writes; tests, quality, engine, preview, release, build and target-width browser checks **PENDING on final integrated head**. Earlier intermediate CI runs may cancel on push; never count cancelled or parent green as this final head's proof.
- **External blockers:** actual owner authentication and physical stock, real operator/customer order workflow, fitting/cut/tailor/device acceptance, privacy/security audit and release approval not present. No physical stock or invoice/order records created, no provider charge, no main merge or deploy.
- **Next independent action:** verify exact integrated head GitHub Actions CI and Non-3D QA, inspect failures/repair; then inspect source-to-vault and order status receipt boundaries for further verified release blockers. Stop only at genuine external input with a precise evidence request, while continuing testable work.
