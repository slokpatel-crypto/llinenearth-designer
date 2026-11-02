# TITAN: first-ten delivered-order ledger completeness gate

**2026-11-02 | Source-only. Production launch remains BLOCKED.**

Current privileged source queries return opposite historical windows:

- `production_order_list(p_limit=500)` orders **all order statuses** by `created_at DESC` (the newest orders).
- `production_delivery_evidence_list(p_limit=500)` joins delivered-order evidence to the order registry and orders by `created_at ASC` (the earliest audits).

Both SQL functions cap the response to **500 rows**, with no total count or cursor. The earliest ten actual deliveries can be outside the newest-500 order window. Likewise, the first ten audit records cannot be assumed exhaustive when the evidence RPC reaches its limit. A positive `firstTarget.length >= 10` or all ten Boolean source receipts in these two windows does **not** establish the original ten actual delivered orders in the full database.

**Conservative API gate (this PR):** An authenticated, valid ledger read returns HTTP 200 with `configured:true` only when **both lists have strictly fewer than 500 rows**. If either reaches the cap, return a private/no-store HTTP **409** with a fixed, non-sensitive message explaining that historical pagination is required. The caller must not render a first-ten "SOURCE AUDITED" acceptance from truncated data, and it must not create a fresh delivery audit against an incomplete ledger. The separate clean-main delivery-audit UI follow-up #790 fails closed on non-2xx responses; merge it only after its own checks.

This is deliberately conservative when exactly 500 entries exist but none more. It sacrifices availability of the operator audit until trustworthy total-count/cursor evidence exists instead of forging coverage. It does not modify any SQL RPCs, production orders, service keys, stock quantities, physical proofs or Vercel settings.

**Real follow-up required:** Design and test a service-only, page/total-aware delivery evidence RPC covering the complete set of delivered orders, stable ordering (including ID tie breaker), and authoritative source links, in an isolated restored staging database. Only then can the full chronological first-ten delivery gate be certified and made usable beyond 500 rows. Physical dispatch/delivery and tailor/owner signoffs are separate required gates.

**Verification required:** Full CI + independent Non-3D QA at exact branch commit, including 499/500 boundaries and a strict no-cache 409 contract. No deploy or migrations before owner signoff.
