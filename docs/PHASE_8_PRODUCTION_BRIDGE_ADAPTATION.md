# Phase 8 — Production Bridge Adaptation

Status: production handoff, printable tech pack, real usage capture, stock ledger, quote ledger and production-order workflow are implemented. Physical calibration and first-order evidence remain open.

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
3. Enter physically verified opening stock / receipts in the new append-only stock ledger.
4. Use reservation / release / consumption lifecycle against locked revisions.
5. Create operator-entered quotes with immutable line items and status history; no prices are auto-invented.
6. Create production orders from the same locked revision / recipe hash, optionally tied to an accepted quote.
7. Validate the first production orders with zero manual re-entry of design details.

## Completion gate

- [x] immutable recipe traceability
- [x] evidence-safe tailor handoff schema
- [x] exact fabric IDs in handoff
- [x] construction / finished-target export
- [x] unresolved-item export
- [x] no invented meterage / price
- [x] Designer handoff export
- [ ] validated cloth estimation table
- [x] append-only live stock / reservation integration
- [x] evidence-safe operator-entered quote ledger
- [x] tailor-ready formatted tech pack / print layout
- [x] finished-garment QC evidence desk + delivery gate
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


## Stock, quote and order engineering

The private Operator Desk now has:

### Stock Ledger
- append-only receipts and adjustments,
- physically measured metres only,
- available / reserved / physical snapshot,
- revision-linked reservations,
- release and consume flows,
- transaction locking to reduce oversubscription risk,
- no seeded or guessed opening balance.

### Production Desk
- quote creation tied to a locked revision ID and 64-character recipe hash,
- deterministic subtotal / adjustment / total validation,
- operator-entered price lines only,
- quote state history: draft → sent → accepted / void,
- production-order creation from the same locked recipe,
- accepted-quote consistency checks,
- append-only production status events through delivered / cancelled.

These systems provide the engineering path for zero re-entry. They do not make meterage, price, stock or production claims until the corresponding physical / operator evidence is entered.


## Finished-garment QC delivery gate

A new private **Finished Garment QC** desk closes the engineering gap between a production order reaching **Ready** and being marked **Delivered**.

The operator must inspect the real garment and record:
- locked construction match,
- exact fabric identity match,
- finished-measurement check against the approved target,
- stripe/check/pattern alignment where applicable,
- stitching / seam / button / finishing quality,
- clean and damage-free condition,
- optional inspector initials, defect tags and notes.

Approval is append-only evidence tied to the production order, locked revision and recipe hash. A rework decision automatically sends the order back to **Stitching**. The API and database both refuse **Delivered** unless the latest QC inspection is approved.

This remains a human physical inspection. The software does not auto-claim that a garment passed QC.
