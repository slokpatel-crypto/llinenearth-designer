-- Propagate authenticated customer ownership from locked design vaults into quotes and production orders.
-- Ownership is attributed only when one distinct authenticated owner can be resolved for the exact immutable revision/hash.

alter table private.production_quotes
  add column if not exists owner_user_id uuid null references auth.users(id) on delete set null;

alter table private.production_orders
  add column if not exists owner_user_id uuid null references auth.users(id) on delete set null;

create index if not exists production_quotes_owner_idx
  on private.production_quotes(owner_user_id,created_at desc)
  where owner_user_id is not null;

create index if not exists production_orders_owner_idx
  on private.production_orders(owner_user_id,created_at desc)
  where owner_user_id is not null;

create or replace function private.resolve_locked_revision_owner(
  p_revision_id text,
  p_recipe_hash text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_owner uuid;
  v_count integer;
begin
  select min(owner_user_id),count(distinct owner_user_id)
  into v_owner,v_count
  from private.designer_locked_revision_vault
  where revision_id=trim(p_revision_id)
    and recipe_hash=lower(p_recipe_hash)
    and owner_user_id is not null
    and expires_at>now();

  if coalesce(v_count,0)=1 then return v_owner; end if;
  return null;
end;
$$;

revoke all on function private.resolve_locked_revision_owner(text,text) from public,anon,authenticated;

create or replace function public.production_quote_create(
  p_revision_id text,
  p_recipe_hash text,
  p_currency text,
  p_line_items jsonb,
  p_adjustment numeric default 0,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_quote uuid;
  v_subtotal numeric:=0;
  v_total numeric:=0;
  v_owner uuid;
  item jsonb;
  v_amount numeric;
begin
  if coalesce(length(trim(p_revision_id)),0)<12 then raise exception 'locked revision id is required'; end if;
  if lower(coalesce(p_recipe_hash,'')) !~ '^[a-f0-9]{64}$' then raise exception 'invalid recipe hash'; end if;
  if upper(coalesce(p_currency,'')) !~ '^[A-Z]{3}$' then raise exception 'invalid currency'; end if;
  if jsonb_typeof(p_line_items)<>'array' or jsonb_array_length(p_line_items)<1 or jsonb_array_length(p_line_items)>30 then
    raise exception 'line items must contain 1..30 items';
  end if;

  for item in select value from jsonb_array_elements(p_line_items)
  loop
    if coalesce(length(trim(item->>'label')),0)=0 then raise exception 'line item label is required'; end if;
    if jsonb_typeof(item->'amount')<>'number' then raise exception 'line item amount is required'; end if;
    v_amount=(item->>'amount')::numeric;
    if v_amount<0 or v_amount>10000000 then raise exception 'invalid line item amount'; end if;
    v_subtotal=v_subtotal+v_amount;
  end loop;

  if p_adjustment is null or abs(p_adjustment)>10000000 then raise exception 'invalid adjustment'; end if;
  v_total=v_subtotal+p_adjustment;
  if v_total<0 then raise exception 'quote total cannot be negative'; end if;

  v_owner=private.resolve_locked_revision_owner(p_revision_id,p_recipe_hash);

  insert into private.production_quotes(
    revision_id,recipe_hash,currency,line_items,subtotal,adjustment,total,note,owner_user_id
  ) values(
    left(trim(p_revision_id),220),lower(p_recipe_hash),upper(p_currency),p_line_items,
    round(v_subtotal,2),round(p_adjustment,2),round(v_total,2),left(coalesce(p_note,''),1000),v_owner
  )
  returning quote_id into v_quote;

  insert into private.production_quote_events(quote_id,event_type,payload)
  values(v_quote,'created',jsonb_build_object(
    'total',round(v_total,2),
    'currency',upper(p_currency),
    'customerOwnershipResolved',v_owner is not null
  ));

  return v_quote;
end;
$$;

create or replace function public.production_order_create(
  p_revision_id text,
  p_recipe_hash text,
  p_quote_id uuid default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_order uuid;
  v_quote_status text;
  v_quote_revision text;
  v_quote_hash text;
  v_quote_owner uuid;
  v_owner uuid;
begin
  if coalesce(length(trim(p_revision_id)),0)<12 then raise exception 'locked revision id is required'; end if;
  if lower(coalesce(p_recipe_hash,'')) !~ '^[a-f0-9]{64}$' then raise exception 'invalid recipe hash'; end if;

  if p_quote_id is not null then
    select status,revision_id,recipe_hash,owner_user_id
    into v_quote_status,v_quote_revision,v_quote_hash,v_quote_owner
    from private.production_quotes where quote_id=p_quote_id;

    if v_quote_status is null then raise exception 'unknown quote'; end if;
    if v_quote_status<>'accepted' then raise exception 'quote must be accepted before order creation'; end if;
    if v_quote_revision<>trim(p_revision_id) or v_quote_hash<>lower(p_recipe_hash) then
      raise exception 'quote does not match locked design';
    end if;
    v_owner=v_quote_owner;
  end if;

  if v_owner is null then
    v_owner=private.resolve_locked_revision_owner(p_revision_id,p_recipe_hash);
  end if;

  insert into private.production_orders(revision_id,recipe_hash,quote_id,note,owner_user_id)
  values(left(trim(p_revision_id),220),lower(p_recipe_hash),p_quote_id,left(coalesce(p_note,''),1000),v_owner)
  returning order_id into v_order;

  insert into private.production_order_events(order_id,status,payload)
  values(v_order,'created',jsonb_build_object(
    'note',left(coalesce(p_note,''),1000),
    'customerOwnershipResolved',v_owner is not null
  ));

  return v_order;
end;
$$;

-- If a customer claims a recovery-token design after an operator already created a draft quote/order,
-- propagate ownership only into still-unowned records for the exact immutable recipe.
create or replace function public.production_claim_revision_ownership(
  p_revision_id text,
  p_recipe_hash text,
  p_owner_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_valid boolean;
  v_quotes integer:=0;
  v_orders integer:=0;
begin
  select exists(
    select 1 from private.designer_locked_revision_vault
    where revision_id=trim(p_revision_id)
      and recipe_hash=lower(p_recipe_hash)
      and owner_user_id=p_owner_user_id
      and expires_at>now()
  ) into v_valid;

  if not v_valid then raise exception 'customer does not own this locked revision'; end if;

  update private.production_quotes
  set owner_user_id=p_owner_user_id
  where revision_id=trim(p_revision_id)
    and recipe_hash=lower(p_recipe_hash)
    and owner_user_id is null;
  get diagnostics v_quotes=row_count;

  update private.production_orders
  set owner_user_id=p_owner_user_id
  where revision_id=trim(p_revision_id)
    and recipe_hash=lower(p_recipe_hash)
    and owner_user_id is null;
  get diagnostics v_orders=row_count;

  return jsonb_build_object('quotes',v_quotes,'orders',v_orders);
end;
$$;

create or replace function public.production_quote_list_owned(p_owner_user_id uuid,p_limit integer default 100)
returns table(
  quote_id uuid,revision_id text,recipe_hash text,currency text,total numeric,status text,created_at timestamptz,updated_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select q.quote_id,q.revision_id,q.recipe_hash,q.currency,q.total,q.status,q.created_at,q.updated_at
  from private.production_quotes q
  where q.owner_user_id=p_owner_user_id
  order by q.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

create or replace function public.production_order_list_owned(p_owner_user_id uuid,p_limit integer default 100)
returns table(
  order_id uuid,revision_id text,recipe_hash text,quote_id uuid,status text,created_at timestamptz,updated_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select o.order_id,o.revision_id,o.recipe_hash,o.quote_id,o.status,o.created_at,o.updated_at
  from private.production_orders o
  where o.owner_user_id=p_owner_user_id
  order by o.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

revoke all on function public.production_claim_revision_ownership(text,text,uuid) from public,anon,authenticated;
revoke all on function public.production_quote_list_owned(uuid,integer) from public,anon,authenticated;
revoke all on function public.production_order_list_owned(uuid,integer) from public,anon,authenticated;

grant execute on function public.production_claim_revision_ownership(text,text,uuid) to service_role;
grant execute on function public.production_quote_list_owned(uuid,integer) to service_role;
grant execute on function public.production_order_list_owned(uuid,integer) to service_role;
