# LLinen Earth — Production Connection Checklist

This document covers the remaining connection layer between:

```text
Customer website
      ↓
Supabase cloud event memory
      ↕
LLinen Earth OS (Windows)
      ↓
LLinenEarthData local vault
```

The public website never receives arbitrary access to the operator PC.

## 1. Create / connect Supabase

The cloud schema is already defined in:

```text
docs/cloud-memory.sql
```

Create a Supabase project and run that SQL once. The table is intentionally protected by RLS with no anonymous browser policies; the Next.js server writes and reads with the service-role key.

Required server-side values:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not expose the service-role key through `NEXT_PUBLIC_*`.

## 2. Generate LLinen Earth server secrets

Run:

```powershell
npm run production-secrets
npm run operator-password
```

The first command generates two separate random secrets:

```text
LLINEN_OPERATOR_SESSION_SECRET=
LLINEN_OPERATOR_SYNC_TOKEN=
```

The second command asks for the private Operator Desk password and outputs:

```text
LLINEN_OPERATOR_PASSWORD_HASH=
```

Only the hash goes to Vercel; the plain operator password is not stored in the repository.

## 3. Configure Vercel

Set these for the required environments:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LLINEN_OPERATOR_SYNC_TOKEN
LLINEN_OPERATOR_PASSWORD_HASH
LLINEN_OPERATOR_SESSION_SECRET
FASHN_API_KEY
```

For the website preview to render FASHN output, `FASHN_API_KEY` also needs Preview access.

Operator web sessions use a signed HttpOnly SameSite=Strict cookie. Customer browser code never receives the password hash, session-signing secret, sync token, or Supabase service-role key.

## 4. Pair the Windows PC

Open:

```text
LLinen Earth OS → Memory → Cloud ↔ PC
```

Use the deployed endpoint:

```text
https://<production-domain>/api/operator/sync
```

and paste the exact `LLINEN_OPERATOR_SYNC_TOKEN` value generated above.

LLinen Earth OS stores the token in Windows Credential Manager. The data vault only stores the non-secret sync URL.

After pairing:
- manual sync is available immediately;
- the app performs a quiet sync while open every five minutes;
- only newly-created local operator events are uploaded;
- cloud event IDs make retries idempotent;
- website events are downloaded into the local append-only event ledger.

## 5. Web Operator Desk

Visit:

```text
/operator
```

Unauthenticated requests are redirected to:

```text
/operator/login
```

The Operator Desk can read cloud memory only after a valid signed operator session is present.

Operator-only outcomes such as store visits and sales are rejected by the public memory endpoint unless the request has an authenticated operator session.

## 6. End-to-end verification

Use a test customer and verify this exact chain:

1. Complete Style Director on the website.
2. Confirm a website event exists in Supabase.
3. Open LLinen Earth OS and press **Sync cloud now**.
4. Confirm the customer journey appears in Customers / Leads.
5. Add a name, lead status, tailoring stage or sale in LLinen Earth OS.
6. Sync again.
7. Confirm those operator events exist in Supabase.
8. Sign in to the web Operator Desk and confirm the cloud summary reflects the synced journey.
9. Create a local backup from LLinen Earth OS.
10. Confirm Memory → System Health has no unexpected warnings.

## 7. Production safety rules

- Never put service-role keys or sync tokens in browser JavaScript.
- Never expose the LLinen Earth PC to inbound public ports.
- Keep Supabase RLS enabled.
- Treat customer names and phone numbers as business/customer data and collect them only when needed.
- Do not store payment-card data, Aadhaar, PAN, passwords, or unrelated personal files in the LLinen Earth vault.
- Use Windows disk encryption and normal Windows account security on the operator PC.
- Keep local backups plus the cloud copy; neither should be the only copy.

## Current architecture status

Code is in place for:
- public customer event intake;
- authenticated operator-only visit/sale intake;
- authenticated web Operator Desk;
- token-protected desktop sync endpoint;
- cloud → PC download;
- PC → cloud operator-event upload;
- duplicate-safe event reconciliation;
- local backups;
- secure desktop token storage in Windows Credential Manager;
- automatic sync while LLinen Earth OS is running.

The remaining deployment dependency is provisioning/configuring the Supabase project and putting the generated secrets into Vercel.
