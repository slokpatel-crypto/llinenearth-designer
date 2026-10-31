#!/usr/bin/env bash
# Run ONLY against the ephemeral PostgreSQL container supplied by Actions.
# No Supabase credentials, service-role keys or production endpoints accepted.
set -euo pipefail
container="$1"
if [[ -z "$container" ]]; then
  echo "An ephemeral GitHub Actions PostgreSQL container ID is required." >&2
  exit 2
fi
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

run_sql_file() {
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1"
}
query() {
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc "$1"
}

run_sql_file scripts/ci/stock-record-db-setup.sql
# Execute the SAME actual migration committed for a future owner-reviewed
# rollout, not a separately reimplemented fake idempotency function.
run_sql_file supabase/migrations/20261031_stock_record_exact_retry.sql
run_sql_file scripts/ci/stock-record-db-assertions.sql

# Two separate Postgres sessions attempt exactly the same physical receipt.
# Both must receive the same committed event ID and the ledger must have one row.
same_call="select public.fabric_stock_record_v3('fabric-par','receipt',3.000,'','Checker One','ROLL-PAR','concurrency-key-0001');"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc "$same_call" > "$tmpdir/same1.out" 2> "$tmpdir/same1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc "$same_call" > "$tmpdir/same2.out" 2> "$tmpdir/same2.err" &
pid2=$!
wait "$pid1"
wait "$pid2"
first_id=$(tr -d '\r\n' < "$tmpdir/same1.out")
second_id=$(tr -d '\r\n' < "$tmpdir/same2.out")
if [[ -z "$first_id" || "$first_id" != "$second_id" ]]; then
  echo "Concurrent same-key physical receipts did not return one UUID." >&2
  exit 1
fi
if [[ $(query "select count(*) from private.fabric_stock_ledger where request_key='concurrency-key-0001'") != "1" ]]; then
  echo "Concurrent retry inserted a duplicate physical stock row." >&2
  exit 1
fi

# Two distinct adjustments race to remove 2m each from only 3m available.
# The shared fabric lock must prevent the pair from overdrawing to -1m.
call_a="select public.fabric_stock_record_v3('fabric-par','adjustment_out',2.000,'','Checker One','ADJUST-A','concurrency-key-0002');"
call_b="select public.fabric_stock_record_v3('fabric-par','adjustment_out',2.000,'','Checker One','ADJUST-B','concurrency-key-0003');"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc "$call_a" > "$tmpdir/adj1.out" 2> "$tmpdir/adj1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc "$call_b" > "$tmpdir/adj2.out" 2> "$tmpdir/adj2.err" &
pid2=$!
set +e
wait "$pid1"; status1=$?
wait "$pid2"; status2=$?
set -e
if ! { [[ $status1 -eq 0 && $status2 -ne 0 ]] || [[ $status1 -ne 0 && $status2 -eq 0 ]]; }; then
  echo "Concurrent overdraw must allow exactly one adjustment." >&2
  cat "$tmpdir/adj1.err" "$tmpdir/adj2.err" >&2
  exit 1
fi
if ! grep -q "adjustment exceeds available unreserved fabric" "$tmpdir/adj1.err" "$tmpdir/adj2.err"; then
  echo "The losing adjustment did not fail with the stock-availability veto." >&2
  exit 1
fi
if [[ $(query "select count(*) from private.fabric_stock_ledger where fabric_id='fabric-par' and event_type='adjustment_out'") != "1" ]]; then
  echo "Concurrent adjustment overdraw inserted multiple stock rows." >&2
  exit 1
fi
if [[ $(query "select available_metres from public.fabric_stock_snapshot_v2(array['fabric-par'])") != "1.000" ]]; then
  echo "Concurrent adjustment left incorrect available metres." >&2
  exit 1
fi
echo "Disposable PostgreSQL physical-stock idempotency, conflict and concurrency PASS."
