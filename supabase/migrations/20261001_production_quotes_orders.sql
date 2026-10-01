-- Evidence-safe quote and production-order ledgers.
-- Prices are operator-entered; no migration seeds prices and no customer quote is auto-invented.

create schema if not exists private;

create table if not exists private.production_quotes (
  quote_id uuid primary key default gen_random_uuid(),
  revision_id text not null,
  recipe_hash text not null,
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  line_items jsonb not null,
  subtotal numeric(12,2) not null check (subtotal>=0),
  adjustment numeric(12,2) not null default 0,
  total numeric(12,2) not null check (total>=0),
  note text not null default '',
  status text not null default 'draft' check (status in ('draft','sent','accepted','void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipe_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists private.production_quote_events (
  event_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references private.production_quotes(quote_id) on delete cascade,
  event_type text not null check (event_type in ('created','sent','accepted','void','note')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.production_orders (
  order_id uuid primary key default gen_random_uuid(),
  revision_id text not null,
  recipe_hash text not null,
  quote_id uuid references private.production_quotes(quote_id),
  status text not null default 'created' check (status in ('created','cloth_reserved','cutting','stitching','fitting','ready','delivered','cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipe_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists private.production_order_events (
  event_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.production_orders(order_id) on delete cascade,
  status text not null check (status in ('created','cloth_reserved','cutting','stitching','fitting','ready','delivered','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_quotes_revision_idx on private.production_quotes(revision_id,created_at desc);
create index if not exists production_quote_events_quote_idx on private.production_quote_events(quote_id,created_at);
create index if not exists production_orders_revision_idx on private.production_orders(revision_id,created_at desc);
create index if not exists production_order_events_order_idx on private.production_order_events(order_id,created_at);

alter table private.production_quotes enable row level security;
alter table private.production_quote_events enable row level security;
alter table private.production_orders enable row level security;
alter table private.production_order_events enable row level security;

revoke all on private.production_quotes from public,anon,authenticated;
revoke all on private.production_quote_events from public,anon,authenticated;
revoke all on private.production_orders from public,anon,authenticated;
revoke all on private.production_order_events from public,anon,authenticated;

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

  insert into private.production_quotes(
    revision_id,recipe_hash,currency,line_items,subtotal,adjustment,total,note
  ) values(
    left(trim(p_revision_id),220),lower(p_recipe_hash),upper(p_currency),p_line_items,
    round(v_subtotal,2),round(p_adjustment,2),round(v_total,2),left(coalesce(p_note,''),1000)
  )
  returning quote_id into v_quote;

  insert into private.production_quote_events(quote_id,event_type,payload)
  values(v_quote,'created',jsonb_build_object('total',round(v_total,2),'currency',upper(p_currency)));

  return v_quote;
end;
$$;

create or replace function public.production_quote_set_status(
  p_quote_id uuid,
  p_status text,
  p_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $
declare v_current text;
begin
  if p_status not in ('sent','accepted','void') then raise exception 'unsupported quote status'; end if;

  select status into v_current from private.production_quotes where quote_id=p_quote_id for update;
  if v_current is null then return false; end if;

  if not (
    (v_current='draft' and p_status in ('sent','void')) or
    (v_current='sent' and p_status in ('accepted','void'))
  ) then
    raise exception 'invalid quote transition from % to %',v_current,p_status;
  end if;

  update private.production_quotes
  set status=p_status,updated_at=now(),note=case when trim(coalesce(p_note,''))='' then note else left(p_note,1000) end
  where quote_id=p_quote_id;

  insert into private.production_quote_events(quote_id,event_type,payload)
  values(p_quote_id,p_status,jsonb_build_object('note',left(coalesce(p_note,''),1000),'from',v_current));
  return true;
end;
$;

create or replace function public.production_quote_list(p_limit integer default 100)
returns table(
  quote_id uuid,revision_id text,recipe_hash text,currency text,line_items jsonb,
  subtotal numeric,adjustment numeric,total numeric,note text,status text,created_at timestamptz,updated_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select q.quote_id,q.revision_id,q.recipe_hash,q.currency,q.line_items,q.subtotal,q.adjustment,q.total,q.note,q.status,q.created_at,q.updated_at
  from private.production_quotes q
  order by q.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
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
begin
  if coalesce(length(trim(p_revision_id)),0)<12 then raise exception 'locked revision id is required'; end if;
  if lower(coalesce(p_recipe_hash,'')) !~ '^[a-f0-9]{64}$' then raise exception 'invalid recipe hash'; end if;

  if p_quote_id is not null then
    select status,revision_id,recipe_hash into v_quote_status,v_quote_revision,v_quote_hash
    from private.production_quotes where quote_id=p_quote_id;
    if v_quote_status is null then raise exception 'unknown quote'; end if;
    if v_quote_status<>'accepted' then raise exception 'quote must be accepted before order creation'; end if;
    if v_quote_revision<>trim(p_revision_id) or v_quote_hash<>lower(p_recipe_hash) then raise exception 'quote does not match locked design'; end if;
  end if;

  insert into private.production_orders(revision_id,recipe_hash,quote_id,note)
  values(left(trim(p_revision_id),220),lower(p_recipe_hash),p_quote_id,left(coalesce(p_note,''),1000))
  returning order_id into v_order;

  insert into private.production_order_events(order_id,status,payload)
  values(v_order,'created',jsonb_build_object('note',left(coalesce(p_note,''),1000)));

  return v_order;
end;
$$;

create or replace function public.production_order_set_status(
  p_order_id uuid,
  p_status text,
  p_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $
declare v_current text;
begin
  if p_status not in ('cloth_reserved','cutting','stitching','fitting','ready','delivered','cancelled') then
    raise exception 'unsupported order status';
  end if;

  select status into v_current from private.production_orders where order_id=p_order_id for update;
  if v_current is null then return false; end if;

  if not (
    (v_current='created' and p_status in ('cloth_reserved','cancelled')) or
    (v_current='cloth_reserved' and p_status in ('cutting','cancelled')) or
    (v_current='cutting' and p_status in ('stitching','cancelled')) or
    (v_current='stitching' and p_status in ('fitting','ready','cancelled')) or
    (v_current='fitting' and p_status in ('stitching','ready','cancelled')) or
    (v_current='ready' and p_status in ('delivered','cancelled'))
  ) then
    raise exception 'invalid order transition from % to %',v_current,p_status;
  end if;

  update private.production_orders
  set status=p_status,updated_at=now(),note=case when trim(coalesce(p_note,''))='' then note else left(p_note,1000) end
  where order_id=p_order_id;

  insert into private.production_order_events(order_id,status,payload)
  values(p_order_id,p_status,jsonb_build_object('note',left(coalesce(p_note,''),1000),'from',v_current));
  return true;
end;
$;

create or replace function public.production_order_list(p_limit integer default 100)
returns table(
  order_id uuid,revision_id text,recipe_hash text,quote_id uuid,status text,note text,created_at timestamptz,updated_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select o.order_id,o.revision_id,o.recipe_hash,o.quote_id,o.status,o.note,o.created_at,o.updated_at
  from private.production_orders o
  order by o.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.production_quote_create(text,text,text,jsonb,numeric,text) from public,anon,authenticated;
revoke all on function public.production_quote_set_status(uuid,text,text) from public,anon,authenticated;
revoke all on function public.production_quote_list(integer) from public,anon,authenticated;
revoke all on function public.production_order_create(text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.production_order_set_status(uuid,text,text) from public,anon,authenticated;
revoke all on function public.production_order_list(integer) from public,anon,authenticated;

grant execute on function public.production_quote_create(text,text,text,jsonb,numeric,text) to service_role;
grant execute on function public.production_quote_set_status(uuid,text,text) to service_role;
grant execute on function public.production_quote_list(integer) to service_role;
grant execute on function public.production_order_create(text,text,uuid,text) to service_role;
grant execute on function public.production_order_set_status(uuid,text,text) to service_role;
grant execute on function public.production_order_list(integer) to service_role;
