-- Disposable PostgreSQL only: the actual service-role JSONB audit RPC must
-- match the same aggregate-only ten counters as the owner SQL script.
do $aggregate_audit$
declare
  v jsonb;
  expected jsonb:='{
    "reservationRows":5,
    "duplicateLineGroups":1,
    "duplicateLineRows":2,
    "missingLockedRevision":1,
    "missingSource":1,
    "missingChecker":1,
    "missingRequestKey":1,
    "missingReservationUuid":1,
    "paddedSource":1,
    "placeholderSource":1
  }'::jsonb;
begin
  v:=public.fabric_stock_source_audit_v1();
  if v is distinct from expected then
    raise exception 'privacy-safe operator source RPC mismatches historical aggregate audit';
  end if;
  if has_function_privilege('anon','public.fabric_stock_source_audit_v1()','EXECUTE')
     or has_function_privilege('authenticated','public.fabric_stock_source_audit_v1()','EXECUTE')
     or not has_function_privilege('service_role','public.fabric_stock_source_audit_v1()','EXECUTE')
  then
    raise exception 'source audit RPC grants permit non-service-role access';
  end if;
  if exists(select 1 from jsonb_object_keys(v) key
    where key not in (
      'reservationRows','duplicateLineGroups','duplicateLineRows',
      'missingLockedRevision','missingSource','missingChecker',
      'missingRequestKey','missingReservationUuid','paddedSource',
      'placeholderSource'
    )) then
    raise exception 'source audit RPC leaked unapproved stock fields';
  end if;
end;
$aggregate_audit$;
