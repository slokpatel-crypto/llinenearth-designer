-- TITAN M69 SOURCE ONLY: privileged read-only schema readiness attestation.
-- Deploy to APPROVED ISOLATED STAGING only after v2 and v3 stock migrations.
-- It reads pg_catalog metadata, never customer/roll stock ledger rows.
-- A web server flag alone is never evidence that the underlying migration
-- exists or that the reservation request-key body has been upgraded.
create or replace function public.fabric_stock_write_ready_v1()
returns boolean
language sql stable security definer
set search_path='pg_catalog','public','private'
as $$
with expected(name,signature) as (
  values
    ('record_v3','public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)'),
    ('reserve_v2','public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)'),
    ('release_v2','public.fabric_stock_release_v2(uuid,text,text,text)'),
    ('consume_v2','public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text)'),
    ('snapshot_v2','public.fabric_stock_snapshot_v2(text[])')
), source as (
  select e.name,to_regprocedure(e.signature) as oid
  from expected e
), checked as (
  select s.name,s.oid,p.prosecdef,
    -- Merely having a search_path setting is insufficient: a later
    -- ALTER FUNCTION could include pg_temp or an untrusted schema while
    -- preserving SECURITY DEFINER and all the normal role grants.
    -- Accept only the paths used by the reviewed v2/v3 stock functions.
    -- Preserve quotes and quoted whitespace: "pub lic" is not public.
    coalesce(exists(select 1 from unnest(p.proconfig) c
      where split_part(c,'=',1)='search_path'
        and split_part(c,'=',2) ~ '^[[:space:]]*(public|"public")([[:space:]]*,[[:space:]]*(private|"private"))?[[:space:]]*$'),false) as fixed_path,
    coalesce(has_function_privilege('service_role',s.oid,'EXECUTE'),false) as service_ok,
    coalesce(has_function_privilege('anon',s.oid,'EXECUTE'),false) as anon_ok,
    coalesce(has_function_privilege('authenticated',s.oid,'EXECUTE'),false) as auth_ok,
    lower(pg_get_functiondef(s.oid)) as body
  from source s left join pg_proc p on p.oid=s.oid
)
select coalesce(bool_and(
  oid is not null and coalesce(prosecdef,false) and fixed_path
  and service_ok and not anon_ok and not auth_ok
  and case name
    when 'reserve_v2' then coalesce(
      position('v_existing.event_type is distinct from ''reserve''' in body)>0 and
      position('v_existing.reservation_id is null' in body)>0 and
      position('v_existing.fabric_id is distinct from v_fabric' in body)>0 and
      position('v_existing.quantity_metres is distinct from p_quantity_metres' in body)>0 and
      position('v_existing.revision_id is distinct from v_revision' in body)>0 and
      position('v_existing.recorded_by is distinct from v_requester' in body)>0 and
      position('v_existing.source_reference is distinct from v_source' in body)>0 and
      position('pg_advisory_xact_lock(hashtext(''stock-request:''||v_key))' in body)>0,
      false)
    when 'record_v3' then coalesce(
      position('v_existing.event_type is distinct from p_event_type' in body)>0 and
      position('v_existing.fabric_id is distinct from v_fabric' in body)>0 and
      position('v_existing.quantity_metres is distinct from p_quantity_metres' in body)>0 and
      position('v_existing.note is distinct from v_note' in body)>0 and
      position('v_existing.recorded_by is distinct from v_checker' in body)>0 and
      position('v_existing.source_reference is distinct from v_source' in body)>0 and
      position('v_existing.reservation_id is not null' in body)>0 and
      position('v_existing.revision_id is not null' in body)>0 and
      position('pg_advisory_xact_lock(hashtext(''stock-request:''||v_key))' in body)>0,
      false)
    else true
  end
),false) and to_regclass('private.fabric_stock_ledger') is not null
from checked;
$$;

revoke all on function public.fabric_stock_write_ready_v1() from public,anon,authenticated;
grant execute on function public.fabric_stock_write_ready_v1() to service_role;
