-- LLinen Earth cloud memory — production hardening
-- Append-only event ledger used by the public website and LLinen Earth OS.
-- This migration is the canonical bootstrap for a new LLinen Earth Supabase project.

begin;

create table if not exists public.style_events (
  id text primary key,
  session_id text not null,
  type text not null,
  at timestamptz not null,
  source text not null default 'style-director',
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.style_events
  drop constraint if exists style_events_id_shape,
  add constraint style_events_id_shape check (length(id) between 1 and 160);

alter table public.style_events
  drop constraint if exists style_events_session_shape,
  add constraint style_events_session_shape check (length(session_id) between 1 and 140);

alter table public.style_events
  drop constraint if exists style_events_type_allowed,
  add constraint style_events_type_allowed check (
    type in (
      'session_started',
      'answer_selected',
      'looks_generated',
      'look_selected',
      'render_requested',
      'render_completed',
      'whatsapp_clicked',
      'visit_logged',
      'sale_logged',
      'operator_note',
      'customer_updated',
      'lead_status_changed',
      'order_status_changed',
      'measurements_updated',
      'payment_logged'
    )
  );

alter table public.style_events
  drop constraint if exists style_events_source_shape,
  add constraint style_events_source_shape check (
    source in ('style-director', 'operator', 'operator-desktop')
  );

alter table public.style_events
  drop constraint if exists style_events_payload_object,
  add constraint style_events_payload_object check (jsonb_typeof(payload) = 'object');

create index if not exists style_events_session_at_idx
  on public.style_events (session_id, at);

create index if not exists style_events_type_at_idx
  on public.style_events (type, at desc);

create index if not exists style_events_received_idx
  on public.style_events (received_at asc);

create index if not exists style_events_received_id_idx
  on public.style_events (received_at asc, id asc);

alter table public.style_events enable row level security;

-- Public browser roles never query this table directly.
-- Next.js validates events and writes through a server-only elevated key.
revoke all on table public.style_events from anon;
revoke all on table public.style_events from authenticated;

-- The elevated role is append/read only: no mutation of historical records.
revoke all on table public.style_events from service_role;
grant select, insert on table public.style_events to service_role;

comment on table public.style_events is
  'LLinen Earth append-only customer/operator event ledger. Browser access is intentionally denied.';

create or replace function public.llinen_cloud_schema_version()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select 4;
$$;

revoke all on function public.llinen_cloud_schema_version() from public;
revoke all on function public.llinen_cloud_schema_version() from anon;
revoke all on function public.llinen_cloud_schema_version() from authenticated;
grant execute on function public.llinen_cloud_schema_version() to service_role;

-- Server-only diagnostic used by npm run cloud:check and desktop pairing.
-- It verifies the permissions that matter for the event ledger without exposing
-- customer rows or payloads.
create or replace function public.llinen_cloud_health()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'schemaVersion', 4,
    'tableExists', to_regclass('public.style_events') is not null,
    'rlsEnabled', coalesce((
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'style_events'
    ), false),
    'anonSelect', has_table_privilege('anon', 'public.style_events', 'select'),
    'anonInsert', has_table_privilege('anon', 'public.style_events', 'insert'),
    'authenticatedSelect', has_table_privilege('authenticated', 'public.style_events', 'select'),
    'authenticatedInsert', has_table_privilege('authenticated', 'public.style_events', 'insert'),
    'serviceSelect', has_table_privilege('service_role', 'public.style_events', 'select'),
    'serviceInsert', has_table_privilege('service_role', 'public.style_events', 'insert'),
    'serviceUpdate', has_table_privilege('service_role', 'public.style_events', 'update'),
    'serviceDelete', has_table_privilege('service_role', 'public.style_events', 'delete')
  );
$$;

revoke all on function public.llinen_cloud_health() from public;
revoke all on function public.llinen_cloud_health() from anon;
revoke all on function public.llinen_cloud_health() from authenticated;
grant execute on function public.llinen_cloud_health() to service_role;

commit;
