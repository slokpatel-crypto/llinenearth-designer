-- SYNTHETIC records for disposable PostgreSQL CI ONLY.
-- Never run this file against live or staging supplier stock.
insert into private.fabric_stock_ledger (
  fabric_id,event_type,quantity_metres,reservation_id,revision_id,
  request_key,note,recorded_by,source_reference
) values
  ('ci-audit-fabric','reserve',1.000,gen_random_uuid(),
   'locked-ci-audit-rev-1','ci-audit-duplicate-key-1',
   'locked design reservation','Fixture Checker','Sheet-Legacy-001-Line-1'),
  ('ci-audit-fabric','reserve',1.000,gen_random_uuid(),
   'locked-ci-audit-rev-1','ci-audit-duplicate-key-2',
   'locked design reservation','Fixture Checker',' sheet-legacy-001-line-1 '),
  ('ci-audit-fabric','reserve',1.000,gen_random_uuid(),
   'locked-ci-audit-rev-2','ci-audit-missing-source-1',
   'locked design reservation','Fixture Checker',''),
  ('ci-audit-fabric','reserve',1.000,gen_random_uuid(),
   null,'ci-audit-missing-revision-1',
   'locked design reservation','Fixture Checker','Sheet-Legacy-002-Line-1'),
  ('ci-audit-fabric','reserve',1.000,null,
   'locked-ci-audit-rev-3',null,
   'locked design reservation','','TBD');
