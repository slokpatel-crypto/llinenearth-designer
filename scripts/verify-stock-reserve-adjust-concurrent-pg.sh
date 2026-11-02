#!/usr/bin/env bash
# TITAN M50: real overlapping reservation versus physical stock adjustment.
# Strictly disposable PostgreSQL: verifies shared fabric locks prevent oversell.
set -euo pipefail

[[ "${PGDATABASE:-}" == "titan_synthetic" &&
   "${PGHOST:-}" == "127.0.0.1" &&
   "${TITAN_SYNTHETIC_PG_TEST:-}" == "enabled" ]] || {
  echo "M50 refuses anything except opted-in localhost titan_synthetic" >&2
  exit 1
}

uuid="$(psql -X -At -v ON_ERROR_STOP=1 -c 'select gen_random_uuid();')"
fabric="SYNTHETIC-TITAN-M50-${uuid}"
receipt_key="SYNTHETIC-M50-RECEIPT-${uuid}"
reserve_key="SYNTHETIC-M50-RESERVE-${uuid}"
adjust_key="SYNTHETIC-M50-ADJUST-${uuid}"
tmp="$(mktemp -d)"
first_pid=""
second_pid=""
cleanup() {
  if [[ -n "$first_pid" ]]; then kill "$first_pid" 2>/dev/null || true; fi
  if [[ -n "$second_pid" ]]; then kill "$second_pid" 2>/dev/null || true; fi
  if [[ -n "$first_pid" ]]; then wait "$first_pid" 2>/dev/null || true; fi
  if [[ -n "$second_pid" ]]; then wait "$second_pid" 2>/dev/null || true; fi
  # Only the UUID-scoped synthetic fabric touched by this script.
  psql -X -v ON_ERROR_STOP=1 -c \
    "delete from private.fabric_stock_ledger where fabric_id='${fabric}';" >/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

psql -X -At -v ON_ERROR_STOP=1 -c \
  "select public.fabric_stock_record_v3('${fabric}','receipt',3.000,
   'synthetic race test','Synthetic checker','Synthetic roll receipt','${receipt_key}');" \
  >"$tmp/receipt"

# Hold a reservation transaction open after a successful 2.000m reservation.
# A concurrent distinct-key 2.000m adjustment_out MUST block on the same
# per-fabric advisory lock until the reservation commits, then fail because
# only 1.000m is available. Key-level idempotency alone cannot enforce this.
reserve="select public.fabric_stock_reserve_v2(
  '${fabric}',2.000,'LE-LOCK-SYNTHETIC-M50-${uuid}',
  '${reserve_key}','Synthetic checker','Synthetic approved cutting sheet');"
PGAPPNAME=titan_m50_reserve_first psql -X -At -v ON_ERROR_STOP=1 \
  -c 'begin;' -c "$reserve" -c 'select pg_sleep(5);' -c 'commit;' \
  >"$tmp/reserve" 2>"$tmp/reserve.err" &
first_pid=$!

in_transaction=0
for _ in $(seq 1 80); do
  active="$(psql -X -At -v ON_ERROR_STOP=1 -c \
    "select count(*) from pg_stat_activity
     where application_name='titan_m50_reserve_first'
     and state='active' and query like 'select pg_sleep(5)%';")"
  if [[ "$active" == 1 ]]; then in_transaction=1; break; fi
  sleep 0.1
done
if [[ "$in_transaction" != 1 ]]; then
  cat "$tmp/reserve.err" >&2 || true
  echo "M50 reservation did not reach locked sleep" >&2
  exit 1
fi

adjust="select public.fabric_stock_record_v3(
  '${fabric}','adjustment_out',2.000,'synthetic race test',
  'Synthetic checker','Synthetic stock count','${adjust_key}');"
PGAPPNAME=titan_m50_adjust_second psql -X -At -v ON_ERROR_STOP=1 \
  -c "$adjust" >"$tmp/adjust" 2>"$tmp/adjust.err" &
second_pid=$!

was_blocked=0
for _ in $(seq 1 30); do
  waiting="$(psql -X -At -v ON_ERROR_STOP=1 -c \
    "select count(*) from pg_stat_activity
     where application_name='titan_m50_adjust_second'
     and wait_event_type='Lock';")"
  if [[ "$waiting" == 1 ]]; then was_blocked=1; break; fi
  sleep 0.1
done
[[ "$was_blocked" == 1 ]] || {
  echo "M50 expected adjustment to wait on same fabric lock" >&2
  cat "$tmp/adjust.err" >&2 || true
  exit 1
}

wait "$first_pid"
first_pid=""
if wait "$second_pid"; then
  echo "M50 unsafe: adjustment was incorrectly accepted after reservation" >&2
  exit 1
fi
second_pid=""
grep -q "adjustment exceeds available stock" "$tmp/adjust.err" || {
  cat "$tmp/adjust.err" >&2
  echo "M50 expected insufficient available stock rejection" >&2
  exit 1
}

balances_ok="$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "select case when physical_metres=3.000 and reserved_metres=2.000
               and available_metres=1.000 then 'PASS' else 'FAIL' end
   from public.fabric_stock_snapshot_v2(array['${fabric}']);")"
count="$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from private.fabric_stock_ledger where fabric_id='${fabric}';")"
[[ "$balances_ok" == PASS ]] || {
  echo "M50 unexpected stock balances after simultaneous adjustment and reservation" >&2
  exit 1
}
[[ "$count" == 2 ]] || {
  echo "M50 expected just receipt + reservation, got $count events" >&2
  exit 1
}
echo "TITAN M50 PASS: distinct-key adjustment waited for reservation, then rejected; 3m physical, 2m reserved, 1m available."
