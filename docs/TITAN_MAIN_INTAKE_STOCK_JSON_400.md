# TITAN isolated main intake — stock JSON HTTP 400

## Scope and immutable baseline (2026-11-02 UTC)
- Exact starting `main`: `2f9c6fe27b62b40db568fd56bbc9c56d6d01d170`.
- Verified `main` `vercel.json` contains `git.deploymentEnabled: false`. **No production deployment permitted.**
- Source-only behavior: authenticated operator stock requests with missing body, malformed JSON, invalid UTF-8 or non-object JSON return private/no-store HTTP 400 **before** any service-role RPC, not ambiguous 503. Oversized 413, business conflicts 409, true backend failures 503 remain unchanged.
- The current main branch uses `fabric_stock_record_v2`. This intake intentionally does **not** import the v3 migration, opt-in stock rollout gate or any other unverified stacked draft. Exact dependency scope is four source/test files plus this note.
- Exact code/test commits: `90d202712a563eb9ae3a41521a6d6d2f183552a1`, `6c552ff553b858e814389bc1139485f522b6a5dd`, `3c1b6e482213e262dcb8100dc061726614a77672`, `286fa6bcc1a3e8ad3a975d1542d8ae38cc02df21`.
- Node regression: typed malformed JSON, invalid UTF-8 and missing body; route maps to 400. Built-Next authenticated localhost fake PostgREST tests: all four invalid cases return 400, no privileged RPC.
- **Acceptance pending** exact-head Full CI (quality, tests, engine, preview, release, build, authenticated HTTP, browser/3D) and independent Non-3D, security review and dependency/ancestry verification. Do **not** merge main until all applicable checks succeed at the intake head.
- T5/J5 and T6/J6 engineering only. No complete physical launch gate certified. Real supplier stock, v3 staging/rollback, tailoring, customer/operator acceptance, original Blender/UV, physical devices, beta testers, deliveries and owner approval remain pending.

No main update, Vercel deployment, live Supabase migration, physical stock write or paid AI is authorized by this note.
