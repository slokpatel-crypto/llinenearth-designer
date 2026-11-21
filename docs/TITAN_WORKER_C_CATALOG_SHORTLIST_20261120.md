# Worker C — customer catalogue shortlist and evidence comparison

Date: 2026-11-20

## Customer-facing milestone

The existing catalogue supported selection of a single shirt and trouser cloth but did not support an explicit side-by-side decision. Customers can now build independent shortlists of up to three shirt fabrics and three trouser fabrics, inspect the same catalogue details and evidence statuses, and explicitly apply a candidate to the primary pair. The subsequent handoff remains the existing validated `from=fabric-catalog` link, preserving exact selected IDs and existing locked-design boundaries.

## Engineering and privacy

- `src/lib/designer/catalog-shortlist.ts` has pure deterministic selection/reconciliation and comparison helpers. Invalid category/ID never enters a shortlist; removed catalogue entries cannot remain after a server refresh. The shortlist is in-memory presentation state, not a private database or an immutable design revision.
- `src/app/catalog/page.tsx` provides accessible toggle controls, a hard three-item maximum, evidence panels, explicit “Use this fabric” buttons, and separately labelled shirt/trouser sections.
- `src/app/catalog/catalog.css` supports 390, 768 and 1440 widths with a single-column comparison card on small devices.
- Existing `fabricEvidence` text is reused without treating catalogue metadata as proven physical attributes. Fibre content is labelled verified only when its field-specific verification flag is true.

## Verification gates

- `tests/catalog-shortlist.test.ts`: capacity, deduplication, stale catalogue pruning, cross-garment rejection, unknown physical facts, proof labels and separation from the primary pair.
- `scripts/verify-fabric-catalog-handoff.cjs`: browser tests at 390/768/1440, maximum compare count, separate trouser shortlist, explicit choose, no silent handoff mutation, exact IDs and no page errors/overflow.
- Exact-head `quality`, all tests, engine and performance evaluations, release and production build, synthetic private API checks and independent photographic/3D browser CI are required before merge.

No new migration, runtime dependency, producer calls, service credentials or production customer records.
