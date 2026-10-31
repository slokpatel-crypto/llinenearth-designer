-- Read-only recovery of an exact durable creation receipt after an operator
-- browser crash or a lost POST acknowledgement. This does NOT prove that a
-- missing receipt has not yet committed. No customer/order instructions are
-- returned; only action and the previously committed quote/order UUID.
create or replace function public.production_creation_request_receipt_lookup(
  p_request_key uuid
)
returns table(action text,receipt_id uuid)
language sql
security definer
set search_path='public','private'
as $$
  select r.action,r.receipt_id
  from private.production_creation_request_receipts r
  where r.request_key=p_request_key
    and p_request_key is not null
  order by r.action
  limit 2;
$$;

revoke all on function public.production_creation_request_receipt_lookup(uuid)
  from public,anon,authenticated;
grant execute on function public.production_creation_request_receipt_lookup(uuid)
  to service_role;
