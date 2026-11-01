# TITAN main intake 7 — bounded PostgREST backend response streams

2026-11-01. Narrow follow-up to actual operator production route security PR #663, stacked on isolated main intake #662 → #661 → #660 → merged #659/#658. The large original development stack is NOT introduced.

The already authenticated production route previously called `response.json()` on privileged PostgREST RPC results, which permits arbitrary upstream result sizes and malformed data to consume server memory. The verified M149 transport design distinguishes bounded large history lists from small mutation results.

This isolated change uses the already-tested `readBoundedJsonResponse` helper to enforce an **actual decoded byte cap**, independently of Content-Length: 4 MiB per `*_list` RPC response, 256 KiB for single mutation and locked-revision RPC replies. The existing 8-second RPC timeout, private no-store policy, authenticated operator checks and action behavior remain unchanged. Successful or failing upstream responses are never assumed to prove a write was not committed; malformed or overflowing responses fail closed.

New focused tests verify source integration, streaming chunks with spoofed size, large bodies, list/receipt caps, invalid JSON and invalid UTF-8. Exact-head full CI, Non-3D and relevant signed HTTP verification are required before merge, and all predecessor small-intake PRs must land first. This is software safety evidence, **not** genuine supplier stock, model similarity, tailor/QC, beta customer tests, ten deliveries, migration or launch approval. Vercel automatic deployment must remain disabled.
