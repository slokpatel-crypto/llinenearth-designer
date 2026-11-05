#!/usr/bin/env bash
set -euo pipefail
# Runs ONLY on a disposable PostgreSQL test instance. No credentials, remote DB
# or customer data. Demonstrates why duplicate-version filename order is unsafe.
# Historical curated CI has strict identity gate last; prove that current
# filesystem order can overwrite it with a lossy provenance-only function.

psql -v ON_ERROR_STOP=1 <<'SQL'
begin;
set role service_role;
do $probe$
declare
  rejected boolean := false;
begin
  begin
    perform public.fabric_stock_reserve_v2(
      'SYNTHETIC-TITAN-ORDER-PROBE', 1.000, 'locked-revision-0001',
      repeat('k', 181), 'Synthetic stock checker', 'Synthetic physical receipt');
  exception when others then
    if sqlerrm not like '%reservation identity or evidence exceeds supported length%' then
      raise exception 'unexpected strict reservation failure: %', sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then raise exception 'strict reserve gate did not reject oversized request key'; end if;
end $probe$;
reset role;
rollback;
SQL

# This later-alphabetical same-version SQL is a CREATE OR REPLACE of the
# identical six-parameter reserve RPC. It silently left(...,180) truncates.
psql -v ON_ERROR_STOP=1 -f \
  supabase/migrations/20261103_stock_reservation_provenance_gate.sql

psql -v ON_ERROR_STOP=1 <<'SQL'
begin;
set role service_role;
do $probe$
declare v_reservation uuid;
begin
  perform public.fabric_stock_record_v2(
    'SYNTHETIC-TITAN-ORDER-PROBE', 'receipt', 2.000,
    'synthetic receipt for migration order test',
    'Synthetic stock checker', 'Synthetic physical receipt');
  v_reservation := public.fabric_stock_reserve_v2(
    'SYNTHETIC-TITAN-ORDER-PROBE', 1.000, 'locked-revision-0001',
    repeat('k', 181), 'Synthetic stock checker', 'Synthetic physical receipt');
  if v_reservation is null then
    raise exception 'expected lossy reserve to succeed in disposable test';
  end if;
end $probe$;
reset role;
do $probe$
begin
  if (select count(*) from private.fabric_stock_ledger
      where fabric_id = 'SYNTHETIC-TITAN-ORDER-PROBE'
        and event_type = 'reserve'
        and request_key = repeat('k', 180)) <> 1 then
    raise exception 'unsafe later migration failed to exhibit silent key truncation';
  end if;
end $probe$;
rollback;
SQL

# Replay the actual forward-only 14-digit-timestamp repair from PR #900
# after the unsafe historical same-version override. Never run against live DB.
psql -v ON_ERROR_STOP=1 -f \
  supabase/migrations/20261104134500_restore_stock_reservation_identity_gate.sql

psql -v ON_ERROR_STOP=1 <<'SQL'
begin;
set role service_role;
do $probe$
declare rejected boolean := false;
begin
  begin
    perform public.fabric_stock_reserve_v2(
      'SYNTHETIC-TITAN-ORDER-PROBE', 1.000, 'locked-revision-0001',
      repeat('k', 181), 'Synthetic stock checker', 'Synthetic physical receipt');
  exception when others then
    if sqlerrm not like '%reservation identity or evidence exceeds supported length%' then
      raise exception 'failed to restore strict identity behavior: %', sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then raise exception 'strict reserve gate not restored'; end if;

  -- Use synthetic evidenced stock to verify that the *actual forward repair*
  -- preserves idempotency and exact request-payload binding, not only length.
  perform public.fabric_stock_record_v2(
    'SYNTHETIC-TITAN-ORDER-PROBE', 'receipt', 2.000,
    'synthetic receipt for forward repair test',
    'Synthetic stock checker', 'Synthetic physical receipt');
  <<replay_probe>>
  declare
    original uuid;
    replayed uuid;
  begin
    original := public.fabric_stock_reserve_v2(
      'SYNTHETIC-TITAN-ORDER-PROBE', 1.000, 'locked-revision-0001',
      'SYNTHETIC-FORWARD-REPLAY-0001', 'Synthetic stock checker',
      'Synthetic physical receipt');
    replayed := public.fabric_stock_reserve_v2(
      'SYNTHETIC-TITAN-ORDER-PROBE', 1.000, 'locked-revision-0001',
      'SYNTHETIC-FORWARD-REPLAY-0001', 'Synthetic stock checker',
      'Synthetic physical receipt');
    if original is null or original is distinct from replayed then
      raise exception 'forward repair lost exact idempotent replay identity';
    end if;
    begin
      perform public.fabric_stock_reserve_v2(
        'SYNTHETIC-TITAN-ORDER-PROBE', 1.125, 'locked-revision-0001',
        'SYNTHETIC-FORWARD-REPLAY-0001', 'Synthetic stock checker',
        'Synthetic physical receipt');
      raise exception 'mismatched idempotency payload unexpectedly accepted';
    exception when sqlstate '22023' then null;
    end;
  end replay_probe;
end $probe$;
-- service_role correctly has no SELECT on private ledger. Perform this single
-- synthetic row-count assertion after RESET ROLE, in the same transaction.
reset role;
do $verify$
begin
  if (select count(*) from private.fabric_stock_ledger
      where request_key='SYNTHETIC-FORWARD-REPLAY-0001')<>1 then
    raise exception 'forward repair inserted duplicate reservation';
  end if;
end $verify$;
rollback;
select case when (select count(*) from private.fabric_stock_ledger) = 0
  then 'PASS' else 'FAIL' end as zero_persisted_synthetic_rows;
SQL

test "$(psql -v ON_ERROR_STOP=1 -Atc 'select count(*) from private.fabric_stock_ledger')" = 0
echo 'PASS: historical override admits truncated key; forward-only repair restores strict rejection, replay binding and zero synthetic rows'
