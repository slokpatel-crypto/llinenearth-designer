#!/usr/bin/env bash
# M62: an aborted writer must release its request-key lock and durable identity.
# Test actual simultaneous PostgreSQL transactions; synthetic localhost only.
set -euo pipefail
[[ "${PGDATABASE:-}" == titan_synthetic &&
   "${PGHOST:-}" == 127.0.0.1 &&
   "${TITAN_SYNTHETIC_PG_TEST:-}" == enabled ]] || {
  echo "M62 refuses databases other than opt-in localhost titan_synthetic" >&2
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

run_aborted_writer(){
  local mode="$1"
  local uuid fabric key sql first_app second_app
  local asleep=0 blocked=0 expected_rows expected_physical expected_reserved
  uuid="$(psql -X -At -v ON_ERROR_STOP=1 -c 'select gen_random_uuid();')"
  fabric="SYNTHETIC-TITAN-M62-$uuid"
  key="SYNTH-M62-$mode-$uuid"
  fixtures+=("$fabric")
  if [[ "$mode" == reserve ]]; then
    psql -X -At -v ON_ERROR_STOP=1 -c \
      "select public.fabric_stock_record_v3('$fabric','receipt',3.000,
       'synthetic precondition receipt','Synthetic checker',
       'Synthetic calibration roll','SYNTH-M62-RECEIPT-$uuid');" \
      >"$tmp/seed-$mode"
    sql="select public.fabric_stock_reserve_v2(
      '$fabric',1.125,'LE-LOCK-SYNTH-M62-$uuid',
      '$key','Synthetic tailor','Synthetic signed cutting sheet');"
    expected_rows=2
    expected_physical=3
    expected_reserved=1.125
  else
    sql="select public.fabric_stock_record_v3(
      '$fabric','receipt',1.125,'synthetic aborted write',
      'Synthetic checker','Synthetic physical roll','$key');"
    expected_rows=1
    expected_physical=1.125
    expected_reserved=0
  fi
  first_app="titan_m62_""$mode""_first"
  second_app="titan_m62_""$mode""_second"

  # Session A obtains request-key lock and creates a tentative ledger row.
  # It then sleeps while holding the transaction, and ROLLS BACK.
  PGAPPNAME="$first_app" psql -X -At -v ON_ERROR_STOP=1 \
    -c 'begin;' -c "$sql" -c 'select pg_sleep(5);' -c 'rollback;' \
    >"$tmp/first-$mode" 2>"$tmp/first-$mode.err" &
  first_pid=$!
  for _ in $(seq 1 80); do
    local in_sleep
    in_sleep="$(psql -X -At -v ON_ERROR_STOP=1 -c \
      "select count(*) from pg_stat_activity
       where application_name='$first_app'
       and state='active' and query like 'select pg_sleep(5)%';")"
    if [[ "$in_sleep" == 1 ]]; then asleep=1; break; fi
    sleep .1
  done
  [[ "$asleep" == 1 ]] || {
    echo "M62 $mode: first write did not hold its uncommitted row" >&2
    cat "$tmp/first-$mode.err" >&2 || true
    return 1
  }

  # Session B uses the SAME request key and EXACT evidence. It must block
  # until session A aborts, then INSERT fresh (no phantom first key).
  PGAPPNAME="$second_app" psql -X -At -v ON_ERROR_STOP=1 \
    -c "$sql" >"$tmp/second-$mode" 2>"$tmp/second-$mode.err" &
  second_pid=$!
  for _ in $(seq 1 30); do
    local lockwait
    lockwait="$(psql -X -At -v ON_ERROR_STOP=1 -c \
      "select count(*) from pg_stat_activity
       where application_name='$second_app' and wait_event_type='Lock';")"
    if [[ "$lockwait" == 1 ]]; then blocked=1; break; fi
    sleep .1
  done
  [[ "$blocked" == 1 ]] || {
    echo "M62 $mode: retry did not wait on aborted writer's request-key lock" >&2
    cat "$tmp/second-$mode.err" >&2 || true
    return 1
  }

  wait "$first_pid"; first_pid=""
  wait "$second_pid"; second_pid=""
  local tentative committed retry
  tentative="$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    "$tmp/first-$mode" | head -n 1)"
  committed="$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    "$tmp/second-$mode" | head -n 1)"
  [[ -n "$tentative" && -n "$committed" && "$tentative" != "$committed" ]] || {
    echo "M62 $mode: retry did not insert a new durable event/reservation UUID" >&2
    return 1
  }
  retry="$(psql -X -At -v ON_ERROR_STOP=1 -c "$sql")"
  [[ "$retry" == "$committed" ]] || {
    echo "M62 $mode: replay after retry commit did not return stable UUID" >&2
    return 1
  }
  local state
  state="$(psql -X -At -v ON_ERROR_STOP=1 -c \
    "select case when physical_metres=$expected_physical
       and reserved_metres=$expected_reserved
       and available_metres=($expected_physical-$expected_reserved)
       and (select count(*) from private.fabric_stock_ledger
            where fabric_id='$fabric')=$expected_rows
       and (select count(*) from private.fabric_stock_ledger
            where request_key='$key')=1
       then 'PASS' else 'FAIL' end
       from public.fabric_stock_snapshot_v2(array['$fabric']);")"
  [[ "$state" == PASS ]] || {
    echo "M62 $mode: rollback/retry led to wrong physical balances or multiple request-key rows" >&2
    return 1
  }
  echo "TITAN M62 PASS: $mode aborted first writer, waiting retry committed once, subsequent retry replayed."
}
run_aborted_writer record
run_aborted_writer reserve
echo "TITAN M62 PASS: rollback of both manual receipt and reservation preserves key recovery."
