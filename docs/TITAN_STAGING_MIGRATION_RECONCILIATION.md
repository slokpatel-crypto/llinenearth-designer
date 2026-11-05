# TITAN staging migration reconciliation — 2026-11-05

Scope: read-only engineering verification on stacked draft PR #905 branch. No production DB access, migrations, merges, deployment, stock mutation or human signoff.

Parent: `53c41a0c0b6e42556b8e8a5c571073c0932e845c`. Parent exact-head Full CI `41963651933` SUCCESS; Non-3D `41963651793` SUCCESS; read-only migration inventory `41963651870` FAILED CLOSED at the real historical inventory step (synthetic tests succeeded). This failure is an unresolved real migration-history blocker, not a CI pass.

New commits:
- `529eeafe29aac5c974f9430be0ecb14ea5fb1c40` — compare staging manifest version, filename and byte-exact SHA-256 without connecting to a database.
- `163fae4425524b70f23e5d2e76a94f60a1f69b6a` — negative regression cases for missing, duplicate, changed and ambiguous histories.
- `b74990f34595c1fca1c8e1c40ec97500f0fa3900` — independent synthetic CI job, including missing-manifest fail-closed check.

Acceptance: implementation committed; matching-head new workflow, Full CI and Non-3D results PENDING / not yet inspected. A successful synthetic test does not establish a real staging match. This comparison requires an independently exported trustworthy staging manifest with actual SQL digests; standard Supabase migration history often has versions without SQL bytes, so no fingerprint should be invented.

Next 30–40-minute slice: inspect new exact-head CI, repair any workflow/test failures, obtain authorized staging migration history via read-only export, identify actual collisions and prove a disposable full historical replay before any integration. Keep physical stock, tailor, customer, device, Blender and owner gates PENDING.
