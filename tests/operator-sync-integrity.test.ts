import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  parseOperatorSyncPage,validOperatorLocalDate,validOperatorLocalDateTime,
  validOperatorSyncTimestamp,operatorSyncNumber,readOperatorSyncBatch,
  OperatorSyncBatchError,validateOperatorSyncReadRows,
} from "../src/lib/operator-sync-integrity.ts";

const base="https://linenearth.example/api/operator/sync";
const page=(query:string)=>parseOperatorSyncPage(new URL(base+query));
test("sync pagination preserves safe legacy and compound cursors",()=>{
  assert.deepEqual(page(""),{limit:500,cursor:null});
  assert.deepEqual(page("?limit=1200"),{limit:1000,cursor:null});
  assert.deepEqual(page("?cursor=2026-10-28T05%3A00%3A00%2B05%3A30"),{
    limit:500,cursor:{receivedAt:"2026-10-28T05:00:00+05:30",id:null},
  });
  assert.deepEqual(page("?limit=20&cursor=2026-10-28T00%3A00%3A00.123456Z%7Cevt_abc-01"),{
    limit:20,cursor:{receivedAt:"2026-10-28T00:00:00.123456Z",id:"evt_abc-01"},
  });
});
test("sync cursor cannot inject PostgREST filters or skip malformed time boundaries",()=>{
  for(const cursor of [
    "", "2027-02-29T00:00:00Z", "2026-01-01T24:00:00Z",
    "2026-10-28", "2026-10-28T00:00:00",
    "2026-10-28T00:00:00Z|", "2026-10-28T00:00:00Z|abc,id.gt.0",
    "2026-10-28T00:00:00Z|abc)or(id.gt.0",
    "2026-10-28T00:00:00Z|abc|def",
    "2026-10-28T00:00:00Z|abc.def",
  ])assert.equal(page("?cursor="+encodeURIComponent(cursor)),null,cursor);
  for(const limit of ["0","-1","NaN","Infinity","1.2","", "100000000000000000000"])
    assert.equal(page("?limit="+encodeURIComponent(limit)),null,limit);
});
test("strict operator event timestamps and scheduled dates reject JS normalization",()=>{
  assert.equal(validOperatorSyncTimestamp("2028-02-29T00:00:00Z"),true);
  assert.equal(validOperatorSyncTimestamp("2027-02-29T00:00:00Z"),false);
  assert.equal(validOperatorSyncTimestamp("2026-01-01"),false);
  assert.equal(validOperatorLocalDate("2028-02-29"),true);
  assert.equal(validOperatorLocalDate("2027-02-29"),false);
  assert.equal(validOperatorLocalDate("2026-04-31"),false);
  assert.equal(validOperatorLocalDateTime("2026-10-28T23:59"),true);
  assert.equal(validOperatorLocalDateTime("2026-10-28T24:00"),false);
  assert.equal(validOperatorLocalDateTime("2026-02-30T10:00"),false);
});
test("operator financial and tape evidence refuses numeric coercion",()=>{
  for(const value of [null,true,false,"5",[],{},NaN,Infinity,-1])
    assert.equal(operatorSyncNumber(value,0,100),null);
  assert.equal(operatorSyncNumber(0,0,100),0);
  assert.equal(operatorSyncNumber(45.25,0,100),45.25);
  assert.equal(operatorSyncNumber(101,0,100),null);
});
const req=(body:string)=>new Request(base,{method:"POST",body,headers:{"content-type":"application/json"}});
test("operator sync batch rejects oversized, invalid and silently truncated submissions",async()=>{
  assert.deepEqual(await readOperatorSyncBatch(req('{"events":[]}')),[]);
  assert.equal((await readOperatorSyncBatch(req(JSON.stringify({events:Array(250).fill({id:"x"})})))).length,250);
  await assert.rejects(()=>readOperatorSyncBatch(req(JSON.stringify({events:Array(251).fill({id:"x"})}))),e=>e instanceof OperatorSyncBatchError&&e.status===413);
  for(const body of ["{}","[]","null",'{"events":null}',"{oops"])
    await assert.rejects(()=>readOperatorSyncBatch(req(body)),OperatorSyncBatchError);
  await assert.rejects(()=>readOperatorSyncBatch(req(JSON.stringify({events:[],extra:"x".repeat(256_100)}))),e=>e instanceof OperatorSyncBatchError&&e.status===413);
});
test("corrupt backend page cannot advance sync cursor or impersonate a stored event",()=>{
  const good={id:"evt-1",session_id:"s-1",type:"operator_note",at:"2026-10-28T00:00:00Z",
    source:"operator-desktop",payload:{note:"hello"},received_at:"2026-10-28T00:01:00Z"};
  assert.deepEqual(validateOperatorSyncReadRows([good],5),[good]);
  for(const rows of [null,{},[null],[[]],[{...good,id:"bad)or(id.gt.0"}],
    [{...good,received_at:"2027-02-29T00:00:00Z"}],
    [{...good,payload:[]}],Array(2).fill(good)])
    assert.equal(validateOperatorSyncReadRows(rows,1),null);
});
test("route validates before privileged RPC, rejects silent truncation and guards response cursor",()=>{
  const route=readFileSync("src/app/api/operator/sync/route.ts","utf8");
  assert.ok(route.includes("readOperatorSyncBatch(request)"));
  assert.ok(route.includes("parseOperatorSyncPage(incomingUrl)"));
  assert.ok(route.includes("validateOperatorSyncReadRows(await response.json(),limit)"));
  assert.ok(!route.includes("body.events.slice(0,250)"));
  assert.ok(!route.includes('new Date(String(body.at || ""))'));
});

