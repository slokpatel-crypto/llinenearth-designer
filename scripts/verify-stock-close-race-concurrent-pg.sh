#!/usr/bin/env bash
# TITAN M61: consume versus release on the same reservation, both commit orders.
# Real independent PostgreSQL sessions, synthetic-only database.
set -euo pipefail
[[ "${PGDATABASE:-}" == titan_synthetic &&
   "${PGHOST:-}" == 127.0.0.1 &&
   "${TITAN_SYNTHETIC_PG_TEST:-}" == enabled ]] || {
  echo "M61 refuses non-local or non-synthetic database" >&2
  exit 1
}
tmp="$(mktemp -d)"
first_pid=""
second_pid=""
fixtures=()
cleanup(){
  for pid in "$first_pid" "$second_pid"; do
    if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  done
  for fabric in "${fixtures[@]}"; do
    psql -X -v ON_ERROR_STOP=1 -c \
      "delete from private.fabric_stock_ledger where fabric_id='$fabric';" >/dev/null || true
  done
  rm -rf "$tmp"
}
trap cleanup EXIT

run_race(){
  local winner="$1"
  local id fabric reservation first_sql second_sql primary_app secondary_app
  local waiting=0 asleep=0 expected_physical expected_events
  id="$(psql -X -At -v ON_ERROR_STOP=1 -c 'select gen_random_uuid();')"
  fabric="SYNTHETIC-TITAN-M61-$id"
  fixtures+=("$fabric")
  psql -X -At -v ON_ERROR_STOP=1 -c \
    "select public.fabric_stock_record_v3('$fabric','receipt',3.000,
     'synthetic close-race receipt','Synthetic stock checker',
     'Synthetic counted roll','SYNTH-M61-RECEIPT-$id');" >"$tmp/receipt-$winner"
  reservation="$(psql -X -At -v ON_ERROR_STOP=1 -c \
    "select public.fabric_stock_reserve_v2('$fabric',2.000,
     'LE-LOCK-SYNTHETIC-M61-$id','SYNTH-M61-RESERVE-$id',
     'Synthetic tailor','Synthetic approved cutting card');")"
  [[ "$reservation" =~ ^[0-9a-f-]{36}$ ]] || { echo "M61 invalid reservation UUID" >&2; return 1; }
  local consume_sql release_sql
  consume_sql="select public.fabric_stock_consume_reservation_v2(
    '$reservation'::uuid,1.000,'Actual synthetic cutting usage',
    'Synthetic tailor','Synthetic signed cutting card');"
  release_sql="select public.fabric_stock_release_v2(
    '$reservation'::uuid,'Synthetic cancelled cutting sheet',
    'Synthetic checker','Synthetic signed cancellation');"
  if [[ "$winner" == consume ]]; then
    first_sql="$consume_sql"; second_sql="$release_sql"
    expected_physical="2.000"; expected_events=4
  else
    first_sql="$release_sql"; second_sql="$consume_sql"
    expected_physical="3.000"; expected_events=3
  fi
  primary_app="titan_m61_"$winner"_first"
  secondary_app="titan_m61_"$winner"_second"
  PGAPPNAME="$primary_app" psql -X -At -v ON_ERROR_STOP=1 \
    -c 'begin;' -c "$first_sql" -c 'select pg_sleep(5);' -c 'commit;' \
    >"$tmp/first-$winner" 2>"$tmp/first-$winner.err" &
  first_pid=$!

  for _ in $(seq 1 80); do
    local active
    active="$(psql -X -At -v ON_ERROR_STOP=1 -c \
      "select count(*) from pg_stat_activity
       where application_name='$primary_app'
       and state='active' and query like 'select pg_sleep(5)%';")"
    if [[ "$active" == 1 ]]; then asleep=1; break; fi
    sleep .1
  done
  [[ "$asleep" == 1 ]] || {
    echo "M61 $winner: first closure did not hold transaction" >&2
    cat "$tmp/first-$winner.err" >&2 || true
    return 1
  }
  PGAPPNAME="$secondary_app" psql -X -At -v ON_ERROR_STOP=1 \
    -c "$second_sql" >"$tmp/second-$winner" 2>"$tmp/second-$winner.err" &
  second_pid=$!
  for _ in $(seq 1 30); do
    local blocked
    blocked="$(psql -X -At -v ON_ERROR_STOP=1 -c \
      "select count(*) from pg_stat_activity
       where application_name='$secondary_app' and wait_event_type='Lock';")"
    if [[ "$blocked" == 1 ]]; then waiting=1; break; fi
    sleep .1
  done
  [[ "$waiting" == 1 ]] || {
    echo "M61 $winner: conflicting close did not wait on reservation lock" >&2
    cat "$tmp/second-$winner.err" >&2 || true
    return 1
  }

  wait "$first_pid"; first_pid=""
  wait "$second_pid"; second_pid=""
  grep -qx t "$tmp/first-$winner" || {
    echo "M61 $winner: winning closure did not return true" >&2
    cat "$tmp/first-$winner" >&2
    return 1
  }
  grep -qx f "$tmp/second-$winner" || {
    echo "M61 $winner: losing closure must return false" >&2
    cat "$tmp/second-$winner" >&2
    return 1
  }
  local result
  result="$(psql -X -At -v ON_ERROR_STOP=1 -c \
    "select case when s.physical_metres=$expected_physical
                      and s.reserved_metres=0
                      and s.available_metres=$expected_physical
                      and (select count(*) from private.fabric_stock_ledger
                           where fabric_id='$fabric')=$expected_events
            then 'PASS' else 'FAIL' end
     from public.fabric_stock_snapshot_v2(array['$fabric']) s;")"
  [[ "$result" == PASS ]] || {
    echo "M61 $winner: double-close altered stock or created extra events" >&2
    return 1
  }
  echo "TITAN M61 PASS: $winner wins, competing close waits and rejects."
}
run_race consume
run_race release
echo "TITAN M61 PASS: both closure commit orders preserve physical stock."
