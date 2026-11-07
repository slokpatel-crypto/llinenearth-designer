#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/assert-disposable-stock-acl-db.sh"
# Disposable PostgreSQL ONLY. Invoke each retired RPC as the real service_role
# rather than relying exclusively on has_function_privilege metadata.
assert_denied() {
  local role="$1" function_name="$2" invocation="$3" result status
  set +e
  result=$(psql -v ON_ERROR_STOP=1 2>&1 <<SQL
begin;
set role $role;
select $invocation;
rollback;
SQL
)
  status=$?
  set -e
  if [[ "$status" -eq 0 || "$result" != *"permission denied for function $function_name"* ]]; then
    echo "FAIL: retired $function_name for $role did not fail with expected EXECUTE denial" >&2
    echo "$result" >&2
    exit 1
  fi
}

for role in anon authenticated service_role; do
  assert_denied "$role" fabric_stock_record \
    "public.fabric_stock_record('SYNTHETIC-TITAN-ACL-PROBE','receipt',1.000,'synthetic')"
  assert_denied "$role" fabric_stock_reserve \
    "public.fabric_stock_reserve('SYNTHETIC-TITAN-ACL-PROBE',1.000,'locked-revision-0001','request-key-00000001')"
  assert_denied "$role" fabric_stock_release \
    "public.fabric_stock_release('00000000-0000-4000-8000-000000000001'::uuid,'synthetic')"
  assert_denied "$role" fabric_stock_consume_reservation \
    "public.fabric_stock_consume_reservation('00000000-0000-4000-8000-000000000001'::uuid,1.000,'synthetic')"
done

# Positive controls: exercise the full authorized v2 lifecycle using only
# synthetic stock. The entire sequence rolls back, including its receipt.
psql -v ON_ERROR_STOP=1 -At <<'SQL' | grep -qx PASS
begin;
set role service_role;
do $probe$
declare
  consumed_id uuid;
  released_id uuid;
begin
  perform public.fabric_stock_record_v2(
    'SYNTHETIC-TITAN-ACL-PROBE', 'receipt', 3.000, 'synthetic',
    'Synthetic stock checker', 'Synthetic physical receipt'
  );
  consumed_id := public.fabric_stock_reserve_v2(
    'SYNTHETIC-TITAN-ACL-PROBE', 1.000,
    'synthetic-locked-revision-0001', 'synthetic-request-consume-0001',
    'Synthetic checker', 'Synthetic reservation evidence'
  );
  if consumed_id is null or not public.fabric_stock_consume_reservation_v2(
    consumed_id, 1.000, 'synthetic', 'Synthetic checker', 'Synthetic usage evidence'
  ) then
    raise exception 'authorized v2 consume path failed';
  end if;
  released_id := public.fabric_stock_reserve_v2(
    'SYNTHETIC-TITAN-ACL-PROBE', 1.000,
    'synthetic-locked-revision-0002', 'synthetic-request-release-0002',
    'Synthetic checker', 'Synthetic reservation evidence'
  );
  if released_id is null or not public.fabric_stock_release_v2(
    released_id, 'synthetic', 'Synthetic checker', 'Synthetic release evidence'
  ) then
    raise exception 'authorized v2 release path failed';
  end if;
end;
$probe$;
rollback;
select 'PASS';
SQL
psql -v ON_ERROR_STOP=1 -Atc \
  "select count(*) from private.fabric_stock_ledger where fabric_id='SYNTHETIC-TITAN-ACL-PROBE'" \
  | grep -qx 0

echo "PASS: four v1 RPCs denied for three roles; all four authorized v2 lifecycle methods exercised and rolled back"
