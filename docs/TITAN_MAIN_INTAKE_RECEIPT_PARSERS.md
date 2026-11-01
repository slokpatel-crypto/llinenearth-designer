# TITAN GitHub-main intake: original request receipt parsers

Date: 2026-11-01. This small intake starts from main commit `e8315f1a6c621ad802d2d74ecc00ba804a42de4a`, rather than merging the >2,000-commit stacked draft backlog.

The two pure receipt parser modules are copied byte-for-byte from matching-head fully green M147 `12aefb9715364d2dbec29613fbb24bd2be52cbbd`: exact signed private receipt SQL fields, strict sanitized browser wire fields, normalized UUID, status/action whitelist, duplicate/count and private-field rejection. They have no imports, no mutating SQL, customer details, stock assumptions, render/model changes or paid-AI requirements. The independent Node regression `tests/production-receipt-intake.test.ts` checks both positive and strict negative examples on main's own codebase.

This is a **reusable isolated library intake**, not a declaration that the operator flow is deployable or that its unmerged API/SQL/UI dependencies exist on main. Require matching-head main-intake Node, quality, release, build and applicable workflow checks before merging. In particular, **do not merge the entire stacked PR chain as a shortcut**. No live migrations or external provider calls.

Main retains `vercel.json: git.deploymentEnabled=false`; no Vercel deployment is authorized, including after merge. Real supplier stock, actual model/UV, tailor/fit/QC, signed operator/customer and devices, five beta testers, ten real deliveries, privacy/security/restore and owner launch approvals remain blocked.
