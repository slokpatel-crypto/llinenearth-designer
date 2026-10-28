# TITAN 16:00 IST — authenticated stock, production and vault boundary (2026-10-28)

## Source and branch
Based on draft #443 head `af21f450aaf26829350e6d6490bcaf4c792279fd` (stacked through #442/#441/#440/#311). Earlier #443 exact-head CI and non-3D QA completed successfully; native source geometry is still blocked by sleeve spacing, UV continuity, photo/tailor evidence. `main` is unchanged. This branch is a draft; no merge, deployment, production schema migration or data write.

## Verified defects and changes
1. Production service-role POST accepted unrestricted JSON bodies without browser Origin/Fetch Metadata checks; hostile cross-site requests and oversized chunked payloads could reach privileged RPC paths. A shared fail-closed JSON request gate now checks Origin, Fetch Metadata, content type, Content-Length and actual streamed UTF-8 bytes (48 KiB production, 256 KiB locked-design vault, 16 KiB measurement vault).
2. Both recovery vaults had no corresponding browser Origin/JSON/stream cap. They now reject cross-site writes, malformed/array JSON, invalid UTF-8 and oversized payloads before privileged RPCs, without changing stored records or recovery-token formats.
3. Measurement-vault payload validation accepted arbitrary observation values and extra fields, shallowly checked measurement structure and coerced account-owned vault IDs. Version-1 physical fields and observation vocabularies are now strictly validated; partial measurements and unassessed observations remain valid, not invented.
4. Stock and production endpoints exposed raw Supabase error details to the browser. Backend failures now use generic public errors while server logs retain diagnostic detail. Stock mutations additionally reject hostile Fetch Metadata requests. Input-validation feedback remains separate.

## Regression and release evidence
13 local focused Node tests passed against the new pure modules (8 request-gate + 5 measurement validation). Repository tests also cover route ordering, redaction and stock Fetch Metadata; run exact-head GitHub CI and real Chromium QA before marking all checks passed. No live Supabase, customer profile, stock metreage, supplier provenance, tailor signoff or physical geometry was fabricated or changed.

## Compatibility / handoff
Same-origin JSON clients remain supported; account-owned and recovery-token paths remain available. Previously accepted malformed observation records now fail closed until corrected. Operators must verify production Supabase migrations, security grants, stock physical counts and a disposable end-to-end delivery/restore test before launch. Next 17:00 integration should inspect matching-head CI, fix any regressions, reconcile the stacked draft chain and preserve native source blockers. Do not merge or deploy without separate approval.

## Read-only production connector probe
Supabase project listing returned `llinen-earth-designer` (`wfplvqmsdzwhwwupsbfu`, `ap-south-1`) with reported `ACTIVE_HEALTHY` project status. **This is not a database, RLS, stock RPC or live delivery validation.** Read-only attempts to list migrations, inspect public tables and run `select current_setting('server_version')` all failed with database connection timeouts. No production data was read or changed; leave all live schema/security/stock gates open and retry a read-only database audit only when connectivity recovers.