test("cloud event ordering and identical-instant ID tie-breaks are enforced",()=>{
  const row={id:"evt-a",session_id:"s-a",type:"operator_note",
    at:"2026-10-28T00:00:00Z",received_at:"2026-10-28T00:01:00Z",
    source:"operator-desktop",payload:{note:"ok"}};
  assert.deepEqual(validateOperatorSyncReadRows([row,{...row,id:"evt-b"}],2)?.length,2);
  assert.deepEqual(validateOperatorSyncReadRows([{...row,id:"evt-b"},row],2)?.length,2);
  assert.equal(validateOperatorSyncReadRows([row,row],2),null);
  assert.deepEqual(validateOperatorSyncReadRows([{...row,id:"evt-b",received_at:"2026-10-28T00:01:00.123456Z"},{...row,received_at:"2026-10-28T00:01:00.123789Z"}],2)?.length,2);
  assert.equal(validateOperatorSyncReadRows([{...row,id:"evt-b",received_at:"2026-10-28T00:02:00Z"},row],2),null);
});
test("operator route refuses truncated date/time fields and coerced financial evidence",()=>{
  const route=readFileSync("src/app/api/operator/sync/route.ts","utf8");
  assert.ok(route.includes('validOperatorLocalDate(dueDate)'));
  assert.ok(route.includes('validOperatorLocalDateTime(dateTime)'));
  assert.ok(route.includes('operatorSyncNumber(payload.amount,0,100_000_000)'));
  assert.ok(route.includes('operatorSyncNumber(rawValue,0,max)'));
  assert.ok(!route.includes('text(payload.dueDate, 10)'));
  assert.ok(!route.includes('text(payload.dateTime, 16)'));
  assert.ok(!route.includes('Number(rawValue)'));
  assert.ok(route.includes('stored: null'));
});

test("cloud schema health requires a literal numeric v5 acknowledgement",()=>{
  const route=readFileSync("src/app/api/operator/sync/route.ts","utf8");
  assert.ok(route.includes('const version:unknown = await response.json()'));
  assert.ok(route.includes('typeof version !== "number" || version !== 5'));
  assert.ok(!route.includes('Number(await response.json())'));
});
