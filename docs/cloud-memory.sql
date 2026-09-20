-- LLinen Earth cloud memory
--
-- Canonical migration:
--   supabase/migrations/20260920_style_events_hardening.sql
--
-- Apply that migration to the Supabase project used by the website.
-- It creates/hardens public.style_events, enables RLS, revokes direct
-- browser access from anon/authenticated, and grants only SELECT/INSERT
-- to service_role for the server-side append/read workflow.
--
-- Required Vercel server-only environment variables:
--   SUPABASE_URL
--   SUPABASE_SECRET_KEY              (preferred)
--   SUPABASE_SERVICE_ROLE_KEY        (legacy fallback)
--   LLINEN_OPERATOR_SYNC_TOKEN
--   LLINEN_OPERATOR_PASSWORD_HASH
--   LLINEN_OPERATOR_SESSION_SECRET
--
-- Public website clients never receive the elevated Supabase key.
-- Next.js Route Handlers validate and persist events server-side.
--
-- Desktop LLinen Earth OS:
--   1. Pair /api/operator/sync with LLINEN_OPERATOR_SYNC_TOKEN.
--   2. The token is stored in Windows Credential Manager.
--   3. Desktop pushes operator events and pulls website events.
--   4. Event IDs make sync idempotent; received_at + id is the pull cursor.
--
-- Legacy minimal schema retained below only as reference.
create table if not exists public.style_events (
  id text primary key,
  session_id text not null,
  type text not null,
  at timestamptz not null,
  source text not null default 'style-director',
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.style_events enable row level security;
