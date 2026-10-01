# Phase 8 — Production Bridge Adaptation

Status: production handoff, printable tech pack, real usage capture, stock/quote/order workflow, authenticated customer ownership, finished-garment QC and zero-reentry evidence capture are implemented. Physical calibration and real first-order outcomes remain open.

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
- [x] versioned meterage-table registry + owner/tailor approval gate implemented
- [x] append-only live stock / reservation integration
- [x] evidence-safe operator-entered quote ledger
- [x] authenticated customer ownership propagated into quote/order records
- [x] authenticated customer quote review + direct acceptance evidence
- [x] privacy-safe authenticated customer production timeline
- [x] tailor-ready formatted tech pack / print layout
- [x] finished-garment QC evidence desk + delivery gate
- [x] first-10 zero-reentry evidence capture + scorecard implemented
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
- every new receipt/adjustment requires a named checker/recorder and a concrete physical source reference (roll tag, receipt, stock-count sheet, etc.),
- positive-stock readiness remains open if any contributing manual stock event is legacy/provenance-free,
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
- authenticated customer ownership propagated from the immutable locked revision into quote/order records when ownership is unambiguous,
- customer account view of itemized quote and production status without private operator notes,
- privacy-safe order timeline from the append-only production event ledger, exposing status timestamps only and keeping operator payloads private,
- authenticated customer acceptance of a sent quote, recorded as an append-only customer-account event before operator order creation,
- accepted-quote consistency checks,
- append-only production status events through delivered / cancelled.

These systems provide the engineering path for zero re-entry. They do not make meterage, price, stock or production claims until the corresponding physical / operator evidence is entered.


## Finished-garment QC delivery gate

A new private **Finished Garment QC** desk closes the engineering gap between a production order reaching **Ready** and being marked **Delivered**.

The operator must inspect the real garment and record:
- a named inspector/checker and a concrete physical inspection reference,
- locked construction match,
- exact fabric identity match,
- finished-measurement check against the approved target,
- stripe/check/pattern alignment where applicable,
- stitching / seam / button / finishing quality,
- clean and damage-free condition,
- optional inspector initials, defect tags and notes.

Approval is append-only evidence tied to the production order, locked revision and recipe hash. A rework decision automatically sends the order back to **Stitching**. The API and database both refuse **Delivered** unless the latest QC inspection is approved **and** contains current provenance (named inspector + physical inspection reference). Legacy provenance-free approvals remain historical and do not unlock delivery.

This remains a human physical inspection. The software does not auto-claim that a garment passed QC.


## First-10 zero-reentry proof

A private **Zero-Reentry Proof** desk now measures the remaining operational gate instead of letting it be checked manually.

For every real **Delivered** order, the operator records whether any design data had to be typed again during the handoff or production flow. If re-entry happened, the audit records which category was re-entered and preserves the incident instead of hiding it.

The scorecard evaluates the **first 10 delivered orders in chronological order**:
- all 10 must have a completion audit tied to a named operator/checker,
- every qualifying audit must include a concrete production-flow evidence reference such as a tailor job card, cutting packet or dispatch record,
- all 10 must confirm zero manual design-data re-entry,
- any recorded re-entry incident keeps the gate open,
- legacy completion rows without provenance remain visible but do not satisfy the current gate.

The software therefore supplies the evidence mechanism, but the roadmap item stays incomplete until 10 real delivered orders actually prove the result. Production-packet generation itself no longer claims zero re-entry; it proves only that the packet came directly from the immutable locked revision, while the real post-delivery audit supplies the operational proof.


## Versioned meterage calibration registry

The engineering path for the remaining **validated cloth estimation table** is now implemented without seeding generic tailoring numbers.

The private **Meterage Registry**:
- refuses to register a garment calibration draft until the server can verify at least 20 valid real cut cases for that garment,
- stores explicit non-overlapping fabric-width bands, base metres and optional pattern-matching allowance,
- versions every table,
- requires a named owner/tailor approver before activation,
- automatically retires the previous active table for the same garment when a new version is approved,
- keeps the roadmap validation gate open until real evidence and a real approval are entered.

The code therefore supports a controlled production estimator, but it does not call any meterage value validated until Linen Earth has supplied the physical cut data and owner/tailor sign-off.


## Meterage evidence integrity

- Meterage model registration now revalidates every submitted evidence case ID against the append-only operator production-usage ledger.
- Case IDs must resolve to an unambiguous real cut for the same garment; unknown, duplicated-input or cross-garment IDs are rejected.
- A model cannot even be registered through the hardened route before 20 verified real cuts exist, and approval rechecks the same evidence again before activation.


## Physical stock provenance gate

New manual stock receipts and adjustments are accepted only with a named checker and a physical source reference. The v2 stock snapshot reports manual-event provenance per fabric. Legacy stock rows remain part of the numeric balance for audit continuity, but any positive-stock fabric with provenance-free manual events stays **open** in Roadmap readiness rather than being treated as verified live stock.


## Reservation quantity provenance

Stock reservation metres are no longer accepted as an unexplained operator number. Every new reservation must name the requester/checker and reference the real source of the quantity (for example an approved meterage sheet or tailor request). The reservation remains tied to the immutable locked revision and keeps the existing idempotent request-key protection.
