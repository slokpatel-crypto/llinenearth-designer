# Phase 5 — Lock, Share & Enquiry Adaptation

Status: recipe lock, privacy-safe sharing, recovery vault, authenticated ownership and an auditable five-customer validation gate are implemented; real-customer evidence remains.

## Existing foundation to keep

- Canonical garment specification already records fabrics, StyleSpec v2, body preview, finished targets, construction checks, block strategy, readiness and unresolved items.
- WhatsApp enquiry already sends the selected Linen Earth look.
- The final photoreal renderer already requires a deliberate lock before spending a render credit.
- Existing older design-version code also uses finalized versions and a specification hash.

## Roadmap v2 work added

`design-lock.ts` now creates a portable immutable recipe revision:
- versioned lock contract,
- SHA-256 recipe hash over canonical sorted JSON,
- timestamped revision ID,
- optional parent revision ID,
- full canonical garment-spec snapshot,
- verification helper that detects later mutation,
- reconstruction helper that returns an independent copy.

Designer technical details now offer **Lock recipe revision**. The revision is exported as JSON so the exact recipe can be reconstructed without relying on display labels or browser UI state.

Changing fabric, construction, body profile, measurements or creative direction clears the current lock state before another revision is created.

## Share-link work now implemented

Locked revisions can now create a signed 30-day share token. The public share payload deliberately excludes body profile, finished-measurement targets and other customer measurement data. The share page shows the design recipe, fabrics and construction choices and can reopen the Designer.

The server verifies the locked recipe hash before issuing a share link. Tampered or expired share tokens are rejected.

## Secure recovery vault now implemented

A locked revision can be saved deliberately to a private Supabase-backed recovery vault:
- browser never receives database credentials,
- the full locked recipe is integrity-verified before storage,
- a high-entropy recovery key is generated in the server route,
- only the SHA-256 hash of that key is stored,
- the recovery token stays with the customer/operator,
- retrieval verifies the locked recipe again,
- the secure copy expires automatically,
- the recovery flow supports download of the locked JSON, tailor handoff and printable tech pack,
- the recovery token is pasted into a POST flow and is not placed in the page URL.

Recovery tokens remain an independent backup mechanism. Signed-in customers can now attach new or older locked revisions to their authenticated account without exposing the recipe through a public URL.

## What this does not yet solve

The authenticated account now supplies durable customer ownership for locked revisions. Production-order customer identity linkage beyond the locked-design owner is still an operational launch concern. Recovery tokens still grant access to their vault item and must be kept private; browser localStorage is not authoritative.

## Completion gate

- [x] canonical design recipe exists
- [x] stable StyleSpec v2 IDs exist
- [x] immutable lock snapshot contract
- [x] SHA-256 recipe fingerprint
- [x] parent-revision linkage
- [x] mutation verification test
- [x] reconstruction test
- [x] Designer lock/export action
- [x] WhatsApp exact-look enquiry
- [x] authenticated customer ownership
- [x] opt-in durable server recovery vault for locked revisions
- [x] signed expiring share-token model for non-sensitive design recipe
- [x] authenticated customer ownership / account-level deletion permissions
- [x] five-customer lock → share/enquiry evidence workflow engineered through the shared private-beta gate
- [ ] five real customers complete lock → share/enquiry with zero blocking bugs

## Real-customer validation gate

The existing Phase 9 private-beta ledger is reused rather than creating another evidence system. Each anonymous case now records **design locked** and **share/enquiry completed** separately. A case counts only when both are true and no blocking bug is recorded. Legacy generic beta rows cannot accidentally satisfy this stricter Phase 5 gate.

## Rule

Never overwrite a locked revision in place. Any changed fabric, measurement, construction option or creative treatment creates a new revision linked to the previous revision.
