-- Atomic distributed OTP limiter for a normalized email HMAC digest.
-- No raw email, source IP or OTP codes stored. Apply and test before enabling
-- LINEN_CUSTOMER_OTP_DISTRIBUTED_REQUIRED=1 and setting dedicated server secret.
create schema if not exists private;
create table if not exists private.customer_otp_rate_windows(
  subject_hash text primary key check(subject_hash ~ '^[a-f0-9]{64}$'),
  started_at timestamptz not null default now(),
  attempts integer not null default 0 check(attempts between 0 and 9)
);
create index if not exists customer_otp_rate_windows_expiry_idx
  on private.customer_otp_rate_windows(started_at);
alter table private.customer_otp_rate_windows enable row level security;
revoke all on table private.customer_otp_rate_windows from public,anon,authenticated,service_role;

create or replace function public.customer_otp_rate_consume(p_subject_hash text)
returns boolean language plpgsql security definer set search_path='public','private' as $$
declare
  v_attempts integer;
begin
  if p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid OTP rate digest';
  end if;
  insert into private.customer_otp_rate_windows(subject_hash,started_at,attempts)
  values(p_subject_hash,now(),1)
  on conflict(subject_hash) do update set
    started_at=case
      when customer_otp_rate_windows.started_at<=now()-interval '10 minutes' then now()
      else customer_otp_rate_windows.started_at end,
    attempts=case
      when customer_otp_rate_windows.started_at<=now()-interval '10 minutes' then 1
      else least(customer_otp_rate_windows.attempts+1,9) end
  returning attempts into v_attempts;
  return v_attempts<=8;
end;
$$;
revoke all on function public.customer_otp_rate_consume(text) from public,anon,authenticated;
grant execute on function public.customer_otp_rate_consume(text) to service_role;
