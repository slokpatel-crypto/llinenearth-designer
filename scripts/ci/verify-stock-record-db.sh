#!/usr/bin/env bash
# Run ONLY against the ephemeral PostgreSQL container supplied by Actions.
# No Supabase credentials, service-role keys or production endpoints accepted.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "Refusing stock fixture writes outside disposable GitHub Actions." >&2
  exit 2
fi
container="${1:-}"
if [[ -z "$container" ]]; then
  echo "An ephemeral GitHub Actions PostgreSQL container ID is required." >&2
  exit 2
fi
# Both variants run exclusively inside the same ephemeral Actions container:
# fixture tests standalone SQL; historical loads the REAL stock migration chain
# into a separate disposable database, including the legacy production schema.
mode="${2:-fixture}"
case "$mode" in
  fixture) database=postgres ;;
  historical)
    database=titan_stock_historical
    docker exec "$container" createdb -U postgres "$database"
    ;;
  *) echo "Unknown stock DB verification mode." >&2; exit 2 ;;
esac
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

run_sql_file() {
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" < "$1"
}
query() {
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$1"
}

if [[ "$mode" == "fixture" ]]; then
  run_sql_file scripts/ci/stock-record-db-setup.sql
  run_sql_file supabase/migrations/20261031_stock_record_exact_retry.sql
else
  # Exact chronological stock-only migration dependency chain. The original
  # ledger, legacy RPCs, provenance and reservation/consumption close functions
  # all exist before the v3 event RPC is installed. No fabricated ledger schema.
  for migration in \
    supabase/migrations/20261001_fabric_stock_ledger.sql \
    supabase/migrations/20261028_fabric_stock_provenance.sql \
    supabase/migrations/20261029_stock_reservation_provenance.sql \
    supabase/migrations/20261030_stock_consumption_provenance.sql \
    supabase/migrations/20261031_stock_reservation_concurrency_provenance.sql \
    supabase/migrations/20261031_stock_record_exact_retry.sql \
    supabase/migrations/20261031_stock_reservation_exact_key_evidence.sql \
    supabase/migrations/20261031_stock_reservation_line_dedupe.sql
  do
    if [[ "$migration" == "supabase/migrations/20261031_stock_reservation_line_dedupe.sql" ]]; then
      # The old schema MUST be audited BEFORE the new unique index installs.
      # Seed only artificial data in this disposable CI database, prove that
      # aggregates find it and the real migration refuses existing duplicates.
      run_sql_file scripts/ci/stock-reservation-source-audit-fixture.sql
      audit_before=$(docker exec -i "$container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database" < scripts/ci/stock-reservation-source-audit.sql | tr -d '\r\n')
      if [[ "$audit_before" != "5|1|2|1|1|1|1|1|1|1" ]]; then
        echo "Read-only stock audit missed synthetic legacy source anomalies: $audit_before" >&2
        exit 1
      fi
      if docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" < "$migration" > "$tmpdir/preflight.out" 2>&1; then
        echo "Migration incorrectly installed over historic duplicate physical lines." >&2
        exit 1
      fi
      if ! grep -q 'existing duplicate meterage reservation lines require owner reconciliation' "$tmpdir/preflight.out"; then
        echo "Migration blocked without its explicit owner-reconciliation veto." >&2
        cat "$tmpdir/preflight.out" >&2
        exit 1
      fi
      if [[ $(query "select to_regclass('private.fabric_stock_reserve_source_line_uidx') is null") != "t" ]]; then
        echo "Rejected migration partially installed the unique source-line index." >&2
        exit 1
      fi
      # Fixture cleanup ONLY in this fresh disposable CI database. NEVER
      # delete or rewrite actual supplier/operator ledger rows.
      query "delete from private.fabric_stock_ledger where fabric_id='ci-audit-fabric'" >/dev/null
      audit_after=$(docker exec -i "$container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database" < scripts/ci/stock-reservation-source-audit.sql | tr -d '\r\n')
      if [[ "$audit_after" != "0|0|0|0|0|0|0|0|0|0" ]]; then
        echo "Source audit did not return to clean after removal of CI-only fixtures: $audit_after" >&2
        exit 1
      fi
      echo "Read-only legacy source audit detected synthetic conflicts; preflight refused them; cleaned disposable fixtures only."
    fi
    run_sql_file "$migration"
  done
fi
# Both paths share exactly the same real transaction and concurrency tests.
run_sql_file scripts/ci/stock-record-db-assertions.sql
if [[ "$mode" == "historical" ]]; then
  run_sql_file scripts/ci/stock-record-historical-assertions.sql
  run_sql_file scripts/ci/stock-reservation-exact-key-assertions.sql
  run_sql_file scripts/ci/stock-reservation-line-dedupe-assertions.sql
fi

