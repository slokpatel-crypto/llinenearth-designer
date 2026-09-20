-- LLinen Earth cloud memory table
-- Run in the Supabase SQL editor for the project used by the website.

create table if not exists public.style_events (
  id text primary key,
  session_id text not null,
  type text not null,
  at timestamptz not null,
  source text not null default 'style-director',
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists style_events_session_idx on public.style_events (session_id, at);
create index if not exists style_events_type_idx on public.style_events (type, at desc);
create index if not exists style_events_received_idx on public.style_events (received_at desc);

alter table public.style_events enable row level security;

-- No anonymous/browser read or write policy is intentionally created.
-- The Next.js server route writes with SUPABASE_SERVICE_ROLE_KEY.
-- Before exposing operator cloud reads, add operator authentication at the application layer.
