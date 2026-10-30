## 2026-10-30 — Public bearer share URLs must not propagate as Referer or become indexed

**Decision:** The 30-day design-share URL is a bearer credential. The inherited site-wide `strict-origin-when-cross-origin` policy permits the full share path to appear in same-origin navigation Referer headers; a page-only consent gate cannot prevent later disclosure through logs, analytics or navigation. Override the global header specifically for `/share/:token` with `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store, max-age=0`; add page-level noindex/no-follow and referrer metadata as defense in depth. The route-specific header rule must follow the global rule. Existing signed URLs remain readable until expiry and no body measurements are added to the payload. Robots directives are best effort, not access control or revocation. This is J4/T5 security-source hardening, not independent browser/privacy approval, genuine customer signoff or launch readiness. No model/photo, supplier stock, schema, production write, paid provider, merge or deploy.

## 2026-10-30 — Public share issuance requires separate disclosure consent and verified account ownership

**Decision:** A signed design-share token is a 30-day **public bearer link**, not a private customer record. The previous share route accepted a bare client-provided locked revision and minted a token before attempting a best-effort audit, even if no customer identity or explicit share consent existed. A self-consistent recipe hash proves neither ownership nor consent. Fail closed: require an explicit `consentToShare:true` separate from staff-contact consent, a literal design-vault recovery token, authenticated customer, both owner-scoped and access-key vault reads agreeing with the requested version/revision/hash/parent/lock instant, and a bounded literal UUID audit receipt before signing the public link. Never return a link on audit/storage failure. Studio must explain anyone holding the link can view the recipe, require a confirmed account-owned vault copy, invalidate stale async responses when consent or lock changes, and reject inconsistent owner/audit receipts. Existing signed share URLs remain readable until their own expiry; valid customer designs can still be shared after secure save and consent. This intentionally closes anonymous/unaudited issuance; it does not change the shared payload (which excludes body measurements), original model, preview, stock or schema. Source tests are not live Supabase/customer/security approval. No production writes, paid providers, merge or deploy.

## 2026-10-30 — Visible provisional option does not prove photographic render support

**Decision:** The M39 advanced-to-legacy bridge checked `legacySelectable` and membership in the existing selector, but the selector includes provisional cuts with `renderSupport.livePreview:"none"`. Exact-head M40 Non-3D Chromium showed selecting `open_short_hem_cuff` changed the original legacy photo cuff from `Barrel Cuff (2-button)` to `Open Short-Sleeve Hem`, contradicting the rule that unphotographed precision construction remains canonical-v2-only. Require both a selectable visible label and non-`none` live preview support before projecting any advanced cut into the photographic selector; apply the same guard in reverse conversion. Preserve the canonical advanced ID, existing selectable legacy choices and versioned recipe. The photo still does not certify construction geometry or physical drape. No supplier stock, paid AI, schema, live write, merge or deploy.

## 2026-10-30 — Do not duplicate the legacy fallback with an unreachable narrowed boolean check

**Decision:** The M39 reverse StyleSpec adapter already rejects `legacySelectable:false` before considering an option label. TypeScript correctly narrows the remaining property to `true | undefined`; comparing it again with `false` is unreachable and broke the production build at PR #533 exact head `4bca7b050f1da445cfedbd694cf1c52b82719b9e`. The only extra condition then compared `option.label===fallback` and returned that same `fallback`, so the entire branch was semantically redundant. Remove the dead branch rather than weakening types, retaining the explicit unselectable guard, canonical v2 option, photo fallback, tests and original `linen-earth-studio-model-v1`. This repairs a code/build gate, not a human/photo/stock/physical release criterion. No schema, provider call, live database write, merge or deployment.

## 2026-10-30 — Versioned StyleSpec must preserve literal option IDs and complete legacy selections

**Decision:** Validate incoming StyleSpec v2 as a typed JSON object, not by coercing arbitrary values with `String(...)`. A single-element array containing a valid option ID, an object with a custom `toString`, or an array containing `tucked` previously could pass the versioned-construction guard, despite being a malformed saved-design and tailor-handoff envelope. Require plain non-array shirt/pant/legacy records, literal option-ID strings, and all eleven nonempty legacy style labels; preserve every existing valid canonical option including provisional IDs. This prevents false validation of forged owner-recovered construction, avoids a renderer/operator mismatch, and does not create new labels, migrate persisted records or change canonical hashes. Synthetic source tests are not genuine customer/operator approval. No physical inventory, model/photo, paid render, production database write, migration, merge or deployment.

## 2026-10-30 — Malformed delivery browsing rows are not safe operator evidence

**Decision:** The operator production-evidence GET must validate the shape of every order/evidence browse row, not merely the outer arrays. A malformed successful RPC could contain null rows, coerced/padded UUIDs, impossible timestamps, duplicate identities or non-array re-entry fields; the browser dereferences these fields and may crash or misrepresent history. Share a pure fail-closed validator between server and operator UI; require exact UUID identities, unique row IDs, valid timestamps and supported field arrays within the existing 500-row cap. Preserve legacy nullable notes/inspector/reference, optional delivered timestamp and the separate authoritative first-ten full-history SQL gate. This is defensive J5/T5/T6 source integrity, not real delivery, supplier stock, human acceptance or launch approval. No schema, physical evidence write, paid AI, model/photo replacement, main merge or deployment.

## 2026-10-30 — first-ten physical delivery identities must be exact database UUIDs

**Decision:** The authoritative first-ten SQL audit returns UUID-typed order and evidence IDs, not arbitrary strings. A success-shaped upstream JSON receipt with `synthetic-order-1` or `fake-audit-id` must not pass the physical history validator merely because the strings are nonempty and unpadded. Reuse the shared literal UUID creation-receipt guard for order, evidence-order and evidence identities, preserving uppercase UUID hex and refusing whitespace, coercion, non-UUIDs and duplicates. This is T5/J5/T6 source integrity only; genuine supplier, owner/operator, tailor, device, Blender, beta/delivery, security/privacy and owner approval remain unverified. No schema or migration, model/photo change, paid provider, production write, main merge or deployment.

## 2026-10-30 — a vault store RPC must return a literal exact UUID before recovery credentials

**Decision:** Both locked-design and measurement store RPCs return a PostgreSQL UUID scalar. The recovery-token builder normalizes human-facing identifiers, which is unsuitable for privileged upstream receipt validation: padded strings could be silently trimmed into an apparently confirmed store. Introduce one shared literal UUID receipt guard that accepts uppercase UUID hex but refuses whitespace, arrays, objects, missing or malformed values. Validate **before** issuing a recovery token or attempting optional owner linking. Existing browser token parsing, versioned designs, ownership contracts, no-credit deterministic model/photo and backwards compatibility remain unchanged. This is a source-level T2/J3/T5 integrity guard, not real authenticated recovery acceptance or human release approval. No live database write, schema change, migration, paid provider, main merge or deployment.

## 2026-10-30 — share and enquiry audit success requires literal UUID receipts

**Decision:** A privileged audit RPC returning a padded UUID must not be silently normalized into an apparently durable share/enquiry event. Reuse one exact scalar UUID guard for both routes: preserve uppercase UUID hex but reject padding, objects, arrays, null and malformed IDs. A verified audit means intent was recorded, not that WhatsApp was sent or the operator accepted the enquiry. This is source-level T5/J4 integrity, not real authenticated customer/operator acceptance or privacy signoff. No schema, stock, model/photo, paid AI, live writes, migration, main merge or deployment.

## 2026-10-30 — saturated finished-garment QC pages cannot release orders

**Decision:** A globally capped QC ledger is not complete latest-by-order evidence if the returned row count reaches the requested limit. The shared delivery QC guard must fail closed at the cap (500 for privileged server transition, 250 for operator Production Desk) and for malformed limits, even when an apparently valid approval is present. This preserves the original latest-timestamp, calendar, inspector and reference checks, but does not establish an atomic DB receipt for sub-cap reads. A dedicated owner-reviewed latest-QC RPC is a separate migration/release decision. No real garment QC, supplier stock, model/photo, paid AI, live write, migration, main merge or deployment.

## 2026-10-30 — physical QC timestamps require valid literal calendar dates

**Decision:** A purported approved finished-garment inspection with a syntactically ISO-like but impossible civil date must never be normalized by JavaScript `Date.parse` into a later real date that outranks a physical rework. Validate the actual year/month/day and 24-hour clock before comparing instants; preserve real leap days, fractional seconds and timezone offsets. This shared operator/server J5 guard does not replace an atomic latest-inspection database receipt or physical tailor signoff. No supplier facts, schema, paid AI, model/photo changes, live writes, main merge or deployment.

## 2026-10-30 — privileged production API errors are not public diagnostics

**Decision:** Unexpected operator production RPC/SQL errors must be logged only server-side, never returned verbatim in the operator-facing HTTP response. The previous catch returned raw `error.message` and could expose private owner/order/schema or backend details. Return a constant generic HTTP 409 with private no-store while retaining existing explicit input validation and confirmed receipt failures. This is a source-level T5/J5 security guard, not complete live authentication or privacy acceptance. No new dependency, schema, supplier facts, model/photo change, paid AI, live write, main merge or deployment.

## 2026-10-30 — first-ten delivery audit failure is not an absent optional migration

**Decision:** The operator delivery-evidence endpoint may return `firstTenBasis:null` only when the optional first-ten audit RPC is actually absent (HTTP 404), with an explicit installed flag. An installed RPC returning malformed 200 JSON, 5xx or a timeout must fail the whole evidence read closed; otherwise an operator could confuse a broken chronological audit with an uninstalled migration. Require a typed versioned receipt and preserve legitimate `historyValid:false` as blocked history, not approved deliveries. This is source-level J5/T5 integrity; no genuine ten-delivery proof, production data writes, migration, paid provider, main merge or deployment.

## 2026-10-30 — optional production evidence must not silently become empty history

**Decision:** The operator Production Desk may remain compatible with an older database missing an optional QC, outcome or learning-context RPC, but a 200 non-array body, timeout or upstream 5xx is not evidence of zero inspections or outcomes. Accept only literal arrays for installed optional evidence, fail the overall GET closed on malformed/unreachable installed evidence, and tolerate only an explicit HTTP 404 as missing optional migration with separate installed-status flags and a visible operator warning. Core quote/order history remains mandatory. This is source integrity, not physical tailoring or customer approval; it does not authorize migrations, production writes, provider charges, main merge or deployment.

## 2026-10-30 — operator delivery affordances require the same provenance-backed QC as the server

**Decision:** The operator Production Desk must not offer delivery merely because the first matching QC row is approved. Use the existing latest-by-timestamp typed provenance QC gate on the client as well as the server, and label pending/rework/unverified QC conservatively. If the live production ledger fails or returns malformed quote/order lists, clear previously displayed records and disable quote/order creation rather than leaving stale evidence/action controls. The server/database remain authoritative, and a capped list is not an atomic latest-QC proof. No supplier/tailor signoff, migration, live write, model/photo change, paid AI, merge or deployment.

## 2026-10-30 — a stale QC approval cannot release a delivered order

**Decision:** The operator's delivered transition must not treat the first matching row in a capped QC list as the latest physical inspection or use JavaScript `String()` coercion to create a checker/reference. Select the latest same-order inspection by a valid timestamp; reject malformed upstream list rows, ambiguous timestamp ties, a latest rework, missing or coerced inspector/reference. Keep the existing database transition RPC as the final authority, preserve current physical evidence fields and original deterministic no-credit Designer. This is a defensive source gate, not an atomic latest-by-order SQL proof or genuine tailor signoff. A future owner-approved database latest-QC RPC may be required for high-volume or tie-safe acceptance. No live migration, physical evidence creation, main merge, production deployment or provider charges.

## 2026-10-30 — customer production status requires complete typed list receipts

**Decision:** Four owner-scoped production RPCs are independent evidence of customer quote, order, event and outcome history. A malformed non-array response must not be returned as a valid customer production status snapshot or confused with legitimate zero rows. Require all four arrays before success; otherwise use the existing 503 private no-store response. Preserve authenticated owner IDs, bounded streaming reads, prior database contracts, original Designer model and deterministic no-paid-AI operation. This is source-level J5/T5/T6 integrity, not proof of a real authenticated customer journey, physical supplier inventory, tailor approval or production readiness. No schema change, production write, main merge or deploy.

## 2026-10-29 — operator production create success requires a confirmed UUID receipt

**Decision:** A successful HTTP response from `production_quote_create` or `production_order_create_with_context` is not proof of a created quote/order. Both are SQL `uuid`-returning operations; require an exact literal UUID scalar and reject missing, coerced, padded or malformed upstream values with 409 before returning `lockedRevisionVerified` or `learningContextAttached` success flags. Reuse the shared customer production UUID contract and preserve canonical revision verification, current option IDs and owner boundaries. This is code-only J5/T5 integrity, not an authenticated live operator order, supplier inventory, paid provider call, migration, production mutation, merge or deployment.

## 2026-10-29 — legacy gallery resources must be exact same-origin HTTPS

**Decision:** The optional unverified legacy-site HTML scan may only ingest image and link URLs that resolve to the scanned page's exact HTTPS origin without URL credentials. A string-prefix hostname check accepts lookalikes, and unrestricted `<img src>` can publish third-party tracking or spoofed swatches in the inventory API. Preserve valid same-origin relative/absolute URLs and the existing fail-closed `inStock:false` on all legacy swatches. No supplier verification, schema, paid AI, canonical Studio model/photo, live data write, merge or deployment; this does not substitute for a complete security audit.

## 2026-10-29 — ambiguous active fabric identities in operator veto history fail closed

**Decision:** A mistyped operator subtype plus a padded or single-element-array current fabric ID and an availability field is not an unrelated operator note. Treat the entire customer availability metadata receipt as unverified instead of hiding a possible sold-out veto. Do **not** accept a normalized ID as a valid physical stock subject. Preserve unrelated notes with no availability instruction and retired catalogue identities. This is a source-only safety change with regression tests; it creates no supplier inventory or human approval and does not change schema, the canonical model/photo, deterministic no-credit Designer, main or production.

## 2026-10-29 — preserve integer physical stock units through bounded RPC integration

**Decision:** A positive decimal that rounds to zero at the 0.001m ledger resolution is not verified sellable stock. Reject sub-resolution positive dust rather than using `available>0`, and base availability on integer physical units. Preserve the newer bounded 1 MiB upstream JSON adapter and literal fabric ID guard; update its source test to check the validated `record` alias without weakening the no-coercion contract. No fabricated supplier inventory, new schema, paid AI, model/photo changes, production writes, main merge or deploy.

## 2026-10-29 — decoded JSON byte budgets for stock evidence reads

**Decision:** Both operator-history and physical-stock RPC responses have explicit decoded-stream size ceilings independent of upstream Content-Length. Abort/invalid/oversize JSON or malformed RPC row structure yields unavailable customer stock rather than a success-shaped answer or unbounded memory consumption. Preserve 8-second network aborts, exact-count pagination, material provenance, original model/photo and no-credit deterministic preview. Caps: 4 MiB per metadata page, 1 MiB per stock RPC. This cannot certify live supplier stock, authenticated user flows or physical/tailor/Blender/device acceptance and does not authorize production mutation or deploy.

## 2026-10-29 — include sibling padded-subtype safety guard in the stacked release candidate

**Decision:** Include PR #494 independent padded/array subtype strictness in this integrated draft; do not let whitespace or one-item JSON arrays bury a possible sold-out operator event. Source-wiring tests were updated to reflect literal non-clipping text parsing rather than the older inline type guard. This is code evidence only; real supplier stock and human release approval remain open.

## 2026-10-29 — avoid synthetic operator material labels and concealment of ambiguous availability events

**Decision:** A malformed subtype on an active catalogue fabric carrying an availability field is not safely unrelated: it could otherwise hide a sold-out operator veto. Treat that complete metadata lookup as unverified, so both customer stock paths fail closed. Seasonal/role tags must be literal strings in the existing shared vocabulary; never derive "Summer" or "base_safe" from nested arrays or objects. Reject rather than truncate overlong weave, texture or note text, while preserving valid literal values and existing provenance. No schema/dependency/model/photo changes, paid-AI credit, main merge, live mutation or deployment. CI on the exact new stacked head is required; physical stock and human QA remain separate.

## 2026-10-29 — physical metadata must not be manufactured by JavaScript coercion

**Decision:** Physical GSM, fabric weight class and drape may be projected from an operator metadata receipt only when their JSON values are literal in-contract numbers or strings. Previously `Number("145")` and `Number([145])` could yield a physical GSM value, and `String(["soft"])` could yield an apparently measured drape. Keep existing valid numeric/enum data and the availability veto, but omit malformed physical fields; do not fabricate supplier measurements. Formality, weave and texture also refuse coerced JSON types. No schema, new dependency, paid AI, model/photo change, live mutation, merge or deployment.

## 2026-10-29 — reject coerced operator stock overrides before selecting latest record

**Decision:** An operator metadata event is a physical stock veto/override only when its subtype is the literal `designer_fabric_metadata`, its fabric ID is an exact current catalogue identity and its availability is exactly `unknown`, `available` or `unavailable`. Previously `String(value)` converted `["available"]` into `"available"`, and trimming could alias a padded ID. Because newest-record-wins could then conceal an older sold-out event, any malformed current-catalogue availability instruction now invalidates the whole customer metadata read. Unrelated operator notes and obsolete catalogue identities are not current stock evidence. This is defensive interpretation of operator data, not supplier-verified rolls or an atomic database snapshot. No schema, new dependency, AI credit, model/photo change, production mutation, merge or deploy.

## 2026-10-29 — paginated operator sold-out evidence needs ordered row identity

**Decision:** Exact `Content-Range` and stable totals are insufficient to detect repeated or shifted offset pages that omit a sold-out event during concurrent writes. Require every returned `style_events` row to carry a valid canonical timestamp and nonblank ID and require strictly descending `(at,id)` order across and within pages; otherwise both customer stock paths fail closed. This reduces silent omission risk but is not a transactionally consistent snapshot; a future atomic ledger RPC remains preferable. No stock mutation, schema, new dependency, AI cost, model/photo change, merge or deployment.

## 2026-10-29 — reconcile exact-count metadata receipts with bounded pagination

**Decision:** The operator sold-out override ledger is customer-availability evidence only after all pages have been read with contiguous `Content-Range` and exact, consistent totals. Page through stable `at.desc,id.desc` IDs in 1,000-row slices, sharing one eight-second deadline; return unavailable on any missing/moving count, noncontiguous page, malformed row or history beyond five pages. Preserve the initial exact-count contract from PR #486, the bounded legacy gallery from #487, and prior sold-out/stock protections. Human stock and authenticated launch signoffs remain unproven; no schema, data mutation, merge or deploy.

## 2026-10-29 — optional legacy-site inventory cannot stall verified stock

**Decision:** The first-party verified stock path remains authoritative. A slow, broken or oversized old-site product gallery must not consume the `/api/inventory` request budget indefinitely or allocate unbounded HTML. Preserve fallback to unverified bundled legacy gallery, add 5-second abort and 2 MiB streamed HTML maximum, retain `no-store` and protect multi-byte text decoding. No changes to supplier quantities, approved stock, render model, physical truth, schema, live database, or deployment.

## 2026-10-29 — bounded operator metadata must be proven complete

**Decision:** A successful HTTP 200 with a partial `style_events` page is not proof that the operator's sold-out override ledger was fully read. Request an exact PostgREST count and accept only an entire, contiguous 0-based page with matching total, or the literal empty `*/0` response. Missing, partial, inconsistent and over-limit histories fail closed on both public stock paths. The CI-only metadata fixture supplies an explicit empty exact-count header; it does not create stock or operator approval. Larger ledgers require a separately tested paginated reader before they can be customer-visible. No schema, physical evidence, identity, paid-AI, production write or deployment changes.

## 2026-10-29 — customer stock requires a reachable operator metadata ledger

**Decision:** Successful *empty* `style_events` operator metadata is different from no config, 4xx/5xx, invalid response, timeout or broken lookup. Physical stock may be customer-available only when both verified stock and the operator's override ledger have been read. Preserve the old best-effort metadata helper for operator display; use new status-bearing fetch in Designer and legacy `/api/inventory`. The latter returns all structured fabrics unavailable when metadata read is unhealthy. Limit network delay to 8 seconds and keep synthetic empty metadata fixture strictly in CI browser QA. No fake inventory, human operator signoff, stored-data schema or production mutation.

## 2026-10-29 — physical source/signer strings must be complete

**Decision:** Shared physical fabric provenance normalizer must reject human checker names longer than 120 normalized characters, roll/source references over 220, and URLs over 500 instead of silently truncating them into a different-looking valid receipt. Valid boundary-length evidence remains accepted; missing/unknown physical checks remain unknown. This is source-level evidence integrity, not supplier measurement or owner signoff. No schema change, live write, canonical model/image change, paid per-edit AI, merge or deployment.

## 2026-10-29 — never alias a physical stock identity by trimming it