# Two separate Postgres sessions attempt exactly the same physical receipt.
# Both must receive the same committed event ID and the ledger must have one row.
same_call="select public.fabric_stock_record_v3('fabric-par','receipt',3.000,'','Checker One','ROLL-PAR','concurrency-key-0001');"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$same_call" > "$tmpdir/same1.out" 2> "$tmpdir/same1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$same_call" > "$tmpdir/same2.out" 2> "$tmpdir/same2.err" &
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
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$call_a" > "$tmpdir/adj1.out" 2> "$tmpdir/adj1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$call_b" > "$tmpdir/adj2.out" 2> "$tmpdir/adj2.err" &
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
if [[ "$mode" == "historical" ]]; then
  # Real separate sessions with the same key but opposing order evidence:
  # exactly one may commit. The other must fail with the provenance veto.
  query "select public.fabric_stock_record_v3('fabric-reserve-race-a','receipt',5.000,'','Checker One','ROLL-RACE-A','reserve-race-record-a');" >/dev/null
  query "select public.fabric_stock_record_v3('fabric-reserve-race-b','receipt',5.000,'','Checker One','ROLL-RACE-B','reserve-race-record-b');" >/dev/null
  reserve_a="select public.fabric_stock_reserve_v2('fabric-reserve-race-a',2.000,'locked-revision-race-a','reserve-race-shared-0001','Checker One','METERAGE-RACE-A');"
  reserve_b="select public.fabric_stock_reserve_v2('fabric-reserve-race-b',3.000,'locked-revision-race-b','reserve-race-shared-0001','Checker Two','METERAGE-RACE-B');"
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$reserve_a" > "$tmpdir/res1.out" 2> "$tmpdir/res1.err" &
  pid1=$!
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$reserve_b" > "$tmpdir/res2.out" 2> "$tmpdir/res2.err" &
  pid2=$!
  set +e
  wait "$pid1"; status1=$?
  wait "$pid2"; status2=$?
  set -e
  if ! { [[ $status1 -eq 0 && $status2 -ne 0 ]] || [[ $status1 -ne 0 && $status2 -eq 0 ]]; }; then
    echo "Conflicting same-key reservations did not serialize to one winner." >&2
    cat "$tmpdir/res1.err" "$tmpdir/res2.err" >&2
    exit 1
  fi
  if ! grep -q 'stock reservation request key belongs to different evidence' "$tmpdir/res1.err" "$tmpdir/res2.err"; then
    echo "Losing reservation did not fail its exact-evidence veto." >&2
    exit 1
  fi
  if [[ $(query "select count(*) from private.fabric_stock_ledger where request_key='reserve-race-shared-0001' and event_type='reserve'") != "1" ]]; then
    echo "Two conflicting physical reservations committed against one key." >&2
    exit 1
  fi
fi
if [[ "$mode" == "historical" ]]; then
  # One source line, two distinct random request keys, two SQL sessions.
  # A common meterage worksheet for another order remains valid, but this
  # SAME order line may be claimed only once under the natural unique key.
  query "select public.fabric_stock_record_v3('fabric-line-race','receipt',5.000,'','Checker One','ROLL-LINE-RACE','line-race-receipt-0001');" >/dev/null
  line_a="select public.fabric_stock_reserve_v2('fabric-line-race',2.000,'locked-line-race-20261031','different-key-line-a-0001','Checker One','SHEET-LINE-RACE-001');"
  line_b="select public.fabric_stock_reserve_v2('fabric-line-race',2.000,'locked-line-race-20261031','different-key-line-b-0001','Checker One','sheet-line-race-001');"
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$line_a" > "$tmpdir/line1.out" 2> "$tmpdir/line1.err" &
  pid1=$!
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" -Atc "$line_b" > "$tmpdir/line2.out" 2> "$tmpdir/line2.err" &
  pid2=$!
  set +e
  wait "$pid1"; status1=$?
  wait "$pid2"; status2=$?
  set -e
  if ! { [[ $status1 -eq 0 && $status2 -ne 0 ]] || [[ $status1 -ne 0 && $status2 -eq 0 ]]; }; then
    echo "Concurrent different-key same-line reservations must have one winner." >&2
    cat "$tmpdir/line1.err" "$tmpdir/line2.err" >&2
    exit 1
  fi
  if ! grep -q "meterage source line already reserved for locked design and fabric" "$tmpdir/line1.err" "$tmpdir/line2.err"; then
    echo "The losing same-line reservation did not fail with the documented source veto." >&2
    exit 1
  fi
  if [[ $(query "select count(*) from private.fabric_stock_ledger where event_type='reserve' and fabric_id='fabric-line-race' and revision_id='locked-line-race-20261031'") != "1" ]]; then
    echo "Concurrent different-key calls double-reserved one source line." >&2
    exit 1
  fi
fi
echo "Disposable PostgreSQL ($mode) stock idempotency, conflict and concurrency PASS."
