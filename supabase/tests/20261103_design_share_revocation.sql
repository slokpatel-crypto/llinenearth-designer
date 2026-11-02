-- Synthetic-only PostgreSQL share revocation tests. Rolls back.
begin;
do $x$
declare
 a text:=repeat('a',64);
 b text:=repeat('b',64);
 k text:=repeat('c',64);
 other text:=repeat('d',64);
begin
 if public.designer_share_register(a,k,now()+interval '30 days') is distinct from true
   then raise exception 'registration should succeed';end if;
 if public.designer_share_register(a,other,now()+interval '30 days') is distinct from false
   then raise exception 'duplicate registration must not steal revoke capability';end if;
 if public.designer_share_is_revoked(a) is distinct from false
   then raise exception 'fresh public link should be readable';end if;
 if public.designer_share_revoke(a,other) is distinct from false
   then raise exception 'forged revoke key must fail';end if;
 if public.designer_share_revoke(b,k) is distinct from false
   then raise exception 'wrong link token must fail';end if;
 if public.designer_share_revoke(a,k) is distinct from true
   then raise exception 'owner capability must revoke';end if;
 if public.designer_share_is_revoked(a) is distinct from true
   then raise exception 'revoked public link must fail';end if;
 if public.designer_share_revoke(a,k) is distinct from true
   then raise exception 'repeated revoke should be idempotent';end if;
 if public.designer_share_is_revoked(b) is distinct from false
   then raise exception 'legacy unregistered links must remain readable';end if;
 if has_table_privilege('anon','private.designer_share_revocations','SELECT')
    or has_table_privilege('authenticated','private.designer_share_revocations','INSERT')
    or has_table_privilege('service_role','private.designer_share_revocations','SELECT')
    or has_function_privilege('anon','public.designer_share_register(text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.designer_share_revoke(text,text)','EXECUTE') then
     raise exception 'share revocation privileges leaked';end if;
end $x$;
rollback;
select case when count(*)=0 then 'PASS' else 'FAIL' end
from private.designer_share_revocations where token_hash=repeat('a',64);
