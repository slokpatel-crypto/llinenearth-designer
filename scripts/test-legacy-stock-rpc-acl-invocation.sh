#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL ONLY. Invoke each retired RPC as the real service_role
# rather than relying exclusively on has_function_privilege metadata.
assert_denied() {
  local function_name="$1" invocation="$2" result status
  set +e
  result=$(psql -v ON_ERROR_STOP=1 2>&1 <<SQL
begin;
set role service_role;
select $invocation;
rollback;
SQL
)
  status=$?
  set -e
  if [[ "$status" -eq 0 || "$result" != *"permission denied for function $function_name"* ]]; then
    echo "FAIL: retired $function_name did not fail with expected EXECUTE denial" >&2
    echo "$result" >&2
    exit 1
  fi
}

assert_denied fabric_stock_record \
  "public.fabric_stock_record('SYNTHETIC-TITAN-ACL-PROBE','receipt',1.000,'synthetic')"
assert_denied fabric_stock_reserve \
  "public.fabric_stock_reserve('SYNTHETIC-TITAN-ACL-PROBE',1.000,'locked-revision-0001','request-key-00000001')"
assert_denied fabric_stock_release \
  "public.fabric_stock_release('00000000-0000-4000-8000-000000000001'::uuid,'synthetic')"
assert_denied fabric_stock_consume_reservation \
  "public.fabric_stock_consume_reservation('00000000-0000-4000-8000-000000000001'::uuid,1.000,'synthetic')"

# Positive control: a valid provenance-bearing v2 receipt is still permitted
# with service_role. Both the receipt and its transaction must roll back.
psql -v ON_ERROR_STOP=1 -At <<'SQL' | grep -qx PASS
begin;
set role service_role;
select case when public.fabric_stock_record_v2(
  'SYNTHETIC-TITAN-ACL-PROBE', 'receipt', 1.000, 'synthetic',
  'Synthetic stock checker', 'Synthetic physical receipt'
) is not null then 'PASS' else 'FAIL' end;
rollback;
SQL
psql -v ON_ERROR_STOP=1 -Atc \
  "select count(*) from private.fabric_stock_ledger where fabric_id='SYNTHETIC-TITAN-ACL-PROBE'" \
  | grep -qx 0

echo "PASS: four v1 RPCs rejected for service_role; valid v2 receipt rolled back"
