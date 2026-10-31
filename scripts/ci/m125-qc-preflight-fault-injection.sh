#!/usr/bin/env bash
# M125: Six negative QC catalog checks. CI-only disposable PostgreSQL.
# Every fault is in an uncommitted SQL transaction; detected failure aborts
# psql and PostgreSQL rolls back the changed trigger/index/role permission.
set -euo pipefail
if [[ "\${GITHUB_ACTIONS:-}" != "true" || "\${CI:-}" != "true" ]]; then
  echo "M125 refuses non-CI execution" >&2; exit 2
fi
container="\${1:-}"
db="\${2:-}"
if [[ -z "$container" || "$db" != "titan_production_idempotency" ]]; then
  echo "M125 refuses any database except disposable titan_production_idempotency" >&2; exit 2
fi
readonly preflight="scripts/ci/m122-qc-schema-readonly-preflight.sql"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
sed -n '/^DO \$titan\$$/,/^\$titan\$;$/p' "$preflight" > "$work/body.sql"
if ! grep -q '^DO \$titan\$$' "$work/body.sql" ||
   ! grep -q '^\$titan\$;$' "$work/body.sql"; then
  echo "M125 cannot extract read-only catalog audit" >&2; exit 1
fi
run_sql(){
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db"
}
run_sql < "$preflight" > "$work/baseline.out"
for kind in insert_trigger_off update_delete_off truncate_off \
            missing_unique_index leaked_client_rpc missing_service_rpc; do
  case "$kind" in
    insert_trigger_off)
      mutation="alter table private.finished_garment_qc_inspections disable trigger finished_garment_qc_assign_sequence;"
      diagnostic="required insert trigger missing or disabled";;
    update_delete_off)
      mutation="alter table private.finished_garment_qc_inspections disable trigger finished_garment_qc_append_only;"
      diagnostic="append-only or TRUNCATE trigger missing or disabled";;
    truncate_off)
      mutation="alter table private.finished_garment_qc_inspections disable trigger finished_garment_qc_no_truncate;"
      diagnostic="append-only or TRUNCATE trigger missing or disabled";;
    missing_unique_index)
      mutation="drop index private.finished_garment_qc_order_sequence_unique;"
      diagnostic="monotonic QC index absent or unsafe";;
    leaked_client_rpc)
      mutation="grant execute on function public.production_delivery_eligibility_list(integer) to authenticated;"
      diagnostic="grants unsafe client EXECUTE";;
    missing_service_rpc)
      mutation="revoke execute on function public.production_delivery_eligibility_list(integer) from service_role;"
      diagnostic="service-only RPC execution missing";;
  esac
  {
    printf 'BEGIN;\n%s\n' "$mutation"
    cat "$work/body.sql"
    printf '\nROLLBACK;\n'
  } > "$work/fault.sql"
  if run_sql < "$work/fault.sql" > "$work/$kind.out" 2> "$work/$kind.err"; then
    echo "M125 FAIL: installed QC audit accepted $kind" >&2; exit 1
  fi
  if ! grep -Fq "$diagnostic" "$work/$kind.err"; then
    echo "M125 FAIL: unexpected $kind error (not the expected QC audit rejection)" >&2
    exit 1
  fi
  # Re-run ACTUAL installed read-only preflight to prove each fault rolled back.
  if ! run_sql < "$preflight" > "$work/recovered-$kind.out" 2> "$work/recovered-$kind.err"; then
    echo "M125 FAIL: $kind not rolled back" >&2; exit 1
  fi
  echo "M125 QC fail-closed $kind PASS (disposable PostgreSQL)"
done
echo "M125 six installed-schema/ACL fault injections all rejected and rolled back PASS"
