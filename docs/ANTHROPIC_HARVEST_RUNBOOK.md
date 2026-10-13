# Claude knowledge harvest runbook

Run the script from the repository root **only in a trusted environment already holding the secret**.

```bash
node scripts/anthropic-knowledge-harvest.mjs --dry-run
# Only after confirming API access, operator authorization and budget:
node scripts/anthropic-knowledge-harvest.mjs --execute --max-requests=1
node scripts/anthropic-knowledge-harvest.mjs --execute --max-requests=6
```

The execution cap is explicit. Each job makes at most one paid request. It stops on the first HTTP, JSON or schema error. Outputs are stored under `artifacts/anthropic-knowledge-proposals` and marked **UNVERIFIED_PROPOSAL**. Do not promote them into production rules without human review. This is not a replacement for fabric calibration, supplier proof, measured pattern scale, physical drape or tailor approval.

**Deployment gap:** The configured Anthropic secret is in Vercel project `llinen-earth-live-preview`, not automatically available to this repository's runtime. Do not export or copy the key into GitHub. Execute only after securely linking the code to the project that already has the secret, or configuring an authorized server-side runtime. The existing readiness endpoint is a presence check, not a live API test.
