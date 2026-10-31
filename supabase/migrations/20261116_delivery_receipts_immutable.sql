-- M126: delivery replay receipts are durable audit evidence, not editable cache.
-- A privileged UPDATE or DELETE could rewrite the original request intent,
-- manufacture a same-key replay success, or discard proof after a lost HTTP ack.
-- Preserve original M112 atomic INSERT and replay logic; no history backfill.
-- DRAFT: owner schema/security and staging restore approval before any live DDL.
create or replace function private.reject_production_delivery_receipt_mutation()
returns trigger
language plpgsql
set search_path='pg_catalog'
as $$
begin
  raise exception 'production delivery idempotency receipts are append-only'
    using errcode='55000';
end;
$$;

revoke all on function private.reject_production_delivery_receipt_mutation()
  from public,anon,authenticated;

drop trigger if exists production_delivery_receipt_append_only
  on private.production_delivery_request_receipts;
create trigger production_delivery_receipt_append_only
  before update or delete on private.production_delivery_request_receipts
  for each row execute function private.reject_production_delivery_receipt_mutation();

-- TRUNCATE bypasses row-level DELETE triggers; protect complete replay history.
drop trigger if exists production_delivery_receipt_no_truncate
  on private.production_delivery_request_receipts;
create trigger production_delivery_receipt_no_truncate
  before truncate on private.production_delivery_request_receipts
  for each statement execute function private.reject_production_delivery_receipt_mutation();

-- Successful same-key replay is still a READ of the original immutable
-- SHA-256 request and returns true without emitting another delivery event.
-- Changed instructions retain the original M112 rejection semantics.
