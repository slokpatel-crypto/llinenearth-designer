# Customer fit isolation and fabric provenance verification

Date: 27 October 2026. Branch: `work/titan-customer-fit-isolation-20261027`.
Base: PR #400 (`9213255388e9825393b967a8b5b194e74a1516ad`).

## Fixed behavior

- Named profile activation resets posture evidence that does not belong to that customer.
- Profile history, active-fit identity and measurements recover together on failed saves/deletes where browser storage permits rollback.
- Unreadable history blocks mutation. Readback detects lost writes and concurrent edits before reporting success.
- Measurement vault actions reject duplicate synchronous dispatch; token and measurement controls remain locked until settlement.
- Denial of the localStorage getter is handled without losing a confirmed remote recovery token.
- Physical provenance rejects non-string identity/reference/reviewer/date/URL values instead of coercing them into evidence. Verified CSV GSM stays within the existing 40–1000 range.

## Local verification

| Check | Result |
| --- | --- |
| `npm run quality` | Passed |
| `npm test` | 835 passed, 0 failed |
| `npm run eval:engine` | 15 rules; 3 snapshots; 29 scenarios / 145 requests passed |
| `npm run eval:preview-performance` | 1,696 samples; p95 0.015 ms, p99 0.079 ms; engine timing only |
| `npm run release:check` | Static gates passed; live provider checks excluded |
| `npm run build` | Passed with type checking |
| Measurement recovery browser scenarios | Passed at 390, 768 and 1440px; no console errors or horizontal overflow |
| Visual inspection | 390px and 1440px full-page screenshots inspected |

Browser scenarios exercise real production React code with synthetic API responses: duplicate load dispatch, locked edits/navigation, failed observation writes with rollback, remote-save token preservation when the localStorage getter throws, and token-bound deletion. The script is `scripts/verify-measurement-recovery.cjs` and runs in both CI workflows. Local runtime: isolated Playwright 1.56.1, Chromium 141; project dependencies unchanged. The configured newer browser download was truncated, so this does not claim verification on that newer browser version.

## Remaining limits

Initial GitHub publication was blocked by automatic approval review; the owner subsequently approved pushing the branch and opening a draft PR. Remote exact-head CI must be checked after publication. This approval does not authorize a merge or deployment.

localStorage is not a transaction: tab termination, concurrent edits after readback and unsuccessful rollback remain limits. The rollback helper leaves detected other-tab changes untouched. Real authenticated vault recovery/ownership, database migration verification, supplier evidence and physical tailor/model approval remain separate release gates. The existing 3D candidate remains unapproved.
