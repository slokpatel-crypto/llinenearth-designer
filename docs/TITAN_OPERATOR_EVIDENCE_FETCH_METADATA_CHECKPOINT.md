# TITAN production evidence Fetch Metadata checkpoint — 2026-11-02 UTC

## Verified isolated main intake (#794)

- **T5/J5, T6/J6 engineering only:** clean-main PR #794 parent `a91c9862a65fcd88d37cf17d3e29de6495493dfe` → verified draft head `b5e07bd1dea735dd21a7cffb9b958678725fddbc` → guarded squash merge `8da51fe024d14014950c5613c490d88f27ca34c6`.
- **Exact-head CI:** Full CI run [41404237992](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41404237992) **SUCCESS**, independent Non-3D QA [41404238041](https://github.com/slokpatel-crypto/llinenearth-designer/actions/runs/41404238041) **SUCCESS**. PostgreSQL and build jobs, studio QA green. Verified five-file diff with no migration or unrelated backlog. `main` `vercel.json.git.deploymentEnabled=false` verified before and after merge.
- Delivery first-ten history completeness gate from merged #791 remains intact; old #793 closed as superseded, not merged. No Vercel deploy or live database write.

## Next independent T5/J5 security slice (this draft)

- **Branch:** `titan-evidence-fetch-metadata-20261102`, parent `8da51fe024d14014950c5613c490d88f27ca34c6` (latest main at branch creation).
- **Implementation chain:** parent → `11779366d0adc446ddd7972aa34fb0be0d698182` (shared guard) → `25b2f5797984eb2c7df65f3609774e5f348dc3e2` (pure tests) → `374f3de82a3003a6d624325da44434eb6ac82785` (built Next/fake PostgREST tests) → this documentation commit (obtain exact SHA from GitHub).
- **Defect:** privileged production delivery/cutting evidence writes previously checked Origin and JSON media type but did not reject `Sec-Fetch-Site: cross-site` or `same-site` if Origin was stripped by a reverse proxy or matched through a manipulated intermediary. Defense-in-depth requires both independent browser signals to agree before any service-role RPC.
- **Fix:** reject any present Fetch Metadata site value other than `same-origin` or `none` with HTTP 403; preserve legitimate direct/proxied same-origin JSON, signed operator cookie, bounded payload, private no-store and immutable UUID ACK. Reject non-safe-integer Content-Length. No changes to original model, stock, 3D, migrations or paid AI.
- **Regression:** pure tests for absent Origin, matching Origin with conflicting Fetch Metadata, same-site subdomains, legitimate same-origin/none and unsafe declared length; built Next synthetic HTTP verifies 403 and **zero private RPC** for both evidence routes.
- **Exact-head verification:** **PENDING** fresh full CI (disposable PostgreSQL, quality, Node, engine, preview performance, release, build, built Next signed HTTP, strict Chromium/3D) and independent Non-3D QA on the documentation-inclusive SHA. Do not transfer parent CI evidence or merge to main until both workflows finish SUCCESS and main diff/no-deploy guard are rechecked.
- **External gates remain BLOCKED:** genuine supplier roll stock/provenance, approved staging migration/restore, owner/customer/operator Supabase acceptance, tailor/physical cloth usage and QC, original Blender native four-view geometry/UV, real devices, five beta testers, ten genuine deliveries, security/privacy and explicit owner release approval. No T1–T6 or J1–J6 full acceptance awarded.
- **Next slice:** inspect matching-head workflow outcomes and repair any regression. If both green, verify latest main, exact four-file code/test + checkpoint diff and no-deploy guard; integrate only this isolated security slice. Reconcile older PR #792 (overlapping calibration Origin/Fetch Metadata) without merging its stale main ancestry.
