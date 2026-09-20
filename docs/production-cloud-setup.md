# LLinen Earth — Production Cloud Setup

This is the production path for the customer website, Supabase event memory and LLinen Earth OS.

## 1. Apply the database migration

Apply:

```text
supabase/migrations/20260920_style_events_hardening.sql
```

The migration:

- creates / hardens `public.style_events`
- enables Row Level Security
- removes direct `anon` and `authenticated` table privileges
- grants only `SELECT` and `INSERT` to the elevated server role
- restricts event types and payload shape
- adds deterministic sync indexes

The table is intentionally append-only for the application. Website browsers never receive an elevated Supabase key.

## 2. Configure Vercel server-only variables

Required:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
LLINEN_OPERATOR_SYNC_TOKEN=
LLINEN_OPERATOR_PASSWORD_HASH=
LLINEN_OPERATOR_SESSION_SECRET=
LLINEN_MEMORY_SESSION_SECRET=
```

Compatibility fallback:

```text
SUPABASE_SERVICE_ROLE_KEY=
```

Prefer `SUPABASE_SECRET_KEY` on a modern Supabase project. Do not prefix any secret with `NEXT_PUBLIC_`.

Generate LLinen-owned secrets:

```bash
npm run production-secrets
```

Generate the operator password hash:

```bash
npm run operator-password
```

## 3. Verify cloud readiness

With the server environment loaded:

```bash
npm run cloud:check
```

For a Vercel-linked local checkout:

```bash
vercel env run -- npm run cloud:check
```

The checker never prints secret values. It verifies:

- Supabase URL
- elevated key format
- `style_events` reachability
- desktop sync token
- operator session signing secret
- operator password hash

## 4. Web flow

Customer browser:

```text
Style Director
  ↓
/api/memory/event
  ↓
server validation
  ↓
Supabase style_events
```

The browser does not receive `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.

## 5. Desktop pairing

In LLinen Earth OS → Memory:

1. Open Cloud Pairing.
2. Use the production sync endpoint:
   ```text
   https://<your-live-domain>/api/operator/sync
   ```
3. Enter the same `LLINEN_OPERATOR_SYNC_TOKEN` configured on the server.
4. Save pairing.
5. The token is stored in Windows Credential Manager, not the ordinary LLinen data folder.

Desktop synchronization:

- runs shortly after app startup
- repeats approximately every five minutes while the app is open
- pushes local operator events first
- then pulls website/cloud events
- event IDs make retries idempotent
- the pull cursor uses `received_at + id` so events sharing a timestamp are not skipped

## 6. Operator web access

`/operator` is protected by:

- scrypt password hash
- signed HttpOnly session cookie
- 12-hour session expiry
- login throttling
- middleware redirect
- no-index / no-cache headers
- frame / MIME / referrer / permissions hardening

The web operator view is a protected fallback. LLinen Earth OS remains the primary private operating interface.

## 7. Backups

LLinen Earth OS backups include:

- customer / style events
- inventory snapshot
- AI Brain decisions
- sync state

The Memory module also exposes local health warnings, backup count, archived visual count and cloud pairing state.

## 8. Secrets policy

Never place these values in:

- source code
- GitHub commits
- browser JavaScript
- `NEXT_PUBLIC_*`
- URLs
- screenshots or chat messages

If an elevated Supabase key or operator sync token is exposed, rotate it immediately.
