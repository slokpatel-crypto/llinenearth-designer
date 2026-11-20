-- Synthetic-only native PostgreSQL distributed OTP concurrency and TTL tests.
begin;
do $test$
declare
  a text:=repeat('a',64);
  b text:=repeat('b',64);
  i integer;
  ok boolean;
  caught boolean:=false;
begin
  for i in 1..8 loop
    ok:=public.customer_otp_rate_consume(a);
    if ok is distinct from true then raise exception 'attempt % unexpectedly blocked',i;end if;
  end loop;
  if public.customer_otp_rate_consume(a) is distinct from false
    or public.customer_otp_rate_consume(a) is distinct from false then
    raise exception 'ninth/replayed OTP attempt must be denied';
  end if;
  if public.customer_otp_rate_consume(b) is distinct from true then
    raise exception 'unrelated email subject was blocked';end if;
  update private.customer_otp_rate_windows set started_at=now()-interval '11 minutes'
    where subject_hash=a;
  if public.customer_otp_rate_consume(a) is distinct from true then
    raise exception 'expired ten-minute window must reset';end if;
  if (select attempts from private.customer_otp_rate_windows where subject_hash=a)<>1 then
    raise exception 'expired window attempts must reset to one';end if;
  begin
    perform public.customer_otp_rate_consume('plain-email@example.test');
  exception when others then caught:=true;
  end;
  if not caught then raise exception 'plaintext email must never be accepted';end if;
  if has_table_privilege('anon','private.customer_otp_rate_windows','SELECT')
    or has_table_privilege('authenticated','private.customer_otp_rate_windows','INSERT')
    or has_table_privilege('service_role','private.customer_otp_rate_windows','SELECT')
    or has_function_privilege('anon','public.customer_otp_rate_consume(text)','EXECUTE')
    or has_function_privilege('authenticated','public.customer_otp_rate_consume(text)','EXECUTE') then
    raise exception 'client access to OTP limiter leaked';end if;
  if not has_function_privilege('service_role','public.customer_otp_rate_consume(text)','EXECUTE') then
    raise exception 'service role missing OTP limiter RPC';end if;
end
$test$;
rollback;
select case when count(*)=0 then 'PASS' else 'FAIL' end
from private.customer_otp_rate_windows where subject_hash in (repeat('a',64),repeat('b',64));
