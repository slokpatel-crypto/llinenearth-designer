-- DRAFT ONLY: owner must approve physical source-line standards, inspect
-- legacy anomalies, rehearse rollback and authorize migration separately.
-- A real receipt source_reference MUST identify the exact documented roll /
-- supplier delivery LINE, not a generic invoice/sheet, invented suffix or
-- user-generated retry key. A single supplier sheet can contain multiple
-- genuine lines; different fabrics may reference the same sheet/line.
-- No migration is applied merely by opening this PR.
--
-- Reject existing duplicate documented receipt lines without deleting,
-- rewriting, or silently choosing between historical physical quantities.
do $receipt_audit$
begin
  if exists (
    select 1 from private.fabric_stock_ledger
    where event_type='receipt' and btrim(coalesce(source_reference,''))<>''
    group by fabric_id,lower(btrim(source_reference))
    having count(*)>1
  ) then
    raise exception 'existing duplicate physical receipt source lines require owner reconciliation';
  end if;
end;
$receipt_audit$;

-- Final database defense, including direct ledger writes bypassing the RPC.
-- Null/blank legacy sources remain UNVERIFIED, never certified as physical.
create unique index if not exists fabric_stock_receipt_source_line_uidx
  on private.fabric_stock_ledger (
    fabric_id,(lower(btrim(source_reference)))
  ) where event_type='receipt' and btrim(coalesce(source_reference,''))<>'';

-- Keep original RPC signature, same request-key/fabric lock ordering,
-- same exact-evidence retry, available-stock veto and service-role grants.

-- DRAFT ONLY: must be reviewed, installed and verified before the API can
-- use this RPC. No migration is executed by opening the GitHub PR.
-- A network timeout after a committed physical stock receipt must never
-- mint another receipt when the operator retries the exact same request.
--
-- Existing ledger request_key has a partial unique index from 20261001.
-- This new function locks keys in the SAME order as stock reserve v2,
-- checks the whole original record on key reuse, and locks the matching
-- fabric before checking for a safe removal from available stock.

create or replace function public.fabric_stock_record_v3(
  p_fabric_id text,
  p_event_type text,
  p_quantity_metres numeric,
  p_note text,
  p_recorded_by text,
  p_source_reference text,
  p_request_key text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_existing record;
  v_id uuid;
  v_available numeric:=0;
begin
  -- Never silently trim/truncate an immutable stock identity or exact
  -- request key; it would make different signed source records collide.
  if p_fabric_id is null or length(p_fabric_id)<1 or length(p_fabric_id)>160
     or p_fabric_id<>btrim(p_fabric_id) then
    raise exception 'invalid stock fabric id';
  end if;
  if p_request_key is null or length(p_request_key)<12 or length(p_request_key)>180
     or p_request_key<>btrim(p_request_key) then
    raise exception 'invalid stock request key';
  end if;
  if p_event_type is null or p_event_type not in ('receipt','adjustment_in','adjustment_out') then
    raise exception 'unsupported manual stock event';
  end if;
  if p_quantity_metres is null or p_quantity_metres<0.001 or p_quantity_metres>100000
     or p_quantity_metres<>round(p_quantity_metres,3) then
    raise exception 'invalid physical stock quantity precision';
  end if;
  if p_recorded_by is null or length(btrim(p_recorded_by))<2
     or length(p_recorded_by)>120 then
    raise exception 'invalid named stock checker';
  end if;
  if p_source_reference is null or length(btrim(p_source_reference))<3
     or length(p_source_reference)>240 then
    raise exception 'invalid physical stock source reference';
  end if;
  if p_note is null or length(p_note)>600 then
    raise exception 'invalid physical stock note';
  end if;

  -- Same namespace as fabric_stock_reserve_v2, so a reused request key
  -- can NEVER be adopted by a different kind of stock action.
  perform pg_advisory_xact_lock(hashtext('stock-request:'||p_request_key));
  select l.event_id,l.fabric_id,l.event_type,l.quantity_metres,
         l.note,l.recorded_by,l.source_reference,l.reservation_id
    into v_existing
    from private.fabric_stock_ledger l
   where l.request_key=p_request_key
   limit 1;
  if found then
    if v_existing.reservation_id is not null
       or v_existing.fabric_id<>p_fabric_id
       or v_existing.event_type<>p_event_type
       or v_existing.quantity_metres<>p_quantity_metres
       or v_existing.note<>p_note
       or v_existing.recorded_by<>p_recorded_by
       or v_existing.source_reference<>p_source_reference then
      raise exception 'stock request key already belongs to different evidence';
    end if;
    return v_existing.event_id;
  end if;

  -- Use the SAME fabric-level namespace as reserve_v2 and consumption_v2,
  -- rather than the old v2 manual-event lock on bare fabric ID.
  perform pg_advisory_xact_lock(hashtext('stock-fabric:'||p_fabric_id));
  -- A retry with the SAME key returned above; a different key must never
  -- book the same documented physical receipt line again. Fabric lock
  -- serializes concurrent tabs/devices before checking the natural identity.
  if p_event_type='receipt' and exists (
    select 1 from private.fabric_stock_ledger l
     where l.event_type='receipt' and l.fabric_id=p_fabric_id
       and lower(btrim(l.source_reference))=lower(btrim(p_source_reference))
  ) then
    raise exception 'physical receipt source line already recorded for fabric';
  end if;
  if p_event_type='adjustment_out' then
    select coalesce(s.available_metres,0) into v_available
      from public.fabric_stock_snapshot_v2(array[p_fabric_id]) s
     limit 1;
    if coalesce(v_available,0)<p_quantity_metres then
      raise exception 'adjustment exceeds available unreserved fabric';
    end if;
  end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,note,recorded_by,source_reference,request_key
  ) values (
    p_fabric_id,p_event_type,p_quantity_metres,p_note,
    p_recorded_by,p_source_reference,p_request_key
  ) returning event_id into v_id;
  return v_id;
end;
$$;

revoke all on function public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)
  to service_role;
