# LLinen Earth cloud production runbook

This is the final activation checklist for website ↔ LLinen Earth OS memory.

## 1. Create or connect the Supabase project

Use one dedicated production project for LLinen Earth. Prefer a region close to the shop/customer base if practical.

The ChatGPT Supabase connector currently returns no projects, so no live database changes have been applied from this workspace yet.

## 2. Apply the canonical schema

Apply:

```text
supabase/migrations/20260920_style_events_hardening.sql
```

The expected contract is **schema v5**.

It creates an append-only `public.style_events` ledger and server-only diagnostic RPCs.

Security contract:

- RLS enabled
- no direct `anon` table access
- no direct `authenticated` table access
- server role: SELECT + INSERT only
- server role: no UPDATE / DELETE
- browser never receives the server secret

## 3. Configure Vercel server secrets

Set these only as server-side environment variables:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
LLINEN_OPERATOR_SYNC_TOKEN=
LLINEN_OPERATOR_PASSWORD_HASH=
LLINEN_OPERATOR_SESSION_SECRET=
LLINEN_MEMORY_SESSION_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY` is accepted only as a legacy fallback.

Never create `NEXT_PUBLIC_` versions of any secret above.

Generate local secrets with:

```bash
npm run production-secrets
npm run operator-password
```

## 4. Verify before customer data flows

Run:

```bash
npm run cloud:check
```

Do not enable production sync unless every required check passes.

The checker verifies schema version, RLS, role grants, table reachability and the required application secrets.

## 5. Pair LLinen Earth OS

In **Memory → Cloud ↔ PC**:

1. Use the production sync endpoint:
   `https://<production-domain>/api/operator/sync`
2. Paste the same `LLINEN_OPERATOR_SYNC_TOKEN`.
3. Pair the PC.

The token is saved in Windows Credential Manager, not in the LLinen Earth data folder.

The desktop then:

- uploads local operator events
- syncs operator-only Measurement Passport updates
- syncs payment/deposit amounts and payment method labels only; never card numbers or payment credentials
- syncs appointment/trial scheduling as operator-only business events
- pulls website/customer events
- uses event IDs for idempotency
- uses a deterministic `received_at + id` cursor
- auto-syncs periodically and also supports manual sync

## 6. Verify end to end

Perform one disposable test journey:

1. Open Style Director on the website.
2. Choose occasion/garment/colour.
3. Generate/select a look.
4. Open LLinen Earth OS and sync.
5. Confirm the session appears.
6. Add a customer name or walk-in note on the PC.
7. Sync again.
8. Sign in to the web Operator Desk and confirm the operator event appears in cloud memory.

Do not use real customer PII for the first test.

## 7. Production operating rules

- Keep the database append-only.
- Use new events to correct business history.
- Back up the local vault regularly.
- Do not store card data, Aadhaar/PAN, passwords or unrelated personal files.
- Keep customer notes relevant to tailoring/service only.
- Rotate the sync token if a PC is lost or decommissioned.
- Change the operator password if staff access changes.
- Keep the web Operator Desk private and authenticated.

## 8. If cloud is unavailable

LLinen Earth OS remains local-first.

Walk-ins, orders, inventory edits, sales, AI Brain decisions and backups continue locally. Sync can reconcile later when the cloud becomes available.
