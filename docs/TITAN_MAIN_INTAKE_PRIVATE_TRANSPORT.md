# TITAN isolated main intake — private operator production HTTP transport

**Criterion:** T5/J5 operator production privacy; T6/J6 HTTP regression.
**Parent main:** `8fc78dbd135e75fdbb5709e25cf0dc035f57947c` (verify live before any merge).
**Origin:** Independently port the privacy invariant from narrow draft PR #669/#672 without importing its 64-commit dependency stack or any unrelated application changes.
**Change:** The existing main production route now sets `Cache-Control: private, no-store` on every GET and POST outcome, including 401, unconfigured GET, 400, 409, 503 and successful replies. The only NextResponse.json call is the central response constructor. No SQL, stock, model, auth, production logic or schema changes.
**Regression:** A Node source contract checks all return paths and CI ordering. The actual built-Next synthetic HTTP fixture checks seven GET/POST cases, including signed and anonymous sessions, with zero Supabase/backend configuration. Main CI also runs quality, full Node, engine, preview, release, build and Chromium. Exact-head CI and Non-3D remain **PENDING until verified**; this document is not approval.
**Release:** No production deployment, live migrations, stock changes or paid AI. Real supplier inventory, tailor/fit/QC, customer/operator, devices, native Blender, beta deliveries, security/privacy/staging and owner approval remain PENDING/BLOCKED. Never merge until all required matching-SHA checks and isolated diff/ancestry are verified.
**Next 30–40 minute slice:** inspect this branch's actual CI and signed HTTP result; repair any failures, then evaluate whether this four-file intake alone can safely merge with exact main SHA guard and deployment disabled. Do not infer human release readiness.
