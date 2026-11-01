# TITAN authenticated ledger HTTP fixture acceptance

Parent: PR #670, exact commit `b7062a6317fc911a773187c8bb16a7121954a545`.

The built Next operator production GET now has an automated HTTP acceptance runner against an ephemeral loopback PostgREST fixture. No application behavior or schema changes. The runner starts its own Next process with synthetic session/backend credentials and a minimal environment, signs a real operator cookie and exercises the real route. The fixture permits only the five named list RPCs with their exact p_limit values; it checks all five calls for each batch. No external backend or mutation RPC is used.

45 passing cases: genuine empty ledger; each list preserving records at its exact limit; six malformed/over-limit variants for each of five lists; and verified optional PGRST202 404 versus generic 404/outage for each of three optional lists. Each response checks private/no-store and exact public response content. CI runs this after the production build.

Local verification (2026-11-01): quality PASS; all 685 tests PASS; engine evaluations PASS (29 scenarios/145 requests); preview performance PASS; release check PASS with live checks explicitly skipped; production build PASS; built-Next fixture HTTP 45/45 PASS; diff whitespace PASS. Dependencies reused from an existing installation with byte-identical package-lock.json. Existing CSS compatibility warnings remain. No new UI or application-code changes.

Parent exact-head CI #41286237630 and Non-3D #41286237685 are both success. New commit matching-head CI/browser checks remain PENDING until GitHub runs finish. Main was `72f6bf2e1368e718d62ee95a97c456c708a5ffc1`; its Vercel git.deploymentEnabled remains false. Parent is 61 commits ahead of main across 23 files, so isolated new test success alone does not certify that intake chain. Verify upstream intake and relevant disposable database gates before ordered integration. User authorization permits tested production sections on main, but does not remove verification requirements. No deploy performed.

Next action: inspect new matching-head CI and fixture step; resolve any failures; verify parent intake/database evidence for main integration. Physical fabric, tailor/QC, model-source, device, novice tester and delivery release evidence remains separate and unverified.