**Decision:** A catalogue fabric ID or reservation UUID supplied for physical inventory mutation must be an exact identifier. Reject surrounding whitespace instead of silently normalizing a mistyped stock subject into a valid different one. Keep existing human name, source-reference and optional note normalization, and preserve accepted canonical IDs and idempotency-key compatibility. Add positive/negative Node regressions; no schema, live stock write, migration, main merge or deployment. This is not evidence of real supplier inventory, tailor fit or owner approval.

## 2026-10-29 — legacy inventory endpoint must not bypass verified stock

**Decision:** `/api/inventory` retains its existing swatch list and category counts but derives structured `inStock` and stock totals from the same operator metadata + live `fabric_stock_snapshot_v2` verification used by the Designer catalogue. Bundled `FABRIC_STOCK.inStock` is not physical proof; an absent/invalid/unreachable live ledger fails closed, while legacy website scans remain unverified. An explicit sold-out override stays sold out. The endpoint responds `private, no-store` and disables static caching. This is a source-only consistency fix, not confirmation of actual rolls, human fit or rollout. No schema, paid provider, migration, database write, original model/photo change, merge or deployment.

## 2026-10-29 — preserve complete human stock audit notes

**Decision:** Manual receipt/adjustment, reservation consumption and release audit notes are optional, but supplied notes must be literal strings of at most 600 normalized characters. Reject arrays, objects, booleans, numbers and overlong notes instead of coercing or silently truncating physical evidence. Missing/null notes remain empty for backwards compatibility. No schema change, new inventory, migration, production mutation or deployment. Preserve deterministic Designer and fixed model/photo.

## 2026-10-29 — stock availability needs a corroborated v2 ledger receipt

**Decision:** Do not trust a lone `provenance_ready:true` from the stock snapshot RPC. The existing SQL v2 contract includes manual, provenance and legacy-unverified event counts. Require positive safe-integer manual count, equal provenance count and zero legacy count; malformed or missing counts fail closed. The CI-only loopback fixture emits synthetic matching counts solely to exercise UI and never represents real inventory. This adds consistency checks, not physical supplier evidence, human approval or a stock reservation. No schema, real database write, merge or deployment.

## 2026-10-29 — Verified inventory must match one unique catalogue identity

**Decision:** A physically verified stock snapshot row can only promote a customer swatch if that fabric ID occurs exactly once in the catalogue. Duplicate catalogue IDs (including two different swatch photos) fail closed instead of sharing one physical roll's availability. A valid but unexpected RPC fabric ID is not a verified catalogue fabric and must not inflate verifiedStockFabrics. Preserve existing valid positive/zero evidence, catalogue sold-out overrides, option IDs, model/photo and deterministic no-credit Designer behavior.

**Limits:** This is a source-level identity consistency guard, not supplier-verified stock, a physical reservation, or proof of fit. Live private stock and locked revision tables are empty at inspection; authenticated Supabase customer/operator tests, exact-head CI/browser, supplier/tailor/device/native Blender signoffs and explicit major milestone approval remain required. No schema, production data, main merge or deployment.

## 2026-10-29 — internal GarmentViewer must not freeze live stock at build time

**Decision:** The internal 3D viewer reads the same owner-reviewed live stock as the customer Designer, so its server page must render dynamically. Without request-time rendering, a build performed without Supabase credentials statically freezes zero available fabrics, causing verified Style Director-to-3D fabric handoff to lose both IDs even when runtime stock becomes available. This fix does not bypass fail-closed production inventory, approve the prototype model, or fabricate stock. Keep the CI-only stock fixture isolated.

## 2026-10-29 — device dashboard must respect persisted human review and full v2 receipt

**Decision:** The operator device dashboard must not reclassify a persisted v2 `review` as accepted merely because raw samples and checkboxes pass. Only a fully normalized v2 receipt explicitly marked accepted can satisfy the display gate; contradictory v2 metrics are review-only with uncertified summary fields. Historical v1 remains review-only. This is code integrity, not a physical-device acceptance.

## 2026-10-29 — match browser/server device latency and missing-data semantics

**Decision:** A browser session with no latency samples reports `withinTarget:null` (not a fabricated failure). The client and server both compare the rounded displayed p95 to the 100 ms acceptance threshold, conservatively treating 99.96 ms as 100.0 ms and requiring review. Real target-device signoff is still required; this only fixes the audit transport contract.

## 2026-10-29 — integrate fail-closed stock and verified device audit receipts without promoting release

**Decision:** The verified-stock fail-closed source and isolated CI-only browser stock fixture from draft PR #474 coexist with strict v2 device evidence and confirmed PostgREST event receipts from sibling draft PR #475. Integration is a new stacked draft branch based on #474, copying the three non-overlapping source/test files from #475. Keep real inventory unknown until owner-reviewed ledger facts exist, keep v1 device evidence review-only, and require exact integration-head CI plus real human/device/tailor/model/owner acceptance before any launch. Do not merge main or deploy from this branch.

## 2026-10-29 — Browser QA may use isolated synthetic stock, production may not

**Decision:** Production customer stock stays fail-closed without one genuine provenance-ready live ledger row per offered fabric. Existing real-browser Designer regressions previously assumed bundled/demo stock and returned HTTP 200 without physical proof. Rather than weakening that production boundary, run a separate loopback mock Supabase stock endpoint only in GitHub Actions browser jobs. Its process refuses to start without CI/GITHUB_ACTIONS, uses a fake fixed test-only key and never writes a real database. Tests assert its exact typed fixture rows and guard. It does not demonstrate supplier stock, physical fabric scale, human approvals or a live Supabase login/handoff.

## 2026-10-29 — Customer stock must fail closed when physical ledger evidence is missing

**Decision:** A catalogue swatch's bundled `inStock` bit is merchandising metadata, not verified roll availability. The customer-facing verified-stock projection now sets `inStock:false` whenever the exact fabric lacks one valid provenance-ready live snapshot, including missing, duplicate, malformed and failed backend reads. `availabilityVerified` is false for unknown data, true for valid zero/positive evidence. Even a valid positive ledger row cannot override a catalogue item explicitly marked unavailable. Real stock must be recorded and reviewed by an authorized operator before the customer journey can advertise it. Preserve the deterministic no-paid-credit editor and canonical mannequin identity.

**Limits:** This is a fail-closed source safeguard, not proof of physical metreage, supplier approval, the live authenticated enquiry flow, 3D parity or production readiness. The current live stock ledger is empty. Do not synthesize rows, run migrations or merge/deploy without the separate release gates.

## 2026-10-29 — Device QA acceptance must use literal raw measurements and confirmed visual checks

**Decision:** Reject JSON-coerced device class, viewport and evidence version; do not drop malformed latency samples and then count the remaining values as a 12-sample pass. For v2 operator memory writes, require the complete bounded literal numeric sample set and deny a claimed accepted status unless the server recomputes the existing p95/visual gates. Reject overlong device observations rather than silently truncating them. Read-side history must not coerce numeric strings/null into displayed legacy latency or sample counts. Keep historic v1 events visible only as review, not approved target-device evidence.

**Limits:** A typed receipt cannot prove the device was tested by an independent operator, that visual checks were performed, or that a real browser/production environment passed. Preserve original model/photo, no-paid-credit deterministic core, database schema and customer records; no merge or deployment.

## 2026-10-29 — Physical colour proof must use literal LAB and a confirmed check receipt

**Decision:** Instrument LAB coordinates cannot be created from `Number(...)`-coerced JSON strings, arrays, booleans or null. Reject malformed supplied LAB even when a fallback hex is present, and require literal fabric/profile/hex/method/checker/illuminant/reference fields without truncating provenance. Only literal finite database Delta E and genuine named checker/reference fields can count toward the ten-fabric evidence gate. Require same-origin 16 KiB streamed JSON, approved Analyzer hex identity and a valid returned UUID before claiming the physical check was recorded.

**Limits:** Software cannot certify actual instrument calibration, D65 booth capture, fabric colour fidelity, supplier stock, human signoff, tailor fit or Blender parity. No production schema/data mutation, paid per-edit AI, model/photo replacement, merge or deployment.

## 2026-10-29 — Tailor ease calibration cannot be JSON-coerced or falsely approved

**Decision:** Physical body/finished-garment centimetres and model ease ranges must be literal finite numbers, not `Number(...)`-coerced strings, arrays or null. Case, garment, fit, field, tailor and finished-garment references must be typed, with notes rejected rather than truncated. Only literal numeric database evidence can satisfy the existing 35-cell coverage gate. Bound same-origin operator JSON to 16 KiB and require UUID evidence/model creation receipts and exact `true` approval/retirement RPC responses. Keep legacy approved-model read adapters unchanged for compatibility.

**Limits:** No fabricated tape readings, actual tailor or owner approval, live database verification, physical fit, supplier measurements or native Blender. No schema, paid AI, original model/photo, merge or deployment.

## 2026-10-29 — Physical fabric truth policy needs an actual persisted receipt

**Decision:** The operator cannot claim an approved physical-evidence policy merely because PostgREST returned HTTP 201 without a row. Require a returned representation with exactly one event ID matching the submitted immutable ID and a parseable persisted timestamp. Reject coerced policy status and overlong human signer/rationale instead of truncating; require same-origin, actual streamed 16 KiB JSON and private no-store errors. Missing/mismatched receipts fail closed; a live end-to-end write must be separately tested with owner authorization.

**Limits:** This is evidence-integrity engineering, not supplier-measured scale, GSM, fibre, drape, stock, real human signoff or a production approval. No model/photo replacement, paid per-edit AI, schema migration, customer data mutation, merge or deployment.

## 2026-10-29 — Novice Designer proof must be server-timed and receipt-confirmed

**Decision:** Novice user testing is a release gate, not an arbitrary form submission. Require literal case/device/outcome/seconds/approver fields and nontruncated human notes. Enforce same-origin, JSON media and actual 16 KiB streamed request bounds. A started timer is accepted only if the single backend row contains a UUID matching the requested case and device; a finished timer must match the requested session UUID and have finite positive elapsed seconds. Recorded attempts and human approval must return a valid UUID receipt. Reject unconfirmed writes instead of reporting a successful study. Legacy manual-timing attempts remain available but do not satisfy the server-timed five-case gate.

**Limits:** No fabricated novice users, human review, device QA, live Supabase, supplier stock, tailor fit or Blender approval. Existing model/photo, deterministic no-credit preview and database schema unchanged; no merge or deployment.

## 2026-10-29 — Launch-readiness evidence requires literal human facts and confirmed audit IDs

**Decision:** A beta completion or launch checklist sign-off cannot become verified because arrays stringify to device/revision/approver IDs, notes silently truncate incidents, or a service-role RPC returns an arbitrary truthy response. Require literal closed device/evidence/status vocabulary, bounded case/revision/human IDs and notes, same-origin 16 KiB streamed JSON, and a valid UUID receipt for verified beta, legacy beta and checklist events. Only after the verified-beta RPC confirms the receipt may the API return `verifiedFlowAudit:true`. Return 400/413 for invalid bodies and private no-store responses.

**Limits:** A UUID audit does not prove actual five-customer flow, legal/privacy owner signoff, supplier stock, live Supabase, tailor fit or native Blender. No migration, production data, paid AI, model/photo change, merge or deployment.

## 2026-10-29 — Meterage approval requires typed physical bands and real RPC confirmation

**Decision:** A production metre-estimation model cannot become approved because a JSON string/array coerces to a measured width, a forged model ID or approver is truncated, or a truthy RPC response masquerades as a confirmed change. Require literal numeric physical bands and bounded notes, strict UUID model identities, a valid model UUID creation receipt, and exact boolean true for approve/retire. Bound operator JSON to 16 KiB actual streamed bytes and same-origin media, with 400/413 body errors and private no-store responses. Preserve the 20 distinct real cut-case threshold and existing garment vocabulary.

**Limits:** Software gates do not prove real cloth usage, actual owner/tailor signoff, supplier provenance, live Supabase or native Blender. No schema/data mutation, paid AI, model/photo change, merge or deployment.

## 2026-10-29 — Production cut evidence cannot be coerced into physical truth

**Decision:** Reject JSON-coerced physical widths, actual usage, repeat, matching, case/garment IDs and silently truncated cut context/notes. Preserve existing precision and garment vocabulary. Require 16 KiB actual streamed same-origin JSON, a confirmed UUID evidence receipt, 400/413 body failures and private no-store responses.

**Limits:** Software cannot prove real cutting, supplier stock, tailor inspection or native 3D. No schema/data migration, model/photo, paid per-edit AI, merge or production deployment.

## 2026-10-29 — Measurement calibration must not silently trim physical proof or fake stored evidence

**Decision:** Real self-versus-tailor tape comparisons are physical release evidence, not forgiving form text. Reject notes longer than 1200 characters rather than silently truncating findings, preserve the existing strict numeric and checker/source contracts, and accept only a valid database UUID event receipt before returning `stored:true`. Require same-origin JSON with an actual 16 KiB streamed byte cap before privileged writes, 400/413 for invalid bodies and private no-store responses. Existing valid operator payloads and stored case formats remain compatible.

**Limits:** Typed software evidence cannot establish an actual tape session, independent tailor approval, live Supabase access, or physical garment fit. No schema, model/photo, supplier facts, paid credits, merge or production deployment.

## 2026-10-29 — Delivery audits require an exact confirmed immutable receipt

**Decision:** A production delivery audit cannot count as recorded because the service-role RPC returned HTTP 200 or an arbitrary truthy JSON value. Validate the delivered order ID with the shared strict UUID contract and require a returned evidence UUID before reporting success. Reject cross-site/media-type/oversized streamed JSON before privileged mutation, preserve 400/413 for malformed/oversized bodies, and make every POST response private no-store. Retain the existing closed re-entry field vocabulary and physical provenance requirements; no fabrication of zero-reentry evidence.

**Limits:** A syntactically valid UUID is not proof of actual delivery or operator signoff. The database remains the authority on delivered order status and immutable lineage. No schema/data mutation, model/photo, paid AI, merge or deployment; real Supabase and human first-ten delivery acceptance are still blocked.

## 2026-10-29 — Finished-garment QC is a typed, receipt-confirmed physical release gate

**Decision:** A forged/coerced QC decision, unsupported defect, unknown or nonboolean check, or truncated inspection note must not become evidence that a physical garment passed. Require literal approved/rework, supported boolean check IDs and defect tags, note <=1200 characters, named inspector and physical inspection reference. Before privileged RPC, enforce same-origin JSON with a 16 KiB actual streamed limit and exact UUID production order identity. A valid returned inspection UUID is required before the UI can report success; malformed/oversized JSON returns 400/413, and responses are private no-store. Preserve the existing operator form payloads and source model/photo.

**Limits:** A validated receipt is not real physical garment inspection, actual tailor signoff, stock proof or a verified Supabase session. No schema, customer data, paid AI, deployment or merge changes; exact-head CI and live human acceptance remain separate gates.

# DECISIONS.md — Linen Earth

## 2026-10-29 — Human outcome learning evidence is typed and receipt-confirmed

**Decision:** A human reviewer or learning-policy threshold must not be forged by JSON coercion, permissive UUID shapes, silent note truncation, or a truthy/non-UUID RPC response. Enforce exact literal outcome UUID, approved/rejected decision, reviewer/approver text (2–120 characters), optional review note (<=1200), required policy source note (3–1200), and numeric safe-integer threshold 1–10000. The operator POST now bounds actual streamed JSON to 16 KiB, rejects cross-site/media-type abuse before auth, checks the operator session before reading the body, and requires a valid returned UUID for a recorded review or policy. Keep the database as the final human evidence authority; no review is auto-approved by code.

**Compatibility and limits:** The existing UI sends numeric thresholds and literal strings. Existing migrations, owner/operator authorization, model/photo, deterministic no-credit Designer and saved data are unchanged. Negative-only HTTP and unit checks cannot prove a real human review, live Supabase, fabric/tailor evidence, or launch readiness. No merge or deployment.


## 2026-10-29 — Customer production actions require typed, bounded, confirmed evidence

**Decision:** Customer quote acceptance and post-delivery feedback are security-sensitive owner-scoped writes. Reject cross-site and non-JSON POSTs, malformed/oversized streamed JSON (16 KiB), coerced quote/order UUIDs, coerced action/rating/fit/wear/note values, and overlength feedback before identity lookup or privileged RPC. Preserve normal valid UI payloads and omitted optional note/wear fields. Only an exact boolean `true` quote-acceptance RPC receipt counts as accepted; false remains unavailable, and an invalid receipt is a 409. Only a valid returned outcome UUID counts as recorded feedback. Every POST response uses private no-store headers; negative-only real HTTP regressions cannot create production records.

**Compatibility and limits:** The existing service-role RPCs still authorize owner and delivered-order state; no new schema, option ID, model/photo, provider call, customer data change, merge or deployment. A green source/browser test cannot replace live authenticated Supabase, real fabric stock, tailor review or native Blender evidence.


## 2026-10-29 — Operator production status changes require literal identities and confirmed RPC receipts

**Decision:** Privileged quote/order status writes previously stringified arbitrary JSON ID/status/note values, silently truncated overlong notes, and returned HTTP 200 `{updated:false}` when the database rejected an update. Validate an exact UUID, one of the existing `production-state` transition destination IDs, and an optional literal note up to 1000 characters before any QC lookup or RPC. Preserve normal whitespace trimming, uppercase UUID compatibility and omitted/null notes; never invent or infer a status. Leave the database as the authority on actual state transitions. Only an exact `true` RPC response counts as an updated status; a false/invalid receipt returns 409 so the operator UI cannot display success. Streamed oversized/invalid JSON now returns the established 413/400 responses instead of being swallowed by the generic 409 catch.

**Compatibility and boundaries:** No schema migration, status vocabulary expansion, production data mutation, identity/photo/3D change, provider spend, merge or deployment. Existing operator UI uses exact UUIDs and known statuses. Source and unit regressions are not live database/stock/tailor acceptance; matching-head CI and authenticated operator checks remain required.


## 2026-10-29 — Operator password sign-in is a bounded same-origin JSON operation

**Decision:** The operator login previously parsed unlimited streamed JSON, stringified and silently truncated passwords, used an Origin-only check that allowed same-site subdomain requests, and kept an unbounded per-forwarded-IP attempt map. Reuse the shared same-origin/Fetch Metadata and 4 KiB streamed JSON guard, require a literal 1–300 character opaque password without trim/truncation, and fail closed on malformed JSON or values before calling the verifier. Preserve existing operator password verification, session cookie attributes and generic error responses. Limit best-effort local attempts to eight per IP and 300 global in 15 minutes with a 1,024-key cap; never evict active counters to admit a new identity. Add pure and real HTTP negative regressions without attempting a real operator sign-in.

**Limits:** Forwarded IPs and process-local maps are not trusted distributed abuse controls. Missing live Supabase, operator/tailor/stock and native 3D proof remain release blockers. No password, provider, customer data, migration, model/photo, paid API, merge or production deployment changed.


## 2026-10-29 — Auth limiter capacity must not evict active abuse counters

**Decision:** A bounded in-memory OTP/verification rate-key map must not make room for a new untrusted identity by deleting an unexpired IP or mailbox counter. Under a 2,048-identity flood, the former oldest-key eviction could reset a targeted customer's attempt history before its ten-minute window ended. At capacity, scan for an expired key and reclaim it; if all entries are live, fail closed for a new identity with the existing 429 behavior, while still counting known identities. Keep the existing per-IP, hashed-mailbox and global budgets unchanged. Add negative regression cases for both email and IP and a positive recovery case after expiry. This deliberately favors temporary denial over bypass during a sustained flood.

**Limitations:** A process-local counter can be reset by instance restart and is not a substitute for a distributed edge/provider limiter. No live OTP, Supabase database write, production migration, new paid service, model/photo change or deployment. Exact-head CI and real-browser verification remain required.


## 2026-10-29 — Customer OTP endpoints fail closed on untrusted public JSON

**Decision:** The existing OTP request and code verification endpoints accepted unlimited streamed JSON, untrusted `String()`-coercible email/code values, and verification attempts without any process-local throttling. Reuse the shared streamed-size, JSON content-type and same-origin boundary for both routes with a 4 KiB limit; reject arrays, objects and numeric codes before any Supabase call. Preserve normal string email normalization and whitespace-tolerant six-to-twelve-character OTP entry. Respond with private/no-store headers on both success and errors. The bodyless logout POST reuses the same origin/fetch-metadata guard without requiring a JSON body, so cross-site forms cannot clear customer cookies. Use separate eight-send and twelve-verification-attempt per-IP ten-minute budgets, bounded to 2,048 process-local keys, plus independent global best-effort caps against simple forwarded-IP rotation and hashed per-mailbox limits (four OTP sends or ten code attempts per ten minutes). Do not store plaintext email addresses in rate keys. Add pure and actual HTTP negative regressions that never trigger a real OTP email.

