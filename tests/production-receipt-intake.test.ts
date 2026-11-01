import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProductionCreationReceipts,
  parseProductionCreationReceiptResponse,
} from "../src/lib/designer/production-creation-receipt-lookup.ts";
import {
  parseProductionStatusReceipts,
  parseProductionStatusReceiptResponse,
} from "../src/lib/designer/production-status-receipt-lookup.ts";

const quote="123e4567-e89b-42d3-a456-426614174010";
const order="123e4567-e89b-42d3-a456-426614174011";
test("main intake: exact private SQL creation receipts normalize to safe public metadata",()=>{
  const rows=[
    {action:"create_quote",receipt_id:quote.toUpperCase()},
    {action:"create_order",receipt_id:order},
  ];
  const safe=[
    {action:"create_quote",receiptId:quote},
    {action:"create_order",receiptId:order},
  ];
  assert.deepEqual(parseProductionCreationReceipts(rows),safe);
  assert.deepEqual(parseProductionCreationReceiptResponse(safe),safe);
  assert.deepEqual(parseProductionCreationReceipts([]),[]);
  assert.deepEqual(parseProductionCreationReceiptResponse([]),[]);
  assert.equal(parseProductionCreationReceipts(safe),null,
    "Raw SQL parser cannot accept sanitized API-shaped receipt objects");
  assert.equal(parseProductionCreationReceiptResponse(rows),null,
    "Browser API parser cannot accept raw SQL-shaped objects");
});
test("main intake: reject private columns, duplicate actions, malformed and oversized creation data",()=>{
  const valid={action:"create_quote",receipt_id:quote};
  const safe={action:"create_quote",receiptId:quote};
  for(const bad of [
    null,{},[null],[{}],
    [{...valid,privateCustomerPhone:"secret"}],
    [{...valid,receipt_id:"not-a-uuid"}],
    [{...valid,action:"unknown"}],
    [valid,valid],
    [valid,{action:"create_quote",receipt_id:order}],
    [valid,{action:"create_order",receipt_id:order},valid],
  ])assert.equal(parseProductionCreationReceipts(bad),null);
  for(const bad of [
    null,{},[null],[{}],
    [{...safe,privateNote:"secret"}],
    [{...safe,receiptId:"broken"}],
    [{...safe,action:"unknown"}],
    [safe,safe],
    [safe,{action:"create_order",receiptId:order},safe],
  ])assert.equal(parseProductionCreationReceiptResponse(bad),null);
});
test("main intake: exact SQL status receipts normalize to strictly allowed status metadata",()=>{
  const rows=[
    {action:"quote_status",record_id:quote.toUpperCase(),target_status:"accepted"},
    {action:"order_status",record_id:order,target_status:"delivered"},
  ];
  const safe=[
    {action:"quote_status",recordId:quote,status:"accepted"},
    {action:"order_status",recordId:order,status:"delivered"},
  ];
  assert.deepEqual(parseProductionStatusReceipts(rows),safe);
  assert.deepEqual(parseProductionStatusReceiptResponse(safe),safe);
  assert.deepEqual(parseProductionStatusReceipts([]),[]);
  assert.deepEqual(parseProductionStatusReceiptResponse([]),[]);
  assert.equal(parseProductionStatusReceipts(safe),null);
  assert.equal(parseProductionStatusReceiptResponse(rows),null);
});
test("main intake: no guessed, private, duplicate or excessive status receipt evidence",()=>{
  const row={action:"order_status",record_id:order,target_status:"ready"};
  const safe={action:"order_status",recordId:order,status:"ready"};
  for(const bad of [
    null,{},[null],[{}],
    [{...row,statusNote:"secret"}],
    [{...row,target_status:"unknown"}],
    [{...row,record_id:"bad"}],
    [{...row,action:"quote_status"}],
    [row,row],
    [row,row,row,row],
  ])assert.equal(parseProductionStatusReceipts(bad),null);
  for(const bad of [
    null,{},[null],[{}],
    [{...safe,privateCustomer:"secret"}],
    [{...safe,status:"unknown"}],
    [{...safe,recordId:"bad"}],
    [{...safe,action:"quote_status"}],
    [safe,safe],
    [safe,safe,safe,safe],
  ])assert.equal(parseProductionStatusReceiptResponse(bad),null);
});
