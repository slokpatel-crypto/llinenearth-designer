# TITAN main intake 6 — actual privileged production route HTTP safety

Date: 2026-11-01. Parent: narrow intake #662, stacked after #661 → #660 → #659 → verified merged #658. The broad M149 draft is not imported.

This slice changes **real application behavior** in `src/app/api/operator/production/route.ts` rather than merely adding unused helpers.

## Verified defect from existing main
The production POST handler parsed attacker-supplied input using unbounded `request.json()`, lacked origin/fetch-metadata validation and sent raw caught PostgREST error messages to the browser. The GET/POST catch paths logged exception objects including potential supplier/customer/recovery-token detail, while the upstream RPC helper read response error bodies into memory. Operator authentication alone is not sufficient to protect cross-origin writes.

## Targeted fail-closed changes
- Preserve existing signed operator cookie authorization and current action/RPC semantics. Refuse cross-site `Origin` or `Sec-Fetch-Site`, non-JSON Content-Type and oversized Content-Length before body read or mutation.
- Require an actual decoded JSON byte limit of 65,536, including chunked/no-Content-Length bodies, and reject JSON that is not an object.
- Return 400 invalid JSON, 413 oversized body, 403 cross-origin and 415 media type, all with private/no-store. Never return raw SQL/PostgREST errors or tokens. Unknown errors respond with a generic 409 and manual inspect-before-retry guidance, because a SQL write may already be committed.
- Replace raw server exception logging with a fixed closed diagnostics category; no raw backend response body is collected.
- Add focused tests against real helpers and route source ordering. Their success is code/CI evidence, **not** a live authenticated operator transaction or production-database integration test.

## Release gate
Retarget to actual main only after #659–#662 are separately accepted, then run exact-head full CI/Non-3D and relevant signed HTTP/operator acceptance; confirm no regressions in quote/order/status workflows. Main's `vercel.json git.deploymentEnabled=false` must remain unchanged. No Vercel deployment, live Supabase schema or customer/order mutations, paid AI, real-world fabric/fit/Blender, beta or ten deliveries are authorized or implied.
