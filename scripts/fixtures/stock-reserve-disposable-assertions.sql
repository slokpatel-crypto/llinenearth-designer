-- Executed only against the disposable PostgreSQL CI service.
do $$
declare
  first_id uuid;
  replay_id uuid;
  count_rows integer;
begin
  first_id := public.fabric_stock_reserve_v2('disposable-test-fabric', 1.250,
    'disposable-locked-revision', 'disposable-request-key-0001',
    'disposable-operator', 'disposable-evidence-001');
  replay_id := public.fabric_stock_reserve_v2('disposable-test-fabric', 1.250,
    'disposable-locked-revision', 'disposable-request-key-0001',
    'disposable-operator', 'disposable-evidence-001');
  if first_id is null or first_id is distinct from replay_id then
    raise exception 'idempotent replay changed reservation identity';
  end if;
  select count(*) into count_rows from private.fabric_stock_ledger
    where request_key='disposable-request-key-0001';
  if count_rows <> 1 then raise exception 'replay inserted duplicate ledger rows'; end if;
  begin
    perform public.fabric_stock_reserve_v2('disposable-test-fabric', 2.000,
      'disposable-locked-revision', 'disposable-request-key-0001',
      'disposable-operator', 'disposable-evidence-001');
    raise exception 'mismatched replay unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.fabric_stock_reserve_v2('disposable-test-fabric', 1.000,
      'disposable-locked-revision', repeat('x',181),
      'disposable-operator', 'disposable-evidence-001');
    raise exception 'oversized identity unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.fabric_stock_reserve_v2('unverified-fabric', 1.000,
      'disposable-locked-revision', 'disposable-request-key-0002',
      'disposable-operator', 'disposable-evidence-001');
    raise exception 'unverified fabric unexpectedly reserved';
  exception when sqlstate '22023' then null;
  end;
end $$;
do $$
begin
  if has_function_privilege('anon',
      'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)', 'EXECUTE')
    or not has_function_privilege('service_role',
      'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)', 'EXECUTE')
  then raise exception 'reservation RPC ACL violation'; end if;
end $$;