**Limits:** `x-forwarded-for` can be untrusted, process-local counters reset per instance and cannot replace provider/edge distributed abuse controls. This source hardening does not verify a live Supabase account, production environment, customer consent, real stock/tailor evidence or production launch. No database migration, model/photo change, paid image provider, merge or deployment. New exact-head CI/browser verification is required.


## 2026-10-28 — Same-ID fabric revisions revoke preview and handoff evidence

**Decision:** Fabric IDs alone do not bind a Creative Lab concept to the physical roll data it was generated from. Derive a deterministic revision identity from catalogue photo, colour/pattern, repeat scale, provenance, physics, declared stock and allowed-garment fields. When the live or restored fabric snapshot differs under the same ID, revoke creative direction, visual review, stale async assessment, alternative search, lock UI and the matched Director handoff badge. Context-derived compatibility scores are intentionally excluded from the physical revision identity. Nested JSON keys are canonicalized to avoid false revision drift from property order; nonfinite, cyclic and non-JSON evidence fails closed. The catalogue, Creative Lab generator and assessment API now call one shared server-only loader that applies the identical reviewed physics/provenance attachment to the same live stock; this prevents the former server/client same-ID enrichment mismatch. Assessment independently revalidates the creative recipe's fabric revision, context and cut against that current snapshot before building any garment spec, rejecting stale or tampered same-ID creative proof with HTTP 409. Creative redesign likewise rejects an old concept whose physical snapshot or context no longer matches, rather than recycling stale treatments. Missing current snapshots fail closed in the customer Designer; legacy pure callers without snapshots retain their existing ID/context/cut semantics but cannot certify current physical parity. The full assessment/selection identity, including active creative recipe and visual review, also guards asynchronous design locking and all five locked handoff/share/enquiry/vault actions; late responses cannot present stale proof or tokens after a fabric, fit, cut, context, creative or review change.

**Compatibility:** No schema migration or model replacement. This may conservatively require reselecting a concept after a supplier/catalogue update; it never treats a new revision as measured fabric truth. A mocked 1440px Chromium reload regression checks that a same-ID supplier catalogue change clears restored creative proof; it does not constitute real supplier evidence. Human supplier, tailor and native Blender acceptance remain mandatory. No merge/deployment or paid-provider call.


## 2026-10-28 — Phase 1 physical and reviewer proof rejects JSON coercion

**Decision:** Treat recorded physical repeat, preview-period and calibration-marker values as untrusted evidence: only actual numeric JSON values are eligible, never strings, booleans, null or objects that `Number(...)` can convert. Preserve existing finite/positive ratio and scale-tolerance checks. Physical provenance notes must be strings, not object-coerced text. Evidence version and photo-coordinate-system identifiers must also be literal strings; arrays/objects that stringify to a valid label cannot satisfy the contract. Independent reviewer IDs must be strings and ratings must be integer values 1–5; fractional scores cannot be rounded into passing reviews. Apply the same rating contract to the direct Phase 1 acceptance gate to prevent bypass through a different caller. Malformed root event envelopes (null, arrays and primitives) also normalize to blocked evidence rather than throwing, including direct realism aggregation and direct Phase 1 acceptance callers. Malformed historical evidence fails closed until resubmitted; valid numeric receipts and versioned contract remain compatible.

**Limit:** Software validation is not proof of real independent people, supplier-calibrated scale, native Blender geometry, four-angle likeness, tailor signoff or live production verification. No schema, provider, model identity, merge or deployment change.


## 2026-10-28 — Native 3D silhouette and evaluated-mesh evidence is fail-closed

**Decision:** A native Blender report that says `ready=true` cannot certify candidate four-angle file integrity if garment widths, centerlines, cuffs, hem asymmetry or identity guides were not actually sampled. Missing/nonfinite measurements now block native preflight, and the independent receipt validator checks all eleven locked garment silhouette values and nine identity-guide values with the existing target/tolerance contract. It also cross-checks evaluated panel vertex/polygon/triangle counts, applied transforms, active UV layers, degenerate geometry, and aggregate mobile triangle/vertex budgets. Reject missing, coerced or contradictory counts even if the native report claims success.

**Source immutability:** Snapshot SHA-256 of the loaded .blend, canonical studio photo and native preflight script before running native checks. Recheck the actual files after preflight, after all four renders and immediately before atomic publication. Concurrent source replacement or symlink substitution invalidates the candidate instead of binding the final receipt to a different source. Regression fixtures cover source, photo and script drift.

**Scope:** Offline candidate-file integrity only; the old native sleeve-spacing/UV-seam failures remain blocked pending a fresh real Blender run. No new model, fabricated physical facts, supplier measurements, photoreal parity, tailor signoff, deployment or production promotion. The historical candidate receipt shape remains readable but incomplete evidence must be regenerated rather than silently promoted.

## 2026-10-28 — Four-angle PNG receipts require decodable bounded rasters

**Decision:** CRC-valid PNG chunks and a matching SHA-256 alone do not establish that a Blender QA frame can be decoded. Native candidate and rejected-diagnostic evidence now inspect bounded zlib IDAT streams, exact scanline byte counts and PNG filter values, and require noninterlaced RGB/RGBA 8/16-bit frames with consecutive IDAT chunks. A forged/truncated image cannot satisfy candidate file integrity merely by recomputing its manifest digest. Direct candidate-validator calls also require the actual Blender scene, preflight script and canonical reference-photo file paths; manifest-only hashes cannot count as independent file verification. Reject duplicate JSON keys and nonfinite constants in both the candidate manifest and native preflight report, including cases where an attacker recomputes the report digest. The independent native-report consistency check also requires the actual `Body` mesh identity, 1727±20mm body height and measured hand/leg guide spacing at their locked ±3mm tolerances, not just sleeve/leg garment centers. This is file-format integrity, **not** visual likeness, physical fit, calibrated drape, tailor acceptance or native Blender approval. No schema, provider or model change.

## 2026-10-28 — 3D promotion evidence is strictly typed and independent

**Decision:** Treat both authenticated operator event writes and stored GarmentViewer QA payloads as untrusted JSON. Reject malformed evidence before persistence as well as at read/promotion boundaries; otherwise write-time Number(null)/Math.round conversions permanently erase the original invalid type. Reject coerced timing, physical-scale and realism ratings, including null, booleans, numeric strings, fractional ratings and nonfinite numbers. Do not round evidence into a passing review or round >8% physical error down to 8%. Blank operator error fields cannot become numeric zero. Browser-restored latency/reviewer arrays must pass the same strict normalizer before re-submission. Require independent stripe/check fabric IDs and no duplicate verified pattern receipts before scale acceptance.

**Compatibility:** Valid numeric records and exact existing closed-vocabulary pattern labels retain their values; malformed historical records fail closed until reviewed and resubmitted. Native Blender geometry/four-angle proof is a separate mandatory server-controlled promotion gate, currently false until a trusted registry is implemented; operator JSON must never set it. No schema, paid provider, canonical model or customer rollout changes. Exact-head CI and real physical/operator review remain required.


## 2026-10-28 — Native candidate four-angle evidence must be complete and scene-bound

**Decision:** Candidate four-angle Blender renders require a passing native geometry/UV scene preflight before any frame is generated. Use the existing identity-locked source scene and canonical `linen-earth-studio-model-v1` / `/designer/studio-tucked.webp`; do not generate a substitute model.

**Integrity:** Write into a fresh temporary output directory and publish the four frames, native geometry/UV preflight report and manifest together only after checking exact angle labels/yaws, PNG structure/CRC/dimensions, file SHA-256, source .blend SHA-256, original studio-photo SHA-256, preflight-script SHA-256 and report SHA-256. Reject truthy non-boolean scene identity locks and unsaved Blender edits. Reject contradictory sleeve/leg spacing, UV seam or body-intersection findings even if a report says ready. Never overwrite previous evidence in place. A separate explicit rejected-diagnostic mode may preserve failed-native-preflight frames and report, but must keep `nativePreflightPassed=false` and `rejectedDiagnostic=true`, and cannot satisfy candidate promotion. Legacy #311 native workflow needs an output/flag adaptation before integration. Python regressions run in CI without Blender.

**Limit:** The manifest remains `candidateOnly: true` and all photographic/realism/tailor/drape approval flags remain false. This does not demonstrate a successful native Blender run or actual four-angle likeness, physical fabric calibration or production readiness. No schema/dependency changes or customer rollout.


Architecture and product decisions that must persist across coding sessions.

## 2026-10-05 — Style Director signs the complete garment recipe

**Contract:** handoff v2 signs both legacy controls and canonical StyleSpec v2, including shirt/trouser types and construction. The same spec travels through the result, explicit photoreal request, Designer assessment and saved draft used by the isolated 3D lab. Live edits remain deterministic.

**Lifecycle:** malformed or inaccessible browser drafts cannot prevent URL restoration. A late opening assessment cannot overwrite an edited recipe or enter recommendation memory. Verification belongs to the original recipe; edits hide its audit badge, and a network failure never claims a matched handoff.

**Compatibility:** existing v2 saved drafts and legacy-only URLs still restore. Old v1 tokens do not certify canonical garment types; their designs open without verified-handoff status. New links must be regenerated for v2 verification. No database migration or dependency change. Photographic preview limits and the production 3D asset gate remain in place.

**Evidence:** behavioral tests cover generated recipe round trips, signed nested fields, expiry and the HTTP boundary. Chromium checks malformed/stale/blocked drafts, delayed assessment/audit responses, exact Designer-to-3D continuity and zero paid calls at 390/768/1440px.


## 2026-10-05 — GarmentViewer M1 stays isolated until realistic geometry passes QA

**Decision:** continue the reusable 3D viewer idea as an isolated `/lab/garment-viewer` milestone. Preserve the public `/visual -> /style-director` redirect and the current photographic Designer. M1 proves stable model identity, separate shirt/trouser PBR materials, Linen Earth swatch replacement, texture scale, roughness/normal detail, four camera views and touch/orbit behavior without AI credits.

**Geometry:** the generated block GLB is temporary engineering geometry, not a customer realism surface. Do not promote it to Designer/Style Director. The next milestone replaces only geometry/UV quality with the approved realistic office-wear model while retaining the material/camera contract.

**Dependency:** the lab pins Google `<model-viewer>` 4.3.1 for GLB/PBR/camera plumbing. Linen Earth generates the temporary GLB itself; no third-party mannequin asset is used.

## 2026-10-04 — Preserve both controls and banner; use a calm three-second reveal

**Owner preference:** keep the existing thread-and-logo homepage banner alongside the new premium buttons. Save their approved combined version at `checkpoint/brand-animation-and-premium-controls-20261004`; a preview cropped above the banner must not be treated as removing it.

**Timing:** both the opening and replayable banner begin with 1.2 seconds of quiet white artwork. Background threads/light start after that hold; the unchanged logo begins at 1.5 seconds and finishes at 2.6 seconds. All movement finishes by 3 seconds of visible playback. Reveal the caption gently; use restrained offsets and easing, without a loop or additional dependency.

**Behavior:** first keyboard/pointer/wheel interaction can still dismiss the opening immediately. Keep once-per-session display, offscreen/hidden-tab pause, replay, complete static no-JavaScript artwork and live reduced-motion cancellation. Browser evidence checks the actual white hold, native animation end times, path movement, replay and original responsive/lifecycle regressions. No outfit, fabric, Designer, recipe or schema changes.

**Completed tracks:** pause/resume only unfinished Motion handles. A completed native track has committed its final style and cancelled its underlying animation; replaying that handle would resurrect its first keyframe. Browser tests wait for pending native pause tasks to settle, retain the strict frozen-pixel/clock checks, and prove that the finished logo and threads remain intact during a late offscreen pause/resume.

## 2026-10-04 — Richer controls and explicit Designer clarification drafts

**Controls:** add original compass/garment/weave icons, circular arrow details, an inset tailoring line, a finite light sweep and press feedback to the homepage actions, brand replay and Ask Designer. Keep labels and destinations authoritative, illustrations decorative, disabled controls quiet and reduced-motion controls static. Server markup contains the complete controls; no extra animation dependency or per-frame JavaScript is introduced.

**Legibility:** scope the Designer header eyebrow style to its direct text container. Decorative action spans inherit the button foreground and 12px type rather than the 6px eyebrow treatment. Browser checks require readable size, at least 4.5:1 enabled-label contrast, matching icon foreground and contained text at all three supported widths.

**Designer:** when a question has conflicting construction, an unsupported reference, unsupported garment or unclear task, offer up to three relevant questions from the existing supported option library. Selecting one prepares a new editable question and retains the original question plus its previous starting point for restoration. Carry the request's interpreted occasion/context and existing cloth/construction basis into the follow-up. A choice is not a submission, an outfit application or a human judgement. Restore, main-outfit changes and navigation cancel stale work through the existing request scope.

**Compatibility:** `designer-advice-v1` gains an optional clarification object. Old callers still receive the same task/results contract; no database migration, persisted recipe, physical-fabric claim or provider call changes. Clarification is assistance with supported tasks, not universal reference-image understanding. Browser verification covers draft preparation/restoration, late responses, unchanged model pixels, proposal/request context, human-feedback counts and responsive motion controls.

## 2026-10-04 — Original thread motion around the real brand logo

