-- LLinen Earth cloud memory — production hardening
-- Append-only event ledger used by the public website and LLinen Earth OS.
-- Safe to re-run.

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

-- Keep the Data API surface narrow even if an application bug submits malformed data.
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
      'order_status_changed'
    )
  );

alter table public.style_events
  drop constraint if exists style_events_source_shape,
  add constraint style_events_source_shape check (length(source) between 1 and 48);

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

-- The browser never talks to this table directly.
-- Route Handlers validate events, then use a server-only elevated Supabase key.
revoke all on table public.style_events from anon;
revoke all on table public.style_events from authenticated;

-- Keep the elevated server role append/read only. It does not need update/delete.
revoke all on table public.style_events from service_role;
grant select, insert on table public.style_events to service_role;

comment on table public.style_events is
  'LLinen Earth append-only customer/operator event ledger. Browser access is intentionally denied.';

commit;
