# Customer saved-design legacy compatibility checkpoint — 2026-11-18

Parent source SHA: `714e06876147536af1b4696609690774f989e288` (observed in preceding run; branch may have advanced before this edit).
Source fix SHA: `4d03b525735ad20594391ef179e656244d59cd09`.
Regression SHA: `6c8c4e5987d979d9d9fa58928e9de32a47585a22`.

Acceptance slice: two distinct legacy versions with no `specHash` must both survive local saved-design deduplication; saving one again must replace only its own version. Previously all absent `specHash` values compared equal and the second save silently discarded the first.

Evidence: committed `tests/saved-designs-legacy.test.ts`; matching-head GitHub workflow lookup immediately after regression commit returned zero runs. **Test not yet verified passing.** Required: full CI, Non-3D, quality, tests, engine, preview-performance, release check and build at exact head.

Blocking release gap: this fixes browser-local legacy data loss only. Ordinary saved designs still use browser-wide localStorage, not authenticated owner-scoped server persistence. Cross-account denial, second-device recovery, independent review and disposable database evidence remain **PENDING**. Real fabric, stock, tailor, customer/device and native Blender evidence remain **PENDING/BLOCKED**; no physical approval is inferred.

Next slice: verify matching-head CI; then implement authenticated server-backed ordinary saved designs and negative cross-account tests on a compatible security branch. Do not merge to main or deploy without isolated intake and all required gates.
