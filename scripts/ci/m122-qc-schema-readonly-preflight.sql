-- TITAN M122: installed QC schema/privilege audit. READ ONLY.
-- Run only on owner-approved, isolated/staging database after migrations
-- 20261110..20261116, or in disposable CI PostgreSQL. Never applies DDL,
-- mutates production records, approves physical QC or migrates real data.
BEGIN READ ONLY;
DO $titan$
DECLARE
  v_order_table oid := to_regclass('private.production_orders');
  v_qc_table oid := to_regclass('private.finished_garment_qc_inspections');
  v_receipts oid := to_regclass('private.production_delivery_request_receipts');
  v_gate oid := to_regprocedure('public.production_order_set_status(uuid,text,text)');
  v_delivery oid := to_regprocedure('public.production_order_deliver_idempotent(uuid,uuid,text)');
  v_hint oid := to_regprocedure('public.production_delivery_eligibility_list(integer)');
  v_trigger oid := to_regprocedure('private.assign_finished_garment_qc_sequence()');
  v_immutability oid := to_regprocedure('private.reject_finished_garment_qc_mutation()');
  v_receipt_immutability oid := to_regprocedure('private.reject_production_delivery_receipt_mutation()');
  v_event_immutability oid := to_regprocedure('private.reject_production_event_mutation()');
  v_quote_events oid := to_regclass('private.production_quote_events');
  v_order_events oid := to_regclass('private.production_order_events');
  v_event_table oid;
  v_request_receipt_immutability oid := to_regprocedure('private.reject_production_request_receipt_mutation()');
  v_request_table oid;
  v_req_name text;
  v_req_row_trigger text;
  v_req_trunc_trigger text;
  v_locked_identity oid := to_regprocedure('private.reject_locked_production_identity_mutation()');
  v_quote_table oid := to_regclass('private.production_quotes');
  v_functions oid[];
  v_function oid;
