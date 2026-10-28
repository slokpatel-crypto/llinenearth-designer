# TITAN 15:00 IST — fabric proof-to-Designer boundary (2026-10-28)

## Source audit
Base draft PR #442 exact head `ca27429ba189be771321c3c9f431e164a0cb75ca`: CI 40657449175 success; non-3D browser QA 40657449187 success; native source candidate 40657449193 failed its intentional production release gate. Earlier source evidence remains 563.54 mm cuff spacing against maximum 536 mm, 112/110 sleeve UV shared-edge tears, metric distortion and no photo/tailor parity. `main` is not changed.

## Actionable defects
1. Physical provenance accepted impossible calendar dates, future inspection receipts, HTTP links, credential-bearing URLs and coerced object/number signers, sometimes truncating evidence silently.
2. Reviewed Analyzer fabric could upgrade customer-facing physical repeat, GSM, drape or fibre from invalid or coerced values; rejected review statuses were not explicitly barred, and an arbitrary non-HTTPS source string could pass the audit-source check.

## Fix and scope
- Strict typed, bounded, canonical non-future provenance receipts; HTTPS URL with no embedded credentials. No supplier evidence was created or modified.
- Customer fabric enrichment now requires approved/corrected human review, a valid auditable source/note, finite positive mm repeat, valid optional stripe width, bounded GSM and known drape/fibre. Invalid physical claims stay provisional, independently of the still-unresolved 3D release gate.
- 10 positive/negative focused Node tests cover valid provenance, malformed dates, URLs, type coercion, invalid scale/GSM/drape/fibre, review status and note-only provenance. Local `node --experimental-strip-types --test tests/titan-fabric-*.test.ts` passed 10/10 before commit.
- No production data write, schema migration, paid provider, canonical model/photo change, merge or deployment.

## Compatibility and follow-up
Existing correctly recorded provenance and approved/corrected reviewed Analyzer values remain accepted. Previously tolerated malformed physical receipts are now ignored rather than promoted; operators must correct the evidence, not fabricate it. Follow up with exact-head CI, full test/build/release/preview gates and physical supplier/tailor signoff. Keep next 16:00 work on authenticated stock and vault recovery, without modifying production data.

## Additional intake integrity hardening
Direct fabric data-URL ingestion now rejects malformed base64 padding, incomplete quartets and noncanonical pad bits before a capture is accepted. The existing JPEG/PNG/WebP MIME allowlist and byte limits remain; actual image decoding still belongs to the Analyzer pipeline. A malformed non-string source URL cannot be laundered into verified physical evidence by appending a note. Three additional positive/negative Node regressions were added (13 focused tests total). No file bytes, stock, customer data or evidence records were changed.
