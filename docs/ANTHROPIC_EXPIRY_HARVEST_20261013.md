# Anthropic key expiry: safe one-time engineering harvest (13 October 2026)

## What is actually implemented
- Opt-in Claude styling commentary for the EXISTING Style Director endpoint. It is a server-side optional addition only. The deterministic ranking, selected fabric IDs, tailoring StyleSpec v2, measurement review, rendered image workflow, signed handoff and stock data are unchanged.
- Strict output allow-list: at most one styling observation per current look; no external links, HTML, fabricated GSM or physical verification. API errors, timeouts, invalid JSON or expiry all return the original deterministic looks.
- Eight bounded independent AI research prompts as a CLI with schema validation and explicit non-verified field provenance. Each output is an unreviewed JSON document that can be inspected and manually accepted later.
- Operator-only `/operator/anthropic-harvest` screen and same-origin, session-authenticated `/api/operator/anthropic-harvest` endpoint. The screen calls one pack per request and downloads captured packs locally; the secret never leaves the server.

## Immediate steps while the key is valid
1. Check the exact Vercel project/environment where the protected `ANTHROPIC_API_KEY` is configured. At inspection on 13 October the key exists in the PRODUCTION environment of `llinen-earth-live-preview`. It is marked sensitive: the integration connector does not return plaintext, so the key's validity and credit budget have NOT been tested.
2. Run the harvest **only in a secure environment where that variable is actually injected**, not in a browser, public build log, test trace or GitHub PR. Do not paste or print the secret. If using a separate execution project, provision a replacement/new variable through the provider's secure UI; Vercel's protected value is not exportable through the connected tools.
3. Verify the model ID in the Anthropic account. The code defaults to `claude-sonnet-4-5-20250929` but both paths accept `ANTHROPIC_MODEL`. The selected model may be discontinued or inaccessible to the account.
4. Alternatively, after an approved deployment of this branch into the **same Vercel project and production environment** that already contains the key, sign in as an operator and open `/operator/anthropic-harvest`. Use **Generate all eight packs** and **Download JSON**. This is operator-initiated; it cannot start itself, and each pack needs one successful provider response. The browser export is unreviewed and must be retained privately.
5. Inspect the plan without charges: `npm run ai:knowledge:plan`. Execute explicitly: `npm run ai:knowledge:harvest`. Expect eight bounded requests and 64–96 generated **unreviewed** guidelines if all return valid structured JSON. An error stops the job; previously written packs remain in the output folder but the success manifest is not written.
6. Review the generated files under `artifacts/anthropic-knowledge/`. Do not promote them as measured facts. Validate technical claims using supplier records, 3-view photos, mm ruler, construction samples, tailors and owner signoff. Keep the files private while unreviewed. Commit only individually selected, evidence-backed facts with explicit provenance and suitable licences.
7. To enable OPTIONAL server-side copy on the same deployed Next.js application, configure `ANTHROPIC_STYLE_EDITORIAL_ENABLED=1` in its server production environment, alongside a valid protected key, and redeploy only after the major milestone gates pass. With no flag or key, the existing product behaves exactly as before.

## Coverage of eight knowledge packs

| Pack | Intended output | Mandatory independent evidence |
| --- | --- | --- |
| Fabric material judgement | Trade-name and appearance guidance | Fibre content, verified GSM and finish from supplier |
| Physical pattern calibration | mm repeat and colour QA protocol | Actual calibrated flat photos/ruler/colour chart |
| Shirt tailoring construction | Collar, cuff, yoke, placket workflows | Sample constructions and tailor review |
| Trouser and cross-garment rules | Rise, width, pleat and shirt proportion guidelines | Fit/ease/measurement evidence |
| Style Director capsules | Context-led pairing heuristics | Stock checked against actual catalogue |
| 3D model QA | Four-angle, contact and UV failure checks | Native browser & Blender evidence, owner identity approval |
| Operator evidence and tailor handoff | Audit and review workflow | Supplier/owner/tailor approvals |
| AI safety and regression evaluation | Hallucination/expiry/fail-closed test matrix | Deterministic tests and observed provider failures |

## Production and identity release boundary

**Neither Claude nor this harvest can generate real physical measurements, guarantee a photographic 3D model identity, certify UV pattern scale, establish body/garment collisions or approve a physical tailor sample.** Reuse the existing canonical Studio model; keep the independent 3D prototype branch separate until the full Blender, four-view, mobile latency, true fabric-scale and human acceptance gates pass. No key is needed to continue those engineering tasks.

## Privacy and cost limits
- The editorial adapter only runs for a verified operator session (never for anonymous public visitors) and sends only up to 3 look IDs, canonical garment descriptors, catalogue colour/line and deterministic reasons; no profile measurements, phone number, customer photos, secrets, financial data or personal identity.
- Editorial requests cap at 500 output tokens, time out after 3.5 s and silently fall back to existing style output. Only enable deliberately.
- The harvest sends no customer or supplier-private photos, uses 8 bounded 2,800-output-token requests and **requires** `--execute`. No unbounded retries and no background task.
- Generated packs have `source=ai-generated-suggestions`, `reviewStatus=unreviewed`, `physicalEvidenceVerified=false`.
- A protected Vercel key cannot be assumed transferable between projects; a missing key must not be replaced by a hardcoded secret or a `NEXT_PUBLIC_` variable.

## Acceptance checklist
- [x] Optional deterministic-safe integration code exists.
- [x] Machine-readable eight-pack research pipeline exists.
- [x] Operator-authenticated one-pack endpoint and browser export screen exist (not yet deployed).
- [x] Unit guards against misleading provenance and invalid output are written.
- [ ] Anthropic API request succeeded using protected production key (requires secure runtime access).
- [ ] Generated output files exist from actual provider responses.
- [ ] Human technical review and physical verification completed.
- [ ] CI checks, browser checks and major-milestone deployment confirmed.

Do not mark unchecked items complete without evidence.
