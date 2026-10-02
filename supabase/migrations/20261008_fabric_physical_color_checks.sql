-- Append-only controlled physical colour checks for Phase 2 fabric truth.
-- Delta E is stored as descriptive evidence only; this migration does not invent a pass/fail threshold.

create schema if not exists private;

create table if not exists private.fabric_physical_color_checks (
  check_id uuid primary key default gen_random_uuid(),
  fabric_id text not null,
  profile_id text,
  digital_hex text not null,
  method text not null check (method in ('spectrophotometer','colorimeter','calibrated_capture')),
  physical_l numeric(7,3) not null check (physical_l between 0 and 100),
  physical_a numeric(8,3) not null check (physical_a between -160 and 160),
  physical_b numeric(8,3) not null check (physical_b between -160 and 160),
  physical_hex text,
  delta_e numeric(8,3) not null check (delta_e between 0 and 200),
  illuminant text not null default '',
  device text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(trim(fabric_id)) between 2 and 160),
  check (digital_hex ~ '^#[0-9A-F]{6}$'),
  check (physical_hex is null or physical_hex ~ '^#[0-9A-F]{6}$')
);

create index if not exists fabric_physical_color_checks_fabric_idx
  on private.fabric_physical_color_checks(fabric_id,created_at desc);

alter table private.fabric_physical_color_checks enable row level security;
revoke all on private.fabric_physical_color_checks from public,anon,authenticated;

create or replace function public.fabric_physical_color_check_record(
  p_fabric_id text,
  p_profile_id text,
  p_digital_hex text,
  p_method text,
  p_physical_l numeric,
  p_physical_a numeric,
  p_physical_b numeric,
  p_physical_hex text,
  p_delta_e numeric,
  p_illuminant text default '',
  p_device text default '',
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_fabric_id)),0)<2 then raise exception 'fabric id is required'; end if;
  if upper(coalesce(p_digital_hex,'')) !~ '^#[0-9A-F]{6}$' then raise exception 'invalid digital hex'; end if;
  if p_method not in ('spectrophotometer','colorimeter','calibrated_capture') then raise exception 'invalid physical colour method'; end if;
  if p_physical_l is null or p_physical_l<0 or p_physical_l>100 then raise exception 'invalid physical L'; end if;
  if p_physical_a is null or p_physical_a<-160 or p_physical_a>160 then raise exception 'invalid physical a'; end if;
  if p_physical_b is null or p_physical_b<-160 or p_physical_b>160 then raise exception 'invalid physical b'; end if;
  if p_delta_e is null or p_delta_e<0 or p_delta_e>200 then raise exception 'invalid delta E'; end if;
  if nullif(trim(coalesce(p_physical_hex,'')),'') is not null and upper(p_physical_hex) !~ '^#[0-9A-F]{6}$' then
    raise exception 'invalid physical hex';
  end if;
  if p_method<>'calibrated_capture' and coalesce(length(trim(p_device)),0)=0 then
    raise exception 'instrument identity is required';
  end if;
  if p_method='calibrated_capture' and coalesce(length(trim(p_note)),0)<4 then
    raise exception 'capture evidence note is required';
  end if;

  insert into private.fabric_physical_color_checks(
    fabric_id,profile_id,digital_hex,method,physical_l,physical_a,physical_b,
    physical_hex,delta_e,illuminant,device,note
  ) values(
    left(trim(p_fabric_id),160),nullif(left(trim(coalesce(p_profile_id,'')),100),''),
    upper(p_digital_hex),p_method,round(p_physical_l,3),round(p_physical_a,3),round(p_physical_b,3),
    case when trim(coalesce(p_physical_hex,''))='' then null else upper(p_physical_hex) end,
    round(p_delta_e,3),left(trim(coalesce(p_illuminant,'')),80),
    left(trim(coalesce(p_device,'')),160),left(trim(coalesce(p_note,'')),800)
  )
  returning check_id into v_id;

  return v_id;
end;
$$;

create or replace function public.fabric_physical_color_check_list(p_limit integer default 200)
returns table(
  check_id uuid,fabric_id text,profile_id text,digital_hex text,method text,
  physical_l numeric,physical_a numeric,physical_b numeric,physical_hex text,
  delta_e numeric,illuminant text,device text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select c.check_id,c.fabric_id,c.profile_id,c.digital_hex,c.method,
         c.physical_l,c.physical_a,c.physical_b,c.physical_hex,
         c.delta_e,c.illuminant,c.device,c.note,c.created_at
  from private.fabric_physical_color_checks c
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),1000));
$$;

revoke all on function public.fabric_physical_color_check_record(text,text,text,text,numeric,numeric,numeric,text,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.fabric_physical_color_check_list(integer) from public,anon,authenticated;
grant execute on function public.fabric_physical_color_check_record(text,text,text,text,numeric,numeric,numeric,text,numeric,text,text,text) to service_role;
grant execute on function public.fabric_physical_color_check_list(integer) to service_role;
