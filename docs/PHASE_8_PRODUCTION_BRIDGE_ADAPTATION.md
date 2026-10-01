# Phase 8 — Production Bridge Adaptation

Status: production handoff contract implemented; validated meterage / stock / quote systems remain intentionally unfilled.

## New production handoff

A locked design revision can now be exported as `linen-earth-production-handoff-v1`.

It carries:
- locked revision ID and recipe hash,
- exact shirt / trouser fabric IDs,
- construction specification,
- finished-garment targets already present in the canonical spec,
- block strategy and construction checks,
- unresolved review items,
- production placeholders for cloth estimate, stock reservation and quote.

## Evidence boundary

The handoff deliberately leaves these values blank until Linen Earth validates them:
- shirt metres,
- trouser metres,
- stock reservation ID,
- price / currency.

The application does **not** invent meterage from generic tailoring rules and does not infer price or stock from the visual catalogue.

## Designer integration

After **Lock recipe revision**, Designer now exposes **Export tailor handoff**. The handoff is traceable to exactly the same immutable recipe hash.

The same locked handoff can also export a printable HTML tech pack. It includes exact fabric IDs, construction selections, finished-garment target ranges, block/check information, unresolved items and blank production fields where meterage/stock/quote evidence is still missing. It intentionally does not invent those values.

## Remaining production work

1. Measure actual cloth usage across representative shirt / trouser sizes and fabric widths.
2. Agree owner/tailor estimation formulas and version them.
3. Connect exact stock roll / available metres.
4. Add reservation lifecycle and idempotent stock changes.
5. Add quote calculation and append-only price / adjustment history.
6. Validate the first production orders with zero manual re-entry of design details.

## Completion gate

- [x] immutable recipe traceability
- [x] evidence-safe tailor handoff schema
- [x] exact fabric IDs in handoff
- [x] construction / finished-target export
- [x] unresolved-item export
- [x] no invented meterage / price
- [x] Designer handoff export
- [ ] validated cloth estimation table
- [ ] live stock / reservation integration
- [ ] quote engine
- [x] tailor-ready formatted tech pack / print layout
- [ ] first 10 production orders completed with zero design-data re-entry


## Real cloth-usage calibration now implemented

The private Operator Desk now includes **Production Calibration**. After a real garment is cut, the operator can record:
- locked revision ID,
- garment side,
- exact fabric ID,
- actual fabric width,
- actual metres consumed,
- measured pattern repeat when relevant,
- whether pattern matching was required,
- cut/size context and operator notes.

The dashboard keeps shirt and trouser evidence separate and waits for at least 20 real cases on each side before calling the dataset ready to analyse. It reports observed medians only as descriptive evidence; those medians are **not** used as customer meterage estimates or quotes.

This closes the engineering gap for collecting the evidence needed to build a future meterage model without inventing numbers.
