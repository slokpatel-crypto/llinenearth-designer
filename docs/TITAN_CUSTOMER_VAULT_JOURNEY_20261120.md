# Worker C — Customer vault to Designer journey (2026-11-20)

Base: `main` at `b011e86acba5cde88eebe0529d9e1f92761f8516`, isolated branch `titan-worker-c-customer-vault-resume-20261120`.

## Existing modules reused
- Designer fabric discovery and closed garment option IDs.
- SHA-256 canonical lock v1 with StyleSpec v2 and parent revision linkage.
- Account-owned Supabase vault `listOwned`/`loadOwned`, already protected by the signed-in identity.
- Existing signed 30-day share endpoint, measurement-redacted share page and exact-look enquiry endpoint.
- Existing email OTP, secure recovery token, owner deletion and quotes/orders.

## Journey added
1. Discover shirt/trouser fabrics in Designer and assess the look.
2. Lock a versioned canonical recipe, then store in secure vault (existing).
3. Sign in and view saved designs with verified reconstruction metadata in the account vault.
4. Reuse the original immutable revision for public share or WhatsApp enquiry.
5. Reopen a saved StyleSpec v2 pair in Designer as a validated **editable descendant**. Reassessment and a new lock produce a new parent-linked revision. The original stays unchanged.

## Security and compatibility
- Client never passes vault contents, recovery tokens, customer email or measurements in the resume URL; just owner-scoped UUID.
- The authenticated API validates ownership and SHA; the client verifies SHA again before using the recipe.
- Unknown fabric/category, unrecognized context/options, missing StyleSpec v2 or invalid body profile fail closed. Legacy designs stay readable in account but cannot be silently transformed into unsupported construction.
- Do not infer or fabricate stock, verified physical size, measurements or completed customer evidence.
- No migrations, dependencies, deployment or live data mutation during development.

## Verification required
- Pure tests: valid lineage, cross-garment IDs, tamper and legacy rejection, UUID URL boundary.
- Complete `npm run quality`, `npm test`, `npm run eval:engine`, `npm run eval:preview-performance`, `npm run release:check`, `npm run build` at exact PR head.
- Authenticated and non-owner browser checks for saved views and restore; widths 390 / 768 / 1440; no console errors.
- Independent review and verified exact-head CI before any merge.
