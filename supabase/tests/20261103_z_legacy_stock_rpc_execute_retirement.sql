-- Run in an isolated disposable PostgreSQL database after the v1/v2 migrations
-- and the forward-only legacy EXECUTE retirement migration.
-- This asserts *effective* privileges, including any inherited PUBLIC grants.
begin;
do $acl$
declare
  signature text;
  role_name text;
  legacy_signatures constant text[] := array[
    'public.fabric_stock_record(text,text,numeric,text)',
    'public.fabric_stock_reserve(text,numeric,text,text)',
    'public.fabric_stock_release(uuid,text)',
    'public.fabric_stock_consume_reservation(uuid,numeric,text)'
  ];
  v2_signatures constant text[] := array[
    'public.fabric_stock_record_v2(text,text,numeric,text,text,text)',
    'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)',
    'public.fabric_stock_release_v2(uuid,text,text,text)',
    'public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text)'
  ];
begin
  foreach signature in array legacy_signatures loop
    if to_regprocedure(signature) is null then
      raise exception 'historical v1 signature disappeared (schema compatibility): %', signature;
    end if;
    foreach role_name in array array['service_role','authenticated','anon'] loop
      if has_function_privilege(role_name, signature, 'EXECUTE') then
        raise exception 'unsafe effective v1 EXECUTE: role % can still invoke %',role_name,signature;
      end if;
    end loop;
  end loop;

  foreach signature in array v2_signatures loop
    if to_regprocedure(signature) is null then
      raise exception 'v2 stock RPC missing after migration: %',signature;
    end if;
    if not has_function_privilege('service_role', signature, 'EXECUTE') then
      raise exception 'v2 stock service_role RPC unexpectedly revoked: %',signature;
    end if;
    foreach role_name in array array['authenticated','anon'] loop
      if has_function_privilege(role_name, signature, 'EXECUTE') then
        raise exception 'unprivileged role % can execute v2 stock RPC %',role_name,signature;
      end if;
    end loop;
  end loop;
  if (select count(*) from private.fabric_stock_ledger) <> 0 then
    raise exception 'permission-only migration altered disposable stock ledger';
  end if;
end;
$acl$;
rollback;
select 'PASS: all four v1 stock mutators denied, v2 service_role grants retained' as result;
