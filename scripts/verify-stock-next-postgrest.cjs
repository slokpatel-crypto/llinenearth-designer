"use strict";
// True Next.js server -> reverse path adapter -> real PostgREST -> disposable
// PostgreSQL 16 stock RPC integration. Synthetic keys and data only.
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {spawn}=require("node:child_process");
const {createHmac,randomUUID}=require("node:crypto");
if(process.env.PGDATABASE!=="titan_synthetic"||
   process.env.PGHOST!=="127.0.0.1"||
   process.env.TITAN_SYNTHETIC_PG_TEST!=="enabled")
  throw new Error("Refusing real Next->PostgREST test outside synthetic localhost.");
const jwtSecret=process.env.TITAN_POSTGREST_JWT_SECRET;
if(!jwtSecret||jwtSecret.length<32)throw new Error("Synthetic PostgREST JWT secret unavailable.");
const sessionSecret="titan-m48-synthetic-operator-session-secret-"+randomUUID();
const eventKey="SYNTH-M48-"+randomUUID();
const fabricId="linen-plain-60-sky-blue";
const evidence={action:"record",fabricId,eventType:"receipt",quantityMetres:1.375,
  note:"synthetic local PostgREST integration",recordedBy:"Synthetic checker",
  sourceReference:"SYNTH-M48-ROLL",requestKey:eventKey};
