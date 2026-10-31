-- M128: quote/order creation and non-delivery status request receipts are
-- durable retry evidence. RLS alone does not stop privileged editing,
-- deletion or TRUNCATE, which can erase lost-ack replay history.
-- No existing rows changed. Owner-approved staging rehearsal required.
create or replace function private.reject_production_request_receipt_mutation()
returns trigger
language plpgsql
set search_path='pg_catalog'
as $$
begin
  raise exception 'production request receipts are append-only'
    using errcode='55000';
end;
$$;
revoke all on function private.reject_production_request_receipt_mutation()
  from public,anon,authenticated;

drop trigger if exists production_creation_receipt_append_only
  on private.production_creation_request_receipts;
create trigger production_creation_receipt_append_only
  before update or delete on private.production_creation_request_receipts
  for each row execute function private.reject_production_request_receipt_mutation();
drop trigger if exists production_creation_receipt_no_truncate
  on private.production_creation_request_receipts;
create trigger production_creation_receipt_no_truncate
  before truncate on private.production_creation_request_receipts
  for each statement execute function private.reject_production_request_receipt_mutation();

drop trigger if exists production_quote_status_receipt_append_only
  on private.production_quote_status_request_receipts;
create trigger production_quote_status_receipt_append_only
  before update or delete on private.production_quote_status_request_receipts
  for each row execute function private.reject_production_request_receipt_mutation();
drop trigger if exists production_quote_status_receipt_no_truncate
  on private.production_quote_status_request_receipts;
create trigger production_quote_status_receipt_no_truncate
  before truncate on private.production_quote_status_request_receipts
  for each statement execute function private.reject_production_request_receipt_mutation();

drop trigger if exists production_order_status_receipt_append_only
  on private.production_order_status_request_receipts;
create trigger production_order_status_receipt_append_only
  before update or delete on private.production_order_status_request_receipts
  for each row execute function private.reject_production_request_receipt_mutation();
drop trigger if exists production_order_status_receipt_no_truncate
  on private.production_order_status_request_receipts;
create trigger production_order_status_receipt_no_truncate
  before truncate on private.production_order_status_request_receipts
  for each statement execute function private.reject_production_request_receipt_mutation();

-- Normal existing idempotent RPCs INSERT an original request receipt once and
-- read the stored intent on retry. No history backfill or artificial success.
