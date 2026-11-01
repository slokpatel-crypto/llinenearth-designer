# TITAN authenticated ledger HTTP fixture acceptance

Parent: PR #670, exact commit `b7062a6317fc911a773187c8bb16a7121954a545`.

The built Next operator production GET now has an automated HTTP acceptance runner against an ephemeral loopback PostgREST fixture. No application behavior or schema changes. The runner starts its own Next process with synthetic session/backend credentials and a minimal environment, signs a real operator cookie and exercises the real route. The fixture permits only the five named list RPCs with their exact p_limit values; it checks all five calls for each batch. No external backend or mutation RPC is used.

45 passing cases: genuine empty ledger; each list preserving records at its exact limit; six malformed/over-limit variants for each of five lists; and verified optional PGRST202 404 versus generic 404/outage for each of three optional lists. Each response checks private/no-store and exact public response content. CI runs this after the production build.

Local verification (2026-11-01): quality PASS; all 685 tests PASS; engine evaluations PASS (29 scenarios/145 requests); preview performance PASS; release check PASS with live checks explicitly skipped; production build PASS; built-Next fixture HTTP 45/45 PASS; diff whitespace PASS. Dependencies reused from an existing installation with byte-identical package-lock.json. Existing CSS compatibility warnings remain. No new UI or application-code changes.

Parent exact-head CI #41286237630 and Non-3D #41286237685 are both success. New commit matching-head CI/browser checks remain PENDING until GitHub runs finish. Main was `72f6bf2e1368e718d62ee95a97c456c708a5ffc1`; its Vercel git.deploymentEnabled remains false. Parent is 61 commits ahead of main across 23 files, so isolated new test success alone does not certify that intake chain. Verify upstream intake and relevant disposable database gates before ordered integration. User authorization permits tested production sections on main, but does not remove verification requirements. No deploy performed.

Next action: inspect new matching-head CI and fixture step; resolve any failures; verify parent intake/database evidence for main integration. Physical fabric, tailor/QC, model-source, device, novice tester and delivery release evidence remains separate and unverified.


## 2026-11-01 — Authenticated GET fail-closed boundary (T5/J5, T6/J6; draft)

- **Branch:** `work/titan-ledger-auth-fixture-20261101`. **Exact parent:** `fcf9fc0419d78a46d07ab09ec411b96041fe56cf` (PR #671). **Code commit:** `411a696ba53a6eccea45b35f03b6e3b5f1560559`. This narrow branch is a compatible child of #671; no unrelated giant draft stack is merged.
- **Acceptance slice:** Extend the existing signed, built-Next/loopback fixture test to require 401 and `private, no-store` for seven anonymous, malformed, forged, expired, wrong-version, wrong-expiry-type and extra-segment operator sessions. Each denied request must make **zero** upstream production ledger RPC calls. The synthetic Supabase secret-key transport must use only the `apikey` header, not a bearer credential. Retain all 45 existing configured-ledger cases, now **52 total expected**.
- **Files:** `scripts/verify-operator-ledger-fixture-http.cjs`, this checkpoint. **Verification performed:** source transformed against exact parent blob; JavaScript parsed successfully via V8 syntax-only check. **PENDING:** repository npm quality, full Node tests, engine, preview-performance, release check, production build, actual 52-case built-Next fixture, exact-head full CI and Non-3D browser QA. Do not claim PASS until their matching-head runs finish.
- **Main intake:** latest observed main `72f6bf2e1368e718d62ee95a97c456c708a5ffc1` had `vercel.json git.deploymentEnabled=false`. Re-read live main, parent ancestry, each intake dependency and matching-head checks before any isolated merge. No deployment, live SQL, stock mutation, schema change or paid AI.
- **Release blockers:** T1–T6/J1–J6 remain uncertified; genuine supplier rolls/metres, authenticated human customer/operator, physical tailor/QC, original-model native Blender/UV, devices, novice betas, first-ten real deliveries, security/privacy/staging/restore and owner approvals remain PENDING/BLOCKED.
- **Next 30–40-minute slice:** inspect exact-head CI and signed fixture outcome; fix a concrete failure if any. If green, verify the narrow #662+ main-intake dependency chain and disposable database evidence before a separately verified main update.