BEGIN
  if v_order_table is null or v_qc_table is null or v_receipts is null then
    raise exception 'M122 QC staging preflight: required private tables missing';
  end if;

  if not exists(
    select 1 from pg_attribute where attrelid=v_order_table
      and attname='qc_latest_sequence' and not attisdropped and attnotnull
      and atttypid='bigint'::regtype
  ) or not exists(
    select 1 from pg_attribute where attrelid=v_qc_table
      and attname='inspection_sequence' and not attisdropped
      and not attnotnull and atttypid='bigint'::regtype
  ) then
    raise exception 'M122 QC staging preflight: missing or unsafe sequence columns';
  end if;

  if not exists(
    select 1 from pg_constraint
    where conrelid=v_order_table and contype='c'
      and pg_get_constraintdef(oid) like '%qc_latest_sequence%>= 0%'
  ) or not exists(
    select 1 from pg_constraint
    where conrelid=v_qc_table and contype='c'
      and pg_get_constraintdef(oid) like '%inspection_sequence%> 0%'
  ) then
    raise exception 'M122 QC staging preflight: QC sequence bounds not enforced';
  end if;

  if (select count(*) from pg_index i
    join pg_class idx on idx.oid=i.indexrelid
    where i.indrelid=v_qc_table and i.indisunique
      and idx.relname='finished_garment_qc_order_sequence_unique'
      and i.indpred is not null
      and pg_get_expr(i.indpred,i.indrelid) like '%inspection_sequence IS NOT NULL%')<>1 then
    raise exception 'M122 QC staging preflight: monotonic QC index absent or unsafe';
  end if;

  if v_trigger is null or
     (select count(*) from pg_trigger t
      where t.tgrelid=v_qc_table
        and t.tgname='finished_garment_qc_assign_sequence'
        and t.tgfoid=v_trigger
        and t.tgenabled='O'
        and not t.tgisinternal
        and (t.tgtype::int & 2)=2  -- BEFORE
        and (t.tgtype::int & 4)=4  -- INSERT
     )<>1 then
    raise exception 'M122 QC staging preflight: required insert trigger missing or disabled';
  end if;

  -- M122 append-only hardening must seal UPDATE, DELETE and TRUNCATE,
  -- including historical unsequenced inspection rows. A missing/disabled
  -- TRUNCATE trigger could otherwise erase the entire physical QC ledger.
  if v_immutability is null then
    raise exception 'M123 QC staging preflight: append-only function absent';
  end if;
  if (select count(*) from pg_trigger t
      where t.tgrelid=v_qc_table
        and t.tgname='finished_garment_qc_append_only'
        and t.tgfoid=v_immutability
        and t.tgenabled='O' and not t.tgisinternal
        and (t.tgtype::int & 1)=1  -- ROW
        and (t.tgtype::int & 2)=2  -- BEFORE
        and (t.tgtype::int & 8)=8  -- DELETE
        and (t.tgtype::int & 16)=16 -- UPDATE
      )<>1
    or (select count(*) from pg_trigger t
      where t.tgrelid=v_qc_table
        and t.tgname='finished_garment_qc_no_truncate'
        and t.tgfoid=v_immutability
        and t.tgenabled='O' and not t.tgisinternal
        and (t.tgtype::int & 1)=0  -- STATEMENT
        and (t.tgtype::int & 2)=2  -- BEFORE
        and (t.tgtype::int & 32)=32 -- TRUNCATE
      )<>1 then
    raise exception 'M123 QC staging preflight: append-only or TRUNCATE trigger missing or disabled';
  end if;
  if not exists(select 1 from pg_proc p
      where p.oid=v_immutability and not p.prosecdef
        and exists(select 1 from unnest(coalesce(p.proconfig,ARRAY[]::text[])) c
          where c like 'search_path=%' and c like '%pg_catalog%')
        and pg_get_functiondef(p.oid) like '%errcode=''55000''%')
    or has_function_privilege('anon',v_immutability,'EXECUTE')
    or has_function_privilege('authenticated',v_immutability,'EXECUTE') then
    raise exception 'M123 QC staging preflight: append-only function grants or rejection semantics invalid';
  end if;

  -- M126: durable same-key replay evidence may never be rewritten or
  -- erased, including by a privileged service role. A second named BEFORE
  -- TRUNCATE trigger is required because row DELETE triggers cannot fire then.
  if v_receipt_immutability is null
    or (select count(*) from pg_trigger t
       where t.tgrelid=v_receipts
         and t.tgname='production_delivery_receipt_append_only'
         and t.tgfoid=v_receipt_immutability and t.tgenabled='O'
         and not t.tgisinternal
         and (t.tgtype::int & 1)=1
         and (t.tgtype::int & 2)=2
         and (t.tgtype::int & 8)=8
         and (t.tgtype::int & 16)=16)<>1
    or (select count(*) from pg_trigger t
       where t.tgrelid=v_receipts
         and t.tgname='production_delivery_receipt_no_truncate'
         and t.tgfoid=v_receipt_immutability and t.tgenabled='O'
         and not t.tgisinternal
         and (t.tgtype::int & 1)=0
         and (t.tgtype::int & 2)=2
         and (t.tgtype::int & 32)=32)<>1 then
    raise exception 'M126 delivery replay receipt append-only trigger missing or disabled';
  end if;
  if not exists(select 1 from pg_proc p
      where p.oid=v_receipt_immutability and not p.prosecdef
        and exists(select 1 from unnest(coalesce(p.proconfig,ARRAY[]::text[])) c
          where c like 'search_path=%' and c like '%pg_catalog%')
        and pg_get_functiondef(p.oid) like '%errcode=''55000''%')
    or has_function_privilege('anon',v_receipt_immutability,'EXECUTE')
    or has_function_privilege('authenticated',v_receipt_immutability,'EXECUTE') then
    raise exception 'M126 delivery receipt append-only function insecure';
  end if;

  -- M127: immutable quote and order state histories. No privileged UPDATE,
  -- DELETE or TRUNCATE may remove a delivered event while leaving a durable
  -- same-request replay receipt; both journals must be independently sealed.
  if v_event_immutability is null or v_quote_events is null
     or v_order_events is null then
    raise exception 'M127 production event journal or rejection function absent';
  end if;
  if not exists(select 1 from pg_proc p
      where p.oid=v_event_immutability and not p.prosecdef
        and exists(select 1 from unnest(coalesce(p.proconfig,ARRAY[]::text[])) c
          where c like 'search_path=%' and c like '%pg_catalog%')
        and pg_get_functiondef(p.oid) like '%errcode=''55000''%')
    or has_function_privilege('anon',v_event_immutability,'EXECUTE')
    or has_function_privilege('authenticated',v_event_immutability,'EXECUTE') then
    raise exception 'M127 production event rejection function insecure';
  end if;
  FOREACH v_event_table IN ARRAY ARRAY[v_quote_events,v_order_events] LOOP
    if not (select relrowsecurity from pg_class where oid=v_event_table)
       or has_table_privilege('anon',v_event_table,'SELECT')
       or has_table_privilege('authenticated',v_event_table,'SELECT') then
      raise exception 'M127 private event journal RLS or grants insecure';
    end if;
    if (select count(*) from pg_trigger t
        where t.tgrelid=v_event_table and t.tgfoid=v_event_immutability
          and t.tgenabled='O' and not t.tgisinternal
          and (t.tgtype::int & 1)=1 and (t.tgtype::int & 2)=2
          and (t.tgtype::int & 8)=8 and (t.tgtype::int & 16)=16
          and t.tgname in (
            'production_quote_event_append_only',
            'production_order_event_append_only'))<>1
      or (select count(*) from pg_trigger t
        where t.tgrelid=v_event_table and t.tgfoid=v_event_immutability
          and t.tgenabled='O' and not t.tgisinternal
          and (t.tgtype::int & 1)=0 and (t.tgtype::int & 2)=2
          and (t.tgtype::int & 32)=32
          and t.tgname in (
            'production_quote_event_no_truncate',
            'production_order_event_no_truncate'))<>1 then
      raise exception 'M127 production event append-only or TRUNCATE trigger missing or disabled';
    end if;
  END LOOP;

  -- M128: durable quote/order creation and non-delivery status replay
  -- receipts must be immutable, even when edited directly as a privileged
  -- SQL user; UPDATE/DELETE and TRUNCATE require distinct enabled triggers.
  if v_request_receipt_immutability is null
    or not exists(select 1 from pg_proc p
      where p.oid=v_request_receipt_immutability and not p.prosecdef
        and exists(select 1 from unnest(coalesce(p.proconfig,ARRAY[]::text[])) c
          where c like 'search_path=%' and c like '%pg_catalog%')
        and pg_get_functiondef(p.oid) like '%errcode=''55000''%')
    or has_function_privilege('anon',v_request_receipt_immutability,'EXECUTE')
    or has_function_privilege('authenticated',v_request_receipt_immutability,'EXECUTE') then
    raise exception 'M128 request replay rejection function missing or insecure';
  end if;
  for v_req_name,v_req_row_trigger,v_req_trunc_trigger in
    select * from (values
      ('production_creation_request_receipts',
       'production_creation_receipt_append_only','production_creation_receipt_no_truncate'),
      ('production_quote_status_request_receipts',
       'production_quote_status_receipt_append_only','production_quote_status_receipt_no_truncate'),
      ('production_order_status_request_receipts',
       'production_order_status_receipt_append_only','production_order_status_receipt_no_truncate')
    ) as requested(name,row_trigger,truncate_trigger)
  loop
    v_request_table:=to_regclass('private.'||v_req_name);
    if v_request_table is null
      or not (select relrowsecurity from pg_class where oid=v_request_table)
      or has_table_privilege('anon',v_request_table,'SELECT')
      or has_table_privilege('authenticated',v_request_table,'SELECT') then
      raise exception 'M128 request replay table missing or client grants unsafe: %',v_req_name;
    end if;
    if (select count(*) from pg_trigger t
        where t.tgrelid=v_request_table and t.tgname=v_req_row_trigger
          and t.tgfoid=v_request_receipt_immutability and t.tgenabled='O'
          and not t.tgisinternal and (t.tgtype::int & 1)=1
          and (t.tgtype::int & 2)=2 and (t.tgtype::int & 8)=8
          and (t.tgtype::int & 16)=16)<>1
      or (select count(*) from pg_trigger t
        where t.tgrelid=v_request_table and t.tgname=v_req_trunc_trigger
          and t.tgfoid=v_request_receipt_immutability and t.tgenabled='O'
          and not t.tgisinternal and (t.tgtype::int & 1)=0
          and (t.tgtype::int & 2)=2 and (t.tgtype::int & 32)=32)<>1 then
      raise exception 'M128 request replay append-only trigger missing or disabled: %',v_req_name;
    end if;
  end loop;

  -- M130: immutable locked quote/order recipe and financial identity,
  -- despite privileged direct SQL. Ordinary status and QC counter updates
  -- remain permitted through canonical state and inspection functions.
  if v_quote_table is null or v_locked_identity is null then
    raise exception 'M130 locked production identity table or guard absent';
  end if;
  if not exists(select 1 from pg_proc p
      where p.oid=v_locked_identity and not p.prosecdef
        and exists(select 1 from unnest(coalesce(p.proconfig,ARRAY[]::text[])) c
          where c like 'search_path=%' and c like '%pg_catalog%')
        and pg_get_functiondef(p.oid) like '%new.recipe_hash is distinct from old.recipe_hash%'
        and pg_get_functiondef(p.oid) like '%new.line_items is distinct from old.line_items%'
        and pg_get_functiondef(p.oid) like '%new.total is distinct from old.total%'
        and pg_get_functiondef(p.oid) like '%new.quote_id is distinct from old.quote_id%'
        and pg_get_functiondef(p.oid) like '%errcode=''55000''%')
    or has_function_privilege('anon',v_locked_identity,'EXECUTE')
    or has_function_privilege('authenticated',v_locked_identity,'EXECUTE') then
    raise exception 'M130 locked production identity trigger function missing or unsafe';
  end if;
  if (select count(*) from pg_trigger t
      where t.tgrelid=v_quote_table and t.tgname='production_quote_locked_identity'
        and t.tgfoid=v_locked_identity and t.tgenabled='O'
        and not t.tgisinternal and (t.tgtype::int & 1)=1
        and (t.tgtype::int & 2)=2 and (t.tgtype::int & 16)=16)<>1
    or (select count(*) from pg_trigger t
      where t.tgrelid=v_order_table and t.tgname='production_order_locked_identity'
        and t.tgfoid=v_locked_identity and t.tgenabled='O'
        and not t.tgisinternal and (t.tgtype::int & 1)=1
        and (t.tgtype::int & 2)=2 and (t.tgtype::int & 16)=16)<>1 then
    raise exception 'M130 locked production quote/order identity trigger missing or disabled';
  end if;

  if v_gate is null or v_delivery is null or v_hint is null then
    raise exception 'M122 QC staging preflight: status/delivery/eligibility RPC missing';
  end if;
  v_functions := ARRAY[v_gate,v_delivery,v_hint,v_trigger];
  FOREACH v_function IN ARRAY v_functions LOOP
    if not exists(
      select 1 from pg_proc p
      where p.oid=v_function
        and p.prosecdef
        and exists(select 1 from unnest(coalesce(p.proconfig,ARRAY[]::text[])) c
          where c like 'search_path=%' and c like '%private%')
    ) then
      raise exception 'M122 QC staging preflight: function % missing SECURITY DEFINER or fixed search path',
        v_function::regprocedure;
    end if;
    if has_function_privilege('anon',v_function,'EXECUTE')
      or has_function_privilege('authenticated',v_function,'EXECUTE') then
      raise exception 'M122 QC staging preflight: function % grants unsafe client EXECUTE',
        v_function::regprocedure;
    end if;
  END LOOP;
  if not has_function_privilege('service_role',v_gate,'EXECUTE')
    or not has_function_privilege('service_role',v_delivery,'EXECUTE')
    or not has_function_privilege('service_role',v_hint,'EXECUTE') then
    raise exception 'M122 QC staging preflight: service-only RPC execution missing';
  end if;

  if not (select relrowsecurity from pg_class where oid=v_qc_table)
     or not (select relrowsecurity from pg_class where oid=v_receipts) then
    raise exception 'M122 QC staging preflight: private evidence RLS disabled';
  end if;
  if has_table_privilege('anon',v_qc_table,'SELECT')
    or has_table_privilege('authenticated',v_qc_table,'SELECT')
    or has_table_privilege('anon',v_receipts,'SELECT')
    or has_table_privilege('authenticated',v_receipts,'SELECT') then
    raise exception 'M122 QC staging preflight: private evidence readable by browser roles';
  end if;

  if not exists(
    select 1 from pg_proc p where p.oid=v_gate
      and pg_get_functiondef(p.oid) like '%v_latest_sequence is distinct from v_order_sequence%'
      and pg_get_functiondef(p.oid) like '%six exact passing physical QC checks required before delivery%'
  ) or not exists(
    select 1 from pg_proc p where p.oid=v_hint
      and pg_get_functiondef(p.oid) like '%q.inspection_sequence=o.qc_latest_sequence%'
  ) then
    raise exception 'M122 QC staging preflight: active SQL functions do not enforce latest physical QC proof';
  end if;
END
$titan$;
COMMIT;
