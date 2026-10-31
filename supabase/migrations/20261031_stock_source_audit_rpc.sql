-- DRAFT ONLY: read-only, aggregate-only operator stock migration preflight.
-- Install after the historical provenance/ledger migrations with explicit
-- owner approval. Never run live SQL or inventory corrections from draft CI.
-- No source reference, physical SKU, human name, order ID, or event UUID
-- is returned to the browser. This is NOT physical source certification.
create or replace function public.fabric_stock_source_audit_v1()
returns jsonb
language sql
stable
security definer
set search_path='public','private'
as $$
with reservations as (
  select fabric_id,revision_id,
    lower(btrim(coalesce(source_reference,''))) as source_key,
    source_reference,recorded_by,request_key,reservation_id
  from private.fabric_stock_ledger
  where event_type='reserve'
),
duplicate_lines as (
  select count(*)::bigint as n from reservations
  where revision_id is not null and btrim(revision_id)<>''
    and source_key<>''
  group by fabric_id,revision_id,source_key
  having count(*)>1
),
counts as (
  select
    count(*)::bigint as reservation_rows,
    count(*) filter (where revision_id is null or btrim(revision_id)='')::bigint as missing_locked_revision,
    count(*) filter (where source_key='')::bigint as missing_source,
    count(*) filter (where length(btrim(coalesce(recorded_by,'')))<2)::bigint as missing_checker,
    count(*) filter (where request_key is null or btrim(request_key)='')::bigint as missing_request_key,
    count(*) filter (where reservation_id is null)::bigint as missing_reservation_uuid,
    count(*) filter (where coalesce(source_reference,'')<>btrim(coalesce(source_reference,'')))::bigint as padded_source,
    count(*) filter (where source_key in (
      'unknown','tbd','pending','n/a','na','none','sheet','approved','test'
    ))::bigint as placeholder_source
  from reservations
)
select jsonb_build_object(
  'reservationRows',counts.reservation_rows,
  'duplicateLineGroups',(select count(*) from duplicate_lines),
  'duplicateLineRows',coalesce((select sum(n) from duplicate_lines),0),
  'missingLockedRevision',counts.missing_locked_revision,
  'missingSource',counts.missing_source,
  'missingChecker',counts.missing_checker,
  'missingRequestKey',counts.missing_request_key,
  'missingReservationUuid',counts.missing_reservation_uuid,
  'paddedSource',counts.padded_source,
  'placeholderSource',counts.placeholder_source
) from counts;
$$;

revoke all on function public.fabric_stock_source_audit_v1()
  from public,anon,authenticated;
grant execute on function public.fabric_stock_source_audit_v1()
  to service_role;
