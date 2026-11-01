# TITAN main intake: combine verified missing-RPC detection and signed HTTP guard

Date: 2026-11-01. This narrow draft consolidates two **parallel** slices on the main-intake stack, rather than merging the much larger original TITAN draft backlog.

Parent #666 supplies strictly bounded PostgREST optional-RPC 404 handling. Only genuine `PGRST202` missing functions may return an empty optional history; gateway HTML, missing backend configuration, service faults and malformed JSON must fail closed.

Sibling #667 supplies CI-only real signed built-Next HTTP acceptance for the production operator POST; it uncovered a missing private/no-store header on the otherwise correct unsupported-action 400. Carry the exact test script, workflow hook and documentation, and apply its private response factory to **all 17 operator POST return sites** while retaining #666's optional RPC hardening. The additional combination test checks that neither safety contract can be silently lost by a later merge.

No legitimate quote/order/status mutation is sent by this test. Technical acceptance of this *combined* branch requires its own matching-head full CI, Non-3D QA and the signed HTTP checks; neither sibling's pass suffices. Before a main merge, all narrowly scoped parent intakes through #664 must land in order with no unverified files, and the no-deploy `vercel.json git.deploymentEnabled=false` condition must remain. No Vercel deployment, live SQL, customer records, real fabric stock, model calibration, tailor/physical tests or launch authorization.
