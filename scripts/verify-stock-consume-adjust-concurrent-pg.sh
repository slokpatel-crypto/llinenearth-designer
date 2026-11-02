#!/usr/bin/env bash
# M60: independent PostgreSQL sessions, actual consumption and stock adjustment.
# No live database is ever permitted. All rows are unique synthetic test fixtures.
set -euo pipefail
if [[ "$PGDATABASE" != titan_synthetic || "$PGHOST" != 127.0.0.1 ||
      "$TITAN_SYNTHETIC_PG_TEST" != enabled ]]; then
  echo "M60 refuses non-local / non-synthetic database" >&2
  exit 1
fi

uuid="$(psql -X -At -v ON_ERROR_STOP=1 -c 'select gen_random_uuid();')"
fabric="SYNTHETIC-TITAN-M60-$uuid"
tmp="$(mktemp -d)"
first_pid=""
second_pid=""
cleanup(){
  if [[ -n "$first_pid" ]]; then kill "$first_pid" 2>/dev/null || true; wait "$first_pid" 2>/dev/null || true; fi
  if [[ -n "$second_pid" ]]; then kill "$second_pid" 2>/dev/null || true; wait "$second_pid" 2>/dev/null || true; fi
  psql -X -v ON_ERROR_STOP=1 -c     "delete from private.fabric_stock_ledger where fabric_id='$fabric';" >/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

psql -X -v ON_ERROR_STOP=1 -Atc   "select public.fabric_stock_record_v3('$fabric','receipt',3.000,
   'synthetic stock consumption race','Synthetic checker',
   'Synthetic roll counted','SYNTH-M60-RECEIPT-$uuid');" > "$tmp/receipt"
reservation="$(psql -X -v ON_ERROR_STOP=1 -Atc   "select public.fabric_stock_reserve_v2('$fabric',2.000,
   'LE-LOCK-SYNTH-M60-$uuid','SYNTH-M60-RESERVE-$uuid',
   'Synthetic tailor','Approved synthetic cutting sheet');")"
[[ "$reservation" =~ ^[0-9a-f-]{36}$ ]] || { echo "M60 invalid reservation" >&2; exit 1; }

# Session A holds the fabric advisory lock after consuming 1.000m and releasing
# the other 1.000m of reserved cloth. A concurrent 1.500m adjustment must WAIT
# until the new available balance (2.000m) is visible, then safely proceed.
PGAPPNAME=titan_m60_consume_first psql -X -At -v ON_ERROR_STOP=1   -c 'begin;'   -c "select public.fabric_stock_consume_reservation_v2('$reservation'::uuid,
       1.000,'Synthetic actual cutting usage','Synthetic tailor',
       'Signed synthetic cutting card');"   -c 'select pg_sleep(5);' -c 'commit;'   > "$tmp/consume" 2>"$tmp/consume.err" &
first_pid=$!

sleeping=0
for _ in $(seq 1 80); do
  active="$(psql -X -At -v ON_ERROR_STOP=1 -c     "select count(*) from pg_stat_activity
     where application_name='titan_m60_consume_first'
       and state='active' and query like 'select pg_sleep(5)%';")"
  if [[ "$active" == 1 ]]; then sleeping=1; break; fi
  sleep .1
done
[[ "$sleeping" == 1 ]] || {
  echo "M60 consume did not hold its transaction open" >&2
  cat "$tmp/consume.err" >&2 || true
  exit 1
}

PGAPPNAME=titan_m60_adjust_second psql -X -At -v ON_ERROR_STOP=1   -c "select public.fabric_stock_record_v3('$fabric','adjustment_out',1.500,
      'Synthetic post-cut reconciliation','Synthetic checker',
      'Synthetic physical shelf count','SYNTH-M60-ADJUST-$uuid');"   > "$tmp/adjust" 2>"$tmp/adjust.err" &
second_pid=$!

blocked=0
for _ in $(seq 1 30); do
  waiting="$(psql -X -At -v ON_ERROR_STOP=1 -c     "select count(*) from pg_stat_activity
     where application_name='titan_m60_adjust_second'
       and wait_event_type='Lock';")"
  if [[ "$waiting" == 1 ]]; then blocked=1; break; fi
  sleep .1
done
[[ "$blocked" == 1 ]] || {
  echo "M60 adjustment was not observed waiting on the consuming fabric lock" >&2
  cat "$tmp/adjust.err" >&2 || true
  exit 1
}

wait "$first_pid"; first_pid=""
grep -qx t "$tmp/consume" || {
  echo "M60 actual stock consumption failed to return true" >&2
  cat "$tmp/consume" >&2 || true
  exit 1
}
wait "$second_pid"; second_pid=""
[[ "$(grep -Ec '^[0-9a-f-]{36}$' "$tmp/adjust")" == 1 ]] || {
  echo "M60 adjustment did not return an event UUID" >&2; exit 1;
}

snapshot="$(psql -X -At -v ON_ERROR_STOP=1 -c   "select case when physical_metres=0.500
                   and reserved_metres=0
                   and available_metres=0.500
    then 'PASS' else 'FAIL' end
   from public.fabric_stock_snapshot_v2(array['$fabric']);")"
[[ "$snapshot" == PASS ]] || { echo "M60 post-cut ledger balances wrong" >&2; exit 1; }
events="$(psql -X -At -v ON_ERROR_STOP=1 -c   "select count(*) from private.fabric_stock_ledger where fabric_id='$fabric';")"
[[ "$events" == 5 ]] || {
  echo "M60 expected receipt+reserve+consume+release+adjust, got $events" >&2
  exit 1
}

# The remaining 0.500m must not be overdrawn by a later stock adjustment.
if psql -X -At -v ON_ERROR_STOP=1 -c   "select public.fabric_stock_record_v3('$fabric','adjustment_out',0.501,
    'Synthetic overdraw probe','Synthetic checker',
    'Synthetic rejected count','SYNTH-M60-OVERDRAW-$uuid');"   > "$tmp/overdraw" 2>"$tmp/overdraw.err"; then
  echo "M60 invalid adjustment was allowed to exceed post-cut availability" >&2
  exit 1
fi
grep -q "adjustment exceeds available stock" "$tmp/overdraw.err" || {
  cat "$tmp/overdraw.err" >&2
  exit 1
}
echo "TITAN M60 PASS: consume and adjust serialized on fabric lock; 0.500m unreserved stock remains."
