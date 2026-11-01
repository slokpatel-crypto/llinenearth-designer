"use strict";
// Authenticated built-Next stock API checks against a fake localhost PostgREST.
// Never connects to Supabase or modifies real stock/provenance records.
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {spawn}=require("node:child_process");
const {createHmac,randomBytes}=require("node:crypto");
async function listen(server){
  server.listen(0,"127.0.0.1");await once(server,"listening");
  return server.address().port;
}
async function freePort(){
  const server=http.createServer(),p=await listen(server);
  await new Promise(resolve=>server.close(resolve));return p;
}
async function main(){
  const secret=randomBytes(32).toString("hex");
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180_000})).toString("base64url");
  const signature=createHmac("sha256",secret).update(payload).digest("base64url");
  const cookie="linen_operator_session="+payload+"."+signature;
  const fabric="linen-plain-60-sky-blue";
  const uuid="b287e470-0e90-4fd4-b5fb-976eecebd244";
  const marker="SYNTHETIC_PRIVATE_SUPPLIER_SECRET_NOT_FOR_LOGS";
  const valid={fabric_id:fabric,physical_metres:10,reserved_metres:2.125,
    available_metres:7.875,manual_event_count:2,provenance_event_count:2,
    legacy_unverified_event_count:0,provenance_ready:true,
    last_event_at:"2026-11-01T18:00:00Z"};
  let mode="valid";
  const seen=[];
  const upstream=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    seen.push({path:req.url,body});
    const path=req.url||"";
    assert.ok(path.startsWith("/rest/v1/rpc/fabric_stock_"),"unrecognized fake RPC path");
    let response;
    if(path.endsWith("/fabric_stock_snapshot_v2")){
      response={
        valid:[valid],snapshotNull:null,snapshotObject:{stock:[valid]},
        snapshotWrongFabric:[{...valid,fabric_id:"invented-fabric"}],
        snapshotMissingMetres:[{...valid,available_metres:null}],
        snapshotInconsistent:[{...valid,available_metres:10}],
      }[mode]??[valid];
    }else if(path.endsWith("/fabric_stock_record_v2")||
             path.endsWith("/fabric_stock_reserve_v2")){
      response={
        created:uuid,createNull:null,createObject:{id:uuid},
        createArray:[uuid],createBool:true,createString:"false",
        createWrongUuid:"not-uuid",
      }[mode]??uuid;
    }else if(path.endsWith("/fabric_stock_release_v2")||
             path.endsWith("/fabric_stock_consume_reservation_v2")){
      response=mode==="releaseFalse"?false:true;
    }else throw Error("Unexpected stock RPC "+path);
    if(mode==="backend500"){
      res.writeHead(500,{"content-type":"application/json"});
      res.end(JSON.stringify({error:marker,detail:"private SQL source"}));return;
    }
    if(mode==="wrongMime"){
      res.writeHead(200,{"content-type":"text/html"});res.end(JSON.stringify(response));return;
    }
    if(mode==="oversize"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end('["'+ "x".repeat(2_097_152)+'"]');return;
    }
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify(response));
  });
  const upstreamPort=await listen(upstream),nextPort=await freePort();
  const env={...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",
    LINEN_OPERATOR_SESSION_SECRET:secret,
    SUPABASE_URL:"http://127.0.0.1:"+upstreamPort,
    SUPABASE_SECRET_KEY:"sb_secret_titan_fake_stock_only",
    SUPABASE_SERVICE_ROLE_KEY:"",SUPABASE_ANON_KEY:"",NEXT_PUBLIC_SUPABASE_ANON_KEY:""};
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
    "start","-H","127.0.0.1","-p",String(nextPort)],
    {env,stdio:["ignore","pipe","pipe"]});
  let output="";for(const stream of [child.stdout,child.stderr])
    stream.on("data",chunk=>{output=(output+chunk).slice(-10000);});
  const url="http://127.0.0.1:"+nextPort+"/api/operator/stock";
  async function call(method,body){
    const response=await fetch(url,{method,
      headers:{cookie,"content-type":"application/json","connection":"close"},
      ...(body?{body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
    assert.ok(!JSON.stringify(result).includes(marker));
    return {response,result};
  }
  try{
    let ready=false;
    for(let i=0;i<120;i++){
      if(child.exitCode!==null)throw Error("Next exited early");
      try{
        const response=await fetch(url,{headers:{"connection":"close"},
          signal:AbortSignal.timeout(800)});
        ready=response.status===401;
      }catch{}
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,"Next stock fixture did not start");
    for(const kind of [
      "valid","snapshotNull","snapshotObject","snapshotWrongFabric",
      "snapshotMissingMetres","snapshotInconsistent","backend500",
      "wrongMime","oversize",
    ]){
      mode=kind;seen.length=0;
      const {response,result}=await call("GET");
      assert.equal(response.status,kind==="valid"?200:503,kind);
      assert.equal(seen.length,1,kind);
      if(kind==="valid")assert.deepEqual(result,{configured:true,stock:[valid]});
      else assert.deepEqual(result,{error:"Stock ledger could not be read."});
    }
    const record={action:"record",fabricId:fabric,eventType:"receipt",
      quantityMetres:2.125,recordedBy:"Synthetic checker",
      sourceReference:"SYNTH-ROLL-001"};
    const reservation={action:"reserve",fabricId:fabric,quantityMetres:1.25,
      revisionId:"LE-LOCK-SYNTHETIC-0001",requestKey:"STOCK-REQUEST-SYNTHETIC-0001",
      requestedBy:"Synthetic checker",sourceReference:"SYNTH-CUT-SHEET"};
    for(const body of [record,reservation]){
      for(const kind of [
        "created","createNull","createObject","createArray","createBool",
        "createString","createWrongUuid","backend500","wrongMime","oversize",
      ]){
        mode=kind;seen.length=0;
        const {response,result}=await call("POST",body);
        assert.equal(response.status,kind==="created"?200:503,body.action+" "+kind);
        assert.equal(seen.length,1,kind);
        assert.equal(seen[0].path,
          "/rest/v1/rpc/"+(body.action==="record"?"fabric_stock_record_v2":"fabric_stock_reserve_v2"));
        if(kind==="created")assert.deepEqual(result,
          {[body.action==="record"?"eventId":"reservationId"]:uuid});
        else assert.deepEqual(result,{error:"Stock operation could not be verified."});
      }
    }
    assert.ok(!output.includes(marker),"private fake stock RPC error leaked in server logs");
    console.log("TITAN stock API private boundary PASS: 29 synthetic authenticated cases, no real writes.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>upstream.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
