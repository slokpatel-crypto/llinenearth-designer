# Phase 11 — Closed Loop Adaptation

Status: post-delivery customer outcome capture plus human review/threshold-policy engineering are implemented. Real delivered-order outcomes and a real approved learning policy remain operational evidence gates.

## Implemented closed-loop evidence

Authenticated customers can now record an outcome only against a production order that:
- belongs to their account,
- has reached **Delivered**,
- preserves the exact locked revision trace through the production ledger.

The outcome records:
- overall result: love / good / needs work,
- fit result: clean first fit / minor alteration / major alteration / not checked,
- explicit confirmation that the garment was worn before fit evidence is accepted,
- an optional customer note, with a note required for problem outcomes,
- immutable evidence timestamp and exact production-order link.

## Privacy and evidence boundary

Customer outcome data is held in the private production schema and exposed only through authenticated server routes.

The private Production Desk can view the latest outcome for an order. Customer outcome evidence is **not automatically applied to Designer ranking or fit intelligence**. That separation is intentional: customer feedback can be noisy, subjective or caused by production execution rather than design logic.

The private **Customer Outcome Review** desk now adds that control layer:
- each customer outcome can be approved or rejected by a named reviewer,
- rejected evidence requires a reason,
- the minimum approved-case threshold has no software default,
- a named human must enter and document the threshold policy,
- the evidence gate can report whether the human-defined quantity is met,
- even a met evidence gate does not automatically alter Designer ranking.

A later learning rule may only map reviewed evidence into bounded recommendation signals after this real evidence and policy gate is satisfied.


## Durable design lineage

A delivered-order outcome must still be explainable after a temporary secure design-vault copy expires. Orders created from a verified locked-design recovery token can therefore store a minimal immutable **production learning context** alongside the order.

The retained context contains only:
- locked revision ID and recipe hash,
- garment rule/schema versions,
- occasion/climate/intention,
- exact shirt and trouser fabric IDs,
- shirt fit/wear/collar/cuff/placket/button choices,
- trouser shape/rise/waistband/break choices,
- non-personal creative treatment identifiers when present.

It intentionally excludes measurements, finished body targets, body-profile data and block/body-shape information.

The human review gate refuses to approve an outcome for learning when this durable lineage is absent. Older/manual orders can still retain customer feedback for service evidence, but they do not count toward the learning threshold.

## Completion gate

- [x] authenticated delivered-order outcome capture
- [x] server validation for rating / fit / wear evidence
- [x] problem outcomes require explanatory evidence
- [x] privacy-safe customer account display
- [x] private operator visibility
- [x] automatic learning explicitly disabled
- [x] privacy-safe durable order → design learning context implemented
- [x] learning approval requires durable design lineage
- [ ] real delivered-order outcome dataset collected
- [x] human review / rejection workflow implemented
- [x] human-entered threshold policy registry implemented with no default threshold
- [ ] real learning policy approved and recorded
- [ ] real evidence threshold reached before any ranking influence
- [ ] post-launch outcome analysis completed


## Durable context integrity hardening

- Human-approved customer outcomes count toward the learning threshold only when the attached durable production context uses the supported context version, matches the outcome's immutable revision ID, carries a valid recipe hash, and identifies both shirt and trouser fabric references.
- A generic, stale or mismatched JSON object can no longer satisfy the Phase 11 learning gate merely by being present.
- This remains evidence gating only; reaching the threshold still does not automatically change Designer ranking.
