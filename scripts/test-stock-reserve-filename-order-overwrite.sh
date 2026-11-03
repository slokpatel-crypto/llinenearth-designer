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

# Return test instance to intended curated state, including the final strict
# body. Re-test rejection after restoration. This is only local test replay.
psql -v ON_ERROR_STOP=1 -f \
  supabase/migrations/20261103_stock_reservation_identity_length_gate.sql

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
end $probe$;
reset role;
rollback;
select case when (select count(*) from private.fabric_stock_ledger) = 0
  then 'PASS' else 'FAIL' end as zero_persisted_synthetic_rows;
SQL

test "$(psql -v ON_ERROR_STOP=1 -Atc 'select count(*) from private.fabric_stock_ledger')" = 0
echo 'PASS: filename-order overwrite admits truncated key, replayed strict gate restores rejection; zero rows'
