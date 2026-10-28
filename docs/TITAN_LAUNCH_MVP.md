# TITAN — smallest launch-ready MVP

Decision date: 2026-10-28. **Current status: candidate for an invitation-only customer enquiry beta; not approved to launch.** Software tests cannot replace physical, tailor, identity or production checks.

## One customer journey

A customer selects **real, currently reviewed Linen Earth stock** for one shirt and one trouser, edits an existing supported collar/cuff/fit recipe, sees the existing fixed-identity photographic front preview, saves/recovers measurements, locks a versioned design and sends a traceable WhatsApp/enquiry or tailor handoff for **manual operator review**. The deterministic editor must work without paid or generative AI credits.

This is the only journey that must work for the first beta. The supported photo can visibly be labelled *approximate* where garment construction, fabric repeat, colour or drape is unverified. No fabricated true-scale, realistic 3D, tailor acceptance, stock guarantee or guaranteed garment fit may be implied.

## Core in scope

1. **Fabric truth and availability:** only active reviewed shirt/trouser SKU IDs, declared-versus-measured provenance, correct repeat units and a fail-closed stale-stock response; owner/operator confirms actual roll before quoting.
2. **Existing photographic Designer:** fixed `linen-earth-studio-model-v1` / `/designer/studio-tucked.webp`, deterministic front preview, physically honest coverage labels, responsive controls at 390/768/1440px and no paid AI per edit.
3. **Canonical selections:** existing closed option vocabularies, StyleSpec v2 compatibility, valid fabric IDs and supported construction; edits invalidate stale preview/assessment.
4. **Measurements and lock:** invalid tape/fit receipts fail closed; locked spec includes version, both exact fabrics, options and hash; recovery/share and manual tailor packet refer to the same immutable revision.
5. **Manual lead handoff:** durable account-owned saved design + authenticated recovery/enquiry, customer contact/consent, operator access and human confirmation before any tailoring or payment. No browser-only record may be treated as an accepted order. **An audited enquiry intent does not prove a WhatsApp message was sent, nor provide an operator inbox; both require separate acceptance.**
6. **Minimum operations:** operator can review current stock/provenance and the canonical tech pack; errors and missing live database evidence prevent readiness.

## Explicitly deferred

- New model, replacement photo, four-angle photoreal 3D and Blender promotion; isolated 3D remains engineering-only with known sleeve-spacing/UV failures.
- Per-edit AI, mandatory FASHN credits, optional final fashion renders, elaborate Style Director consultations and additional garment classes such as blazers/suits.
- Checkout, B2B accounts, automated pricing/production/stock reservation and first-ten delivery claims; broader product/research/marketing pages and notifications.

Existing implementations of these features are **preserved**, not deleted; they are simply not beta acceptance dependencies.

## Go/no-go evidence before any customer beta

- [ ] New-stack exact-head CI: `npm run quality` (this repository's lint/quality command), `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`, and real 390/768/1440 Chromium with no new errors.
- [ ] Separate #444–#447 and #448–#450 draft stacks reconciled, reviewed and staged for one deliberate integration; no conflict or silently omitted patch.
- [ ] Supplier/operator-confirmed real fabric stock, reviewed field-level provenance and honest photographic approximation; measure repeat before promising true scale.
- [ ] Real authenticated Supabase environment verifies owner-scoped lock, recovery, enquiry and operator handoff, including invalid/stale/replay attempts and migrations.
- [ ] Real customer/tailor checks cover legibility, measurement collection, exact SKU/recipe handoff and a human decision to accept/reject each lead; obtain consent and document beta disclaimers.
- [ ] Run target mobile + desktop device acceptance and human release/security signoff, including live runtime identity. No unreviewed native 3D claim.
- [ ] Explicit owner approval for the *major milestone* deployment; preserve existing `[deploy]` policy, and do not deploy from this draft.

## Immediate engineering order

1. Finish strict, uncoerced request selectors and real HTTP regressions; verify the **new head** in CI/Chromium.
2. Reconcile the two active draft ancestry stacks and duplicate request-security helper; choose one stable integration head, test again without touching customer model/photo.
3. Audit a single complete owner-scoped design → measurement → lock → enquiry → operator retrieval flow against real configured Supabase; repair only reproduced gaps.
4. Collect actual stock/tailor/device evidence, then decide whether to release the restricted beta. Public production readiness remains a separate milestone.
