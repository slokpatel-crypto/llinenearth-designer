# Anthropic expiry readiness — 13 October 2026

## Verified
- A sensitive `ANTHROPIC_API_KEY` is configured for **production** on Vercel project `llinen-earth-live-preview`.
- The main Linen Earth Designer repository does not currently show an Anthropic integration in the default-branch code search.
- A configured key does **not** establish that it is valid or that requests can be made from this project.

## Security and scope
- Never print, commit, export or embed the key in browser code, logs, CI artifacts or static assets.
- Do not move the key to another project without an explicit secure transfer mechanism.
- Verify API access only via a server-side route on the Vercel project already holding the key; require operator authorization and rate limits. Do not deploy a public unauthenticated test endpoint.
- Treat provider responses as untrusted; schema-validate before storing.

## Priority deliverables while provider access remains
1. Fabric intelligence closed-vocabulary annotation proposals with provenance, uncertainty, and physical-measurement gaps; do not invent composition, repeat millimetres, stock or drape measurements.
2. Style Director deterministic outfit recipes: compatible collar/cuff/placket, fit, rise, trouser silhouette, climate, and formality.
3. Tailoring option knowledge base and cross-garment constraints, preserving existing option IDs.
4. Evaluation fixtures for consistency, hallucinations, and fabric scale; human-review before promotion.
5. Export validated **nonsecret** JSON/TS rules and fixtures to the repository so the engine remains functional after provider access ends.

## Acceptance gates
- Server-only access and operator authentication.
- Explicit model identifier and token/cost limits; bounded batch processing.
- No automatic overwrite of human-approved fabric facts.
- Test + quality + build gates before merging.
- Deployment only at a clean major milestone.

## Current blockers
- Actual Anthropic API validity and available credits have not been verified.
- Key expiration date was reported by the owner, not verified with the provider.
- No verified source measurements or tailor approval for production claims.
