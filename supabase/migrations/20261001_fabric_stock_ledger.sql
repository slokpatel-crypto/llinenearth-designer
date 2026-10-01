-- Append-only Linen Earth fabric stock ledger and reservation primitives.
-- No opening balances are invented by migration; operator must record physically verified metres.

create schema if not exists private;

create table if not exists private.fabric_stock_ledger (
  event_id uuid primary key default gen_random_uuid(),
  fabric_id text not null,
  event_type text not null check (event_type in ('receipt','adjustment_in','adjustment_out','reserve','release','consume')),
  quantity_metres numeric(10,3) not null check (quantity_metres>0 and quantity_metres<=100000),
  reservation_id uuid,
  revision_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists fabric_stock_ledger_fabric_idx
  on private.fabric_stock_ledger(fabric_id,created_at,event_id);
create index if not exists fabric_stock_ledger_reservation_idx
  on private.fabric_stock_ledger(reservation_id,created_at)
  where reservation_id is not null;

alter table private.fabric_stock_ledger enable row level security;
revoke all on private.fabric_stock_ledger from public,anon,authenticated;

create or replace function public.fabric_stock_snapshot(p_fabric_ids text[] default null)
returns table(
  fabric_id text,
  physical_metres numeric,
  reserved_metres numeric,
  available_metres numeric,
  last_event_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select
    l.fabric_id,
    coalesce(sum(case
      when l.event_type in ('receipt','adjustment_in') then l.quantity_metres
      when l.event_type in ('adjustment_out','consume') then -l.quantity_metres
      else 0
    end),0) as physical_metres,
    coalesce(sum(case
      when l.event_type='reserve' then l.quantity_metres
      when l.event_type='release' then -l.quantity_metres
      else 0
    end),0) as reserved_metres,
    coalesce(sum(case
      when l.event_type in ('receipt','adjustment_in','release') then l.quantity_metres
      when l.event_type in ('adjustment_out','consume','reserve') then -l.quantity_metres
      else 0
    end),0) as available_metres,
    max(l.created_at) as last_event_at
  from private.fabric_stock_ledger l
  where p_fabric_ids is null or l.fabric_id=any(p_fabric_ids)
  group by l.fabric_id
  order by l.fabric_id;
$$;

create or replace function public.fabric_stock_record(
  p_fabric_id text,
  p_event_type text,
  p_quantity_metres numeric,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_available numeric:=0;
begin
  if coalesce(length(trim(p_fabric_id)),0)=0 then raise exception 'fabric id is required'; end if;
  if p_event_type not in ('receipt','adjustment_in','adjustment_out') then raise exception 'unsupported manual stock event'; end if;
  if p_quantity_metres is null or p_quantity_metres<=0 or p_quantity_metres>100000 then raise exception 'invalid quantity'; end if;

  perform pg_advisory_xact_lock(hashtext(left(trim(p_fabric_id),160)));

  if p_event_type='adjustment_out' then
    select coalesce(s.available_metres,0) into v_available
    from public.fabric_stock_snapshot(array[left(trim(p_fabric_id),160)]) s
    limit 1;
    if coalesce(v_available,0)<p_quantity_metres then raise exception 'adjustment exceeds available stock'; end if;
  end if;

  insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres,note)
  values(left(trim(p_fabric_id),160),p_event_type,round(p_quantity_metres,3),left(coalesce(p_note,''),600))
  returning event_id into v_id;
  return v_id;
end;
$$;

create or replace function public.fabric_stock_reserve(
  p_fabric_id text,
  p_quantity_metres numeric,
  p_revision_id text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_available numeric:=0;
  v_reservation uuid:=gen_random_uuid();
begin
  if coalesce(length(trim(p_fabric_id)),0)=0 then raise exception 'fabric id is required'; end if;
  if p_quantity_metres is null or p_quantity_metres<=0 or p_quantity_metres>100 then raise exception 'invalid reservation quantity'; end if;
  if coalesce(length(trim(p_revision_id)),0)<12 then raise exception 'locked revision id is required'; end if;

  perform pg_advisory_xact_lock(hashtext(left(trim(p_fabric_id),160)));

  select coalesce(s.available_metres,0) into v_available
  from public.fabric_stock_snapshot(array[left(trim(p_fabric_id),160)]) s
  limit 1;

  if coalesce(v_available,0)<p_quantity_metres then raise exception 'insufficient available stock'; end if;

  insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres,reservation_id,revision_id,note)
  values(left(trim(p_fabric_id),160),'reserve',round(p_quantity_metres,3),v_reservation,left(trim(p_revision_id),220),'locked design reservation');

  return v_reservation;
end;
$$;

create or replace function public.fabric_stock_release(
  p_reservation_id uuid,
  p_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_fabric text;
  v_revision text;
  v_reserved numeric:=0;
  v_released numeric:=0;
  v_consumed numeric:=0;
  v_remaining numeric:=0;
begin
  select max(fabric_id),max(revision_id),
    coalesce(sum(case when event_type='reserve' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='release' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='consume' then quantity_metres else 0 end),0)
  into v_fabric,v_revision,v_reserved,v_released,v_consumed
  from private.fabric_stock_ledger
  where reservation_id=p_reservation_id;

  v_remaining=v_reserved-v_released-v_consumed;
  if v_fabric is null or v_remaining<=0 then return false; end if;

  insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres,reservation_id,revision_id,note)
  values(v_fabric,'release',v_remaining,p_reservation_id,v_revision,left(coalesce(p_note,'reservation released'),600));
  return true;
end;
$$;

create or replace function public.fabric_stock_consume_reservation(
  p_reservation_id uuid,
  p_actual_metres numeric,
  p_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_fabric text;
  v_revision text;
  v_reserved numeric:=0;
  v_released numeric:=0;
  v_consumed numeric:=0;
  v_remaining numeric:=0;
  v_physical numeric:=0;
begin
  if p_actual_metres is null or p_actual_metres<=0 or p_actual_metres>100 then raise exception 'invalid actual usage'; end if;

  select max(fabric_id),max(revision_id),
    coalesce(sum(case when event_type='reserve' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='release' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='consume' then quantity_metres else 0 end),0)
  into v_fabric,v_revision,v_reserved,v_released,v_consumed
  from private.fabric_stock_ledger
  where reservation_id=p_reservation_id;

  v_remaining=v_reserved-v_released-v_consumed;
  if v_fabric is null or v_remaining<=0 then return false; end if;
  if p_actual_metres>v_remaining then raise exception 'actual usage exceeds reserved metres'; end if;

  perform pg_advisory_xact_lock(hashtext(v_fabric));

  select coalesce(s.physical_metres,0) into v_physical
  from public.fabric_stock_snapshot(array[v_fabric]) s limit 1;

  if coalesce(v_physical,0)<p_actual_metres then raise exception 'actual usage exceeds physical stock'; end if;

  insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres,reservation_id,revision_id,note)
  values(v_fabric,'consume',round(p_actual_metres,3),p_reservation_id,v_revision,left(coalesce(p_note,'reservation consumed'),600));

  if v_remaining>p_actual_metres then
    insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres,reservation_id,revision_id,note)
    values(v_fabric,'release',round(v_remaining-p_actual_metres,3),p_reservation_id,v_revision,'unused reserved metres released');
  end if;

  return true;
end;
$$;

revoke all on function public.fabric_stock_snapshot(text[]) from public,anon,authenticated;
revoke all on function public.fabric_stock_record(text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.fabric_stock_reserve(text,numeric,text) from public,anon,authenticated;
revoke all on function public.fabric_stock_release(uuid,text) from public,anon,authenticated;
revoke all on function public.fabric_stock_consume_reservation(uuid,numeric,text) from public,anon,authenticated;

grant execute on function public.fabric_stock_snapshot(text[]) to service_role;
grant execute on function public.fabric_stock_record(text,text,numeric,text) to service_role;
grant execute on function public.fabric_stock_reserve(text,numeric,text) to service_role;
grant execute on function public.fabric_stock_release(uuid,text) to service_role;
grant execute on function public.fabric_stock_consume_reservation(uuid,numeric,text) to service_role;
