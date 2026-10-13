# Claude knowledge sprint — operator runbook

## What is already generated
- First pass: `data/anthropic-unverified/2026-10-13/` — **52 proposals** across six domains.
- Second-model Sonnet audit: `data/anthropic-audited/2026-10-13/` — **44 improved proposals**, **not** human approved.
- Manifests in both folders record source model, version, counts, available usage and conservative provenance.

The previous `scripts/anthropic-knowledge-harvest.mjs` draft command is **not available in the repository** and must not be followed. The verified harvest used isolated Vercel preview builds from inline, ephemeral code; all usable non-secret model outputs were archived into the PR.

## Review and use after expiry
1. Open `/operator/anthropic-knowledge` **after** the PR has passed CI and is deployed in the authorized Designer environment; authenticate with the existing operator login.
2. Begin with the AI-audited tier. The original tier is retained for comparison and rejection traceability.
3. Each recommendation is provisional. Record reviewer name, rationale and a decision; reviews are stored as immutable operator events when Supabase persistence is configured.
4. Never treat a proposal or a model's rejection list as verified supplier data. Actual roll measurements, colour and pattern calibration, physical drape, available metres, and tailor acceptance are separate gates.
5. A review receipt does **not** automatically activate a new customer-facing rule. Engineering promotion requires its own regression and business acceptance.

## If provider access is available later
The authenticated `/api/operator/anthropic-readiness` endpoint can generate **one domain per request**, with a durable one-claim-per-task-per-day limiter and a provider-native JSON schema. It requires **the Anthropic credential, operator session configuration and Supabase ledger all in the same server runtime**. These conditions are not guaranteed by simply seeing a key on an unrelated Vercel project.

Do not place secrets in GitHub, output logs, browser code, downloadable assets or client-side environment variables. Do not widen the key's deployment scope without a reviewed security plan.

## Quality status
The provider call and 96 total archived original + AI-audited entries were verified, but that total includes second-model revisions of the same source ideas, not 96 unique physical facts. Static tests and app build/CI may still require correction; do not claim deployment or merge before verification.