**Decision:** add a finite, replayable homepage brand signature and replace the long opening fade with a 2.4-second thread-and-logo reveal. Use the existing `motion/mini` runtime for native path/opacity/transform choreography; original SVG threads surround the unchanged uploaded logo. Reference the [Motion animation API](https://motion.dev/docs/animate), [Magic UI travelling beams](https://magicui.design/docs/components/animated-beam) and [Anime.js line drawing](https://animejs.com/) for movement principles rather than importing another UI or animation framework.

**Interaction:** signature motion plays once when at least a quarter of its artwork enters view and can be replayed. Its longest sequence lasts 3.8 seconds of visible playback. Pause when offscreen or the document is hidden; cancel and restore the complete static artwork if reduced motion is requested, including a live preference change. The intro remains once per tab session and yields immediately to the first keyboard, pointer or wheel interaction. Content and the real logo remain available without JavaScript or session storage. Observers, native animation controls and listeners are cleaned up on navigation.

**Boundary:** these abstract graphics express the brand; they do not depict cloth scale, garment fit, measured drape or manufacturing detail. No catalogue, photograph, Designer contract, saved recipe, dependency or schema changes. Existing keyboard targets and focus treatment remain in use. Browser review includes normal/reduced motion at 390/768/1440, actual changing path pixels, replay, offscreen pause/resume, live reduction, first-interaction dismissal and a short recorded animation.

## 2026-10-01 — Adopt Execution Roadmap v2 by adaptation, not rewrite
**Decision:** keep the existing application and map Roadmap v2 onto it. Rebuild only modules that fail the new gates.

**Why:** the current repository already contains the Designer, Analyzer, Style Director foundations, measurements integration, CI, FASHN final-render flow, operator workflows and Supabase migrations. Starting again would discard validated work.

## 2026-10-01 — True-scale preview is the next core gate
**Decision:** the next major engineering proof is the premium shirt preview with measurable physical pattern scale.

**Why:** current preview work is deterministic and much more advanced than a simple colour overlay, but the roadmap's core promise requires repeatable proof that a known stripe / repeat is rendered at the declared physical scale on the garment.

**Rule:** do not market an unverified preview as physically exact. Continue to show approximate / verified scale states from evidence.

## 2026-10-01 — Keep deterministic editing; AI only for final / edge tasks
**Decision:** instant garment-option editing must stay local / deterministic. FASHN remains a final photoreal rendering step, not the live editor.

## 2026-10-01 — Keep advanced garments, hide behind readiness where necessary
**Decision:** do not delete trousers, blazers, suits or the existing wear-type intelligence. If the shirt flow is not yet at the new proof standard, gate less mature garment flows with feature flags or readiness labels rather than removing them.

## 2026-10-01 — Brand spelling
**Decision:** customer-facing brand is **Linen Earth**. New work should use that spelling unless preserving a legacy technical identifier that would break compatibility.

## 2026-10-01 — Durable customer state before public order reliance
**Decision:** browser-only drafts may remain as convenience, but customer-critical designs / measurement profiles / enquiries must have durable server persistence before they are relied on operationally.

## 2026-10-02 — Customer Designer stays photo-first
**Decision:** the photographic studio model is the canonical customer preview in Designer. The flat/vector construction study must not be exposed as an alternate customer-facing model.

**Why:** the premium target is believable fabric on a consistent photographed model. Construction geometry may remain an internal engineering/QA aid, but customer preview should not fall back to a cartoon-like figure.


## 2026-10-02 — Engineering complete is not roadmap complete
**Decision:** a Roadmap v2 phase is only labelled complete when both its engineering contract and its documented real-world evidence gate pass.

**Why:** several phases depend on physical cloth measurements, independent users, tailor checks, render review or real production outcomes that code cannot manufacture.

**Rule:** missing evidence stays open in the Roadmap Readiness control tower. Do not invent thresholds simply to turn a phase green; Phase 2 physical-field coverage remains open until the owner/supplier policy is explicitly documented.

## 2026-10-02 — Fabric Truth thresholds are human-defined
**Decision:** Phase 2 physical evidence coverage for pattern scale, GSM, drape and fibre is controlled by an explicit owner/supplier policy stored in the operator evidence ledger.

**Why:** software cannot decide what proportion of the active catalogue must carry supplier documents or physical roll measurements before Linen Earth treats the evidence base as operationally sufficient.

**Rule:** only an approved, named human policy may satisfy the physical-coverage portion of Phase 2. A review-state policy, missing policy, or model-inferred physical fact cannot complete the gate. The 50 reviewed-fabric target and controlled physical-colour gate remain separate requirements.

## 2026-10-02 — Launch readiness verifies the live backend
**Decision:** Phase 9 must verify the hardened Roadmap v2 capability contract against the live production Supabase database, not only against migration files in Git.

**Why:** a green repository can still be operationally stale if production migrations were not applied. The production evidence RPC is therefore part of the launch gate.

**Rule:** if the backend health RPC is missing, unavailable, or reports any required capability absent, Phase 9 stays evidence-open. The check is read-only and cannot manufacture evidence.

## 2026-10-02 — Production Vercel builds are main-only
**Decision:** automatic Vercel Git deployments are disabled for every branch except `main`. GitHub CI is the default verifier for feature branches; Vercel preview deployments are no longer created automatically.

**Why:** repeated feature-branch pushes exhausted the Vercel deployment rate limit and blocked a valid production milestone from deploying.

**Rule:** the primary project continues only on `main`; duplicate Vercel projects remain ignored by the existing project-ID guard. Create a preview deliberately only when visual/runtime verification needs one.

## 2026-10-02 — Photographic garment edges feather inward
**Decision:** customer-facing fabric, collar, cuff and creative-surface clipping uses inward-only feathered photographic masks rather than hard vector edges.

**Why:** hard path clipping makes otherwise photographic fabric read like a sticker pasted onto the model, especially beside the neck, cuffs and hands.

**Rule:** edge softness may exist only inside the photographed garment silhouette. No feathering may spread fabric onto skin, hands, studio background or neighbouring garments. Flat construction styling stays outside the customer Designer.

## 2026-10-02 — Phase 9 verifies the primary production runtime
**Decision:** launch readiness must verify that the Operator control tower is running from the primary Linen Earth Vercel project in the production environment with an immutable deployment ID and Git commit SHA.

**Why:** repository CI and a healthy database do not by themselves prove that the customer-facing production runtime is the intended deployment. Duplicate linked Vercel projects must not satisfy the launch gate.

**Rule:** Phase 9 stays open on preview deployments, duplicate project IDs, missing deployment identity, missing production URL, or missing Git SHA. The check is read-only and uses Vercel system environment metadata.

## 2026-10-02 — Remaining Roadmap work is evidence-sprint driven
**Decision:** once an active Roadmap phase is engineering-complete, the next work is sequenced from the live evidence gates rather than adding speculative product code.

**Why:** the remaining blockers are primarily physical cloth checks, real users, tailor approval, render review and delivered production outcomes. More code cannot legitimately satisfy those gates.

**Rule:** the Evidence Sprint may prioritize and link real-world collection work, but it must never auto-create, duplicate, infer or promote evidence. Downstream production/outcome work stays later until its real dependencies pass.

## 2026-10-02 — Photographic structure is neutral-luminance
**Decision:** the instant photo compositor must preserve the studio photograph's folds, seams and wrinkles without reintroducing the source garment's original light/dark colour bias.

**Why:** using the raw dark source shirt as a fold layer can make a light selected Linen Earth fabric look artificially charcoal; using the raw pale source trousers can wash darker cloth out.

**Rule:** detail passes are luminance-normalized per photographed garment before blending. The fabric swatch remains the colour/texture source; the studio photo supplies structure and lighting only.

## 2026-10-03 — Customer preview support follows the photo compositor
**Decision:** Phase 3 option coverage must classify support from the actual photographic customer compositor, not from the internal construction-drawing capability map.

**Why:** an internal vector construction model can approximate more collar, cuff, fit and trouser geometry than the premium customer photograph actually shows. Reusing that support status would overstate what the customer sees.

**Rule:** photographed source matches may be marked exact; non-matching cuts stay approximate with an explicit reason. Selected button material is specification-only at instant-preview scale, contrast cloth remains physically unverified, and unsupported visual details are never promoted merely because the internal construction model can draw them.

## 2026-10-03 — Photo approximation is disclosed before final render
**Decision:** the customer Designer shows a compact live summary of how many currently selected cut details directly match a photographed template and which selected details remain approximate.

**Why:** a premium photographic model can still mislead if a customer assumes every collar, cuff, fit or trouser choice has changed geometrically when the current photo only represents some of them exactly.

**Rule:** the disclosure is about photographic representation only. It does not imply physical colour, drape, fit or construction verification, and it must not replace the photographic model with the internal construction drawing.

## 2026-10-03 — Production deploys require an explicit milestone marker
**Decision:** merging engineering work into `main` no longer automatically consumes a Vercel production build. The primary project builds a Git-triggered production commit only when its commit message contains `[deploy]`.

**Why:** Roadmap v2 work is intentionally batched and the user requested production deployment only after meaningful milestones. Rebuilding every small merged batch repeatedly exhausted Vercel's build-rate quota.

**Rule:** feature branches remain disabled, duplicate projects still fail the project-ID guard, ordinary `main` commits exit the ignored-build step successfully, and a deliberate milestone merge/marker such as `[deploy] Roadmap v2 milestone` is required to continue the primary production build. Missing Vercel metadata remains fail-open so an unusual/manual deployment is not silently suppressed.

## 2026-10-03 — Private Supabase tables stay RPC-only
**Decision:** the `private` schema remains deny-by-default for `anon`, `authenticated`, `service_role` direct schema/table/function access. Server operations use explicitly granted public `SECURITY DEFINER` RPCs instead.

**Why:** Supabase reports RLS-without-policy INFO on private tables, but adding client RLS policies merely to silence that advisory would widen the attack surface. The intended boundary is stronger: client roles cannot use the schema at all.

**Rule:** migrations explicitly revoke current and default privileges on private schema objects; the live Roadmap backend-health RPC verifies effective anon/authenticated isolation. The informational RLS advisory is expected for these intentionally unreachable private tables.

## 2026-10-03 — Customer pattern scale requires accepted studio calibration
**Decision:** patterned customer previews use Phase 1 px/mm calibration only when the recorded proof is fully accepted; fabric-side physical scale evidence alone is not enough to label the photographic preview scale as verified.

**Why:** repeat millimetres describe the cloth, but the browser also needs a reviewed relationship between physical millimetres and the fixed 1024×1536 photographed model coordinate system. Without both halves, an exact-looking stripe/check can still be physically mis-scaled.

**Rule:** the browser receives only a sanitized four-field calibration contract. Operator notes, viewer IDs, raw realism ratings and other proof evidence remain server-side. Missing, revoked or review-state proof returns an unverified calibration and patterned customer previews stay approximate.

## 2026-10-03 — Generated Style Director images cannot outlive their photo calibration
**Decision:** a Style Director photoreal render is bound to the exact proof-backed studio calibration identity used by the real-model preview that seeded it.

**Why:** the generated image replaces the live preview visually. If Phase 1 calibration is later accepted, changed or revoked while that image is on screen, an untracked generated result could continue representing an older pattern scale even though the underlying evidence changed.

**Rule:** Style Director rechecks the safe customer calibration on focus/visibility. A calibration-identity change discards the generated render and locked preview source, remounts the photographic preview, and requires a fresh serialized source before another photoreal request. No AI credit is spent automatically.


## 2026-10-03 — Every generated camera view owns its QA state
**Decision:** front approval is a prerequisite for generating additional selected-look camera views, but it never substitutes for the fidelity check of the side, back or three-quarter image itself.

**Why:** a secondary image can introduce new garment-boundary, pattern, construction or mannequin-identity errors even when its front source was acceptable. Treating the whole set as approved from one front check would overstate visual evidence and could expose a suspect angle as trusted output.

**Rule:** secondary generation is blocked until front QA passes. Each generated secondary view keeps its own check; pass may display normally, review requires an explicit review action, and unavailable checks may be retried without buying another render. Only a currently passing view is a trusted photoreal save/export source.


## 2026-10-03 — Multiview generation requires server-bound front QA
**Decision:** client UI state is not sufficient evidence for spending credits on a secondary photoreal view. The server must verify that the exact front image submitted as the secondary-view source is the image that received a passing fidelity check.

**Why:** a browser-only gate can be bypassed with a direct API request, and a passing job ID alone could be paired with a different generated image. The private outcome ledger already holds the appropriate evidence boundary.

**Rule:** front inspection stores a SHA-256 identity of the inspected FASHN image inside the private QA payload. Secondary generation supplies the front job ID and image; the server requires a matching front outcome, passing QA, matching shirt/trouser IDs, an allowed selected-look concept, and the same image hash before returning a cache hit or spending a generation credit. Repair replaces stale front caches so later views inherit the reviewed repaired source rather than an older defect.


## 2026-10-03 — Front final-render QA measures protected-region drift
**Decision:** the locked front photoreal is checked deterministically outside the intended garment edit before semantic QA can promote it.

**Why:** FASHN Edit documents black mask pixels as preserve guidance rather than a hard boundary, so a successful garment refinement can still change the faceless mannequin, shoes or studio. Recent virtual-try-on research likewise treats preservation of human/background regions as a separate fidelity problem rather than assuming garment quality guarantees identity stability.

**Rule:** only the aligned front view is compared against the canonical studio reference in protected head/outer-background/floor regions. Normalize the mean pixel delta on the existing protected-region scale, classify it conservatively as strong/review/weak, and combine the result with semantic mannequin consistency using the worse status. Review/weak deterministic drift must hold the render and produce a targeted restore-model/studio repair instruction. Do not apply fixed front-coordinate comparison to three-quarter, side or back views because their geometry intentionally changes.

## 2026-10-03 — Instant cloth shading uses neutral shape maps
**Decision:** the customer photo compositor derives broad garment form from a neutral-gray, low-frequency studio lighting map normalized against the actual photographed garment region, rather than blending the photographed source garment luminance/albedo directly into the selected fabric.

**Why:** direct template luminance can make pale Linen Earth cloth inherit the dark source shirt or make darker cloth inherit a pale trouser base. A fixed brightness multiplier is also fragile across shirts, sleeves, trousers and future studio templates. Region-normalizing the photographed cloth around neutral gray keeps relative studio highlights/shadows while removing the source garment's base value.

**Rule:** the catalogue swatch remains the colour/texture authority. The studio photograph may contribute garment-local neutral broad lighting plus colour-neutral multi-band fold/seam relief only. Direct source-photo detail blending, source-garment colour/value, and arbitrary per-template albedo/detail-brightness multipliers must not be used to make the selected cloth look photographic. White contrast collars/cuffs follow the same rule and derive depth only from their own normalized detail region. Relief blur must also be garment-local: non-garment pixels are replaced by the garment-region mean before frequency extraction so skin/background edges cannot manufacture cloth shadows. Directional pattern orientation may follow traced screen-space panel axes for visual realism, but those rotations are photo geometry only and must never be treated as physical grain or scale evidence. When a photographed garment is split into traced panels, shape/relief normalization must use the intersection of the adaptive cloth mask and that exact panel path; whole-shirt or both-leg baselines are not reused for an individual sleeve or leg. Pattern rotation and repeat scaling on those panels must be anchored to a traced screen-space panel start rather than the canvas origin, so calibration changes do not re-phase stripes/checks across the photographed seam. That anchor is still visual geometry only and does not prove physical grain placement. The same rule applies to untucked photographed shirts: when torso, sleeves and collar have distinct traced geometry, they must be projected as distinct fabric panels rather than one globally oriented shirt texture. Untucked photographed trousers follow the same principle per leg; where the source mask is divided at the center seam, the two prepared alpha masks must be complementary so the split cannot create a gap or double-painted textile.

## 2026-10-04 — Assemble cloth panels before applying garment coverage
**Problem:** repeated panel/silhouette feathering left old cloth at boundaries; complementary leg alpha composed with source-over could still lose coverage at the fly. Tucked interior-mask recovery could classify the neighbouring garment at the waistband. Broad-light filtering also blurred bright background into the garment before masking, while weak relief flattened the photographed folds.

**Decision:** assemble base torso/sleeve/leg panels into one garment canvas and apply its antialiased adaptive silhouette once, without a second blur that exposes original cloth. Keep panel-local lighting normalization, grain rotation and repeat anchors. The tucked source palette explicitly rejects the other garment at overlapping geometry and gives known source cloth full interior coverage. A small traced sleeve seam overlap closes the shoulder-panel gap; the curved shirt hem includes its last photographed cloth pixels while palette rejection protects the trouser waistband. Both broad lighting and relief substitute the garment-local mean outside coverage before filtering. Narrower relief bands and stronger shared, colour-neutral compositing preserve photographed seams/folds without blending original navy/beige cloth back into selected swatches.

**Compatibility:** the same model/photos, real catalogue references, scale evidence, save/lock recipes and provider budget remain in use. No dependency, schema or persisted-data migration. This improves coverage and depicted photographic form; it does not measure fabric-specific drape, simulate fit/body shape, warp repeats or establish physical sample acceptance. Existing static contracts are updated to the new renderer and backed by baseline-versus-current Chromium pixel evidence, protected-region checks and 390/768/1440 responsive review.

## 2026-10-03 — Photographic shading follows relative illumination, not byte deltas
**Decision:** the neutral shape map derives studio shading from the photographed garment's relative linear-light luminance ratio around its local cloth baseline, encoded in log space around neutral gray.

**Why:** diffuse image formation is better approximated as reflectance multiplied by shading. Equal sRGB byte differences do not represent equal illumination changes on dark and pale source garments, so additive normalization can make the same studio light read differently when the template cloth changes.

**Rule:** convert photographed grayscale samples to linear-light sRGB before comparing them to the garment baseline; map only the relative illumination ratio back to the neutral shape layer. Keep the selected catalogue swatch as the colour/texture authority, clamp extreme ratios, and do not promote this 2D approximation to a physical BRDF or measured sheen claim.

## 2026-10-03 — Photo garment baseline uses log-average linear luminance
**Decision:** the neutral photographic shape map estimates each garment/panel baseline with an alpha-weighted log-average in linear-light space.

**Why:** the compositor treats shading as relative illumination. A plain arithmetic mean of gamma-encoded pixels lets a small bright highlight or specular patch pull the baseline upward and flatten the rest of the cloth. A log-average in linear light better matches the multiplicative shading model while leaving a uniformly lit garment unchanged.

**Rule:** derive the baseline only from pixels inside the active garment/panel mask, ignore invalid or near-transparent samples, convert sRGB bytes to linear light before averaging in log space, and convert the resulting baseline back to sRGB only for the existing neutralization interface. This is a rendering heuristic, not a measured material property.

## 2026-10-03 — Final-render handoff preserves textile detail with WebP
**Decision:** the deterministic locked customer preview and the split shirt/trouser fabric context use high-quality WebP rather than introducing JPEG generations before the final FASHN render.

**Why:** the final renderer depends on fine weave, slub, stripe/check edges and colour separation that can be softened by repeated JPEG encoding. Current FASHN guidance accepts WebP inputs and recommends preserving original format/quality when possible, so the handoff should avoid avoidable lossy transcodes while staying small enough for the existing request path.

**Rule:** browser locked-preview serialization uses WebP at high quality with Canvas fallback semantics; server validation still accepts JPEG/PNG/WebP but canonicalizes an accepted 1024×1536 locked source to near-lossless WebP. Fabric-context resizing uses lossless intermediates and one near-lossless WebP output. Each fabric-context panel must use contain-fit framing so the complete stock swatch remains visible, and shirt/trouser panels must be separated by a neutral gutter rather than touching or carrying text labels. Keep the current request-size guard and identity checks; this improves source fidelity but does not bypass render QA or upgrade physical-fabric claims.

## 2026-10-03 — Final FASHN renders use PNG
**Decision:** the FASHN edit pipeline requests PNG output for the final front render, repairs and secondary views.

**Why:** these generated images are quality assets and can themselves become the source for later repair/view generation. FASHN documents PNG as the higher-quality output option, while JPEG trades some image fidelity for smaller/faster delivery. Keeping the generated chain in PNG avoids another lossy generation around fine weave and pattern edges without increasing the number of render calls.

**Rule:** keep the existing 1k balanced generation settings and credit gates unchanged; change only the output encoding to PNG. Customer exposure still depends on the existing fidelity QA, and PNG output does not imply verified physical colour or pattern scale.

## 2026-10-03 — FASHN Edit preserves source framing
**Decision:** the final-render Edit call no longer sends a forced 4:5 aspect-ratio field.

**Why:** the current FASHN Edit API documents image, prompt, mask, image_context, resolution, generation_mode, seed, num_images, output_format and return_base64, but not an aspect-ratio override. The locked customer preview already has the full-body 1024×1536 framing we want, so an unsupported/extra 4:5 field risks unnecessary reframing or future request incompatibility.

**Rule:** let FASHN Edit derive output geometry from the submitted source image and keep full-body framing instructions in the prompt. Use a separate supported reframe step only if Linen Earth intentionally wants a different export aspect ratio later; do not couple that to the fidelity render itself.

## 2026-10-03 — Final front edit is garment-mask guided
**Decision:** the locked selected-look front render supplies FASHN Edit with a mask generated from the same 1024×1536 photographed shirt/trouser geometry used by the deterministic compositor.

**Why:** FASHN Edit documents white mask pixels as the priority edit region and black pixels as preserve guidance. The selected look needs cloth realism refinement, while the faceless head, hands, shoes and navy studio should stay as stable as possible. Reusing the existing traced garment geometry focuses the edit without adding another generation or inventing a second segmentation system.

**Rule:** generate a binary PNG mask server-side from the exact active shirt/trouser photo-template paths; pass it only to the locked front refinement where source and mask coordinates are aligned. Repairs and alternate camera views do not reuse the front mask because generated geometry may have moved. Treat the mask as guidance, not a hard boundary; the existing automated fidelity QA remains mandatory.

## 2026-10-03 — Fabric chroma is not white-balance evidence
**Decision:** Fabric Analyzer image quality no longer penalizes a large RGB channel spread as a `strong_color_cast` by itself.

**Why:** a saturated navy, burgundy or green fabric naturally has unequal RGB channel means. Without a known neutral grey/white reference in the same light, that imbalance cannot distinguish the cloth's real colour from an illumination cast. Treating chroma as white-balance evidence unfairly downgraded strongly coloured fabrics.

**Rule:** keep the existing channel-spread value only as a diagnostic compatibility field. Do not turn it into a colour-cast issue or quality penalty unless a future capture protocol supplies a known neutral reference. Physical colour verification remains a separate controlled evidence workflow.

## 2026-10-03 — Async preview results belong to one committed design
**Decision:** the browser owns one cancellable generation/repair/view/QA chain per committed design signature, including its accepted studio calibration. A signature change or unmount invalidates that lifecycle before the next frame is painted.

**Why:** resetting the visible render when a selection changes is insufficient if an older network response can later repopulate the preview, approve old QA, overwrite loading state or invoke creative feedback for the replacement look.

**Rule:** every async response checks its request lifecycle before state/cache writes, follow-up inspections or feedback callbacks. Fetches share an AbortSignal, stale errors and finally blocks cannot affect a newer chain, and a synchronous lock prevents same-frame duplicate generation dispatch. Cancellation is a browser correctness boundary; it cannot promise to refund or stop provider work already dispatched server-side. No shared schema or persistence contract changes.

**Verification runtime:** CI installs pinned Playwright 1.63.0 in a temporary test-only prefix after the production build. It uses real Chromium, local photographs and Canvas at 390/768/1440px, with delayed mocked provider/QA responses that deliberately ignore cancellation. This does not add an application dependency or change package/schema contracts. The screenshots and lifecycle report are retained as CI artifacts; synthetic QA approvals, desktop viewport emulation and unverified calibration must never satisfy physical-fabric or real-device acceptance gates.

## 2026-10-03 — Brand surfaces share the intact original logo
**Decision:** restore the original 890×242 Linen Earth PNG from branding commit `52984409` unchanged and serve it as one content-hashed public asset. Header, opening animation, favicon and social metadata share its source and intrinsic dimensions.

**Why:** the assembled base64 image had a bad palette CRC and a truncated image stream. It exposed metadata to permissive decoders but failed actual browser/pixel decoding, leaving the brand surfaces broken. Reusing its year-cached alias alone would also leave cached failures visible.

**Rule:** preserve the recovered image bytes; verify full pixel decoding and the URL's content hash in tests. Keep the old public image URL as a short-lived redirect to the canonical asset. Browser checks must decode the header and opening logo and validate icon/social metadata at all three responsive widths. No new dependencies, brand redesign, fabric claims or deployment milestone.

## 2026-10-03 — Style Director requests belong to the current journey and look
**Decision:** reuse the cancellable preview request scope for each committed questionnaire step and selected look/calibration. A restart creates a fresh journey even when the first question is already visible.

**Why:** clearing the results on restart or look selection did not stop an older response from displaying another look, recording a discarded render as completed, reopening previous recommendations or clearing a newer request's loading state. Clicking the already selected look also cleared its source preview without asking the compositor to rebuild it.

**Rule:** check ownership after each async boundary and before result, error, loading or style-memory writes. Pass the request's AbortSignal to fetch, invalidate before paint and on restart/selection, and synchronously lock each action against duplicate clicks. Local photo callbacks must belong to an enabled selected look, including while exit animations retain the previous view. Reselecting the active look preserves its prepared source. Server/provider work already dispatched may continue after browser cancellation. No new application dependencies, schema, physical evidence or deployment milestone.

## 2026-10-03 — Style Director photoreal promotion requires fidelity QA
**Decision:** inspect the exact generated front image/job against the same locked shirt, trousers and construction before it replaces the live photographic outfit or enters completed style memory.

**Why:** Style Director used the selected-look generator but bypassed its inspection step, so a wrong fabric, construction or model could appear as a completed final visual.

**Rule:** require an available passing check with every fidelity dimension strong and no major artifact. Missing, malformed, contradictory, unavailable or review checks keep the live outfit visible. Retain the generated image only within the current look/calibration lifecycle so Retry photoreal check repeats inspection without generating another image or recording another render request. Successful QA disables further generation of that same result. Generation and inspection share the request scope; stale approvals/errors cannot display an old image, unlock a new request or complete memory. No dependencies, persistence schema, physical acceptance or deployment changes.

## 2026-10-03 — Live model framing follows the finite preview surface
**Decision:** anchor the Style Director Canvas to its preview frame, matching the contained generated-image surface.

**Why:** a percentage-sized Canvas inside the centered grid could retain an intrinsic row taller than the tablet preview; `object-fit:contain` alone did not stop the model's feet from being clipped by the parent.

**Rule:** keep the Canvas absolutely contained by the preview bounds. Browser checks measure the rendered intrinsic-image bounds inside the clipping frame at 390/768/1440px for initial/selected live looks, held QA and approved images. This changes CSS framing only; Canvas pixels, serialized locked sources, calibration, garment geometry and fabric claims stay identical. No dependencies or schema changes.

**Verification:** real Chromium CI exercises the questionnaire and photographed Canvas at 390/768/1440px, then deliberately delivers mocked responses after cancellation. Reports separate these code regressions from physical, device and owner acceptance; the calibration-change case uses a synthetic API fixture only.

## 2026-10-03 — Neutral photographic folds retain fabric coverage
**Decision:** recover coverage inside the traced tucked garment independently of tiny source-cloth RGB differences; retain the existing colour/brightness rejection at uncertain boundaries.

**Why:** near-neutral folds punched holes in the colour mask, exposing the original dark shirt as blocky patches through a pale selected fabric. A blurred geometric mask supplies conservative interior coverage, with neck clearing and bright mannequin/floor rejection still applied. Prepare it once per photograph and reuse it on every edit.

**Rule:** preserve the real swatch texture, repeat scale, panel grain, mannequin and source fold geometry. This corrects compositing; it does not measure a new fabric's mechanical drape. Exact drape requires mechanical or captured drape evidence ([Rodriguez-Pardo et al., 2023](https://arxiv.org/abs/2304.06704)); a flat RGB swatch alone does not provide that evidence. Existing saved designs remain compatible; no dependency or persistence schema changes. Browser checks cover the previously exposed folds and unchanged head/shoes/studio pixels at all three widths, separately from physical acceptance.

**Collar completion:** the neck clear zone also removed real inner collar folds. For self-fabric collars, restore selected cloth in the same bounded region where cool source chroma or very dark source shadows confirm collar cloth, then draw the original traced wings. The dark-shadow fallback belongs only to this photographed template: its warm mannequin neck is brighter than those near-black, hue-quantised cloth folds. Do not use interior geometry to recover neckline pixels, because it also contains skin. Browser probes include the recovered collar folds and unchanged shaded neck, head, hands, shoes and studio.

## 2026-10-03 — Designer questions produce grounded advice and judged revisions
**Decision:** extend the existing brief endpoint with a versioned `designer-advice-v1` response for callers supplying the selected construction, occasion and context. Dispatch design, critique, comparison, refinement, fit, construction, material and production-preparation tasks through pure functions using the existing stock, rule engine, fit assessment, negotiation and option library.

**Why:** the original one-line interface always proposed three catalogue directions, even for a critique or a question about the selected outfit. It omitted the current construction and occasion, and did not connect a judgement to an actionable revision. Applying a searched direction also sent the previous StyleSpec into canonical assessment.

**Rule:** explicit retained fabrics/details and the latest judgement instruction override defaults and learned taste. Compare available cloth or closed construction options; explain recorded construction guidance, provisional fit targets, conflicts and missing evidence. Hold an apply action with a blocking conflict. Unknown tasks/categories ask for a supported brief. Material answers never infer GSM, fibre, shrinkage, colour verification or exact mechanical drape from a flat image. Advice and revision never call paid image providers. A preview changes only after Apply, and assessment receives that exact versioned construction; late answers, errors and applied-choice assessments cannot write into a changed context.

**Human learning:** one newest human judgement per recommendation and distinct fabric/construction recipe; scope preferences to occasion. Selecting, saving and automated visual QA are not endorsements. A single judgement drives its next revision immediately; stable future preferences still require at least four distinct human reviews and a clear winning signal. Generic colour, cloth and formality feedback requires an instruction rather than an invented intent. Preserve the user's selected fabric/cut when the retained constraints leave no meaningful change.

**Compatibility/storage:** requests without the new current-construction fields retain the existing `linen-designer-brief-v2` response and three-direction flow. New response fields include task advice, versioned proposal construction, change summaries, provisional fit targets and apply eligibility; these are an additive API contract, not a database migration. Human feedback and advice audit use the existing bounded `designer_feedback`/`designer_override` event payloads and queue. Existing local profile version 1 stays readable, with conservative recalculation from human feedback; this is personal preference adaptation, not a globally retrained model. Measurements remain local unless explicitly exported through existing flows. No application dependency or persistence schema change.

**Verification:** task scenarios cover constraints, comparisons, evidence honesty, provisional measurement targets, latest-instruction priority, corrections, duplicate ratings, automated-QA exclusion and occasion/tie handling. Engine evaluation measures 55 deterministic task requests with explicit exclusion of API/image latency and physical acceptance. CI posts 13 actual HTTP contracts against its isolated server: all eight tasks, judged revision, legacy v2 compatibility and invalid construction/stock/ambiguous feedback. Real Chromium uses the actual model/Canvas and deterministic fixtures at 390/768/1440px, then delays responses through text/choice/reset/unmount changes, same-frame duplicate actions and exact-construction canonical assessment. Browser UI/provider responses are mocked; physical, device and owner acceptance remain separate.

## 2026-10-04 — Designer intent follows supported construction and the primary task
**Decision:** resolve natural construction names through the existing option IDs and closed selectable choices. Recognize full labels and bounded aliases across collar, cuff, placket, shirt fit/wear, trouser shape, rise, waistband, break and button material. An outfit request retains its primary design intent when it also mentions comfort, cloth or construction.

**Rule:** enclosing specific phrases win over generic aliases, so soft button-down and extra-high rise remain specific choices. Scope trouser fit adjectives separately from shirt fit; unsupported separate trouser-fit requests and contradictory construction instructions ask for clarification. Named comparisons evaluate those choices or ask for a supported pair instead of substituting point/spread or flat/pleated defaults. Revisions explain the recorded guidance for changed details, including provisional options.

**Constraints:** filter excluded colours and pattern families before ranking, preserving exclusions when a cloth is locked; an unsatisfiable retained cloth produces no proposal. Negated expression stays restrained. White contrast collar/cuffs and vegetable-ivory button material are construction details, not requests for replacement body fabric. Whole-word interpretation prevents photograph from becoming hot weather. These changes preserve the legacy brief response and existing saved StyleSpec contracts; no application dependency, database migration, paid-image call or upgraded physical claim.

**Verification:** pure regression tests cover every current selectable label, aliases, overlap, garment roles, compound intent, exclusion-first ranking, locked-cloth conflicts, named comparisons, contradictions and source guidance. CI adds six actual HTTP contracts and exercises named collar/placket/button request → explicit Apply → exact canonical construction at 390/768/1440px. Browser responses remain deterministic fixtures; actual fabric, drape and device evidence remain separate.


## 2026-10-04 — Designer executes garment briefs, capsule tasks and personal construction preferences
**Decision:** extend the existing deterministic workspace, not a parallel chat engine. Compile bounded creative goals, garment scope, role-specific cloth requirements and capsule occasions into closed construction choices. Apply explicit construction and companion locks before catalogue ranking and fit checks; missing numeric material data cannot satisfy a GSM/Lea request. Creative goals and learned choices are secondary to hard instructions and compatibility, with disclosed fallback when a soft treatment cannot be supported.

**Learning:** keep one latest distinct human recipe judgement per occasion. Use relevant supporting/opposing construction evidence and a clear winner; targeted fit/detail rejections do not reject unrelated liked details. Show the derived preferences and allow opt-out. Saves, repeated clicks, automated image QA and prior-revision navigation do not train personal taste. This is browser preference adaptation, not global model retraining.

**Workflow:** every capsule option carries its own occasion/context through judging and Apply. Cloth-only revisions preserve the actual judged construction. Keep up to six prior advice revisions within the current brief, with explicit Apply still required. Cards disclose photographic construction approximations using the existing shared photo-support contract.

**Compatibility:** additive advisor-v1 and browser-profile-v1 fields; unchanged StyleSpec v2 and legacy brief response, existing feedback event queue, no database migration, dependency or provider call. Read `docs/DESIGNER_ENGINE_EXECUTION.md` for the acceptance scope and remaining physical, preview-asset, broad-interpretation and real-user gates. Software success must not be described as universal designer intelligence or 100% physical readiness.

## 2026-10-04 — Develop a proposal without applying or judging it

**Decision:** let customers explicitly choose a returned direction as the starting point for subsequent Designer questions. Carry the exact proposal fabric IDs, closed construction choices and its own occasion/context through the existing validated brief API. Keep the applied outfit authoritative until explicit Apply; selecting a starting point is neither approval nor a negative judgement and adds no preference evidence.

**Ownership:** snapshot only the question context, not a new saved design or stock record. A human judgement always refers to its actual target proposal, taking priority over the earlier starting point. Read personal preferences for the brief's parsed occasion using the same parser as the API, so a business follow-up to a casual proposal cannot inherit casual-only feedback. Question edits and preference changes cancel pending answers while keeping the chosen starting point; manual changes to the applied outfit, reset/unmount, explicit Apply and returning to the current outfit clear it. Return focus to the brief when a proposal is chosen so mobile users can continue from long card lists.

**Compatibility and verification:** no new API request schema, StyleSpec version, database migration, dependency or paid call. Transient starting points do not provide durable account memory or unrestricted chat history. Pure context/engine cases, actual HTTP follow-up/comparison contracts and responsive Chromium flows cover exact proposal context, no implicit feedback, canonical Apply and stale-response cancellation.

**Capsule correction:** a full learned construction for one occasion must not remove other requested occasions. Each capsule slot starts from its own occasion's construction; only the slot matching the brief's parsed occasion receives that profile's learned construction. Explicit construction and retained customer choices remain authoritative in every slot. The existing incomplete-wardrobe disclosure still applies when hard constraints or stock genuinely prevent a requested look.

## 2026-10-04 — Creative craft workflow and personal research memory

**Decision:** adapt the existing Creative Lab and final-render loop. Add `linen-earth-creative-craft-v1` as an optional field on CreativeDirection and the v1 canonical garment specification. Its closed zone/motif/stitch IDs, catalogue-backed accent fabric, thread colour, proposed repeat, width and coverage survive locking, reconstruction, recipe hashing, production handoff and the printable tech pack. One accent panel is supported per recipe; its real swatch becomes the third separated FASHN reference. Legacy two-swatch renders and recipes without craft remain compatible. No new dependency or database table is introduced.

**Customer flow:** a craft question routes to Creative Lab; explicit controls and the brief take precedence over preferences. Generate and judge produce deterministic placement illustrations; neither applies an outfit nor starts a paid render. Applying carries the exact recipe into the existing model, assessment and explicit final-render action. The model preview identifies unsupported craft as specification-only; the placement illustration shows the new craft geometry. These views are not evidence of exact stitch execution or physical drape. A later cloth/sample review remains mandatory before production.

**Ownership:** dedicated creative-profile handlers validate the signed customer session, reject stale UI owner bindings, and append account-derived events to the existing service-only `style_events` ledger. Unowned historical browser feedback is never imported or attributed on login. Opt-in settings, an explicit learning reset cutoff and latest distinct human concept judgements are read per owner. Settings are fetched independently of the bounded review window so opt-out/reset cannot fall off that window. Renderer mismatches and automatic QA are excluded from taste learning. The previous pooled creative-feedback read is removed. Reset stops use of prior taste; historical audit records remain in the ledger.

**Research:** one daily cron plus an authenticated operator control collects at most two rotating primary sources. The existing DNS/IP-pinned, redirect-validated public page fetcher is reused, with bounded content and timeout. This scheduled collector makes zero paid model calls. Source hash, URL, fetch date and explicit keyword-hypothesis provenance accompany inactive candidates; a human must read, improve and activate each candidate in the existing research desk. An atomic deterministic daily ledger ID prevents duplicate/concurrent/manual runs spending a second batch. A claimed unfinished run needs operator inspection; retries do not silently bypass its daily budget. Daily activation needs the deployed route, `CRON_SECRET` and the operator's enabled setting; it is paused by default. Explicit operator synthesis remains a separate existing paid action.

**Verification:** pure craft/ownership/revision/lock/handoff cases, HTTP handler tests with an isolated ledger adapter, real HTTP contracts on CI, and responsive Chromium flows at 390/768/1440 cover the story. Live Postgres rollback probes verify the ledger accepts the payload shapes, a duplicate primary-key claim remains singular, RLS is enabled, client SELECT/INSERT are revoked and service SELECT/INSERT remains available. No production feedback or candidate was inserted by these probes. Source-token architecture gates now verify the extracted component, ownership and free research budget instead of the retired swatch-only cards and inaccurate background-learning message.

## 2026-10-04 — Branded public-site motion and premium controls

**Decision:** use the existing Motion dependency's small DOM animation entry point for one-time homepage reveals. Keep the uploaded Linen Earth logo, existing typefaces and local editorial photographs; add scoped warm-paper backgrounds, a fine brass line and control hover/press/focus treatments. Decorative motion does not transform the Designer's photographic canvas or fabric swatches. No dependency, API, material claim or render charge is introduced by this polish.

**Accessibility and lifecycle:** content is visible in server output; the optional opening logo mounts only after JavaScript confirms the session and motion preference. Unavailable session storage is tolerated. Reduced-motion changes cancel entrance animations and restore visible styles, keyboard focus completes decorative reveals, and listeners/animations are cleaned up on navigation. Background entrances finish once; no continuous ambient animation or scroll hijacking is added. Chromium checks cover 390/768/1440, normal/reduced motion, focus, no-JavaScript content, disabled storage, navigation and absence of paid provider calls.

**Browser correction:** remove the blanket root loading boundary, which left the static homepage behind a streamed loading placeholder when JavaScript was disabled. Existing action-level loading feedback remains. Replace the unrelated business-desk homepage fallback with the existing full-body studio image; keep its wording as a studio illustration and preserve the configured final-model endpoint. Catalogue photography and the Designer's model assets are unchanged.

## 2026-10-04 — Craft on the existing photographic preview

**Decision:** render the existing optional craft recipe locally on the same studio photograph. Resolve its accent ID against the current available catalogue and its base IDs against the applied shirt/trousers. Reuse actual swatch tiles, neutral garment relief and inward boundary masks. Compose craft after contrast details, with a separate bounded motif grid for the four existing motifs and three proposed stitch treatments. Image loads run together; ownership is invalidated before paint and cancelled edits cannot paint a newer design or enable its render controls. No dependency, schema, paid call or recipe migration is introduced; recipes without craft retain their existing pixels.

**Truth boundary:** every new craft placement is approximate. Illustrative motif spacing, mark width and density respond to the proposed recipe without asserting calibrated physical dimensions. The pocket remains specification-only because the source shirt has no pocket. Untucked waistbands/upper pleats remain hidden, and flat-front trouser pleats are not fabricated. Unsupported details stay in the saved recipe and drafting illustration. Physical drape, shrinkage, stitch tension and production approval still require the exact cloth sample.

**Scale disclosure:** visible patterned accents use the same independent physical-repeat and studio-calibration checks as the base cloth. Verified base fabrics cannot upgrade an unverified accent. The proposed craft-dimension note remains visibly readable in the compact model panel regardless of cloth-scale status.

**Reference replacement:** the existing bounded swatch-tile cache includes the loaded image URL, crop pattern and colour fallback. Updating a catalogue reference under the same fabric ID therefore refreshes both base garments and craft panels instead of reusing an earlier cloth tile. Base and accent reference metadata also participate in preview ownership/final-render cache identity, so the replaced cloth invalidates readiness and cannot inherit an earlier render.

**Verification:** pure cases cover catalogue reconstruction, stale bases, garment compatibility, hidden placements and bounded deterministic geometry. Chromium verifies real canvas pixels, protected skin/background, all supported zones/motifs, no provider calls, responsive application, and late accent loads. These are software placement checks, not physical acceptance.


## 2026-10-04 — Preserve the banner Replay placement

**Decision:** the premium button base sets relative positioning, which overrode the signature Replay button's original absolute placement and put it over the caption. Give the existing scoped premium Replay rule absolute positioning so its original responsive bottom-right offsets apply. The brass styling, keyboard focus, 44px target, three-second motion, logo and thread artwork are retained.

**Verification:** add actual browser geometry checks at 390/768/1440 for caption clearance, the bottom-right inset, target height and containment. Existing timeline, strict pause/resume, reduced-motion and Designer/photo/Style Director verification remains unchanged. No dependency, data, API or deployment guard changes.


## 2026-10-07 — M7.30 mannequin hand anatomy refinement

**Decision:** keep the locked Linen Earth studio identity and existing palm/forearm proportions, but replace the mitten-like hand read with deterministic articulated finger and thumb geometry generated inside the same zero-credit GLB build. Four fingers now extend continuously from each palm with small mirrored spacing/length differences; the thumb sits on the body-facing side and is mirrored per hand. No face/body identity, garment scale, camera, fabric, API or paid-render behaviour changes.

**Acceptance boundary:** this is a mannequin realism refinement, not a scanned anatomical hand claim. Finger geometry must remain subordinate to sleeve/cuff fit, preserve hand clearance from the trouser silhouette and stay consistent in front / 3/4 / side / back views. The production label advances to M7.30; existing model-contract, material, pattern-scale and browser gates remain authoritative.


## 2026-10-07 — M7.31 dress-shoe silhouette refinement

**Decision:** replace the generic scaled sphere used for the visible shoe upper with a deterministic multi-station dress-shoe shell. The new upper narrows through the heel, gains instep volume, tapers toward a lower rounded toe and adds a separate compact heel block above the existing sole. The locked 1727 mm mannequin stance, leg spacing, floor contact, camera system and zero-credit material path remain unchanged.

**Acceptance boundary:** this is a premium mannequin shoe silhouette, not a footwear sizing or last-design system. It must improve front / 3/4 / side readability without changing the garment fit contract or introducing paid rendering.


## 2026-10-07 — M7.32 neck and jaw transition refinement

**Decision:** stop reusing a scaled copy of the head as the visible neck. The mannequin now has a dedicated tapered neck shell that narrows toward the jaw while preserving the locked collar height, head position and 1727 mm identity. This removes the bulbous neck read in 3/4 and side views and gives collar variants a cleaner human-like support surface without adding facial detail.

**Acceptance boundary:** the mannequin remains intentionally faceless and identity-locked. This refinement changes only the visible neutral neck geometry; collar selection, neck gasket behaviour, garment scale, camera, fabric mapping and zero-credit rendering stay unchanged.


## 2026-10-07 — M7.33 exact white contrast collar and cuff rendering

**Decision:** carry the existing StyleSpec v2 `collarFinish` choice into the reusable 3D garment viewer instead of dropping it during Designer → 3D handoff. The live viewer now supports the same three closed choices already used by Designer: self-fabric, white contrast collar, and white contrast collar + cuffs. Contrast pieces keep the active construction geometry and linen normal/roughness behaviour, but deliberately detach the selected shirt colour/pattern texture and render as neutral off-white cloth. The collar neck-gasket follows the collar finish so no coloured seam appears at the neck.

**Compatibility:** no schema migration, new dependency, provider call or AI credit. Existing saved StyleSpec v2 recipes remain valid; missing collarFinish defaults to self-fabric. Switching back to self-fabric restores the prepared real shirt texture to the active collar/cuff materials.

**Verification:** static quality gates protect the exact handoff and texture-detach path; responsive browser QA verifies the saved collar + cuffs choice reaches the new control, remains observable on the viewer shell, and collar-only contrast remains a distinct state.


## 2026-10-07 — M7.34 fit-specific tucked waist geometry

**Decision:** stop rendering a tucked shirt with the same lower-torso shell used for untucked wear. Every shirt fit now gets a dedicated tucked torso geometry that compresses depth at the waistband, slightly cleans the lower width and adds low-amplitude deterministic cloth bunching above the trouser waist. Back constructions keep their own tucked geometry so darts, side pleats and box pleats survive the tuck instead of reverting to a plain back.

**Rendering rule:** tucked and untucked torso shells are mutually exclusive. Sleeve, collar, cuff, placket, yoke, pocket and fabric-scale systems remain independent and reuse the same locked model identity.

**Acceptance boundary:** this is a deterministic visual fit model, not a body-physics simulation. It must remove the obvious shirt/trouser shell intersection while preserving instant updates and zero AI-credit rendering.


## 2026-10-07 — M7.35 English Spread / British collar

**Decision:** add an explicit English Spread / British Collar instead of treating every British business collar as the generic spread shape. The shared Designer library, vocabulary and reusable 3D tailoring library now expose the same option.

**Geometry basis:** the collar uses the current Proper Cloth English Spread reference dimensions: 2.75 in point length, 4.88 in spread, 0.38 in tie space, 1.00 in front band height and 1.38 in rear band height. The 3D shell uses a conservative spread angle between the existing semi-spread and broad spread families, with the same fused / soft-fused / soft-unfused construction variants.

**Rendering:** the collar remains compatible with self-fabric, white contrast collar, and white contrast collar + cuffs, uses the existing physical-scale fabric texture path, and adds no AI/provider cost.


## 2026-10-07 — M7.40 explicit extra-high / Korean trouser rise

**Decision:** the 3D tailoring library now exposes the Designer's existing Extra-High Rise as a real geometry-backed option instead of collapsing it into ordinary high rise.

**Geometry:** the explicit `extra_high` rise shifts the shaped trouser waist shell and all rise-attached fly, button, waistband, pleat and pocket details by 60 mm. Rise-shell generation is now data-driven for every non-mid rise, so future supported rise values do not require hand-written low/high mesh branches.

**Preset:** `Korean High-Rise Tapered` now selects `extra_high` directly. The change stays deterministic, uses the same locked model and fabric materials, and adds no AI/provider cost.


## 2026-10-07 — M7.41 rise-aware tucked-shirt waist junction

**Decision:** tucked shirt geometry is now generated per shirt fit and trouser rise rather than using one fixed waist-compression zone for low, mid, high and extra-high trousers.

**Fit rule:** the shirt compression/bunching zone follows the active trouser waistband top. This keeps the shirt visually inside the waistband across low rise through Korean extra-high rise, while preserving the selected shirt back construction and the same locked mannequin.

**Rendering:** tucked materials are now keyed by `fit + rise`; untucked geometry is unchanged. The system remains deterministic, instant and zero-credit.


## 2026-10-07 — M7.42 360-degree cuff shells

**Decision:** replace flat front-facing cuff plates with closed elliptical cuff shells that wrap the full wrist so cuffs remain believable in front, 3/4, side and back views.

**Construction:** square, rounded, mitered and cocktail families now use separate wrap geometry while preserving the existing measured cuff widths/lengths, fused/soft construction scaling, buttons/cufflinks and white-contrast cloth behavior.

**Acceptance boundary:** cuff shells improve visible tailoring form; they are not a physical button-opening simulation. No model identity, camera, fabric-scale or provider-cost change.


## 2026-10-07 — M7.43 raised-back 360-degree collar bands

**Decision:** replace the thin generic neck gasket behind dress collars with a true wrap-around collar band. The band sits lower at the front and rises at the back, so spread, cutaway, point, button-down and related collars now keep a believable neck silhouette in side and back views.

**Construction:** collar-band geometry is keyed by both collar family and fused/soft construction. Soft constructions reduce band height/depth and follow the same drop as their collar leaves. White-contrast collar choices continue to recolor both the collar leaves and matching band together.

**Acceptance boundary:** this remains deterministic tailoring geometry, not cloth simulation. Camp, one-piece and mandarin collars keep their dedicated construction paths.


## 2026-10-07 — M7.44 360-degree trouser turn-up shells

**Decision:** replace flat box-like trouser turn-up cues with closed elliptical hem shells that wrap each leg. Turn-ups now read as actual folded fabric in front, 3/4, side and back views.

**Fit rule:** the wrap shell remains keyed by trouser fit, break and 4 cm / 5 cm turn-up choice. Its width still follows the selected leg hem scale and its vertical position still follows the selected break.

**Acceptance boundary:** this improves visible tailoring geometry without adding cloth simulation, AI credits or a new model identity.


## 2026-10-07 — M7.45 360-degree waistband hardware

**Decision:** waistband hardware now follows the waist around front, sides and back instead of being drawn only on the front plane.

**Construction:** belt-loop trousers use seven perimeter loops; side adjusters sit on the actual side quarters with tangent rotation; brace-button trousers carry front and rear pairs. Every hardware set continues to follow low, mid, high and extra-high rise positions.

**Acceptance boundary:** this is deterministic tailoring geometry. Extended tabs and drawstrings remain front constructions by design; no cloth simulation, AI credit or model-identity change is introduced.


## 2026-10-07 — M7.46 hip-wrapped trouser pocket openings

**Decision:** front trouser pocket openings now follow the hip perimeter instead of sitting on one flat front plane.

**Construction:** on-seam pockets sit closest to the side seam, slant pockets sit on the front-side quarter, jean scoop pockets sit farther forward and frogmouth pockets stay mostly frontal. Rear welt/jetted pockets are explicitly back-facing. All pocket positions continue to follow the selected trouser rise.

**Acceptance boundary:** these are visible pocket-opening constructions, not simulated pocket bags. The change improves front/3/4/side/back tailoring readability with no AI/provider cost.


## 2026-10-07 — Shared physical identity targets for scan-based production body

**Decision:** move the Linen Earth mannequin's physical silhouette targets into the canonical model-identity JSON and make both the deterministic GarmentViewer builder and Blender body-intake pipeline consume that shared source of truth.

**Production-body workflow:** Blender body preparation now validates the identity file, normalizes the selected realistic body to 1727 mm and floor level, stamps the shared targets into the scene and creates a non-rendering `LinenEarthIdentityGuides` collection for shoulder, shirt waist, trouser waist and both trouser hems. Preflight rejects missing/drifted targets or guides.

**Why:** this removes a major route for the future scan-based body to become a merely similar second mannequin. The production sculpt/garment-fit workflow and the current web model now converge on the same locked physical identity contract.


## 2026-10-07 — Full silhouette identity guides for production-body fitting

**Decision:** extend the shared Blender identity-guide layer beyond shoulder/waist/hem widths to cover every canonical physical target used by the locked Linen Earth model identity.

**Construction:** the body-preparation step now creates non-rendering guides for total height, outer-arm silhouette, left/right hand centres and left/right leg centres in addition to shoulder, shirt waist, trouser waist and both hem widths. The production preflight requires the complete guide set before a garment scene can pass.

**Why:** a scan-based or retopologized body can match the torso widths yet still drift in arm spread, hand clearance, stance or leg spacing. Carrying all shared physical targets into Blender makes the production body fitting workflow converge more tightly on the exact Real Model Designer identity instead of only matching a subset of the front silhouette.


## 2026-10-12 — Production model identity cannot be replaced by an image or cube prototype

**Decision:** continue the existing Linen Earth Designer Studio model path. Repeated AI-generated images or a new photorealistic person are not acceptable 3D engineering outputs and must not replace the canonical studio reference `/designer/studio-tucked.webp` / `linen-earth-studio-model-v1`.

**Implementation:** the internal GarmentViewer lab selects the production GLB only after server-side asset+manifest preflight (`assetReady`), not merely because an environment/default path is configured. When the lab runs its engineering prototype, it labels that geometry explicitly as *not the studio model*. The structural inspector refuses to promote the known box-prototype generator even if its declared model ID is renamed to `LE-OFFICEWEAR-V1` and its six material slots exist.

**Compatibility:** no schema/database migration; existing saved Designer designs, model identity IDs, source photographs and versioned option contracts are unchanged. Internal prototype rendering remains available to engineers, never as evidence of a completed realistic model. Passing structural preflight is still not visual realism approval, verified textile scale, tailor fit approval or deployment authorization.

**Next engineering gate:** exact single identity body mesh, production garment/drape fit and UV evidence, independent front/3-4/side/back visual comparisons, verified supplier physical scale and tailor approval before customer-facing 3D promotion.

## 2026-10-22 — delivery history survives current-status regression

The first-ten production audit selects every order that either currently reports `delivered` or has ever emitted a persisted delivery event. An actual early delivery therefore remains in chronological scope even if a later contradictory transition changes the current order row to another status. Full-history validity now additionally requires every delivery-history order to remain in the terminal `delivered` state; a regression blocks the complete snapshot instead of silently shifting the first-ten window to later clean orders.

Current delivered rows without a delivery event are still included in history validation and fail closed, while only rows with a real delivery timestamp can be ordered into the first-ten payload. The response shape and v2 RPC identifier remain compatible because this corrects selection semantics in the not-yet-released migration. No live migration, customer record, model asset or physical approval is created by this source change. Real delivery evidence, database installation, shop verification and release authorization remain separate gates. Draft only; no merge or deployment.

## 2026-10-23 — cross-dashboard first-ten evidence contract and timestamp integrity

The service-role production_first_ten_delivery_audit v2 RPC is the only chronological authority for the Phase 8 first-ten delivery gate. Its historyValid flag alone is insufficient when the returned JSON lacks delivery chronology or contains malformed evidence. Production Evidence, Phase 10 and Roadmap Control Tower now use the same fail-closed contract guard: at most ten distinct delivered orders; explicit timezone-bearing delivery timestamps no earlier than creation; and well-typed, post-delivery immutable audit rows with checker/source provenance. Unknown/null/extra audit rows and unrecognized order IDs block positive certification rather than being silently filtered out. Valid partial snapshots may display progress but never count as ten real deliveries.

**Compatibility:** source-only validation of the existing v2 RPC; no schema migration, fabric truth update, saved design change, model/GLB/image replacement, or additional paid AI. No live production records, real delivery reviews, human sign-off, release, merge or deployment is implied. Exact-head CI and operator browser/physical evidence remain separate gates.

## 2026-10-23 — production dependency security patch

Exact-head GitHub CI and Deep Engine QA reported a new critical npm audit finding for Next.js 15.5.24 before source/test execution. Patched Next.js 15.5.28 was pinned on the existing 15.5 maintenance line; package-lock.json was regenerated via npm on an isolated GitHub Actions runner with registry-supplied sha512 integrity values, including the matching SWC optional artifacts. Existing Sharp 0.35.5 stays pinned. The temporary lock regeneration workflow was removed. This preserves the audited npm-ci security gate rather than bypassing it.

This source patch does not automatically upgrade the production deployment. No deploy, merge, model asset change or operator/physical signoff is authorized, and exact-head CI/browser checks plus release review must be re-run before any future deploy.

## 2026-10-23 — zero-reentry audit contradictions

The delivery audit contract now rejects a false manual-design-reentry flag paired with any explicitly recorded reentered field ID. Operator POST normalization rejects such submissions instead of storing a misleading "zero re-entry" declaration. Historical records containing the contradiction remain available for investigation, but cannot satisfy a provenance-verified delivery release or the v2 first-ten operator dashboards. Old evidence rows that omitted this optional structured field entirely remain readable for compatibility; existing versioned design, physical proofs, fabrics and the stable model identity remain unchanged.

Source-only correction; no live migration, rewritten physical records, fabricated checker identity, signed delivery or deployment.

## 2026-10-23 — delivery consistency must be enforced at the database boundary

The new, **not yet applied**, 20261104_production_zero_reentry_consistency.sql migration refuses to install on unresolved historical records where manual_design_reentry=false but reentry_fields is nonempty, and adds a validated table CHECK constraint. This prevents even a service-role caller bypassing the application normalizer to record contradictory "clean" deliveries. Existing immutable audit records are never rewritten automatically; the migration must remain blocked until real shop evidence is reviewed and reconciled. The release source checklist includes this migration.

**Release:** no live SQL or DB mutation, no synthetic physical approval, no model/GLB update, no merge or deployment. The production team must review old rows and approve migration application at a later clean milestone.

## 2026-10-23 — backend health must not bless malformed delivery chronology

The independent cloud readiness CLI now validates the v2 first-ten RPC's order identity, full chronology and audit provenance as well as historyValid/response shape. It reports a backend readiness failure on missing delivery timestamps, contradictory zero-reentry fields, duplicate order identities and extraneous malformed audits. It still reports RPC installation, **not** physical zero-reentry certification; real delivery records and separate manual release gates remain mandatory. No live query, migration, production approval or deployment was performed in this source-only change.

## 2026-10-23 — production re-entry field IDs are lossless closed-vocabulary evidence

Operator delivery evidence no longer coerces or silently filters submitted re-entry field IDs. When the field list is present it must be an array containing only the six canonical production categories; unknown, non-string or mixed entries reject the complete submission. Duplicate known selections may be normalized because they do not change the recorded physical incident. In particular, an unknown field can no longer disappear and turn a contradictory submission into an apparently clean zero-reentry audit.

The separate, unapplied `20261105_production_reentry_field_vocabulary.sql` migration first refuses unknown historical values, then adds a database CHECK using JSONB containment over the same six IDs. It never rewrites immutable shop evidence. This is compatible with valid current records and introduces no model, fabric fact, customer schema or paid dependency. Database installation, real record reconciliation, operator review and release approval remain later human-controlled gates. Draft only; no merge or deployment.

## 2026-10-23 — first-ten delivery proof requires ordered, unmodified incident identities

All three first-ten consumers (operator, Phase 10, Roadmap) already use the shared
snapshot guard. The guard and independent cloud readiness checker now reject
out-of-order delivery-event snapshots and unrecognized, non-array, or coerced
re-entry fields in **historical** evidence, including reported incidents.
Legacy fields omitted by older read shapes retain their previous treatment;
the database's current schema requires JSON arrays, and the new, still-unapplied
vocabulary migration independently enforces that shape and closed vocabulary.
These fail-closed checks do not create or validate physical sign-off and cannot
prove the selected ten are the true historical first ten without the underlying
service-role SQL, real records and independent operator review. No merge/deploy.

## 2026-10-23 — operator evidence dashboards use last-request-wins network reads

The Phase 8 delivery, Phase 10 readiness and Roadmap v2 release boards already
clear prior positive evidence before starting a refresh. Concurrent initial or
manual requests can nevertheless return out of order. All three now use a
monotonic request generation, discard older replies/errors and invalidate
pending reads on React unmount; unauthorized navigation also cannot originate
from a superseded generation. This preserves the physical evidence thresholds
and existing design/model identity. Real operator/browser QA remains necessary.
Source-only candidate: no production migration, main merge or deployment.

## 2026-10-23 — immutable delivery audits cannot follow implicit order fallback

On fresh production evidence reads, operator form answers are reset and the
selected order is reconciled with the currently delivered queue. The form no
longer silently targets the first delivered order if the previous selection
is gone. A physical checker must explicitly reconfirm the audited order and
its field/note/reference data. This is a source-only identity-integrity change,
not a claim of completed production audit or human verification.

## 2026-10-24 — Fabric Analyzer physical evidence is validated at every execution boundary

Physical measurements and provenance now use one lossless normalizer across direct analysis, synchronous batches, durable queue ingestion and the independent queue worker. Numeric strings, objects, unknown drape labels, non-text provenance and overlong evidence are rejected instead of coerced, ignored or truncated. The worker repeats validation on persisted JSON so a malformed or bypassed queue write cannot become a stored verified GSM, repeat, width, drape or fibre claim. Valid current UI payloads already send finite JSON numbers and remain compatible. No supplier fact is inferred, no live data is rewritten and no schema or dependency changes are introduced.

## 2026-10-24 — Reference-only Analyzer cannot silently discard verified physical evidence

The independent supplier/source-page Analyzer path does not accept an operator's physical measurements. Previous direct and synchronous batch handling returned source-page results before normalizing evidence, while the durable queue validated input but its worker bypassed the physical payload for source-page-only jobs. That silently lost claimed fibre, drape, GSM, repeat and evidence provenance. All four execution boundaries now normalize first and explicitly reject any nonempty physical claim or physical provenance when no flat fabric capture exists. An ordinary reference-page-only analysis without a physical claim still works, as do existing valid flat-image submissions. Already persisted malformed jobs fail closed in the worker; no migration or rewrite of historical records is performed. Real supplier/owner measurements remain required and the existing studio model is unchanged.

## 2026-10-24 — Batch CSV must not erase malformed physical evidence

The operator CSV worksheet previously converted nonempty invalid physical values (such as 145gsm, exponential/hex notation and malformed 0–1 indices) to undefined before the strict Analyzer API could reject them; unsupported drape labels were likewise deleted. This caused apparent success without the submitted operator claim. The importer now retains nonempty invalid values as strings for the existing strict API to reject per row, converts only finite ordinary decimal notation into numbers, and preserves allowed drape labels. Pure CSV parsing is tested independently from React. Valid worksheet decimals and genuinely blank cells remain backward compatible. No external schema, physical fact, catalogue binding, visual model or dependency changes.

## 2026-10-24 — CSV template prefill requires actual physical provenance

The Analyzer evidence-gap CSV originally prefilled the verified GSM and drape columns directly from metadata even when the operator had not attached valid physical evidence. Designer's customer-facing truth rules already reject these provenance-free values, but the CSV path could accidentally promote them. The shared pure template builder now requires valid structured physical provenance for both physical fields, preserves the auditable source text, and exports an HTTPS link only when present. Unproven catalogue weight and drape remain blank until a human supplies evidence. No previously stored metadata or physical measurement is altered; tests cover source-backed, unsupported and HTTP-only provenance.

## 2026-10-24 — No silent truncation of synchronous Analyzer batches

Batch uploads are explicitly limited to 12 JSON items per request. The previous API sliced an oversized `items` array before processing, so the caller could receive success even though later fabric IDs were never analyzed. A pure boundary validator now rejects the entire malformed/oversized envelope before any fabric job starts and returns an actionable HTTP 400. A 12-item or smaller valid batch retains its original order and processing behavior; the browser already chunks CSV worksheets into groups of 12. No schema, stock evidence, physical claim, model asset, API price or deployment policy changes. Tests cover valid boundaries, over-limit rejection and malformed records. Exact-head CI remains necessary.

## 2026-10-24 — Analyzer CSV must reject ambiguous row structure

The batch CSV client must never quietly remap physical evidence because a spreadsheet has duplicate/blank headers, too many/few columns, malformed quote placement or unterminated quotation. The reusable parser rejects the entire malformed worksheet with a visible operator error and disables batch submission. A valid template with quoted commas, embedded newlines and escaped double quotes still imports. A malformed worksheet changes no server data. The existing JSON batch size and verified physical-value validation remain independently enforced. No migration, new AI service, model, stock fact, or deployment action.

## 2026-10-24 — Durable Analyzer queue may not silently drop jobs 501+

The private queue originally submitted only `items.slice(0,500)` even when operators supplied more than 500 jobs; a success acknowledgement could omit later stock IDs. The same strict envelope validator used for 12-item synchronous batches now receives a documented 500-item queue limit. Oversized or malformed requests are rejected entirely with an actionable 400 before any enqueue RPC, while valid 1–500 item payloads retain their order. Regression tests cover both route callsites, exact limit and over-limit integrity. Source-only compatibility fix; no database migration, real supplier proof, model change or deploy.

## 2026-10-24 — Physical provenance dates must denote actual calendar days

Existing operator physical-evidence records use an optional YYYY-MM-DD inspection date. Shape-only validation previously accepted impossible dates such as `2026-02-30`, letting invalid provenance prefill verified CSV columns. The normalizer now checks the Gregorian UTC calendar parts after parsing, preserving valid leap days and undated written records. Impossible dated records are excluded from verified prefill rather than fabricated or rewritten. Compatible with the existing schema; no physical measurement, model, store record or release approval changed.

## 2026-10-24 — A garment spec hash is not a unique customer handoff identity

Two saved looks can have the same content-addressed spec hash even when they belong to distinct design IDs or customer consultations. The browser atelier handoff writer previously deduplicated solely on `specHash`, which could erase a different saved design's request and customer note without warning. Handoff deduplication now keys on `(designId, specHash)` and preserves different design IDs and revised version hashes; re-requesting an identical version of the same saved design still refreshes one entry. Retain the existing 50-record cap and browser persistence format; no migration or server-side identity claim. Previously overwritten local records cannot be recovered from this code change. No model, supplier evidence or release status changed.

## 2026-10-24 — Legacy/corrupted local atelier handoffs are untrusted

The Atelier handoff store reads browser JSON, which can contain null entries, truncated older objects or non-arrays. Directly treating that data as typed handoffs could crash creation/deduplication or the dashboard, particularly after the composite design/spec identity fix. Read operations now filter records missing the stable request identity and UI-required object/array fields; fully shaped legacy entries remain intact and in order. This is a best-effort integrity guard, not durable server persistence or recovery of already-lost records. The handoff storage key and schema are unchanged, no background migration or customer data rewriting is attempted, and no deployment has happened.

## 2026-10-24 — Browser-only Atelier handoff integrity

**Boundary:** The Atelier queue is localStorage-only convenience, not a production order inbox or recovered durable customer record. At the read boundary reject incomplete nested packet shapes, unknown statuses and corrupt notes/reasons/alternatives instead of displaying someone else's or an unrenderable packet; retain valid existing format/order and 50-record cap. Operator selection must show the chosen handoff's saved note and controlled status immediately (including the first loaded item).

**Compatibility/evidence:** No persistence schema or existing saved design format changed, no supplier/stock/physical facts added. Regression tests exercise corrupted nested browser JSON and source wiring; exact-head CI and responsive browser acceptance are still required before any release.

## 2026-10-24 — Local handoff identifiers and delivery truth

**Identity:** A locked spec hash and millisecond timestamp are not unique customer/packet identities. New browser-local handoffs keep the familiar `HO-<spec>-...` prefix but use a 128-bit cryptographic random nonce; existing legacy IDs remain readable. No backend ID migration or hidden deduplication policy change.

**Delivery semantics:** Creating a localStorage packet must never be labelled as a message sent to Linen Earth staff. Show browser-only copy before the action and after success; surface storage failures without claiming a saved request. Operational delivery still requires durable server persistence and human workflow evidence.

**Verification:** Focused cryptographic-identity and UI contract tests are source-level gates. Exact-head CI, browser QA and real production/shop acceptance remain separate and required; no app deployment or physical validation was performed.

## 2026-10-24 — Analyzer CSV completeness before ingestion

**Contract:** A CSV worksheet cannot report success if data in any populated row or unrecognized column is silently discarded. The supported 22-column vocabulary is aligned to the existing operator template. Misspellings and unsupported supplier fields fail with an actionable error; any populated row lacking `fabricId`, `imageUrl` and `sourcePageUrl` blocks the complete worksheet before batch dispatch. Empty spacer rows remain ignored and in-order valid rows are unchanged.

**Compatibility:** Previous permissive unknown columns are now rejected instead of dropped, requiring their explicit mapping into supported columns. No supplier facts are invented, no backend schema or physical evidence state changes, no model/photo changes. New tests protect mixed valid/orphan rows, unknown headings and blank spacer rows. Exact-head CI and operator/browser QA still required.

## 2026-10-24 — Analyzer response accounting is part of trust

**Decision:** A successful HTTP status is insufficient to certify a batch. The operator UI must verify `total === submittedCount`, `succeeded + failed === submittedCount`, a result for each original index in order and consistency between each row's `ok` flag and the summary. Malformed/partial 200 replies fail closed; previously confirmed chunks retain their visible progress, and the operator is told to inspect/retry unresolved fabrics.

**Compatibility:** Uses the existing server batch v1 response shape with no endpoint, database or migration change. This does not invent fabric evidence, assume idempotent processing for unconfirmed rows or authorize production release. New pure tests and source wiring enforce the invariant; exact-head CI/operator browser acceptance pending.

## 2026-10-24 — Keep local handoff drafts scoped to exact saved design version

**Lifecycle:** A handoff composer is stateful (unsent note, error and saved packet). It must not be reused across a different `SavedDesign.id` or locked spec/version, even though the same React panel position is reused by Saved Designs. Key the component by design identity and locked version; switching selections now starts the new design's independent draft immediately.

**Boundary:** The existing browser-local storage key, spec hash and saved-design format remain unchanged. React remount isolation is not durable customer persistence or proof of staff receipt. Browser regression at 390/768/1440 and exact-head checks remain needed.

## 2026-10-24 — Local saved-design structural recovery

**Boundary:** Saved Designs is browser localStorage, not a durable customer system. Malformed, partially written or foreign records must never crash browsing or saving another design. At read time keep valid designs in original order, checking fields needed by Saved Designs, rendering and the local Atelier handoff; skip invalid entries and enforce the existing 24-card cap without mutating browser storage. Accept optional legacy version hashes instead of fabricating missing versions.

**Limitations:** This is safe best-effort recovery, not retrieval of corrupted customer data. It does not change saved IDs/deduplication semantics, rewrite existing storage or guarantee physical/production truth. Tests cover corrupt nested records, valid older data, cap and actual reader wiring. Exact-head CI and independent browser acceptance remain mandatory.

## 2026-10-24 — Feedback belongs to a saved design and locked version

**Identity:** A locked garment spec is not a unique customer review. Browser-local feedback must deduplicate only an exact `(designId,specHash)` pair, preserve ratings from distinct saved designs with identical construction, and generate nonce-based IDs that cannot collide within the same millisecond. Existing local feedback ID strings remain readable.

**Storage:** Validate browser review packets before rendering/marking as reviewed (closed ratings/statuses, safe string reasons and notes), preserving the 100-record cap and valid prior order. This is strictly a local cache, not a staff submission or durable production system. No model/photo, physical fabric facts, backend migrations or customer data recovery are claimed. New regressions protect composite identity, invalid arrays, nonce construction and caller wiring. Exact-head CI/browser QA pending.

**Customer-facing truth:** The Saved Designs rating confirmation must explicitly say the review was saved only in this browser; it is not a submitted staff ticket. Failed writes show a scoped error for that design and must never present a successful saved message.

## 2026-10-24 — Fabric Studio async results belong to the selected cloth

**Lifecycle:** A requested fabric analysis may outlast file selection, stock selection, source changes, garment changes, range changes or unmount. Scope each request to a monotonically advancing revision and snapshot the input `File` plus AI consent at execution. Before optional AI dispatch, result commit and error commit, reject a superseded revision. Selecting an existing stock fabric must never later be overwritten by a stale uploaded fabric profile.

**Privacy and compatibility:** Toggling consent is disabled during an active scan, and the consent snapshot applies to that request only. An already dispatched HTTP request cannot be unsent, but stale responses cannot update the UI; canceled capture/base64 preflight makes no paid provider request. No API/backend schema or model/photo change, and no physical fabric fact is inferred. Exact-head tests and responsive browser acceptance remain mandatory.

**Raw-image disclosure:** Without photo-consent, image pixels are decoded locally but derived visual summary and file metadata are sent to the app's own `/api/fabric/analyze` server. Do not call this an entirely on-device analysis. With photo-consent, original image bytes are included for optional server/provider AI; labels distinguish the two cases.

## 2026-10-24 — Analyzer batch input stays fixed while processing

**Concurrency:** An async batch action must acquire a synchronous ref lock before `setRunning`, because two rapid clicks can execute before React renders the disabled state. Hold the lock across all 12-row network chunks, release it in `finally`, and disallow worksheet edits, CSV selection and template creation while active. A pending `File.text()` read must also recheck the lock before mutating source rows.

**Data safety:** The already captured request rows and reported counts remain authoritative for that run; do not let a later worksheet edit make the progress appear to belong to another CSV. This does not guarantee network-level exactly-once processing after a failure or retry, and does not change live operator authentication, backend queue schema or physical evidence policy. Exact-head CI and actual UI QA required.

## 2026-10-24 — Operator CSV imports obey newest operator intent

**Race:** A browser File.text() read is asynchronous. An older upload must not overwrite a newer file selection, typed CSV edits or a batch already started on a different worksheet. A monotonic in-memory revision increments on new file selection, manual changes and batch start; pending reads apply only when their revision still matches and no batch is running. Superseded file errors remain silent and active failed reads report an error without discarding the previous worksheet.

**Compatibility:** The native file input clears immediately after selection so the same CSV may be reloaded. No change to analysis schema, uploaded physical facts, persistent state, paid AI, the fixed Designer model or production workflow. Exact-head tests and real browser QA still gate acceptance.

## 2026-10-24 — Batch acknowledgement truth survives UI refresh failure

**Acknowledgements:** Batch POSTs run in 12-item chunks, and a network timeout or malformed result may occur after a server write. Only count rows whose chunk returned a structurally verified response. On failure display confirmed count and label the current chunk **unknown**, instructing staff to inspect persisted profiles before retrying. Do not claim exactly-once behavior.

**Refresh boundary:** A failed post-batch `onComplete` dashboard refresh does not roll back Analyzer results. Report processing as complete while independently flagging failed view refresh; don't suggest re-uploading the worksheet to fix a stale view. Preserve existing 401 navigation, server result checks, physical review requirements and no-deploy policy. Exact-head CI and real operator QA are still required.

## 2026-10-24 — Local named customer measurements require structural recovery

**Record boundary:** Browser-stored named measurement arrays are untrusted. Skip malformed or incomplete entries, non-finite/non-positive/outside-supported 0–254 cm values, unknown measurement keys and repeated IDs; retain valid legacy customer IDs, centimetre-normalized values and chronological order without rewriting storage. Bound displayed histories to the existing 20-profile cap.

**Identity and truth:** A new profile ID uses a 128-bit browser-generated random nonce in addition to the timestamp, preventing accidental same-millisecond customer collisions while retaining old IDs. Local write/activation/delete exceptions must report failure without claiming an operator/customer profile was saved or removed. Customer data remains device-local, and the shop must verify cutting measurements. This is not a migration to durable customer accounts, and deleting an active named profile is not proof the independent legacy Designer measurement snapshot was purged; that deletion/provenance linkage requires a separate, explicitly tested contract. Exact-head CI and browser acceptance remain required.

## 2026-10-24 — Vault recovery token survives rejected browser writes

**Server truth:** After a successful secure measurement vault POST returns a recovery token, that server copy exists independently of browser-local storage. Display and retain the recovery token immediately, before attempting local writes. A browser quota/security failure must not disguise the remote save as failure, hide its only recovery/delete credential, or falsely mark the local profile as saved.

**User recovery:** Attempt clipboard copy independently; if clipboard is denied, the token remains readable in its textarea. Success messaging separates confirmed remote storage from successful local persistence and clearly states that the visible token is required for later recovery/deletion. No token logging, schema change, new vault call, extra data retention, deployment or model alteration. Real browser blocked-storage/clipboard acceptance still required.

## 2026-10-24 — Active customer profile deletion must not erase unrelated Designer measurements

**Identity link:** A named customer profile activation now writes an explicit browser-local profile ID plus a non-cryptographic 64-bit digest of the exact legacy Designer measurement snapshot. On deleting that named profile, clear the active legacy snapshot **only** when both the profile ID and exact snapshot digest still match; edited standalone measurements, another customer's fit, corrupt markers, and older unlinked snapshots stay untouched. The marker contains no measurements and is not an authentication signature.

**Safety/compatibility:** The link key is new and optional. Existing named profiles, older active snapshots, measurement units and local data remain readable; no retroactive inference of who owns an unlinked snapshot. localStorage has no transaction between multiple keys, so blocked writes must surface an error and production storage readiness is not claimed. Real browser verification of delete/load/edit/failure paths remains a release gate.

## 2026-10-25 — Restored measurement evidence uses one closed contract

**Boundary:** Treat browser-local JSON, secure-vault rows and Designer request observations as untrusted at every restore boundary. Accept only version 1, known shirt/trouser measurement keys, finite positive values within the existing 350 cm API ceiling, closed manual observation categories and a parseable recorded timestamp. Reject corrupted profiles instead of coercing strings, inventing timestamps or admitting unknown fields; do not rewrite rejected browser data.

**Compatibility and truth:** Valid existing profiles retain the same storage keys, shape, units and values. The app remains usable without rejected optional data, and the secure vault returns a not-found response for invalid stored payloads without exposing them to the client. This is software integrity only: it adds no supplier measurement, physical fit, tailor approval, database migration or production-data verification. Exact-head CI and real browser/vault acceptance remain mandatory.

## 2026-10-26 — Primary measurement activation requires the complete browser pair

**Activation:** The ordinary Save and Use in Designer actions must use the same guarded measurement-plus-manual-observation writer as secure recovery. React fit state and Designer navigation advance only after both browser records are confirmed written. A failed second write attempts to restore the prior complete pair; navigation is blocked and the customer sees whether rollback was complete or browser state needs rechecking.

**Boundary:** Browser localStorage still has no atomic transaction or durable account guarantee. The storage keys, record schemas and valid saved values remain unchanged, and another tab's concurrent edit is never overwritten during rollback. This prevents software from knowingly activating a mixed fit; it does not prove measurements, posture observations, tailor acceptance or cross-device persistence. Blocked-storage and concurrent-tab browser acceptance remain release gates.

## 2026-10-26 — Vault remote-write success is not dependent on account-link RPC

**Failure:** A secure measurement or locked-design vault RPC can commit successfully and then an optional account-ownership RPC can reject, leaving the client with a 503 and no recovery/delete credential. A malformed request envelope also previously fell into the generic 503 path.

**Contract:** Once the store RPC has returned a valid vault identifier, construct the recovery token before attempting optional account attachment. Treat a false/rejected owner-link as `accountOwned: false` plus an explicit recovery-token warning; preserve optional production-ownership propagation for linked design vaults. Do not log access keys or fabricate account ownership. Reject invalid request bodies or unknown actions with 400. Measurement UI shows account-link failures without hiding the credential. These changes require no database migration, additional paid AI dependency or changes to the existing model.

**Residual boundaries:** This does not make remote storage and HTTP response atomic, does not establish distributed rate limiting and does not guarantee owner linking if a process terminates before response. Real browser and live migration/RPC outage verification remain release gates. No merge or deployment approved.

## 2026-10-26 — Treat the local measurement/observation pair as one UI activation

**Defect:** Each secure measurement save/load wrote profile and manual tailor observations into separate localStorage keys. If the second write failed, the first could persist while UI reported error; reloading could silently combine mismatched evidence.

**Safety:** Keep both existing storage keys and on-disk schema for backwards compatibility. A pure two-key writer snapshots both prior values, writes the pair, then activates React state only if both completed. If either fails, best-effort rollback restores only values that still equal this operation's attempted values; leave other-tab changes intact. Distinguish confirmed remote retrieval from failure to store locally and never discard the original recovery token. If rollback is incomplete, warn about a potentially inconsistent browser cache.

**Limit:** This is not an atomic localStorage transaction or cross-tab lock; tab termination after the first write and browser storage corruption still require manual QA. No migration, main merge or production deployment.

**Designer vault UX follow-up:** The existing Designer Studio vault action ignored the new owner-link failure warning. It now retains its original token and clipboard behavior while clearly surfacing unconfirmed account ownership to customers; account-linked confirmation is not implied. UI/browser acceptance remains pending.

## 2026-10-27 — Customer fit activation includes evidence isolation and recovery

A named customer profile records tape measurements, not manual posture observations. Activating it must reset those observations to unassessed defaults rather than attach the previous customer's evidence. Save, activate and delete now use a shared best-effort multi-record writer; failed writes restore only unchanged values belonging to that operation. Successful writes are read back before success is reported. An unreadable history must block mutation rather than be treated as an empty customer list. Existing keys, valid profile shapes, centimetre values and optional legacy identity markers are retained.

Browser storage remains nontransactional. Concurrent writes after readback, browser termination during writes, and failed rollback remain limits; no cross-tab atomicity or durable cloud guarantee is claimed. Tests inject quota errors, corrupt history, lost writes and concurrent changes.

## 2026-10-27 — Measurement vault request and input lifecycle

A synchronous ref guards all measurement vault actions before fetch dispatch. Measurement controls, primary save/navigation and recovery-token edits are locked while the request settles. This prevents duplicate remote stores and prevents recovery/delete responses from being labelled as a different edited token. Token edits clear stale expiry/status metadata. The pair writer resolves the localStorage getter inside its error boundary, so browser-level storage denial cannot hide a confirmed remote copy's recovery token or escape the ordinary save error UI.

The browser regression uses synthetic vault responses and blocked browser storage at 390/768/1440 widths. It is wired into both existing CI workflows without removing any model or production gate. Real authenticated vault/database and physical tailor acceptance remain separate.

## 2026-10-27 — Physical evidence text is never manufactured by coercion

Source type, reference and reviewer are required strings. Optional date/URL fields may be absent or null, but populated values must also be strings. Objects, arrays, booleans and numeric values no longer become text that qualifies metadata as physically reviewed. The same normalizer protects ingestion, stored metadata reads and verified CSV prefill. A documented catalogue GSM value outside the existing 40–1000 range is left blank in the worksheet instead of promoted to verified data.

Valid string records retain their normalization and optional-field compatibility. Existing malformed records are not rewritten; they simply do not qualify as physical provenance. These software checks establish format integrity only, never authenticity of a supplier statement or an actual measurement.

## 2026-10-27 — Vault identifiers use one strict UUID boundary

Owned-vault actions validate and normalize the submitted UUID before customer identity lookup or database RPC. The same helper is used when issuing and parsing both measurement and locked-design recovery tokens, so a malformed ID cannot be accepted by one path and rejected by another. Arrays, objects, missing UUID hyphens, unsupported UUID versions/variants and trailing data fail closed; valid existing UUIDs remain compatible and are normalized to lowercase.

This is request-format integrity, not authenticated live Supabase acceptance or proof that a vault belongs to a customer. Database migrations, token formats and stored records are unchanged. Exact-head CI plus real signed-in recovery, claim, load and delete verification remain release gates.

## 2026-10-28 — Physical evidence stays untrusted at every rendering boundary

**Contract:** even an approved Analyzer profile must supply field-level declared/reviewed provenance, a usable HTTPS source or sufficiently descriptive note, and finite in-range physical dimensions before customer Designer gains verified facts. Declared pattern repeats require positive repeat mm; swatch-derived scale requires a usable physical pattern dimension. Invalid optional stripe width is dropped without certifying its measurement. Phase 2 owner-policy percentages, signer and rationale must be typed values, and physical coverage must be integer, within the active candidate count, and uncoerced all the way through the roadmap gate. Build-time fabric-scales.json accepts true-scale tile measurements only with a normalized physicalEvidence record (source type, reference and checked-by reviewer) and strictly numeric finite dimensions; provenance-free legacy values remain approximate. The current file is empty. The persisted Analyzer profile shape is unchanged.

**Renderer parity:** isolated 3D tile calibration cannot treat declared swatch width or an undetected/stale pixel period as a measured print repeat. A declared repeat and detected period are required, as in deterministic photographic preview. This is a software truth guard, not supplier confirmation, four-angle Blender/photo parity, calibrated drape or tailor acceptance.

## 2026-10-28 — Measurement calibration and locked-revision metadata fail closed (draft)

**Measurement evidence:** Only typed finite JSON tape readings within existing physical limits and actual nonblank source/checker text count. A malformed latest case cannot revive an older passing result; invalid calendar timestamps or conflicting same-instant revisions block the case. Ten-case medians remain provisional until genuine tailor comparisons and live operator evidence exist. Operator UI clears prior PASS on failed/malformed or stale out-of-order reads rather than retaining a green readiness card. Browser measurement and manual tailor-observation restore now share calendar-valid offset-aware timestamps; no impossible dates or 24:00 are accepted. No schema migration or external-provider call.

**Revision identity:** New nonce-suffixed and historical pre-nonce `LE-LOCK` IDs both remain supported, but their UTC timestamp and recipe-hash prefix must match the locked envelope. Parent IDs must have a known format; timestamp/hash prefix drift is rejected, but a syntactically valid nonce can still be substituted: ownership and full metadata authenticity are not established by the recipe hash. Finished-garment targets must contain finite, ordered centimetre ranges and supported basis labels; JSON coercion of NaN/Infinity into null must not create an apparently valid locked recipe. This is **not** a digital signature or proof of account ownership, tailoring approval, physical stock or a real production order.


## 2026-10-28 — Operator cloud sync and stock reads are untrusted RPC boundaries

**Sync:** The desktop's existing timestamp-only and `timestamp|eventId` cursors remain supported, but only real offset-aware Gregorian instants and safe ASCII IDs may enter PostgREST filters. A malformed cloud page (including duplicate or unsorted cursor keys) must fail without advancing the desktop cursor. Operator event uploads are bounded and validated as a complete batch: no silent 251st-row truncation or coercion of payment, measurement, date or event identifiers. Because `resolution=ignore-duplicates` does not reveal inserted rows, a successful nonempty batch returns `accepted` and `acknowledged`, with `stored:null` rather than an invented inserted count. The current Rust desktop reads `accepted` and does not depend on `stored`; production end-to-end replay and legacy exotic event-ID migration remain unverified.

**Stock:** Operator snapshot responses must have known unique fabric IDs, finite nonnegative metres, coherent physical/reserved/available balances, integer and internally consistent provenance counts, literal boolean provenance status and valid timestamps. Invalid snapshots are unavailable, not zero inventory or verified stock. Record and reservation RPCs must return valid UUIDs before success is shown. These are response-contract checks, not physical roll audits, distributed concurrency guarantees, supplier measurements or production database acceptance. No schema migration, model/photo change, merge or deployment.

**Desktop boundary replay:** The existing Rust uploader used a strict `event.at > last_pushed_at` high-watermark and could silently skip a later append with exactly the same timestamp. It now replays the equal-timestamp boundary using `>=`; duplicate IDs remain idempotent in Supabase. This is a bounded compatibility fix, **not** a complete solution for system-clock rollback or arbitrary backdated event insertion. A future durable append-position/acknowledged-ID ledger is required before claiming exactly-once end-to-end sync.

## 2026-10-28 — Untrusted visual-review receipts cannot be coerced into proof (draft)

The assessment API now uses a pure typed parser for creative visual-review evidence. Scores must be actual finite JSON numbers between 0 and 100, evidence flags actual booleans, status exact `pass`/`review`, and semantic status explicit whenever semantic review is marked available. Invalid supplied receipts return HTTP 422 before garment-spec construction; omitted/null receipts remain compatible and unapproved. This closes prior `String(["pass"])`, `Number("100")` and `Boolean("false")` acceptance paths without altering the original model, supplier facts or the deterministic preview. Passing code tests are not real photographic/tailor approval.

## 2026-10-28 — Assessment responses must match the selected catalogue revision (draft)

A same-ID fabric can change in the server catalogue during an asynchronous Designer assessment. A response computed against newer supplier, stock, photo or reviewed-physics evidence must not be attached to the older browser selection merely because IDs match. A pure `assessmentMatchesSelectedFabricRevisions` gate compares the full canonical shirt and trouser revision receipts before UI assessment state and recommendation memory are accepted. Missing/non-JSON evidence fails closed; old API payload shapes remain unchanged. The user can refresh the catalogue and reassess. Browser and unit tests cover same-ID photo/stock/physics changes, but real supplier measurements and production acceptance remain external.

## 2026-10-28 — Server measurement receipts require literal units and real supplied timestamps (draft)

The Designer assessment API's measurement adapter no longer coerces `unit:["cm"]` to `"cm"`, which could otherwise cause the downstream centimetre/inch converter to interpret an array as inches. Any supplied `updatedAt` must be a real offset-aware Gregorian timestamp (including valid leap days); impossible dates and 24:00 are rejected before tailoring/fit evidence. Legacy clients omitting `updatedAt` retain a receipt-created timestamp for compatibility; this does not claim a physically observed measurement time. Explicit invalid tape values continue to fail closed. New unit and real HTTP negative tests cover this boundary; human tailor approval remains mandatory.

## 2026-10-28 — Invalid explicit body and tailor receipts must not silently disappear (draft)

The assessment API previously converted malformed supplied `bodyProfile` or `observations` into null, which could make fit guidance appear to have no relevant observations rather than reporting a corrupt receipt. Supplied invalid values now return HTTP 422; omitted/null optional values remain compatible. The body-profile validator also rejects array roots and coercible `build`, `skinTone` and `source` enum arrays, preserving the fixed original model and exact selected proportions. Pure and actual HTTP negative regressions cover the boundary; software checks cannot replace a real tailor's manual fit approval.

## 2026-10-28 — One measurement contract across assessment, search and advice

Search and brief/advisor routes reused an older permissive measurement parser that dropped invalid tape readings and accepted JavaScript numeric coercions. They now share the assessment route's `normalizeMeasuredBodyInput`, validate once before catalogue/evidence work, and return HTTP 422 for invalid explicit measurements or tailor observations. Valid legacy inputs, omitted/null optional evidence and decimal tape strings remain compatible; stored quantities stay centimetres regardless of display unit. No database/schema migration is needed. A real HTTP suite exercises all four request paths (64 contracts) and runs within the existing advisor browser workflow. No physical evidence, native model approval or release completion is inferred from these checks.

## 2026-10-28 — Public Designer requests have bounded, same-origin JSON transport (draft)

The assessment, alternative-search and both brief/advisor paths previously used `request.json()` after checking only the declared `Content-Length`. Chunked requests without a length could bypass the byte limit, malformed JSON/UTF-8 was returned as a generic server error, and browser cross-origin request metadata was not screened. All three paths now share the established `secureJsonRequestError` / `readSecureJsonObject` contract (180 KB assessment, 80 KB search, 90 KB brief), with strict JSON content type, same-origin Fetch Metadata/Origin checks, real streamed byte bounds and explicit 400/403/413/415 responses. The shared source is intentionally compatible with the separately drafted operator/secure-vault safety helper; these stacks must be reconciled before merging.

Existing valid same-origin clients and the measurement/fit contract are unchanged. New pure regressions and real HTTP negative tests exercise malformed data, cross-site writes and chunked overflow before any catalogue or paid analysis. The tests are code-level security checks, not a substitute for edge rate limiting, actual device security, native model approval, real tailor/supplier evidence or authenticated live production acceptance. No schema, production data, provider or deployment was changed.

## 2026-10-28 — Reject invalid fit evidence before assessment data loading (draft)

The assessment endpoint used to fetch the live catalogue and approved house ease model, then check if the requested fabrics existed, and only afterward parse explicit measurement and tailor-observation receipts. A corrupt tape reading combined with a retired fabric could return a misleading stock 409 or load protected evidence unnecessarily. The fit input now fails with 422 before catalogue/ease I/O, while valid requests retain the original evaluation path and output. Static ordering and real HTTP regression with a deliberately missing fabric prove the precedence. This does not infer a physically observed measurement or tailor approval.


## 2026-10-28 — Draft MVP fabric-identity input boundary

**Decision:** the launch-track Designer assessment and alternative-search endpoints accept literal (nonempty, at most 160-character) string shirt/trouser IDs and an exact supported occasion; the alternative scope must be a literal closed-vocabulary string, except that omitted/null scope retains the legacy `keep_shirt` default. The brief/advisor route rejects malformed supplied fabric IDs instead of allowing them to be coerced to a stock ID or quietly falling back, and requires a text brief. Existing omitted legacy starting-fabric fields remain optional.

**Why:** `String(["catalogue-id"])` produced a valid ID and `String(["Casual"])` a valid occasion. `.slice(0,160)` could also turn a malformed overlength identifier into a different real catalogue selection. This makes the resulting fit or lock evidence appear linked to a request the caller did not actually submit.

**Compatibility:** legitimate string selectors, legacy omitted fabric starts, and deterministic preview remain unchanged. No migrations, provider calls, approved-model assets, production deployment or physical proof. Real HTTP negative regressions plus exact-head CI must pass before calling the engineering repair verified. Pilot requirements and external approvals are in `docs/TITAN_LAUNCH_MVP.md`.

## 2026-10-28 — Selective draft-stack request and delivery reconciliation

The prior #444–#447 and newer Designer #448–#452 branches diverge deeply; changing entire files across stacks would drop newer custody, locked-design validation or production chronology. **Decision:** forward-port only missing invariants to the newer branch: same-origin, strict JSON and streamed size bounds on both vaults and privileged operator mutations; first-ten evidence revision ID, immutable recipe hash, unique evidence IDs and valid post-delivery chronology in the newer JSON v2 audit and cloud verifier. Current recovery-token issuance precedes optional owner association, and stock snapshot / operator checks remain unchanged.

The older authoritative-table-returning first-ten migration is NOT the same RPC contract as the newer `20261103` JSON v2 migration and is not replayed. No migrations deployed or real first-ten operator evidence confirmed. Exact-head CI plus real browser and authenticated environment acceptance remain prerequisites to promotion. File decisions: `docs/TITAN_20261028_DRAFT_STACK_RECONCILIATION.md`.

## 2026-10-29 — Distinguish prepared locked WhatsApp drafts from real delivery

The Designer previously called `window.open` only after awaiting an HTTP request, exposing mobile popup blockers, and described an audit as verified merely because the Supabase RPC returned HTTP 2xx. It also labeled a WhatsApp deep link as opened, with no proof the customer tapped Send or staff received it.

**Decision:** share and enquiry POSTs now share strict same-origin JSON parsing with streamed 96 KiB payload bounds, explicit invalid-body errors, private no-store responses and bounded process-local throttling. An audit counts as recorded only when a valid database-generated UUID is received. This protects against bogus success payloads, but an audit records *preparation*, not actual delivery.

The Designer now keeps an enquiry link bound to the exact locked revision ID, discards the old link on re-lock, verifies the `wa.me` HTTPS destination and requires a visible second click labeled **Open WhatsApp and send**. It never promises that the shop received a message; the customer must send it in WhatsApp. No external account identity, order placement, tailor approval, backend delivery verification or live Supabase result is inferred.

A non-sensitive public share token still excludes body measurements; the customer recovery token is never put into a WhatsApp URL. In-app secure vault storage remains a separate explicit operation. See `docs/TITAN_VERIFIED_HANDOFF_GATE.md`.

## 2026-10-29 — Operator recovery must not turn malformed vault rows into production quotes

Production quote/order actions previously coerced arrays and other JSON values through `String(body.revisionId||"")`, `String(body.recoveryToken||"")` and silently truncated notes. The operator's token-backed vault RPC also trusted the first row without checking the response envelope, expiry or ambiguous duplicates. These are dangerous precisely where a customer-selected locked recipe crosses into manual quoting.

**Decision:** share a literal bounded selector for quote and order creation; reject non-string or overlong values instead of trimming into a different fact. Keep legacy empty optional notes and quote IDs, the existing operator cookie, and deterministic quote schema. Use the same `selectVaultReadRow` invariant as the customer vault before checking the signed locked revision hash. A valid token alone does not certify customer identity or physical stock; real operator acceptance still requires verified Supabase, the original immutable recipe and human tailoring review.


## 2026-10-29 — Preserve both owner verification and operator lock integrity

The owner-scoped enquiry draft #454 and operator locked quote/order draft #455 diverged from #452. Replacing the newer UI with #454 would bring back delayed `window.open`; replacing the newer production route with the older one would restore coercible lock identifiers. **Decision:** forward-port the #454 consented dual-check (signed-in owner plus independent access-token vault verification) into #455. Preserve its revision-bound explicit WhatsApp click, common size/origin/rate request boundary, and strict operator quote/order fields; legacy raw locks yield unaudited drafts only. UI validates audit receipt/status consistency. Exact-head automated checks and live owner/operator acceptance remain release gates. No database schema/data, original model, paid per-edit AI or deployment changes.

## 2026-10-30 — owner vault lists cannot hide malformed or repeated evidence

**Decision:** A successful owner-scoped listOwned RPC must not silently filter corrupt rows and present an incomplete saved-design or measurement list as authoritative. Validate the entire typed row envelope, exact (untrimmed) UUID and case-insensitive uniqueness before serializing; reject any invalid design revision/hash or measurement/tailor observation rather than dropping it. A legitimate empty array remains a valid empty account list. Existing account-only authorization, token recovery, original Studio model/photo and deterministic no-paid-AI operation remain unchanged. This is J3/T2/T5 source integrity, not real authenticated persistence, live supplier stock, physical tailoring, security approval or release readiness. No live database write, schema/migration, provider charge, main merge or deployment.

**Live SQL contract check (read-only, 2026-10-30):** both SECURITY DEFINER list-owned functions filter by the supplied owner_user_id and expiry, but silently cap output at 100 designs and 50 measurements. The API now rejects a page at its cap instead of claiming it is complete. This is conservative and may block large accounts until an owner-approved paginated/atomic RPC exists. The inspected functions allow service_role execution and deny direct anon/authenticated execution; this is not a full authorization audit.


## 2026-10-30 — Delivery evidence must name the exact submitted order UUID

The operator production-evidence POST previously normalized `body.orderId` using a trim-tolerant vault ID parser. A padded or otherwise altered order selector could become a valid production ID before recording a manual-design-reentry audit. **Decision:** require the existing exact literal UUID scalar validator already used for verified production creation receipts, before any evidence RPC; accept case-insensitive canonical UUID text but reject whitespace, arrays, objects and malformed IDs. Preserve the existing immutable order/audit schema, operator authentication, no-paid-AI Designer, original Studio model and valid legacy UUID requests. This is J5/T5 code integrity only, not evidence of genuine ten deliveries or privacy/security signoff. No database writes, migrations, main merge, paid-provider calls or deployment.


## 2026-10-30 — Physical delivery audit timestamps must be literal calendar evidence

JavaScript Date.parse may normalize nonexistent days such as February 31 into March. **Decision:** first-ten authoritative delivery receipts and operator summary must share strict offset-bearing Gregorian date/time validation before a record can count as delivery or physical audit evidence. Preserve valid leap days, fractional seconds, explicit timezone offsets, original photo/model and no-paid-AI Designer. Invalid or ambiguous timestamps fail closed; no historical rows are rewritten. This is T5/J5/T6 code integrity, not supplier inventory, ten real deliveries, tailor/device/native/security or owner release approval. No production database writes, migrations, provider charges, main merge or deployment.


## 2026-10-30 — First-ten physical delivery identity receipts are literal

The authoritative first-ten audit guard previously trimmed order IDs and evidence receipt IDs before checking uniqueness and lineage. A whitespace-padded upstream identity could therefore be silently normalized into apparently valid physical delivery proof. **Decision:** reject padded order, audit-order and audit-receipt identifiers at the first-ten response boundary. Preserve case-insensitive identity matching and existing legitimate non-padded IDs; do not change the SQL schema, model/photo, deterministic Designer or legacy browsing UI. The guard is source-level integrity only, not ten actual deliveries, verified stock, customer/operator signoff or release approval. No live database writes, migrations, provider charges, main merge or production deploy.


## 2026-10-30 — Operator delivery browse chronology is evidence, not merely syntax

A calendar-valid delivery timestamp can still predate the order it claims to complete, and a calendar-valid immutable audit can predate the physical delivery. The bounded operator browse RPC previously accepted both, allowing a contradictory record to appear in the operator's clean evidence queue. **Decision:** reject delivered-before-created order rows and completion audits before the matching order's creation or known delivery timestamp. Keep nullable historical `delivered_at` for legacy browsing; evidence for orders outside the newest-500 page cannot be cross-checked without full history and never becomes authoritative first-ten proof. Reuse strict calendar parsing and literal UUID receipts. This is T5/J5 source integrity, not physical delivery, supplier stock, authenticated customer/operator acceptance or security/release approval. No production data, migrations, paid providers, original Studio model, main merge or deployment changed.

## 2026-10-30 — T5/J5 operator browse must preserve immutable design lineage

The newest-500 browsing RPCs are *not* an authoritative first-ten history. Nevertheless their successful receipts must not show a delivered order with an invented status, unbound revision/hash, or an immutable completion audit whose copied design identity or order creation diverges from the corresponding production order. Validate SQL-backed fields at the API and UI boundary; compare timestamps as instants to accommodate equivalent timezone representations, retain legacy nullable operator metadata and evidence for orders outside the capped page. A clean no-reentry flag cannot include manually re-entered fields. Keep the canonical model/photo, deterministic core, existing release gate, and database schema unchanged. Release remains blocked without genuine human stock/tailor/delivery evidence and exact-head CI.

## 2026-10-30 — J5 reconcile separate production evidence snapshots

Authoritative oldest-ten and newest-500 browse RPCs are separate non-atomic database reads. Contradictory overlapping locked order/evidence receipt identities cannot be silently merged into a clean operator view; require refresh. A fewer-than-ten authoritative set cannot omit a delivered recent order. Older first-ten entries may be absent from the newest-500 browsing cap, and historyValid=false must remain explicitly blocked, not promoted. Equivalent UUID casing and timezone instants are accepted. This is code-level integrity only, not a physical delivery claim, migration or release approval.

## 2026-10-30 — First-ten audit snapshots must not omit newer visible incidents

The authoritative oldest-ten audit and newest-500 browse lists are independent non-atomic reads. Existing overlap checks matched evidence by evidence ID, but a newly visible completion audit for an oldest-ten order could have a different ID and be absent from the authoritative snapshot. That permitted the first-ten summary to claim a clean audit even while the browse queue showed a later manual-reentry incident. **Decision:** when the authoritative basis is valid, every visible browse audit for an oldest-ten order must also appear by exact canonical UUID in that authoritative basis. Fail closed and require refresh if not; preserve historical audits for orders outside the oldest ten, case-equivalent UUIDs, and explicitly incomplete history as blocked. This is T5/J5 source integrity, not genuine delivery evidence or security/owner approval. No live data writes, schema changes, paid AI, model/photo replacement, main merge or deploy.

## 2026-10-30 — Account claim requires a verified recoverable locked revision before owner mutation

The design-vault `claim` route previously called `designer_locked_revision_vault_set_owner` before reading or verifying the stored revision, then returned `claimed:true` even if the subsequent read was missing, expired, malformed or failed the locked-design integrity check. A successful owner-link receipt is not proof of an actually recoverable design. **Decision:** with the existing bearer recovery token and authenticated customer, read exactly one unexpired vault row and verify its locked revision **before** calling the owner-link RPC; return 404 for absent/expired and 409 for corrupt revision, never claiming success or mutating owner first. Preserve a verified claim if optional production ownership propagation is temporarily unavailable, as before. No new schema, stock fabrication, model/photo changes, paid AI, production data writes, main merge or deployment. Genuine owner-scoped recovery acceptance remains PENDING.

## 2026-10-30 — Measurement account claim must prove usable recovery before linking owner

The measurement-vault `claim` route previously treated a boolean `measurement_profile_vault_set_owner` receipt as complete success without reading or validating the corresponding stored measurement and tailor-observation profile. **Decision:** before account ownership mutation, recover exactly one unexpired token-authenticated record, validate both the stored measurement profile and tailor observations with existing typed contracts, and fail 404/409 on absent or corrupt evidence. Only then call the existing owner-link RPC. Preserve existing token format, legacy valid profiles and no-paid-AI deterministic Designer; no schema changes, live writes, production deployment, or human acceptance claim. This closes a code-level T2/J3 false-success path but does not prove real customer recovery.

## 2026-10-30 — Successful owner-link receipt is not sufficient account recovery proof

Both vault claim endpoints previously verified a bearer-token read before linking an owner, but then reported `claimed:true` from the set-owner boolean alone. A true acknowledgement with missing, stale or inconsistent owner-scoped recovery would leave the customer believing a saved design or measurements were available from their account. **Decision:** after a true owner-link acknowledgement, read through the corresponding authenticated owner-scoped get RPC and require one unexpired valid row matching the original locked revision ID/hash or validated measurement and tailor profile. An unavailable, malformed, expired or contradictory read fails closed with the existing generic 503; no `claimed:true` is issued. A false set-owner result remains `claimed:false`. For designs, optional production ownership propagation runs only after the owner read is verified. No schema, production database mutation, paid provider, original model/photo, main merge or deployment. Code-level J3/T2/T5 only; real signed-in Supabase acceptance is still PENDING.

## 2026-10-30 — A new secure vault store must prove account recovery, not merely owner-link acknowledgement

The earlier J3 owner-scoped post-claim check did not cover initial `store`: both vault endpoints returned `accountOwned:true` from a true set-owner RPC even when the authenticated account could not retrieve the saved record. **Decision:** after a true owner-link acknowledgement on store, require one unexpired owner-scoped read of the exact locked revision ID/hash with verified lock integrity, or the exact validated measurement and tailor-observation profile. Missing, ambiguous, expired, malformed or contradictory owner reads are **not** proof of account persistence; keep the already-created recovery token and report `accountOwned:false` plus the existing warning instead of losing a successfully stored secure copy. Optional design production-ownership propagation only follows confirmed owner recovery. Existing versioned data, original model/photo, no-per-edit-paid-AI core, owner authorization and backward-compatible recovery tokens remain unchanged. This is source-level T2/J3/T5 integrity, not authenticated real-user acceptance, supplier inventory or release approval. No live production writes/migrations, paid-provider calls, main merge or deployment.

## 2026-10-30 — Account recovery must preserve the complete locked-revision lineage

A valid locked design recipe hash binds the garment specification, but not its parent revision or exact lock instant. The owner-scoped post-store/post-claim verification previously compared only `revisionId` and `recipeHash`; a different valid revision with those two equal fields but changed `parentRevisionId` or subsecond `lockedAt` could be called the same recovered saved design. **Decision:** after separately verifying both locked revisions, require literal equality of version, revision ID, recipe hash, parent revision and full locked timestamp before confirming account ownership. Keep existing legacy IDs, recovery-token fallback, optional production propagation, original Studio photo/model and deterministic no-paid-AI preview. This is code-level T2/J3/T5 integrity, not a signed-in live-user acceptance, physical garment approval or release authorization. No production writes, migrations, paid-provider calls, main merge or deployment.


## 2026-10-30 — Expanded Style Director choices cannot silently disagree with the original photographic selector

The existing `changeExpandedCut` synchronized the legacy preview control only for cuff changes, even though real supported legacy labels also exist for collar, placket, shirt fit, trouser rise, waistband and break. Consequently an advanced selection could be saved in the canonical v2 recipe while the original photographic UI still displayed the previous selection. The reverse adapter also allowed `legacySelectable:false` options (for example Wing Collar or Contrast Placket) to masquerade as selectable legacy photo options and could retain stale collar-cloth finish. **Decision:** map only these seven supported groups through the existing `DESIGNER_STYLE_CHOICES` lists and shared option-library `legacySelectable` evidence. For unsupported/provisional construction, preserve the v2 option ID without claiming an unphotographed visual change. Reconstruct canonical collar finish explicitly. Keep the original `linen-earth-studio-model-v1`, deterministic no-paid-AI preview, legacy valid saved selections, exact physical stock provenance and independent photo/native/physical acceptance gates. This is T1/T4/J2 code integrity, not photographic geometry or tailor signoff. No live database write, schema change, paid-provider call, main merge or deployment.


## 2026-10-30 — Persisted legacy photo controls must use selectable reference labels

A locked StyleSpec v2 already required all eleven legacy fields to be nonempty strings, but an arbitrary invented label or a withheld Wing Collar/Contrast Placket could still pass validation and be presented as a reconstructable prior photographic/tailor selection. **Decision:** validate every legacy field against the existing shared option library's selectable labels, including supported provisional labels, and the fixed collar-finish/shirt-wear vocabulary. Retain advanced v2-only IDs separately without pretending the original photo rendered them. Valid historical reference choices, versioned hashes, fixed Studio model and no-per-edit-paid-AI behavior are preserved. This is source-level T1/T2/T5 and J2/J3 integrity, not real authenticated recovery, visual/physical approval or production readiness. No schema, production write, paid provider, main merge or deployment.


## 2026-10-30 — Production quote identity fields must not be coerced or silently truncated

The operator production quote normalizer previously accepted JSON arrays such as `["INR"]` as an apparently valid currency and `["Fabric"]` as a valid line label via `String(...)`. It also silently cut line-item instructions to 160 characters. These values may enter a customer quote and tailor handoff without matching the operator's actual submitted text. **Decision:** only an omitted currency defaults to INR; supplied currency must be a literal string with the existing three-letter format. Line-item labels must be literal, nonempty strings of at most 160 characters with no control characters, and oversized labels fail rather than truncating. Preserve ordinary trimmed labels, existing monetary validation, three-letter currency compatibility and the operator form. This is T5/J5 code-level integrity only; no real quote/order, physical stock, tailoring or owner acceptance is implied. No schema, production writes, provider charges, original Studio model change, main merge or deployment.

## 2026-10-30 — M43 quote paise reconciliation
Calculate quote subtotal and total from integer paise matching persisted rounded lines and adjustment. Preserve input limits, existing rounding policy and INR default. No schema or dependency change; existing valid saved quotes remain compatible. Code/test SHA a24434c93d4f6f4d2d86ea04ee357fad02d1d6be. Full CI/build/browser pending; see TITAN checkpoint.


## 2026-10-30 — Validate share bearer privacy on actual built Next responses

A source-level check of `next.config.ts` does not prove Next's runtime response headers survive dynamic rendering, not-found handling or later global header rules. **Decision:** both existing CI browser lanes must start the actual built local Next server with a test-only share-signing secret and fetch a short-lived synthetic signed `/share/:token` (200), an invalid bearer link (404), and the normal homepage (200). Require actual `Referrer-Policy: no-referrer`, `X-Robots-Tag` noindex/nofollow and private no-store cache controls for both share statuses, while preserving the global ordinary-page policy. The synthetic fabric IDs intentionally cannot imply supplier stock; the script refuses non-loopback hosts and never exercises real owner authentication, database writes or share consent. These are HTTP security regression gates, **not** evidence of real customer/operator authorization, privacy signoff or launch readiness. No model/photo, supplier records, schema, paid AI, main merge or production deployment changes.
