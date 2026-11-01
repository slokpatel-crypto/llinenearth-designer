# TITAN isolated main intake 5: optional QC and customer outcome transport privacy

Date: 2026-11-01. Parent: isolated private-HTTP intake #661 (itself stacked on #660 → #659 → merged #658), **not** the 2,000+ unrelated draft commits.

Only two small modules are copied byte-for-byte from technically green M149:
- `production-qc-transport.ts` projects recognized operator QC columns, copies permitted check IDs and defect IDs, retains absent historical checks as `null` (unverified, not approved), and rejects malformed/unknown nested QC fields.
- `production-outcome-transport.ts` copies a fixed, privacy-minimized set of reviewed customer outcome fields, never arbitrary SQL/RPC columns.

The independent Node tests check that customer phone/address/recovery tokens and private SQL fields do not escape, that nested check/defect data is copied, unknown checks and malformed history fail closed, record caps are enforced, and `worn_confirmed:false` is never silently approved. **Important boundary:** both projection helpers are permitted ONLY AFTER the entire original ledger envelope has been independently validated; projection alone is not evidence of true QC, proper lineage, actual customer satisfaction or receipt.

Main integration requires the narrowly scoped parents #659–#661 to be accepted and merged, this branch retargeted onto actual main, full exact-SHA CI and Non-3D checks, the same approved QC IDs as the owner, and `vercel.json git.deploymentEnabled=false`. Do not merge the giant original TITAN stack, deploy to Vercel, apply live SQL or invent supplier/fit/model/customer proof. Five real betas, ten real deliveries, 3D four-view/UV and physical tailor signoff remain open.
