-- M142: exact committed status receipts, independent of capped history lists.
-- A missing receipt at read time NEVER proves that an in-flight SQL write
-- cannot commit later. Draft-only; no unattended live migration.
create or replace function public.production_status_request_receipt_lookup(
  p_request_key uuid
)
returns table(action text,record_id uuid,target_status text)
language sql
security definer
set search_path='public','private'
as $$
  select 'quote_status'::text,r.quote_id,r.target_status
  from private.production_quote_status_request_receipts r
  where r.request_key=p_request_key and p_request_key is not null
  union all
  select 'order_status'::text,r.order_id,r.target_status
  from private.production_order_status_request_receipts r
  where r.request_key=p_request_key and p_request_key is not null
  union all
  select 'order_status'::text,r.order_id,'delivered'::text
  from private.production_delivery_request_receipts r
  where r.request_key=p_request_key and p_request_key is not null
  limit 3;
$$;

revoke all on function public.production_status_request_receipt_lookup(uuid)
  from public,anon,authenticated;
grant execute on function public.production_status_request_receipt_lookup(uuid)
  to service_role;
