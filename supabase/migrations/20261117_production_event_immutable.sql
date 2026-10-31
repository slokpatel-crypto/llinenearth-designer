-- M127: quote and production-order state transitions are durable event evidence.
-- A privileged UPDATE/DELETE/TRUNCATE previously could remove a delivered
-- event while keeping its immutable delivery replay receipt, or rewrite quote
-- acceptance history without an idempotency duplicate. INSERT-only normal RPCs
-- remain unchanged. Draft: no live migration before explicit owner approval.
create or replace function private.reject_production_event_mutation()
returns trigger
language plpgsql
set search_path='pg_catalog'
as $$
begin
  raise exception 'production quote/order events are append-only'
    using errcode='55000';
end;
$$;
revoke all on function private.reject_production_event_mutation()
  from public,anon,authenticated;

drop trigger if exists production_quote_event_append_only
  on private.production_quote_events;
create trigger production_quote_event_append_only
  before update or delete on private.production_quote_events
  for each row execute function private.reject_production_event_mutation();
drop trigger if exists production_quote_event_no_truncate
  on private.production_quote_events;
create trigger production_quote_event_no_truncate
  before truncate on private.production_quote_events
  for each statement execute function private.reject_production_event_mutation();

drop trigger if exists production_order_event_append_only
  on private.production_order_events;
create trigger production_order_event_append_only
  before update or delete on private.production_order_events
  for each row execute function private.reject_production_event_mutation();
drop trigger if exists production_order_event_no_truncate
  on private.production_order_events;
create trigger production_order_event_no_truncate
  before truncate on private.production_order_events
  for each statement execute function private.reject_production_event_mutation();

-- This preserves existing events. New quote/order/delivery transitions only
-- INSERT new events, as before; human corrections are separately recorded.
