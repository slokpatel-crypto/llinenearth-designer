#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL only. A holds the exact reservation fabric lock.
# B must time out attempting a manual receipt on that fabric, then succeed after A releases.
fabric="SYNTHETIC-TITAN-MANUAL-LOCK"
signal_file="$(mktemp)"
rm -f "$signal_file"
cleanup() { rm -f "$signal_file"; if [[ -n "${holder_pid:-}" ]]; then wait "$holder_pid" 2>/dev/null || true; fi; }
trap cleanup EXIT
(
  psql -v ON_ERROR_STOP=1 -c "begin; select pg_advisory_xact_lock(hashtext('stock-fabric:$fabric')); select pg_sleep(4); rollback;" >/dev/null
) &
holder_pid=$!
# Wait until the holder actually owns the advisory lock (not merely until its process starts).
for i in $(seq 1 60); do
  if psql -v ON_ERROR_STOP=1 -Atc "select count(*) from pg_locks where locktype='advisory' and granted and pid <> pg_backend_pid() and classid=0 and objid=hashtext('stock-fabric:$fabric')::oid and objsubid=1" | grep -qE '^[1-9]'; then
    touch "$signal_file"
    break
  fi
  sleep 0.05
done
[[ -f "$signal_file" ]] || { echo "specific reservation fabric advisory lock was never acquired"; exit 1; }
set +e
result=$(psql -v ON_ERROR_STOP=1 2>&1 <<SQL
begin;
set local lock_timeout='500ms';
select public.fabric_stock_record_v2('$fabric','receipt',1.000,'synthetic','Test checker','Synthetic evidence');
rollback;
SQL
)
status=$?
set -e
[[ "$status" -ne 0 && "$result" == *"lock timeout"* ]] || { echo "manual stock operation did not wait for reservation fabric lock: $result"; exit 1; }
wait "$holder_pid"
holder_pid=""
psql -v ON_ERROR_STOP=1 <<SQL
begin;
select public.fabric_stock_record_v2('$fabric','receipt',1.000,'synthetic','Test checker','Synthetic evidence');
rollback;
SQL
psql -Atc "select count(*) from private.fabric_stock_ledger where fabric_id='$fabric'" | grep -qx 0
echo "PASS: manual stock and reservation fabric lock serialize; synthetic writes rolled back"

# Privileged legacy manual writer must be unreachable after the migration.
# Check effective privileges (including PUBLIC), not merely explicit grants.
psql -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if has_function_privilege('service_role', 'public.fabric_stock_record(text,text,numeric,text)', 'EXECUTE') then
    raise exception 'legacy manual stock writer still executable by service_role';
  end if;
  if has_function_privilege('anon', 'public.fabric_stock_record(text,text,numeric,text)', 'EXECUTE') then
    raise exception 'legacy manual stock writer still executable by anon';
  end if;
  if has_function_privilege('authenticated', 'public.fabric_stock_record(text,text,numeric,text)', 'EXECUTE') then
    raise exception 'legacy manual stock writer still executable by authenticated';
  end if;
end;
$$;
SQL
echo "PASS: legacy provenance-free manual stock RPC is inaccessible to service_role/anon/authenticated"
