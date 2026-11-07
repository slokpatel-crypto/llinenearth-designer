"use strict";
// Authenticated built-Next stock API checks against a fake localhost PostgREST.
// Never connects to Supabase or modifies real stock/provenance records.
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {join}=require("node:path");
// Contract regression: the privileged HTTP boundary must never revive a
// legacy stock RPC, even when the synthetic backend accepts new v2 calls.
const stockRoute=readFileSync(join(process.cwd(),"src/app/api/operator/stock/route.ts"),"utf8");
// Capture typed and untyped calls, with either quote style. An untyped
// legacy RPC must not evade the privileged allowlist regression.
const invokedStockRpcs=[...stockRoute.matchAll(/\bawait\s+rpc(?:<[^>]+>)?\s*\(\s*(['"])([^'"]+)\1/g)]
  .map(match=>match[2]);
const rpcCallCount=[...stockRoute.matchAll(/\bawait\s+rpc(?:<[^>]+>)?\s*\(/g)].length;
assert.equal(invokedStockRpcs.length,rpcCallCount,
  "operator stock RPC name must be a literal approved name; dynamic calls are prohibited");
const approvedStockRpcs=new Set([
  "fabric_stock_snapshot_v2","fabric_stock_record_v2",
  "fabric_stock_reserve_v2","fabric_stock_release_v2",
  "fabric_stock_consume_reservation_v2"
]);
assert.deepEqual(new Set(invokedStockRpcs),approvedStockRpcs,
  "operator stock RPC contract changed; review legacy and new privileged calls");
assert.equal(invokedStockRpcs.length,approvedStockRpcs.size,
  "operator stock RPC count changed; inspect all call sites");

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
      const outcomes={
        valid:[valid],snapshotNull:null,snapshotObject:{stock:[valid]},
        snapshotWrongFabric:[{...valid,fabric_id:"invented-fabric"}],
        snapshotMissingMetres:[{...valid,available_metres:null}],
        snapshotInconsistent:[{...valid,available_metres:10}],
        snapshotShortProvenance:[{...valid,provenance_event_count:1}],
        snapshotFalseReadyLegacy:[{...valid,provenance_event_count:1,
          legacy_unverified_event_count:1,provenance_ready:true}],
        snapshotFalseNotReady:[{...valid,provenance_ready:false}],
        snapshotFalseReadyEmpty:[{...valid,manual_event_count:0,
          provenance_event_count:0,provenance_ready:true}],
      };
      response=Object.hasOwn(outcomes,mode)?outcomes[mode]:[valid];
    }else if(path.endsWith("/fabric_stock_record_v2")||
             path.endsWith("/fabric_stock_reserve_v2")){
      const outcomes={
        created:uuid,createNull:null,createObject:{id:uuid},
        createArray:[uuid],createBool:true,createString:"false",
        createWrongUuid:"not-uuid",
      };
      response=Object.hasOwn(outcomes,mode)?outcomes[mode]:uuid;
    }else if(path.endsWith("/fabric_stock_release_v2")||
             path.endsWith("/fabric_stock_consume_reservation_v2")){
      const outcomes={
        closeTrue:true,closeFalse:false,closeNull:null,
        closeString:"false",closeObject:{released:false},
        closeArray:[false],closeNumber:1,
      };
      response=Object.hasOwn(outcomes,mode)?outcomes[mode]:true;
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
    // Only this local, synthetic, explicitly marked v2 fixture can exercise
    // old stock mutation contract responses. Live deployments remain read-only.
    LINEN_STOCK_WRITES_ENABLED:"test-v2-only",
    TITAN_SYNTHETIC_STOCK_TEST:"enabled",
    VERCEL:"",
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
      "snapshotMissingMetres","snapshotInconsistent","snapshotShortProvenance",
      "snapshotFalseReadyLegacy","snapshotFalseNotReady","snapshotFalseReadyEmpty",
      "backend500","wrongMime","oversize",
    ]){
      mode=kind;seen.length=0;
      const {response,result}=await call("GET");
      assert.equal(response.status,kind==="valid"?200:503,kind);
      assert.equal(seen.length,1,kind);
      if(kind==="valid")assert.deepEqual(result,{configured:true,writesEnabled:true,stock:[valid]});
      else assert.deepEqual(result,{error:"Stock ledger could not be read."});
    }
    // Malformed input is a definitive client error and cannot commit stock.
    for(const malformed of [null,"[]","{oops",Buffer.from([0xc3,0x28])]){
      mode="created";seen.length=0;
      const response=await fetch(url,{method:"POST",
        headers:{cookie,"content-type":"application/json","connection":"close"},
        ...(malformed===null?{}:{body:malformed}),
        signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      assert.equal(response.status,400,"invalid stock JSON must be a definitive 400");
      assert.deepEqual(result,{error:"Stock mutation requires a valid JSON object."});
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
      assert.equal(seen.length,0,"malformed JSON must never reach a stock RPC");
    }
    const record={action:"record",fabricId:fabric,eventType:"receipt",
      quantityMetres:2.125,recordedBy:"Synthetic checker",
      sourceReference:"SYNTH-ROLL-001"};
    const reservation={action:"reserve",fabricId:fabric,quantityMetres:1.25,
      revisionId:"LE-LOCK-SYNTHETIC-0001",requestKey:"STOCK-REQUEST-SYNTHETIC-0001",
      requestedBy:"Synthetic checker",sourceReference:"SYNTH-CUT-SHEET"};
    // A long physical fabric ID, design revision or idempotency key must
    // not be silently cut to a valid prefix before a privileged stock RPC.
    for(const [draft,field,bound] of [
      [record,"fabricId",160],[reservation,"fabricId",160],
      [reservation,"revisionId",220],[reservation,"requestKey",180],
    ]){
      for(const suffix of ["A","B"]){
        mode="created";seen.length=0;
        const {response,result}=await call("POST",{
          ...draft,[field]:"X".repeat(bound)+suffix});
        assert.equal(response.status,409,draft.action+" truncated "+field);
        assert.ok(typeof result.error==="string"&&result.error.includes("cannot be truncated"));
        assert.equal(seen.length,0,draft.action+" truncated "+field+" reached stock RPC");
      }
    }
    // A JSON array must not impersonate a real fabric, locked revision,
    // idempotency key or stock event before any privileged RPC is called.
    for(const [action,field,value] of [
      ["record","fabricId",[fabric]],
      ["record","eventType",["receipt"]],
      ["reserve","fabricId",[fabric]],
      ["reserve","revisionId",[reservation.revisionId]],
      ["reserve","requestKey",[reservation.requestKey]],
    ]){
      mode="created";seen.length=0;
      const draft=action==="record"?record:reservation;
      const {response,result}=await call("POST",{...draft,[field]:value});
      assert.equal(response.status,409,action+" coerced "+field);
      assert.ok(typeof result.error==="string"&&result.error.length>0);
      assert.equal(seen.length,0,action+" coerced "+field+" reached privileged stock RPC");
    }
    // The action dispatcher must also reject JSON arrays that stringify to
    // privileged operation names, even with otherwise valid payloads.
    for(const draft of [record,reservation]){
      mode="created";seen.length=0;
      const {response,result}=await call("POST",{...draft,action:[draft.action]});
      assert.equal(response.status,400,"coerced action must be unsupported");
      assert.deepEqual(result,{error:"Unsupported stock action."});
      assert.equal(seen.length,0,"coerced action reached privileged stock RPC");
    }
    // A valid signed cookie must not bypass browser Fetch Metadata. A
    // cross-site or same-site request cannot reach the privileged stock RPC
    // even if Origin was removed by an upstream intermediary.
    for(const site of ["cross-site","same-site","unexpected"]){
      for(const origin of [null,"http://127.0.0.1:"+nextPort]){
        mode="created";seen.length=0;
        const headers={cookie,"content-type":"application/json",
          "sec-fetch-site":site,"connection":"close"};
        if(origin)headers.origin=origin;
        const res=await fetch(url,{method:"POST",headers,
          body:JSON.stringify(record),signal:AbortSignal.timeout(15000)});
        assert.equal(res.status,403,"stock blocked "+site+" "+String(origin));
        assert.deepEqual(await res.json(),{
          error:"Cross-site stock changes are not allowed."});
        assert.match(res.headers.get("cache-control")||"",/private.*no-store/);
        assert.equal(seen.length,0,"unsafe stock POST reached privileged RPC");
      }
    }
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
    const closures=[
      {action:"release",reservationId:uuid,releasedBy:"Synthetic checker",
        sourceReference:"SYNTH-RELEASE-01"},
      {action:"consume",reservationId:uuid,actualMetres:1.125,
        checkedBy:"Synthetic checker",sourceReference:"SYNTH-CUT-01"},
    ];
    // A one-element JSON array/object or overlong string must not become a named physical
    // checker or a signed supplier/cutting source. Every stock action fails
    // before privileged PostgREST even in the synthetic writable fixture.
    for(const [draft,actor] of [
      [record,"recordedBy"],[reservation,"requestedBy"],
      [closures[0],"releasedBy"],[closures[1],"checkedBy"],
    ]){
      for(const field of [actor,"sourceReference"]){
        for(const invalid of [[draft[field]],{value:draft[field]},null,42,
          "X".repeat(field==="sourceReference"?241:121)]){
          mode="created";seen.length=0;
          const {response,result}=await call("POST",{...draft,[field]:invalid});
          assert.equal(response.status,409,draft.action+" coerced physical "+field);
          assert.ok(typeof result.error==="string"&&result.error.includes("required"));
          assert.equal(seen.length,0,draft.action+" coerced "+field+" reached a privileged stock RPC");
        }
      }
    }
    // Malformed and JSON-coerced reservation identities are definitive 409s.
    // Neither a syntactically invalid UUID nor a one-element JSON array may
    // reach the privileged stock release/consume RPC.
    for(const reservationId of [
      "-".repeat(36),
      "b287e4700e90-4fd4-b5fb-976eecebd244-",
      "b287e470-0e904-fd4-b5fb-976eecebd244",
      "b287e470-0e90-4fd4-b5fb-976eecebd24-",
      "b287e470-0e90-4fd4-b5fb-976eecebd24g",
      [uuid],{0:uuid,length:1},{value:uuid},null,42,true,
    ]){
      for(const body of closures){
        mode="closeTrue";seen.length=0;
        const {response,result}=await call("POST",{...body,reservationId});
        assert.equal(response.status,409,body.action+" invalid reservation identity");
        assert.deepEqual(result,{error:"Valid reservation ID is required."});
        assert.equal(seen.length,0,"coercible reservation ID reached privileged close RPC");
      }
    }
    for(const body of closures){
      for(const kind of [
        "closeTrue","closeFalse","closeNull","closeString",
        "closeObject","closeArray","closeNumber","backend500",
        "wrongMime","oversize",
      ]){
        mode=kind;seen.length=0;
        const {response,result}=await call("POST",body);
        assert.equal(response.status,kind==="closeTrue"?200:
          kind==="closeFalse"?409:503,body.action+" "+kind);
        assert.equal(seen.length,1,body.action+" "+kind);
        assert.equal(seen[0].path,
          "/rest/v1/rpc/"+(body.action==="release"?"fabric_stock_release_v2":
            "fabric_stock_consume_reservation_v2"));
        if(kind==="closeTrue")assert.deepEqual(result,
          {[body.action==="release"?"released":"consumed"]:true});
        else if(kind==="closeFalse")assert.deepEqual(result,
          {error:body.action==="release"?
            "Reservation was not active; no cloth was released.":
            "Reservation was not active; no cloth was consumed."});
        else assert.deepEqual(result,{error:"Stock operation could not be verified."});
      }
    }
    // A separate built Next process proves default legacy v2 writes stay
    // disabled even when a future v3 'enabled' flag is accidentally supplied.
    mode="valid";
    const heldPort=await freePort();
    const held=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
      "start","-H","127.0.0.1","-p",String(heldPort)],{
      env:{...env,LINEN_STOCK_WRITES_ENABLED:"enabled"},
      stdio:["ignore","pipe","pipe"],
    });
    let heldOutput="";
    for(const stream of [held.stdout,held.stderr])
      stream.on("data",chunk=>{heldOutput=(heldOutput+chunk).slice(-7000);});
    try{
      const heldUrl="http://127.0.0.1:"+heldPort+"/api/operator/stock";
      let started=false;
      for(let i=0;i<120;i++){
        if(held.exitCode!==null) throw Error("Held Next fixture exited early: "+heldOutput);
        try{
          const res=await fetch(heldUrl,{signal:AbortSignal.timeout(800)});
          started=res.status===401;
        }catch{}
        if(started)break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      assert.ok(started,"read-only Next stock fixture did not start");
      seen.length=0;
      const available=await fetch(heldUrl,{headers:{cookie,"connection":"close"},
        signal:AbortSignal.timeout(15000)});
      assert.equal(available.status,200);
      assert.deepEqual(await available.json(),{configured:true,writesEnabled:false,stock:[valid]});
      assert.equal(seen.length,1,"stock snapshot GET remains accessible");
      seen.length=0;
      for(const body of [record,reservation,...closures]){
        const heldResponse=await fetch(heldUrl,{method:"POST",
          headers:{cookie,"content-type":"application/json","connection":"close"},
          body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
        assert.equal(heldResponse.status,423,"unapproved v2 stock write must be locked");
        assert.deepEqual(await heldResponse.json(),{
          error:"Legacy v2 stock writes are disabled pending v3 rollout approval."
        });
        assert.match(heldResponse.headers.get("cache-control")||"",/private.*no-store/);
        assert.equal(seen.length,0,"blocked write must never reach privileged RPC");
      }
    }finally{
      if(held.exitCode===null){held.kill("SIGTERM");await once(held,"exit");}
    }
    assert.ok(!output.includes(marker),"private fake stock RPC error leaked in server logs");
    console.log("TITAN stock API private boundary PASS: synthetic authenticated cases, no real writes.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>upstream.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
