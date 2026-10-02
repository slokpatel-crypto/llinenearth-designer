-- Harden physical stock evidence with named provenance.
-- Legacy stock rows remain part of the numeric ledger, but a fabric is not
-- considered provenance-ready while any physical receipt/adjustment lacks a checker/reference.

alter table private.fabric_stock_ledger
  add column if not exists recorded_by text not null default '',
  add column if not exists source_reference text not null default '';

create or replace function public.fabric_stock_record_v2(
  p_fabric_id text,
  p_event_type text,
  p_quantity_metres numeric,
  p_note text default '',
  p_recorded_by text default '',
  p_source_reference text default ''
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
  if coalesce(length(trim(p_recorded_by)),0)<2 then raise exception 'named stock checker or recorder is required'; end if;
  if coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'physical stock source reference is required'; end if;

  perform pg_advisory_xact_lock(hashtext(left(trim(p_fabric_id),160)));

  if p_event_type='adjustment_out' then
    select coalesce(s.available_metres,0) into v_available
    from public.fabric_stock_snapshot(array[left(trim(p_fabric_id),160)]) s
    limit 1;
    if coalesce(v_available,0)<p_quantity_metres then raise exception 'adjustment exceeds available stock'; end if;
  end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,note,recorded_by,source_reference
  ) values(
    left(trim(p_fabric_id),160),p_event_type,round(p_quantity_metres,3),left(trim(coalesce(p_note,'')),600),
    left(trim(p_recorded_by),120),left(trim(p_source_reference),240)
  ) returning event_id into v_id;
  return v_id;
end;
$$;

create or replace function public.fabric_stock_snapshot_v2(p_fabric_ids text[] default null)
returns table(
  fabric_id text,
  physical_metres numeric,
  reserved_metres numeric,
  available_metres numeric,
  manual_event_count bigint,
  provenance_event_count bigint,
  legacy_unverified_event_count bigint,
  provenance_ready boolean,
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
      when l.event_type in ('release','consume') then -l.quantity_metres
      else 0
    end),0) as reserved_metres,
    coalesce(sum(case
      when l.event_type in ('receipt','adjustment_in','release') then l.quantity_metres
      when l.event_type in ('adjustment_out','reserve') then -l.quantity_metres
      else 0
    end),0) as available_metres,
    count(*) filter (where l.event_type in ('receipt','adjustment_in','adjustment_out')) as manual_event_count,
    count(*) filter (where l.event_type in ('receipt','adjustment_in','adjustment_out')
      and length(trim(l.recorded_by))>=2 and length(trim(l.source_reference))>=3) as provenance_event_count,
    count(*) filter (where l.event_type in ('receipt','adjustment_in','adjustment_out')
      and (length(trim(l.recorded_by))<2 or length(trim(l.source_reference))<3)) as legacy_unverified_event_count,
    count(*) filter (where l.event_type in ('receipt','adjustment_in','adjustment_out'))>0
      and count(*) filter (where l.event_type in ('receipt','adjustment_in','adjustment_out')
        and (length(trim(l.recorded_by))<2 or length(trim(l.source_reference))<3))=0 as provenance_ready,
    max(l.created_at) as last_event_at
  from private.fabric_stock_ledger l
  where p_fabric_ids is null or l.fabric_id=any(p_fabric_ids)
  group by l.fabric_id
  order by l.fabric_id;
$$;

revoke all on function public.fabric_stock_record_v2(text,text,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.fabric_stock_snapshot_v2(text[]) from public,anon,authenticated;
grant execute on function public.fabric_stock_record_v2(text,text,numeric,text,text,text) to service_role;
grant execute on function public.fabric_stock_snapshot_v2(text[]) to service_role;
