"use strict";
// Real PostgREST-to-disposable-PostgreSQL contract. Synthetic data only.
// Not a Supabase migration and not physical production acceptance.
const assert=require("node:assert/strict");
const {createHmac,randomUUID}=require("node:crypto");
const mode=process.argv[2];
if(!["before","after"].includes(mode))throw new Error("Specify before or after staged v3 migration.");
if(process.env.PGDATABASE!=="titan_synthetic"||
   process.env.PGHOST!=="127.0.0.1"||
   process.env.TITAN_SYNTHETIC_PG_TEST!=="enabled")
   throw new Error("Refusing to exercise PostgREST outside opt-in localhost synthetic DB.");
const secret=process.env.TITAN_POSTGREST_JWT_SECRET;
if(!secret||secret.length<32)throw new Error("Synthetic JWT secret missing.");
const base="http://127.0.0.1:3017";
const fabric="SYNTHETIC-TITAN-POSTGREST-"+randomUUID();
const key="SYNTH-POSTGREST-"+randomUUID();
const payload={
  p_fabric_id:fabric,p_event_type:"receipt",p_quantity_metres:2.125,
  p_note:"synthetic postgrest only",p_recorded_by:"Synthetic checker",
  p_source_reference:"Synthetic calibration roll",p_request_key:key,
};
function jwt(role){
  const a=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
  const b=Buffer.from(JSON.stringify({role,exp:Math.floor(Date.now()/1000)+300})).toString("base64url");
  const signature=createHmac("sha256",secret).update(a+"."+b).digest("base64url");
  return a+"."+b+"."+signature;
}
async function request(name,body,role="service_role"){
  const res=await fetch(base+"/rpc/"+name,{
    method:"POST",headers:{"content-type":"application/json",
      ...(role?{authorization:"Bearer "+jwt(role)}:{})},
    body:JSON.stringify(body),signal:AbortSignal.timeout(5000),
  });
  return {status:res.status,body:await res.text()};
}
async function main(){
  if(mode==="before"){
    const r=await request("fabric_stock_record_v3",payload);
    assert.ok(r.status===404||r.status===401,
      "new RPC must not exist in PostgREST schema before migration; got "+r.status);
    console.log("M46 PostgREST initial schema verified: stock v3 RPC absent.");
    return;
  }
  const inserted=await request("fabric_stock_record_v3",payload);
  assert.equal(inserted.status,200,"service_role v3 RPC missing after schema reload: "+inserted.body.slice(0,220));
  const first=JSON.parse(inserted.body);
  assert.match(first,/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
  const retry=await request("fabric_stock_record_v3",payload);
  assert.equal(retry.status,200,"identical PostgREST replay failed");
  assert.equal(JSON.parse(retry.body),first,"replay must return original physical event UUID");
  const mismatch=await request("fabric_stock_record_v3",{...payload,p_quantity_metres:2.126});
  assert.equal(mismatch.status,400,"same key with changed quantity must be rejected");
  for(const role of [null,"anon","authenticated"]){
    const forbidden=await request("fabric_stock_record_v3",
      {...payload,p_request_key:key+"-denied-"+(role||"public")},role);
    assert.ok(forbidden.status===401||forbidden.status===403||forbidden.status===404,
      "non-service role must never mutate physical stock: "+(role||"public")+" "+forbidden.status);
  }
  const snapshot=await request("fabric_stock_snapshot_v2",{p_fabric_ids:[fabric]});
  assert.equal(snapshot.status,200,"service-role stock snapshot RPC failed");
  const rows=JSON.parse(snapshot.body);
  assert.equal(rows.length,1);
  assert.equal(Number(rows[0].physical_metres),2.125);
  assert.equal(Number(rows[0].available_metres),2.125);
  console.log("M46 PostgREST real HTTP PASS: reload, v3 creation, replay, mismatch, role denial and ledger snapshot.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
