-- Authenticated customer quote acceptance for account-owned production quotes.
-- Customer acceptance is append-only evidence on the existing quote ledger; it never creates an order automatically.

create or replace function public.production_quote_accept_owned(
  p_quote_id uuid,
  p_owner_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_current text;
  v_owner uuid;
begin
  select status,owner_user_id
  into v_current,v_owner
  from private.production_quotes
  where quote_id=p_quote_id
  for update;

  if v_current is null then return false; end if;
  if v_owner is distinct from p_owner_user_id then return false; end if;
  if v_current<>'sent' then
    raise exception 'quote is not awaiting customer acceptance';
  end if;

  update private.production_quotes
  set status='accepted',updated_at=now()
  where quote_id=p_quote_id;

  insert into private.production_quote_events(quote_id,event_type,payload)
  values(
    p_quote_id,
    'accepted',
    jsonb_build_object('from','sent','actor','customer_account')
  );

  return true;
end;
$$;

create or replace function public.production_quote_list_owned_v2(
  p_owner_user_id uuid,
  p_limit integer default 100
)
returns table(
  quote_id uuid,
  revision_id text,
  recipe_hash text,
  currency text,
  line_items jsonb,
  subtotal numeric,
  adjustment numeric,
  total numeric,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select
    q.quote_id,q.revision_id,q.recipe_hash,q.currency,q.line_items,
    q.subtotal,q.adjustment,q.total,q.status,q.created_at,q.updated_at
  from private.production_quotes q
  where q.owner_user_id=p_owner_user_id
  order by q.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

revoke all on function public.production_quote_accept_owned(uuid,uuid) from public,anon,authenticated;
revoke all on function public.production_quote_list_owned_v2(uuid,integer) from public,anon,authenticated;

grant execute on function public.production_quote_accept_owned(uuid,uuid) to service_role;
grant execute on function public.production_quote_list_owned_v2(uuid,integer) to service_role;
