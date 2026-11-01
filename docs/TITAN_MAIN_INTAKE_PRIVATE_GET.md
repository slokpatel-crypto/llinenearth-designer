# TITAN main intake — private operator GET across all outcomes

2026-11-01. Narrow child of #668, which reconciles optional-ledger 404 verification with the real signed operator POST security gate. The existing operator GET read path returned private/no-store on successful history and backend errors, but not when operator authorization was missing or a backend was unconfigured. Cached responses to operator endpoints should not depend on the particular status path.

This child uses the same `privateProductionResponse` factory for **all four GET return paths** and preserves all seventeen POST private response sites. A source regression enforces that no operator GET or POST return can bypass it. A real built-Next **anonymous** GET probe in the signed HTTP CI workflow verifies status 401, generic body and the explicit no-store header. The test deliberately does not send a signed GET; it cannot fetch customer or live production records, change stock or mutate SQL.

Require exact-head full CI + Non-3D, matching signed real HTTP checks and sequential verified parent intake merges before GitHub main. `vercel.json git.deploymentEnabled=false` is mandatory. Physical supplier stock, native Blender/UV identity, fit/QC, betas, ten actual deliveries and launch approval remain unverified. No Vercel deployment or live SQL.
