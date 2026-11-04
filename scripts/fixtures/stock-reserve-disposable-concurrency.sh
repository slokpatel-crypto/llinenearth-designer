#!/usr/bin/env bash
# Disposable PostgreSQL only: two independent psql sessions race for five metres.
set -euo pipefail
psql -X -v ON_ERROR_STOP=1 -f scripts/fixtures/stock-reserve-disposable-concurrency.sql
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
reserve() {
  local key="$1"
  psql -X -v ON_ERROR_STOP=1 -Atc "select public.fabric_stock_reserve_v2('disposable-test-fabric',3.000,'disposable-locked-revision','$key','disposable-operator','disposable-evidence-001')" >"$tmp/$key.out" 2>"$tmp/$key.err"
}
reserve disposable-race-key-0001 & a=$!
reserve disposable-race-key-0002 & b=$!
wait "$a" && sa=0 || sa=$?
wait "$b" && sb=0 || sb=$?
if ! { { [ "$sa" -eq 0 ] && [ "$sb" -ne 0 ]; } || { [ "$sb" -eq 0 ] && [ "$sa" -ne 0 ]; }; }; then
  echo "Expected exactly one successful competing reservation; got statuses $sa/$sb" >&2
  cat "$tmp"/*.err >&2
  exit 1
fi
success_key=disposable-race-key-0001
if [ "$sb" -eq 0 ]; then success_key=disposable-race-key-0002; fi
original="$(cat "$tmp/$success_key.out")"
replay="$(psql -X -v ON_ERROR_STOP=1 -Atc "select public.fabric_stock_reserve_v2('disposable-test-fabric',3.000,'disposable-locked-revision','$success_key','disposable-operator','disposable-evidence-001')")"
[ -n "$original" ] && [ "$original" = "$replay" ] || { echo 'Concurrent winner replay was not idempotent' >&2; exit 1; }
psql -X -v ON_ERROR_STOP=1 -Atc "select (count(*)=1 and coalesce(sum(quantity_metres),0)=3)::text from private.fabric_stock_ledger where request_key like 'disposable-race-key-%'" | grep -qx true
echo 'Disposable two-session contention: one winner, one rejected, idempotent replay, one ledger row.'
