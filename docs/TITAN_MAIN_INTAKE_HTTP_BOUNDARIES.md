# TITAN isolated main intake 4 — private HTTP boundaries

Date: 2026-11-01 UTC. Parent: isolated main-intake request/retry draft #660, after #659 and merged #658. This is **not** a merge of the multi-thousand-commit original draft backlog.

Three import-free security helpers are copied byte-identically from M149, whose exact SHA `8db50fe1741b70c78cb6c6b006a0ed31ae30cb34` passed full CI, Non-3D QA and both disposable PostgreSQL workflows:

- Strict same-origin JSON POST protection (scheme, host, port, Sec-Fetch-Site) and actual bounded request stream decoding; malformed/too-large requests fail closed.
- Upstream streamed response JSON decoded with a capped actual byte count, independent of Content-Length, rejecting invalid UTF-8 / malformed JSON.
- Confidential operator backend errors mapped to a small closed set of public-safe diagnostic categories, without outputting customer, supplier, SQL or recovery tokens.

The standalone Node regression exercises same-origin vs cross-site, host alias mismatches, strict content type, manipulated Content-Length, oversized chunked JSON, malformed response and privacy-safe errors.

No production endpoint or live database is changed by this library intake. Verify exact-head full CI and independent Non-3D after the parent stacks merge into main, and preserve `vercel.json git.deploymentEnabled=false`. This code is not physical or customer signoff and cannot certify real supplier stock, native 3D model likeness/UV, tailoring, fit/QC, five beta tests, ten deliveries or launch security. No Vercel deployment is authorized.
