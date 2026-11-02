#!/usr/bin/env bash
# Disposable PostgreSQL-only native concurrency acceptance for manual physical
# stock. Never connect this script to a live DB or use real roll references.
set -euo pipefail

[[ "${PGDATABASE:-}" == "titan_synthetic" ]] || {
  echo "Refusing stock concurrency test outside disposable titan_synthetic DB" >&2
  exit 1
}
[[ "${PGHOST:-}" == "127.0.0.1" ]] || {
  echo "Refusing stock concurrency test without localhost PostgreSQL" >&2
  exit 1
}
[[ "${TITAN_SYNTHETIC_PG_TEST:-}" == "enabled" ]] || {
  echo "Explicit synthetic test opt-in required" >&2
  exit 1
}

fixture_uuid="$(psql -X -At -v ON_ERROR_STOP=1 -c 'select gen_random_uuid();')"
fabric_id="SYNTHETIC-TITAN-${fixture_uuid}"
request_key="SYNTHETIC-MANUAL-CONCURRENT-${fixture_uuid}"
tmp="$(mktemp -d)"
cleanup() {
  # Only the generated UUID-scoped synthetic key is ever deleted.
  psql -X -v ON_ERROR_STOP=1 -c "delete from private.fabric_stock_ledger where request_key='${request_key}';" >/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

call="select public.fabric_stock_record_v3('${fabric_id}','receipt',2.125,'synthetic concurrency test','Synthetic checker','Synthetic roll concurrency','${request_key}');"

# The first connection inserts, then holds the same transaction open while
# the second concurrently requests the identical key. Their real PG advisory
# lock must serialize the replay and return one original event UUID.
PGAPPNAME=titan_stock_concurrent_first psql -X -At -v ON_ERROR_STOP=1 \
  -c 'begin;' -c "$call" -c 'select pg_sleep(5);' -c 'commit;' >"$tmp/first" 2>"$tmp/first.err" &
first_pid=$!

first_locked=0
for _ in $(seq 1 80); do
  active="$(psql -X -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_stat_activity where application_name='titan_stock_concurrent_first' and state='active' and query like 'select pg_sleep(5)%';")"
  if [[ "$active" == "1" ]]; then first_locked=1; break; fi
  sleep 0.1
done
if [[ "$first_locked" != 1 ]]; then
  cat "$tmp/first.err" >&2 || true
  echo "First stock writer never reached held transaction" >&2
  exit 1
fi

PGAPPNAME=titan_stock_concurrent_second psql -X -At -v ON_ERROR_STOP=1 \
  -c "$call" >"$tmp/second" 2>"$tmp/second.err" &
second_pid=$!

blocked=0
for _ in $(seq 1 30); do
  waiting="$(psql -X -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_stat_activity where application_name='titan_stock_concurrent_second' and wait_event_type='Lock';")"
  if [[ "$waiting" == "1" ]]; then blocked=1; break; fi
  sleep 0.1
done
if [[ "$blocked" != 1 ]]; then
  echo "Concurrent stock writer did not wait on the key lock" >&2
  cat "$tmp/second.err" >&2 || true
  exit 1
fi

wait "$first_pid"
wait "$second_pid"
first_uuid="$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$tmp/first" | head -n 1)"
second_uuid="$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$tmp/second" | head -n 1)"
count="$(psql -X -At -v ON_ERROR_STOP=1 -c "select count(*) from private.fabric_stock_ledger where request_key='${request_key}';")"
[[ -n "$first_uuid" && "$first_uuid" == "$second_uuid" && "$count" == 1 ]] || {
  echo "Concurrent replay did not return one UUID and one ledger row" >&2
  exit 1
}
echo "TITAN concurrent stock replay PASS: second writer blocked; one event UUID, one ledger row."
