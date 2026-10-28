# TITAN — verified locked-design customer handoff gate

Source implementation date: 29 October 2026. **Draft, not an approved beta.**

## Customer sequence and exact trust boundaries

1. Customer reviews the actual shirt/trouser IDs, physical-evidence caveats and body measurements in the existing fixed-identity photographic Designer.
2. `lockGarmentSpec` hashes the canonical garment recipe, records an immutable revision ID, and invalidates prior completion links on re-lock. This is code-level integrity, not tailor approval.
3. Customer may explicitly save the locked revision to the Supabase vault. Authenticated account ownership is best effort; a recovery token remains an independent secret. No success is claimed until the store RPC confirms.
4. Public share and WhatsApp draft endpoints require the **complete hash-verified locked revision**. Both apply same-origin Fetch Metadata/Origin, JSON media type, bounded streamed UTF-8 body (96 KiB), private no-store responses and best-effort per-process throttling.
5. A durable preparation-audit acknowledgment requires an actual UUID returned from the private RPC; HTTP 200 or a truthy JSON object alone cannot make `audited=true`.
6. The customer sees a prepared WhatsApp draft and must separately click **Open WhatsApp and send**. The link only includes selected garment IDs/names/options, occasion and shortened recipe hash; private measurements/recovery keys are not attached.
7. Only a human-observed WhatsApp receipt or operator-confirmed conversation can establish that the enquiry was delivered; then staff separately review actual fabric stock, measurements and tailoring details before quoting or cutting.

## Regression evidence to collect

- [ ] Exact-head Node tests: valid revision JSON, invalid arrays, corrupt UTF-8/JSON, wrong Content-Type, Origin/Fetch Metadata, overlimit streamed bytes, throttling, UUID vs malformed audit receipts.
- [ ] Actual HTTP tests for both public routes: cross-site and malformed 400/403/413/415 and `Cache-Control: no-store`; no real audit/WhatsApp send during tests.
- [ ] Production build and existing 390/768/1440px pinned Chromium visual checks; ensure no new console errors.
- [ ] Manual target-mobile test: re-lock clears stale WhatsApp link, the direct anchor opens only `https://wa.me`, customer taps Send, and staff confirms real receipt.
- [ ] Live configured Supabase smoke: save / listOwned / loadOwned / recover / audit receipt UUID / operator handoff against a **test account and test stock**, with permission/privacy review. Earlier live introspections timed out; never substitute mocks for this gate.
- [ ] Customer consent, actual tailor review, stock/provenance signoff and deliberate major milestone approval.

## Non-goals

No automated ordering, payment, AI credits, 3D identity replacement, or assertion that an enquiry is received because an audit row exists. The older draft SQL RPC shape must not be replayed into the current v2 production first-ten schema.

## Operator acceptance extension (same customer → tailor milestone)

- [x] Source implementation: quote/order POST actions accept only literal 12–180-character revision identity, lowercase canonical 64-hex recipe hash, bounded literal recovery token and typed untruncated notes/optional quote IDs.
- [x] Source implementation: the privileged `designer_locked_revision_vault_get` response must contain exactly one unexpired, structurally valid vault row; then the original locked SHA-256 revision is revalidated and compared with the requested revision/hash before a quote/order RPC.
- [ ] Verify exact-head static + unit + production build + browser CI on stacked operator draft.
- [ ] Test real operator session, genuine vault expiry/replay, customer ownership and quote rejection using an isolated Supabase test environment; database schema introspection previously timed out.

The operator UI still asks for the customer's recovery token, which is an independent secret; do not add it to public share/WhatsApp links. No order is created simply by preparing an enquiry.