function jwt(role){
  const head=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
  const body=Buffer.from(JSON.stringify({role,exp:Math.floor(Date.now()/1000)+300})).toString("base64url");
  return head+"."+body+"."+createHmac("sha256",jwtSecret).update(head+"."+body).digest("base64url");
}
function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180000})).toString("base64url");
  return "linen_operator_session="+payload+"."+
    createHmac("sha256",sessionSecret).update(payload).digest("base64url");
}
async function listen(server){
  server.listen(0,"127.0.0.1");await once(server,"listening");
  return server.address().port;
}
async function freePort(){
  const s=http.createServer(),p=await listen(s);
  await new Promise(resolve=>s.close(resolve));return p;
}
async function main(){
  // PostgREST is mounted at /rpc/*. Supabase's Next SDK uses /rest/v1/rpc/*.
  // A local-only transport adapter rewrites the URL path and forwards the
  // original service-role JWT without altering the real REST request/response.
  // One synthetic gateway response will be lost after a successful SQL commit.
  // This creates a genuine ambiguous Next.js 503 without changing the real DB.
  let loseOneCommittedReceiptAck=false;
  let swallowedCommittedReceiptAck=false;
  let loseOneCommittedReservationAck=false;
  let swallowedCommittedReservationAck=false;
  let loseOneCommittedCloseAck=null;
  let swallowedCommittedCloseAck=null;
  const proxy=http.createServer((req,res)=>{
    if(!req.url.startsWith("/rest/v1/rpc/")){
      res.writeHead(404);res.end();return;
    }
    const incoming=http.request({
      hostname:"127.0.0.1",port:3017,path:req.url.slice("/rest/v1".length),
      method:req.method,headers:req.headers,
    },remote=>{
      const dropReceipt=loseOneCommittedReceiptAck&&
        req.url==="/rest/v1/rpc/fabric_stock_record_v3";
      const dropReserve=loseOneCommittedReservationAck&&
        req.url==="/rest/v1/rpc/fabric_stock_reserve_v2";
      const dropClose=loseOneCommittedCloseAck!==null&&
        req.url==="/rest/v1/rpc/"+loseOneCommittedCloseAck;
      if(dropReceipt||dropReserve||dropClose){
        if(dropReceipt)loseOneCommittedReceiptAck=false;
        if(dropReserve)loseOneCommittedReservationAck=false;
        if(dropClose)loseOneCommittedCloseAck=null;
        // Consume the real upstream 200 fully first: PostgREST/PostgreSQL
        // have already inserted and committed. Replace only its HTTP ack.
        const committed=remote.statusCode===200;
        remote.resume();
        remote.on("end",()=>{
          if(dropReceipt)swallowedCommittedReceiptAck=committed;
          if(dropReserve)swallowedCommittedReservationAck=committed;
          if(dropClose)swallowedCommittedCloseAck=committed;
          res.writeHead(502,{"content-type":"application/json"});
          res.end(JSON.stringify({error:"synthetic gateway lost committed reply"}));
        });
        return;
      }
      res.writeHead(remote.statusCode||502,remote.headers);remote.pipe(res);
    });
    incoming.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});
    req.pipe(incoming);
  });
  const proxyPort=await listen(proxy),nextPort=await freePort();
  const env={...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",
    LINEN_OPERATOR_SESSION_SECRET:sessionSecret,
    SUPABASE_URL:"http://127.0.0.1:"+proxyPort,
    SUPABASE_SERVICE_ROLE_KEY:jwt("service_role"),
    SUPABASE_SECRET_KEY:"",
    SUPABASE_ANON_KEY:"",NEXT_PUBLIC_SUPABASE_ANON_KEY:""};
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
    "start","-H","127.0.0.1","-p",String(nextPort)],{
      env,stdio:["ignore","pipe","pipe"],
    });
  let output="";for(const stream of [child.stdout,child.stderr])
    stream.on("data",chunk=>{output=(output+chunk).slice(-8000);});
  const url="http://127.0.0.1:"+nextPort+"/api/operator/stock";
  const operatorCookie=cookie();
  async function call(method,body,opts={}){
    const res=await fetch(url,{method,headers:{
      "content-type":"application/json",
      ...(opts.authorized===false?{}:{cookie:operatorCookie}),
      ...(opts.origin?{origin:opts.origin}:{}),
    },...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    const data=await res.json();
    assert.match(res.headers.get("cache-control")||"",/private.*no-store/);
    return {status:res.status,data};
  }
  try{
    let online=false;
    for(let i=0;i<120;i++){
      if(child.exitCode!==null)throw Error("Next fixture stopped: "+output.slice(-2000));
      try{const r=await call("GET",null,{authorized:false});online=r.status===401;}catch{}
      if(online)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(online,"Next stock operator endpoint did not start.");
    const unauthorized=await call("POST",evidence,{authorized:false});
    assert.equal(unauthorized.status,401);
    const crossSite=await call("POST",evidence,{origin:"https://evil.example"});
    assert.equal(crossSite.status,403);
    const wrong=await call("POST",{...evidence,requestKey:""});
    assert.equal(wrong.status,409,"missing receipt key must not reach PostgreSQL");
    const first=await call("POST",evidence);
    assert.equal(first.status,200,"Next->PostgREST v3 insert failed: "+JSON.stringify(first.data));
    assert.match(first.data.eventId,/^[0-9a-f-]{36}$/i);
    const repeated=await call("POST",evidence);
    assert.equal(repeated.status,200);
    assert.equal(repeated.data.eventId,first.data.eventId,"replayed key must return original UUID");
    const changed=await call("POST",{...evidence,quantityMetres:1.376});
    assert.equal(changed.status,503,"changed stock evidence must fail closed without upstream details");
    assert.deepEqual(changed.data,{error:"Stock operation could not be verified."});
    const snapshot=await call("GET");
    assert.equal(snapshot.status,200,"real v2 stock snapshot must be readable by operator");
    assert.equal(snapshot.data.configured,true);
    const row=snapshot.data.stock.find(x=>x.fabric_id===fabricId);
    assert.ok(row,"synthetic stock insert missing from real ledger response");
    assert.equal(Number(row.physical_metres),1.375);
    assert.equal(Number(row.available_metres),1.375);
    assert.equal(row.manual_event_count,1,"same-key retry created multiple ledger records");
    assert.equal(row.provenance_ready,true);

    const ambiguous={...evidence,quantityMetres:0.625,
      sourceReference:"SYNTH-M49-LOST-ACK",
      requestKey:"SYNTH-M48-"+randomUUID()};
    loseOneCommittedReceiptAck=true;
    const lostAck=await call("POST",ambiguous);
    assert.equal(lostAck.status,503,"committed stock receipt must not be falsely acknowledged");
    assert.deepEqual(lostAck.data,{error:"Stock operation could not be verified."});
    assert.equal(swallowedCommittedReceiptAck,true,"gateway loss must occur AFTER a real successful SQL write");
    const afterLoss=await call("GET");
    assert.equal(afterLoss.status,200);
    const pendingRow=afterLoss.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(pendingRow.physical_metres),2.000,
      "the lost-ack stock receipt really committed despite the Next 503");
    assert.equal(pendingRow.manual_event_count,2);
    const replayAfterLoss=await call("POST",ambiguous);
    assert.equal(replayAfterLoss.status,200,"same key must be safe after ambiguous 503");
    assert.match(replayAfterLoss.data.eventId,/^[0-9a-f-]{36}$/i);
    const final=await call("GET");
    assert.equal(final.status,200);
    const finalRow=final.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(finalRow.physical_metres),2.000,
      "replay after a lost committed acknowledgment must not mint another metre");
    assert.equal(finalRow.manual_event_count,2,
      "replay after a lost acknowledgment must not insert a third event");
    const reservation={
      action:"reserve",fabricId,quantityMetres:0.750,
      revisionId:"LE-LOCK-SYNTHETIC-M56-20261102",
      requestedBy:"Synthetic cutting checker",
      sourceReference:"SYNTH-M56-APPROVED-CUT-SHEET",
      requestKey:"SYNTH-M48-"+randomUUID(),
    };
    loseOneCommittedReservationAck=true;
    const reserveLost=await call("POST",reservation);
    assert.equal(reserveLost.status,503,"reservation committed but lost ACK must not be reported successful");
    assert.deepEqual(reserveLost.data,{error:"Stock operation could not be verified."});
    assert.equal(swallowedCommittedReservationAck,true,
      "gateway must drop a real HTTP 200 after the reservation transaction committed");
    const reservedState=await call("GET");
    assert.equal(reservedState.status,200);
    const reservedRow=reservedState.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(reservedRow.physical_metres),2.000);
    assert.equal(Number(reservedRow.reserved_metres),0.750,
      "reservation really committed despite ambiguous first HTTP outcome");
    assert.equal(Number(reservedRow.available_metres),1.250);
    const reserveReplay=await call("POST",reservation);
    assert.equal(reserveReplay.status,200,"identical reservation must safely replay after a lost ACK");
    assert.match(reserveReplay.data.reservationId,/^[0-9a-f-]{36}$/i);
    const reserveRepeated=await call("POST",reservation);
    assert.equal(reserveRepeated.status,200,"repeated same-key reserve must remain idempotent");
    assert.equal(reserveRepeated.data.reservationId,reserveReplay.data.reservationId,
      "reservation replays must return the original committed reservation UUID");
    const reserveMismatch=await call("POST",{...reservation,quantityMetres:0.751});
    assert.equal(reserveMismatch.status,503,
      "changed quantity with an existing reservation key must fail closed");
    assert.deepEqual(reserveMismatch.data,{error:"Stock operation could not be verified."});
    const reserveDifferentSource=await call("POST",{
      ...reservation,sourceReference:"SYNTH-M56-DIFFERENT-CUT-SHEET",
    });
    assert.equal(reserveDifferentSource.status,503,
      "changed cutting-sheet evidence with an old key must fail closed");
    const reservedFinal=await call("GET");
    assert.equal(reservedFinal.status,200);
    const finalReservedRow=reservedFinal.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(finalReservedRow.physical_metres),2.000);
    assert.equal(Number(finalReservedRow.reserved_metres),0.750,
      "lost-ACK replay may not reserve the same cloth twice");
    assert.equal(Number(finalReservedRow.available_metres),1.250);
    assert.equal(finalReservedRow.manual_event_count,2,
      "reservation and replay must not change physical-receipt ledger count");
    // A committed consume closes the reservation and returns unused cloth.
    // The gateway drops the ACK only AFTER PostgREST successfully commits.
    const consume={
      action:"consume",reservationId:reserveReplay.data.reservationId,
      actualMetres:0.500,note:"synthetic measured cutting usage",
      checkedBy:"Synthetic cutting checker",
      sourceReference:"SYNTH-M58-USAGE-CARD",
    };
    swallowedCommittedCloseAck=null;
    loseOneCommittedCloseAck="fabric_stock_consume_reservation_v2";
    const consumedLost=await call("POST",consume);
    assert.equal(consumedLost.status,503,"lost committed consume ACK must fail closed");
    assert.deepEqual(consumedLost.data,{error:"Stock operation could not be verified."});
    assert.equal(swallowedCommittedCloseAck,true,
      "the consume transaction must have committed before dropping the HTTP ACK");
    const afterConsume=await call("GET");
    assert.equal(afterConsume.status,200);
    const consumedRow=afterConsume.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(consumedRow.physical_metres),1.500,
      "exactly 0.500m of fabric must be consumed once");
    assert.equal(Number(consumedRow.reserved_metres),0,
      "consuming the cutting sheet must release all unused held metres");
    assert.equal(Number(consumedRow.available_metres),1.500);
    const consumeRetry=await call("POST",consume);
    assert.equal(consumeRetry.status,409,
      "replaying an already committed consume must be a definitive no-op");
    assert.deepEqual(consumeRetry.data,{
      error:"Reservation was not active; no cloth was consumed.",
    });
    const afterConsumeRetry=await call("GET");
    assert.equal(afterConsumeRetry.status,200);
    const afterConsumeRetryRow=afterConsumeRetry.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(afterConsumeRetryRow.physical_metres),1.500);
    assert.equal(Number(afterConsumeRetryRow.reserved_metres),0);
    assert.equal(Number(afterConsumeRetryRow.available_metres),1.500);

    // A fresh documented cutting sheet may be reserved, then released.
    // Again a lost ACK must not create a second stock release on retry.
    const reserveToRelease={...reservation,
      revisionId:"LE-LOCK-SYNTHETIC-M58-RELEASE",
      quantityMetres:0.400,
      sourceReference:"SYNTH-M58-CANCELLATION-CUT-SHEET",
      requestKey:"SYNTH-M48-"+randomUUID(),
    };
    const reservedForRelease=await call("POST",reserveToRelease);
    assert.equal(reservedForRelease.status,200);
    assert.match(reservedForRelease.data.reservationId,/^[0-9a-f-]{36}$/i);
    const beforeRelease=await call("GET");
    const beforeReleaseRow=beforeRelease.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(beforeReleaseRow.reserved_metres),0.400);
    assert.equal(Number(beforeReleaseRow.available_metres),1.100);
    const release={
      action:"release",reservationId:reservedForRelease.data.reservationId,
      note:"synthetic canceled cutting sheet",
      releasedBy:"Synthetic cutting checker",
      sourceReference:"SYNTH-M58-CANCELLATION-EVIDENCE",
    };
    swallowedCommittedCloseAck=null;
    loseOneCommittedCloseAck="fabric_stock_release_v2";
    const releaseLost=await call("POST",release);
    assert.equal(releaseLost.status,503,"lost committed release ACK must fail closed");
    assert.equal(swallowedCommittedCloseAck,true,
      "the release transaction must commit before dropping the HTTP ACK");
    const afterRelease=await call("GET");
    const releasedRow=afterRelease.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(releasedRow.physical_metres),1.500);
    assert.equal(Number(releasedRow.reserved_metres),0);
    assert.equal(Number(releasedRow.available_metres),1.500);
    const releaseRetry=await call("POST",release);
    assert.equal(releaseRetry.status,409,
      "replaying a committed release must reject an already-closed reservation");
    assert.deepEqual(releaseRetry.data,{
      error:"Reservation was not active; no cloth was released.",
    });
    const afterReleaseRetry=await call("GET");
    const releasedRetryRow=afterReleaseRetry.data.stock.find(x=>x.fabric_id===fabricId);
    assert.equal(Number(releasedRetryRow.physical_metres),1.500);
    assert.equal(Number(releasedRetryRow.reserved_metres),0);
    assert.equal(Number(releasedRetryRow.available_metres),1.500);
    assert.equal(releasedRetryRow.manual_event_count,2,
      "closing reservations cannot mint extra manual stock events");
    console.log("TITAN M58 PASS: lost committed consume/release ACK returns 503, retry 409 and stable ledger balances.");
    console.log("TITAN M56 PASS: real reservation committed but lost ACK; same-key retries hold only 0.750m; changed evidence rejected.");
    console.log("TITAN M49 PASS: committed-but-lost HTTP ack returns 503; same-key retry preserves physical stock.");
    console.log("TITAN M48 Next->PostgREST PASS: authorized v3, replay, mismatch, CSRF, 401, v2 snapshot.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>proxy.close(resolve));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
