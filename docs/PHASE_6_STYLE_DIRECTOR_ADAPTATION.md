# Phase 6 — Style Director Adaptation

Status: advanced existing implementation with owner benchmark and real-user validation evidence workflow; real evidence/sign-off remain.

## Existing foundation to keep

- Guided intent capture for occasion, mood, time, climate, hero garment and colour direction.
- Real Linen Earth stock references.
- Three distinct design directions.
- Deterministic Designer / rule-engine handoff.
- Existing real-model preview path.
- Direct handoff into the full Designer with exact fabric IDs and construction context.
- Feedback and evaluation telemetry.
- Private anonymous real-user validation desk for understandability, material distinction, exact stock handoff and blocking issues.
- Append-only owner/reviewer validation sign-off after real evidence exists.
- Creative-generation / critique work is already separated from the deterministic garment core.

## Roadmap v2 alignment completed

- Style Director directions are presented as different buildable directions, not a numeric winner ranking.
- Candidate tabs now use their named tier / direction instead of 01 / 02 / 03 ranking labels.
- Explanations use non-ranked bullets.
- The exact fabric IDs and style handoff remain authoritative when opening Designer.
- Final photoreal rendering remains separate from the instant deterministic preview.

## Remaining evidence work

- Complete the owner-labelled benchmark set.
- Confirm top-three retention / owner agreement only after the existing evidence threshold is met.
- Continue checking that every shown direction resolves to actual stock fabrics and supported construction IDs.
- Treat unsupported / provisional construction choices as review items rather than silently inventing buildability.

## Completion gate

- [x] structured intent capture
- [x] real-stock candidate generation
- [x] three distinct directions
- [x] deterministic Designer handoff
- [x] no numeric candidate ranking in customer direction UI
- [x] feedback / evaluation foundation
- [x] real-user validation capture + human sign-off engineering
- [ ] owner-labelled benchmark threshold met
- [ ] real-user test confirms directions are understandable and materially distinct


## Real-user validation threshold hardening

- Style Director sign-off now requires a **human-entered clean-case target** between 1 and 50. The software does not invent how many successful user tests are enough.
- A clean case means the latest result for that anonymous case reports understandable directions, materially distinct directions, a working stock/style handoff, and no blocking issue.
- Database approval is rejected until the latest unique clean-case count meets the documented target.
- Legacy approvals without a documented target remain historical evidence and cannot complete the current Phase 6 validation gate.


## Signed handoff evidence

- Every Style Director result now receives a short-lived server-signed handoff token containing the exact stock pair, occasion, context and supported style.
- Designer verifies the signed payload against the state it actually opened before a handoff audit can be recorded.
- Real-user validation can count a successful stock/style handoff only when it references that verified server audit.
- Handoff audit tokens are SHA-256 fingerprinted and idempotent, and each audit may support only one user-test row, preventing replay of one handoff across multiple anonymous cases.

- Clean real-user validation now counts **distinct signed handoff audits**, not just anonymous case IDs. Reusing one verified handoff under multiple test IDs cannot inflate the human evidence threshold, and database sign-off v3 enforces the same rule.


## Stock-aware direction generation

Style Director now applies the same provenance-ready physical stock ledger overlay used by Designer before building directions. Verified out-of-stock cloth cannot be recommended; catalogue-only cloth remains usable without being presented as fully verified live-stock evidence.
