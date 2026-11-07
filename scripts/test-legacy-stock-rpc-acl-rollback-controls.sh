#!/usr/bin/env bash
set -euo pipefail
# Disposable synthetic PostgreSQL only. NEVER run against shared/staging/live DB.
# Exercise the real SQL permission gate under malicious temporary grants/revokes,
# then prove that failed transactions left the original ACL unchanged.
if [[ "${PGDATABASE:-}" != "titan_synthetic" ]]; then
  echo "BLOCKED: mutation controls require disposable titan_synthetic database" >&2
  exit 1
fi
assert_catches_tamper() {
  local label="$1" statement="$2" expected="$3" output status
  set +e
  output=$(psql -X -v ON_ERROR_STOP=1 2>&1 <<SQL
begin;
$statement;
\\i supabase/tests/20261103_z_legacy_stock_rpc_execute_retirement.sql
rollback;
SQL
)
  status=$?
  set -e
  if [[ "$status" -eq 0 || "$output" != *"$expected"* ]]; then
    echo "FAIL: $label was not rejected by the real ACL SQL gate" >&2
    echo "$output" >&2
    exit 1
  fi
  # ON_ERROR_STOP ends the psql session with a failed open transaction;
  # PostgreSQL atomically rolls it back. Prove the clean ACL test still passes.
  psql -X -v ON_ERROR_STOP=1 -At \
    -f supabase/tests/20261103_z_legacy_stock_rpc_execute_retirement.sql \
    | grep -Fqx 'PASS: all four v1 stock mutators denied, v2 service_role grants retained'
}
assert_catches_tamper "PUBLIC inherited v1 EXECUTE" \
  "grant execute on function public.fabric_stock_record(text,text,numeric,text) to public" \
  "unsafe effective v1 EXECUTE: role service_role"
assert_catches_tamper "service_role v2 EXECUTE revoked" \
  "revoke execute on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text) from service_role" \
  "v2 stock service_role RPC unexpectedly revoked"
assert_catches_tamper "authenticated granted v2 EXECUTE" \
  "grant execute on function public.fabric_stock_release_v2(uuid,text,text,text) to authenticated" \
  "unprivileged role authenticated can execute v2 stock RPC"
assert_catches_tamper "unreviewed legacy public overload" \
  "create function public.fabric_stock_record(p_extra integer) returns integer language sql as 'select 1'" \
  "unexpected public stock RPC overload for public.fabric_stock_record(text,text,numeric,text)"
assert_catches_tamper "unreviewed v2 public overload" \
  "create function public.fabric_stock_reserve_v2(p_extra integer) returns integer language sql as 'select 1'" \
  "unexpected public stock RPC overload for public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)"
# Read-only staged snapshot must NOT silently omit alternate overloaded RPCs.
# Each probe is scoped to a disposable transaction and rolled back.
assert_snapshot_flags_overload() {
  local label="$1" statement="$2" expected="$3" clean="$4" output
  output=$(psql -X -At -F '|' -v ON_ERROR_STOP=1 <<SQL
begin;
$statement;
\\i supabase/tests/20261103_z_stock_rpc_acl_readonly_snapshot.sql
rollback;
SQL
)
  if ! grep -Fqx "$expected" <<< "$output"; then
    echo "FAIL: read-only staging snapshot missed $label" >&2
    echo "$output" >&2
    exit 1
  fi
  psql -X -v ON_ERROR_STOP=1 -At -F '|' \\
    -f supabase/tests/20261103_z_stock_rpc_acl_readonly_snapshot.sql \\
    | grep -Fqx "$clean"
}
assert_snapshot_flags_overload "legacy v1 overload" \\
  "create function public.fabric_stock_record(p_extra integer) returns integer language sql as 'select 1'" \\
  "v1|public.fabric_stock_record(text,text,numeric,text)|service_role|UNREVIEWED_OVERLOAD" \\
  "v1|public.fabric_stock_record(text,text,numeric,text)|service_role|NO_EXECUTE"
assert_snapshot_flags_overload "privileged v2 overload" \\
  "create function public.fabric_stock_reserve_v2(p_extra integer) returns integer language sql as 'select 1'" \\
  "v2|public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)|service_role|UNREVIEWED_OVERLOAD" \\
  "v2|public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)|service_role|EXECUTE"
echo "PASS: two read-only staging ACL overload snapshots detected unsafe variants and rolled back"
test "$(psql -X -v ON_ERROR_STOP=1 -Atc 'select count(*) from private.fabric_stock_ledger')" = 0
echo "PASS: five real SQL ACL tamper/overload regressions rejected and transactions rolled back"
