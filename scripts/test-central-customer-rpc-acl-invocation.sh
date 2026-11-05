#!/usr/bin/env bash
set -euo pipefail
# Runs only against the synthetic disposable PostgreSQL service in central CI.
# Never run against staging, production or databases with user records.
#
# Test actual SQL invocation as anon/authenticated instead of relying solely
# on has_function_privilege metadata. SQL transactions intentionally roll back.
assert_denied() {
  local role="$1" function_name="$2" expression="$3" result status
  set +e
  result=$(psql -X -v ON_ERROR_STOP=1 -At 2>&1 <<SQL
begin;
set role $role;
select $expression;
rollback;
SQL
)
  status=$?
  set -e
  if [[ "$status" -eq 0 || "$result" != *"permission denied for function $function_name"* ]]; then
    echo "FAIL: $role could execute or unexpectedly failed $function_name" >&2
    echo "$result" >&2
    exit 1
  fi
}
# All eight customer/session/share/OTP RPCs must be unreachable from browser
# roles, even with real-looking arguments. No plaintext secrets are used.
for role in anon authenticated; do
  assert_denied "$role" customer_session_is_revoked \
    "public.customer_session_is_revoked(repeat('a',64))"
  assert_denied "$role" customer_session_revoke \
    "public.customer_session_revoke(repeat('a',64))"
  assert_denied "$role" customer_otp_rate_consume \
    "public.customer_otp_rate_consume(repeat('a',64))"
  assert_denied "$role" designer_share_register \
    "public.designer_share_register(repeat('a',64),repeat('b',64),now()+interval '1 day','123e4567-e89b-12d3-a456-426614174000'::uuid)"
  assert_denied "$role" designer_share_is_revoked \
    "public.designer_share_is_revoked(repeat('a',64))"
  assert_denied "$role" designer_share_revoke \
    "public.designer_share_revoke(repeat('a',64),repeat('b',64))"
  assert_denied "$role" designer_share_list_owned \
    "public.designer_share_list_owned('123e4567-e89b-12d3-a456-426614174000'::uuid)"
  assert_denied "$role" designer_share_revoke_owned \
    "public.designer_share_revoke_owned(repeat('a',64),'123e4567-e89b-12d3-a456-426614174000'::uuid)"
done

# Positive control: service_role may invoke exactly the approved RPC surface,
# and no digest/share/OTP state may persist outside this synthetic transaction.
psql -X -v ON_ERROR_STOP=1 -At <<'SQL' | grep -qx PASS
begin;
set role service_role;
do $probe$
declare
  owner_id uuid := '123e4567-e89b-12d3-a456-426614174000'::uuid;
begin
  if public.customer_session_is_revoked(repeat('a',64)) is distinct from false
     or public.customer_session_revoke(repeat('a',64)) is distinct from true
     or public.customer_session_is_revoked(repeat('a',64)) is distinct from true
     or public.customer_otp_rate_consume(repeat('c',64)) is distinct from true
     or public.designer_share_register(repeat('d',64),repeat('e',64),
                                      now()+interval '1 day',owner_id) is distinct from true
     or (select count(*) from public.designer_share_list_owned(owner_id)) <> 1
     or public.designer_share_is_revoked(repeat('d',64)) is distinct from false
     or public.designer_share_revoke_owned(repeat('d',64),owner_id) is distinct from true
     or public.designer_share_revoke(repeat('d',64),repeat('e',64)) is distinct from true
     or public.designer_share_is_revoked(repeat('d',64)) is distinct from true
  then raise exception 'service_role customer RPC sequence failed'; end if;
end $probe$;
reset role;
select 'PASS';
rollback;
SQL
psql -X -v ON_ERROR_STOP=1 -At <<'SQL' | grep -qx PASS
select case when
  (select count(*) from private.customer_session_revocations)=0
  and (select count(*) from private.designer_share_revocations)=0
  and (select count(*) from private.customer_otp_rate_windows)=0
  and (select count(*) from private.fabric_stock_ledger)=0
then 'PASS' else 'FAIL' end;
SQL
echo 'PASS: 16 client-role RPC denials, service-role positive controls and four empty synthetic ledgers'
