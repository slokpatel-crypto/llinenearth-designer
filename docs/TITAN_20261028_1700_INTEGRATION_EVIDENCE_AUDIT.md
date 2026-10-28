# TITAN 17:00 IST — integration reconciliation and Phase 8 evidence boundary (2026-10-28)

## Source verification
- Based on #444 exact head `dd9b39bbfec8dfeea41f2857d96eee3233ebdae0`, stacked through #443/#442/#441/#440 and native #311. GitHub exact-head CI and Deep Engine Non-3D QA were **successful** for #440–#444. Source-locked native 3D candidate workflows for #440–#442 **failed their intentional production preflight gate**; do not treat that as a passing model.
- `main` remained `b1c9d102219005da6f2584ea275a80e8dc021a37` when inspected. Root `TODO.md` is absent on #444, so progress and handoff are recorded here and in the draft PR; do not invent TODO completion.

## Fixed defects
1. `/api/operator/production-evidence` POST was an authenticated **service-role** write accepting unbounded `request.json()` without Origin/Fetch Metadata/content-type checks. It now reuses the proven 16 KiB streamed UTF-8 JSON gate before any privileged RPC, rejects malformed UUIDs, and separates operator validation messages from backend errors.
2. The same POST returned raw Supabase exception text to browsers on failure. It now emits a generic 503 while logging server-side diagnostics.
3. The Phase 8 "first ten delivered orders" proof used `production_order_list(p_limit:500)`, which returns the **newest** orders, while the evidence RPC returns the **oldest** 500. Once capped, the UI could falsely label ten newer deliveries as the first ten. The GET now flags a capped order **or** evidence list as incomplete; the summary and UI keep the gate OPEN and explain why. This is deliberately conservative; exact 500-record populations require uncapped authoritative verification before a proof claim.

## Tests / compatibility
- Positive/negative Node tests added for cross-site request rejection, chunked payload caps, same-origin JSON, route wiring, backend error redaction and capped-history gating.
- No migration, dependency change, production data write, model replacement, paid provider call, merge or deployment.
- Existing records remain readable; new POST failures are fail-closed. Historical first-ten evidence cannot be certified once the 500-row RPC cap is reached until a separately approved paginated/aggregate authoritative contract exists.

## Next handoff
- Inspect exact-head CI, Node/quality/engine/performance/build and Chromium widths 390/768/1440; source-locked native Blender remains a separate gate.
- Native original-model cuff spacing remains about 563.5 mm against max 536 mm; sleeve UV discontinuities 112/110, photographic parity, true supplier repeat and tailor signoff remain open.
- Production Supabase project health alone does not prove schema/RLS/stock/restore; earlier read-only SQL calls timed out. Recheck only read-only evidence when available. Do not merge or deploy without separate approval.
