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
