# Phase 5 — Lock, Share & Enquiry Adaptation

Status: core recipe-lock groundwork implemented; durable account persistence remains a production dependency.

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

## What this does not yet solve

The exported lock file is portable and the share token is privacy-safe, but the production system of record is not complete until customer identity and durable authenticated persistence are connected. Browser localStorage must not be treated as the authoritative copy of a paid / production order.

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
- [ ] authenticated customer ownership
- [ ] durable server persistence for locked revisions
- [x] signed expiring share-token model for non-sensitive design recipe
- [ ] authenticated customer ownership / revocation permissions
- [ ] five real customers complete lock → share/enquiry with zero blocking bugs

## Rule

Never overwrite a locked revision in place. Any changed fabric, measurement, construction option or creative treatment creates a new revision linked to the previous revision.
