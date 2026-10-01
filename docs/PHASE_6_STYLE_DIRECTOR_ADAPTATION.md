# Phase 6 — Style Director Adaptation

Status: advanced existing implementation; Roadmap v2 is mostly a grounding / evaluation phase.

## Existing foundation to keep

- Guided intent capture for occasion, mood, time, climate, hero garment and colour direction.
- Real Linen Earth stock references.
- Three distinct design directions.
- Deterministic Designer / rule-engine handoff.
- Existing real-model preview path.
- Direct handoff into the full Designer with exact fabric IDs and construction context.
- Feedback and evaluation telemetry.
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
- [ ] owner-labelled benchmark threshold met
- [ ] real-user test confirms directions are understandable and materially distinct
