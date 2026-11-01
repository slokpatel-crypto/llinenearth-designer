# TITAN main intake — reject malformed production ledger envelopes

**2026-11-01 UTC · T5/J5, T6/J6 · isolated, draft-only**

**Exact parent:** #669 `f7ffcb531cbd29320fe3c19d1cb6416cee3c9278` (itself based on #668, #666, #664, #663, #662, #661, #660 and the merged narrow intakes). **Implementation commit:** `84db74a17fcf42809d1ccf48d200b32fc28cabbf`. This is a child of the latest compatible narrow main-intake line, not a merge of the unverified original ~2000-commit M150 stack.

**Reproduced defect:** the actual authenticated `/api/operator/production` GET accepted JSON `null`, objects, primitives or arrays of malformed rows from any of five PostgREST list functions and returned `configured:true`. The UI can interpret a malformed response as an empty ledger, hiding existing quote/order/QC/outcome/learning evidence. A response-byte bound and HTTP 200 do not establish list shape.

**Change:** fail closed with private/no-store HTTP 503 if any of the five requested lists is not an array of object records or exceeds its requested `p_limit` (quotes/orders 100, QC/outcome 250, learning 500). Genuine empty `[]` remains valid. The existing verified optional missing-function `PGRST202` compatibility path still produces `[]`; generic 404/503 still fail. No database or customer state is mutated. New pure regression tests cover all five positive, malformed, over-limit cases and enforce validation before the configured success response.

**Verification at implementation commit:** connected runtime exercised 30 pure negative cases plus valid empty case; this is **limited local logic evidence**, not full Node/Next or browser QA. **PENDING** exact final-head `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build`, signed Chromium 390/768/1440, Non-3D and both disposable PostgreSQL suites. Parent CI is not transferable. Do not merge into main until the exact branch head and every required parent intake have matching-head green checks and the existing main `vercel.json` guard still has `git.deploymentEnabled=false`.

**BLOCKED/PENDING release:** genuine supplier rolls and physical metres, authenticated customer/operator walkthrough, tailor/fit/QC, native Blender source/UV/four-view, real device tests, five novice beta cases, ten deliveries, privacy/security/restore and owner deployment approval. No live stock, SQL, migrations, provider charges, production deployment or release signoff.

**Next 30–40-minute slice:** inspect this PR's exact-head CI and signed browser results; repair any actual failure. Then add isolated authenticated fixture-backed GET acceptance for malformed upstream ledger responses without contacting real Supabase.
