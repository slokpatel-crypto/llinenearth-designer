# TITAN Worker C — Private saved-design version comparison

## Customer result

My Account can select any two saved locked designs and show a deterministic,
read-only comparison of stored shirt and trouser fabric IDs, style choices
and recorded parent-child lineage. This is an aid to choosing which saved
version to continue in Designer Studio, securely share, or enquire about.

## Reuse and boundaries

- Existing `/api/designer/vault` `listOwned` retrieves only account-owned cards.
- For **both** selections, `loadOwned` checks the signed-in owner server-side;
  the browser then checks `revisionId`, `recipeHash`, and SHA-256 lock integrity.
- No comparison is produced if either load, ownership, schema or hash check fails.
- Diffing happens in a pure function. No new database table/RPC, paid render,
  saved revision mutation, public comparison link, or external data transfer.
- Same-fabric ID with a revised saved label remains the same fabric identity.
- When both revisions contain valid StyleSpec v2, every enumerated shirt/trouser
  field is compared by exact stored ID. When either revision is legacy-only,
  compare only options that both legacy payloads actually recorded.
- Ancestor labels are **direct** only; no assumption that parents are still
  available, no fabricated complete genealogy. Unrelated revisions can also
  be compared side by side.
- Show readable, bounded labels with no customer measurements, body profile,
  production status, creative research notes, stock or fit guarantee.
- All compared information is synthetic in CI; none of the checks qualifies
  real-customer or physical tailoring acceptance.

## Regression and release gate

- `tests/customer-resume.test.ts`: deterministic fabric and construction diffs,
  direct ancestry, unrelated versions, same-revision conflict rejection,
  legacy-limited disclosure, output privacy, owner and hash verification wiring.
- `scripts/verify-customer-journey.cjs`: 390, 768 and 1440px built Chromium
  comparison, parent and changed exact fabric/cut display, no overflow or paid
  provider calls, explicit forbidden second revision with no partial output,
  plus existing share/enquiry/Studio resume/reassess/exported child coverage.
- All AGENTS.md commands, exact-head GitHub CI, Non-3D UI browser evidence,
  independent review and current main ancestry required before merging.
- This is stacked on Worker C's authenticated vault PR #996. Its parent must
  be merged and the stacked diff rebased/retargeted before an independent
  production-safe merge into main.
