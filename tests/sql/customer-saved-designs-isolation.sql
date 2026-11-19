-- Run only against a disposable Supabase PostgreSQL database after migration.
-- Transaction rolls back synthetic users and records.
begin;
do $$
declare
  alice uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  bob uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  recipe jsonb := '{"schemaVersion":1,"designId":"SD_test","title":"Test","recipe":{"brief":{},"version":{"id":"v1"},"renderSet":{}}}'::jsonb;
  actual jsonb;
begin
  if has_function_privilege('anon','public.customer_saved_design_get_owned(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.customer_saved_design_upsert_owned(uuid,text,jsonb)','EXECUTE')
     or has_table_privilege('authenticated','private.customer_saved_designs','SELECT') then
    raise exception 'customer saved designs privilege leak';
  end if;
  insert into auth.users(id) values(alice),(bob);
  if public.customer_saved_design_upsert_owned(alice,'SD_test',recipe) is distinct from true then
    raise exception 'Alice write failed';
  end if;
  select payload into actual from public.customer_saved_design_get_owned(bob,'SD_test');
  if actual is not null then raise exception 'Bob read Alice record'; end if;
  if public.customer_saved_design_delete_owned(bob,'SD_test') is distinct from false then
    raise exception 'Bob deleted Alice record';
  end if;
  if public.customer_saved_design_upsert_owned(bob,'SD_test',recipe) is distinct from true then
    raise exception 'Bob independent same-id write failed';
  end if;
  if (select count(*) from public.customer_saved_design_list_owned(alice)) <> 1
     or (select count(*) from public.customer_saved_design_list_owned(bob)) <> 1 then
    raise exception 'owner-filtered listing failed';
  end if;
  if public.customer_saved_design_delete_owned(alice,'SD_test') is distinct from true then
    raise exception 'Alice deletion failed';
  end if;
  select payload into actual from public.customer_saved_design_get_owned(bob,'SD_test');
  if actual is distinct from recipe then raise exception 'Alice deletion affected Bob'; end if;
  if public.customer_saved_design_upsert_owned(alice,'SD_test',recipe || '{"designId":"SD_other"}'::jsonb)
     is distinct from false then raise exception 'mismatched design id accepted'; end if;
end $$;
rollback;
