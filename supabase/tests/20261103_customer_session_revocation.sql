-- Disposable-only digest revocation invariants; never execute against production.
begin;
do $test$
declare
  a text:=repeat('a',64);
  b text:=repeat('b',64);
  has_error boolean:=false;
begin
  if public.customer_session_is_revoked(a) is distinct from false then
    raise exception 'fresh signed bearer must not be revoked';
  end if;
  if public.customer_session_revoke(a) is distinct from true then
    raise exception 'revocation RPC must acknowledge true';
  end if;
  if public.customer_session_is_revoked(a) is distinct from true then
    raise exception 'revoked bearer is still valid';
  end if;
  if public.customer_session_is_revoked(b) is distinct from false then
    raise exception 'different bearer was revoked';
  end if;
  if public.customer_session_revoke(a) is distinct from true then
    raise exception 'repeat revocation must be idempotent';
  end if;
  begin
    perform public.customer_session_revoke('not-a-digest');
  exception when others then
    has_error:=true;
  end;
  if not has_error then raise exception 'invalid digests must fail'; end if;

  if has_table_privilege('anon','private.customer_session_revocations','SELECT')
     or has_table_privilege('authenticated','private.customer_session_revocations','INSERT')
     or has_table_privilege('service_role','private.customer_session_revocations','SELECT') then
    raise exception 'private digest table must never be directly readable or writable';
  end if;
  if has_function_privilege('anon','public.customer_session_is_revoked(text)','EXECUTE')
     or has_function_privilege('authenticated','public.customer_session_revoke(text)','EXECUTE') then
    raise exception 'client roles must not execute revocation RPCs';
  end if;
  if not has_function_privilege('service_role','public.customer_session_is_revoked(text)','EXECUTE')
     or not has_function_privilege('service_role','public.customer_session_revoke(text)','EXECUTE') then
    raise exception 'service role must have strict RPC access';
  end if;
end
$test$;
rollback;
-- Rollback must leave no synthetic revocations.
select case when count(*)=0 then 'PASS' else 'FAIL' end
from private.customer_session_revocations
where token_hash in (repeat('a',64),repeat('b',64));
