-- SYNTHETIC LEGACY RECEIPTS: disposable Actions PostgreSQL ONLY.
-- Never insert these rows into a real or staging inventory ledger.
insert into private.fabric_stock_ledger (
  fabric_id,event_type,quantity_metres,note,recorded_by,
  source_reference,request_key
) values
  ('ci-receipt-audit-fabric','receipt',1.000,'','Fixture Checker',
   'Supplier-001-Line-1','ci-receipt-audit-key-1'),
  ('ci-receipt-audit-fabric','receipt',1.000,'','Fixture Checker',
   ' supplier-001-line-1 ','ci-receipt-audit-key-2'),
  ('ci-receipt-audit-fabric','receipt',1.000,'','Fixture Checker',
   '','ci-receipt-audit-key-3'),
  ('ci-receipt-audit-fabric','receipt',1.000,'','',
   'TBD',null);
