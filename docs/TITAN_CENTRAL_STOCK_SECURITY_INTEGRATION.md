# TITAN — central combined stock/customer-security integration rehearsal

**This is an isolated, unapproved test snapshot, NOT a merge to main or a deployment.**

Base main: `4dd8020abd83429449ff53ea5bb71b046394d86e`. Source PRs and exact commit heads:
- #863: `714e06876147536af1b4696609690774f989e288`
- #876: `228d8d8c86dd8983e5dbc25d4a569f4b0e585676`
- #879: `b30aa0856c98f31dd472d8633be3ac160ac6bbbe`
- #880: `d980b0a369894f8ec485a56e42939db3d350ff25`

For all changed paths except `.github/workflows/ci.yml`, this branch imports the source PR's original Git blob SHA, unmodified. The sole shared file, `.github/workflows/ci.yml`, was reconciled: retain Security #863's responsive customer/share browser check and customer session/OTP/revocation PostgreSQL job while adding Stock #876's manual-stock lock migration and two-session parity test. The AST source caller guard #879 and executable v1 ACL retirement #880 are also present.

**Additional integrated native SQL sequence:** on this rehearsal branch only, the legacy ACL workflow now applies the manual stock/fabric lock-parity migration **after the red-before-green v1 grants probe**, runs the two-session lock-parity regression, then applies the legacy v1 EXECUTE retirement **twice**, verifies effective function grants and makes real `service_role`-switched calls. This proves both migrations can be applied in their intended order in one disposable PostgreSQL instance. The separate source #880 workflow intentionally remains unchanged.

**Shared-database stock/customer security interaction:** after both stock migrations and negative `service_role` function execution tests complete, the same native PostgreSQL job now applies the three customer-session, share-revocation and OTP rate-limit SQL migrations in **the same database**. It runs the original three customer SQL regressions (with rollback), then reruns all legacy stock effective-ACL and actual role-invocation checks. Finally, it asserts that all four private synthetic ledgers/tables remain empty. This is a specific cross-domain privilege/namespace regression, not a claim that production Supabase has these permissions or that live account persistence is verified.

**Disposable filename-order overwrite proof (Issue #882):** a new native script `scripts/test-stock-reserve-filename-order-overwrite.sh` first asserts the curated final `fabric_stock_reserve_v2` strictly rejects an overlength idempotency key. It then replays the alphabetically later historical `20261103_stock_reservation_provenance_gate.sql` against **the same disposable database**, creates a rollback-only synthetic physically evidenced receipt and reserve, and checks that an 181-character key is silently stored as 180 characters. It then reapplies the strict identity migration, checks rejection returns, confirms zero stock rows persist, and reruns retired-v1 role ACL probes. This is an intentional red-behavior demonstration, **not** permission to apply the unsafe order in production. Preserve both source migrations unchanged until the owner-reviewed history/version-map solution in #882.

**Acceptance gate:** exact-head `CI / build`, `CI / Disposable PostgreSQL stock reservation invariants`, `CI / Disposable PostgreSQL customer security revocations`, `Deep Engine — Non-3D QA / studio`, and `TITAN Legacy Stock RPC ACL QA / Disposable PostgreSQL legacy stock RPC ACL` must all pass. Check actual jobs, not only summaries. No inherited green checks from individual PRs can substitute.

This snapshot is not automatically updated when worker PR heads move. Reconcile and reverify any new changes, staging role/provenance and external legacy callers, independent reviews and GitHub main protection #878 before any owner-approved merge. Real inventory, tailor signoff, 3D model/UV and ten customer deliveries remain separate production gates. No live Supabase operation, no stock-writes unlock, no Vercel deploy.
