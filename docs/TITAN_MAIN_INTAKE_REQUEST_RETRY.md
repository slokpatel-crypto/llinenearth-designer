# TITAN isolated main intake 3: strict original-request identity and retry safety

Date: 2026-11-01. Stack this slice strictly on the small receipt parser (#658) and anonymous write-hold (#659) main intake PRs. Do not include any unrelated multi-thousand-commit TITAN draft backlog.

Three pure, import-free safety helpers are copied unchanged from the **fully verified M149** branch `8db50fe1741b70c78cb6c6b006a0ed31ae30cb34`:
- Parse only literal original browser-generated v4 UUIDs. Do not invent a new request identifier when an earlier production write's result is unknown.
- Classify only explicitly pre-RPC HTTP rejections as certain; all other failures, conflicts, timeouts and unknown responses remain potentially committed.
- Copy an in-memory bounded review of the intended quote/order instruction while excluding recovery tokens, cookies, arbitrary private fields and malformed line-item values.

The independent unit regression on this narrow branch asserts allowed and rejected original IDs, uncertain retry classifications, privacy-safe snapshots and form snapshot copy behavior. These imports and fixtures add **no live production execution path** on main until separately scoped API/SQL/UI integration is verified.

Exact matching-head CI, independent Non-3D and security checks must all pass. This intake must follow PR #658 then #659 into main with the entire `vercel.json` Git deployment policy still disabled. No Vercel deployment, live SQL migration, supplier stock assertion, model alteration, paid AI or owner/physical signoff is authorized.
