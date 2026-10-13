# Anthropic intelligence sprint — verified 13 October 2026

## Real provider verification
- A sensitive provider key was present on Vercel `llinen-earth-live-preview`; it was never committed or shown in logs.
- An isolated Vercel preview-build probe made a **successful real Anthropic API request (HTTP 200)** using `claude-haiku-4-5-20251001`. The diagnostic returned `LINEN_EARTH_API_OK` with 22 input and 13 output tokens.
- Six bounded domain jobs generated **52 unreviewed model proposals**; a follow-on `claude-sonnet-5-5` critique generated **44 additional AI-audited but still unapproved proposals**.
- Earlier uncontrolled-text JSON attempts were rejected if malformed; later requests used Anthropic's native `output_config.format` JSON schema. The successful outputs are preserved separately, with usage/provenance in `data/anthropic-unverified/2026-10-13` and `data/anthropic-audited/2026-10-13`.
- For the six *saved* first-pass results, reported usage totals were 2,761 input and 11,046 output tokens; for the six *saved* audit results, 12,401 input and 20,541 output tokens. These are not total billing across discarded/diagnostic requests.
- Provider validity was confirmed for those runs; **the owner's reported 14 October key expiry was not independently verified**.

## Security
- Temporary preview-scope access to the secret was used only to run isolated build jobs; it was then **reverted and rechecked as production-only** on `llinen-earth-live-preview`.
- No customer interface receives the key. No production deployment was triggered by these jobs.
- GitHub holds only non-secret outputs and source code. Untrusted AI suggestions are never treated as measured fibre composition, stock levels, exact repeat mm, realistic physical drape, owner-approved aesthetics or tailor fit.
- Production Designer projects do not automatically inherit the credential from `llinen-earth-live-preview`. The operator request client cannot run against the key in an unconfigured project.

## Engineering deliverables
- Secure operator-only `/api/operator/anthropic-readiness` supports presence checks and capped one-domain requests with durable spend claims where operator sessions and Supabase are configured.
- `/api/operator/anthropic-knowledge` and `/operator/anthropic-knowledge` expose the archived knowledge, including audited and original tiers, for explicit human review. Review receipts cannot auto-promote live Style Director rules.
- Knowledge input is schema checked, provenance tagged and quarantined. Three regression suites check proposal schema and presence of 52 original and 44 audited items.
- The content remains usable offline from source control after the key stops working.

## Remaining gates
- Confirm latest PR CI/build/QA and review the actual operator page before merging/promoting.
- Seek owner and tailor approval for production-safe rules, plus supplier physical measurements and stock verification. Model critique is not equivalent to physical evidence.
- Don't deploy the entire Designer milestone to production until broader Deep Engine release gates pass.
