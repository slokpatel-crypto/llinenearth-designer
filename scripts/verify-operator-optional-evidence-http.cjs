"use strict";
// Synthetic authenticated built-Next/PostgREST loopback verification.
// No live Supabase, production writes, customer records, or provider calls.
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {spawn}=require("node:child_process");
const {createHmac,createHash,randomBytes}=require("node:crypto");

async function listen(server){
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  return server.address().port;
}
async function freePort(){
  const s=http.createServer();
  const n=await listen(s);
  await new Promise(resolve=>s.close(resolve));
  return n;
}
const optional=[
  "finished_garment_qc_list",
  "production_customer_outcome_list",
  "production_order_learning_context_list",
];
const allowed=new Set(["production_quote_list","production_order_list",...optional]);
const deliveryQc="finished_garment_qc_latest_for_order";
function canonicalizeSynthetic(value){
  if(Array.isArray(value))return value.map(canonicalizeSynthetic);
  if(value&&typeof value==="object")return Object.fromEntries(
    Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,item])=>[key,canonicalizeSynthetic(item)]));
  return value;
}
async function main(){
  // Use one synthetic lock with a real SHA-256 recipe hash and valid vault token,
  // never a real customer/fabric record.
  const garmentSpec={
    version:"linen-earth-garment-spec-v1",
    source:{designerRuleSetVersion:"synthetic-test"},
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{shirt:{id:"synthetic-shirt"},trouser:{id:"synthetic-trouser"}},
    shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",
      cuff:"Barrel",placket:"Standard",button:"Corozo"},
    trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break"},
    creative:null,
  };
  const recipeHash=createHash("sha256").update(JSON.stringify(canonicalizeSynthetic(garmentSpec))).digest("hex");
  const revisionId="LE-LOCK-20261101180000-"+recipeHash.slice(0,12).toUpperCase();
  const lockedRevision={version:"linen-earth-design-lock-v1",revisionId,recipeHash,
    parentRevisionId:null,lockedAt:"2026-11-01T18:00:00.000Z",garmentSpec};
  const vaultId="da2879a5-b433-4bf3-b521-e2d9323a186b";
  const accessKey=randomBytes(32).toString("base64url");
  const recoveryToken="lev1."+vaultId+"."+accessKey;
  const expectedAccessHash=createHash("sha256").update(accessKey).digest("hex");
  const syntheticCreatedId="0d71722a-1e67-4b4d-9ce4-e7e8c47f82a3";
  let mode={target:null,kind:"ok"};
  const seen=[];
  const backend=http.createServer(async(req,res)=>{
    const name=(req.url||"").split("/").pop();
    seen.push({name,method:req.method,apikey:req.headers.apikey,authorization:req.headers.authorization});
    let bytes=0;const chunks=[];
    for await(const chunk of req){bytes+=chunk.length;if(bytes>2048)break;chunks.push(chunk);}
    try{seen[seen.length-1].payload=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{}
    // Status RPCs return scalar JSON booleans. Simulated malformed 200 bodies
    // must not be coerced into "updated:true" by the operator route.
    if((name==="production_order_set_status"||name==="production_quote_set_status")
      && req.method==="POST"){
      const body=mode.target===name ? ({
        ackFalse:"false",ackNull:"null",ackString:'"false"',
        ackObject:'{"updated":false}',ackArray:"[]",ackNumber:"1",
        ackMalformed:"{bad",ackOversized:'"'+ "x".repeat(256)+'"',
      }[mode.kind]??"true") : "true";
      const mime=mode.target===name&&mode.kind==="ackWrongMime"?"text/plain":"application/json";
      res.writeHead(200,{"content-type":mime});res.end(body);return;
    }
    // Vault and quote/order creation are synthetic only; exercise the real
    // built-Next recovery-token verification and create-acknowledgement paths.
    if(name==="designer_locked_revision_vault_get"&&req.method==="POST"){
      const reqPayload=seen[seen.length-1].payload;
      assert.equal(reqPayload?.p_vault_id,vaultId);
      assert.equal(reqPayload?.p_access_hash,expectedAccessHash);
      res.writeHead(200,{"content-type":"application/json"});
      res.end(JSON.stringify([{payload:lockedRevision}]));return;
    }
    if(["production_quote_create","production_order_create_with_context"].includes(name)
      && req.method==="POST"){
      const payload=seen[seen.length-1].payload;
      assert.equal(payload?.p_revision_id,revisionId);
      assert.equal(payload?.p_recipe_hash,recipeHash);
      if(name==="production_order_create_with_context"){
        assert.equal(payload?.p_context?.version,"linen-earth-production-learning-context-v1");
        assert.equal(payload?.p_context?.revisionId,revisionId);
        assert.equal(payload?.p_context?.recipeHash,recipeHash);
        assert.equal(payload?.p_context?.fabrics?.shirtId,"synthetic-shirt");
        assert.equal(payload?.p_context?.fabrics?.trouserId,"synthetic-trouser");
        assert.ok(!("bodyProfile" in payload.p_context));
      }else{
        assert.deepEqual(payload?.p_line_items,[{label:"Synthetic linen",amount:1000}]);
        assert.equal(payload?.p_currency,"INR");
      }
      const bodies={
        createNull:"null",createObject:'{"id":"'+syntheticCreatedId+'"}',
        createArray:'["'+syntheticCreatedId+'"]',createString:'"synthetic-success"',
        createWrongVariant:'"da2879a5-b433-4bf3-7521-e2d9323a186b"',
        createMalformed:"{invalid",createOversized:'"'+ "x".repeat(256)+'"',
      };
      const kind=mode.target===name?mode.kind:"ok";
      const mime=kind==="createWrongMime"?"text/plain":"application/json";
      res.writeHead(200,{"content-type":mime});
      res.end(bodies[kind]??JSON.stringify(syntheticCreatedId));return;
    }
    if((!allowed.has(name)&&name!==deliveryQc)||req.method!=="POST"){
      res.writeHead(500,{"content-type":"application/json"});
      res.end(JSON.stringify({code:"UNEXPECTED_RPC"}));return;
    }
    if(name===mode.target && mode.kind!=="ok"){
      if(["qcApproved","qcStaleApproval","qcTied","qcMissingTime","qcUnsortedApproved"].includes(mode.kind)){
        const approval={order_id:"synthetic-order",decision:"approved",inspector:"Synthetic Inspector",
          inspection_reference:"SYNTH-QC-001",created_at:"2026-10-01T10:00:00Z"};
        const rework={...approval,decision:"rework",created_at:"2026-10-01T11:00:00Z"};
        const rows=mode.kind==="qcStaleApproval"?[approval,rework]:
          mode.kind==="qcTied"?[approval,{...rework,created_at:approval.created_at}]:
          mode.kind==="qcMissingTime"?[{...approval,created_at:null}]:
          mode.kind==="qcUnsortedApproved"?[rework,{...approval,created_at:"2026-10-01T12:00:00Z"}]:
          [approval];
        res.writeHead(200,{"content-type":"application/json"});
        res.end(JSON.stringify(rows));return;
      }
      if(mode.kind==="successWrongMime"){
        res.writeHead(200,{"content-type":"text/plain"});res.end("[]");return;
      }
      if(mode.kind==="successMalformedJson"){
        res.writeHead(200,{"content-type":"application/json"});res.end('{"customer":"SYNTHETIC_PRIVATE_RECOVERY_TOKEN_DO_NOT_ECHO",');return;
      }
      if(mode.kind==="successOversizedBytes"){
        res.writeHead(200,{"content-type":"application/json"});
        res.end(JSON.stringify([{id:"synthetic",padding:"x".repeat(8_388_608)}]));return;
      }
      if(mode.kind==="successObject"||mode.kind==="successNull"||
        mode.kind==="successScalarRow"||mode.kind==="successTooMany"){
        const body=mode.kind==="successObject"?{rows:[]}:
          mode.kind==="successNull"?null:
          mode.kind==="successScalarRow"?[null]:Array.from({length:501},()=>({id:"synthetic"}));
        res.writeHead(200,{"content-type":"application/json"});
        res.end(JSON.stringify(body));return;
      }
      if(mode.kind==="missing"){
        res.writeHead(404,{"content-type":"application/json"});
        res.end(JSON.stringify({code:"PGRST202",message:"Function not found"}));return;
      }
      if(mode.kind==="generic404"){
        res.writeHead(404,{"content-type":"application/json"});
        res.end(JSON.stringify({code:"PGRST116",message:"Not found"}));return;
      }
      if(mode.kind==="gateway"){
        res.writeHead(404,{"content-type":"text/html"});
        res.end("<html>gateway not found</html>");return;
      }
      if(mode.kind==="unavailable"){
        res.writeHead(503,{"content-type":"application/json"});
        res.end(JSON.stringify({code:"PGRST202"}));return;
      }
      if(mode.kind==="malformed"){
        res.writeHead(404,{"content-type":"application/json"});
        res.end("{bad");return;
      }
      if(mode.kind==="oversized"){
        res.writeHead(404,{"content-type":"application/json"});
        res.end(JSON.stringify({code:"PGRST202",message:"x".repeat(5000)}));return;
      }
    }
    res.writeHead(200,{"content-type":"application/json"});
    res.end("[]");
  });
  const backendPort=await listen(backend);
  const nextPort=await freePort();
  const secret=randomBytes(32).toString("hex");
  const key="sb_secret_titan_synthetic_fixture_only";
  const env={...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",
    LINEN_OPERATOR_SESSION_SECRET:secret,
    SUPABASE_URL:"http://127.0.0.1:"+backendPort,
    SUPABASE_SECRET_KEY:key,SUPABASE_SERVICE_ROLE_KEY:""};
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
    "start","-H","127.0.0.1","-p",String(nextPort)],
    {env,stdio:["ignore","pipe","pipe"]});
  let output="";
  for(const stream of [child.stdout,child.stderr])
    stream.on("data",chunk=>{output=(output+chunk).slice(-6000);});
  const url="http://127.0.0.1:"+nextPort+"/api/operator/production";
  try{
    let ready=false;
    for(let i=0;i<120;i++){
      if(child.exitCode!==null)throw Error("Next exited: "+output);
      try{ready=(await fetch(url,{signal:AbortSignal.timeout(800)})).status===401;}catch{}
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,"Next did not start: "+output);
    const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+120000})).toString("base64url");
    const sig=createHmac("sha256",secret).update(payload).digest("base64url");
    const cookie="linen_operator_session="+payload+"."+sig;
    // Signed operator POST parsing failures must not echo private request bytes
    // (or framework/JSON parser exception details). No backend writes allowed.
    const sensitiveMarker="SYNTHETIC_PRIVATE_RECOVERY_TOKEN_DO_NOT_ECHO";
    for(const badBody of [
      '{"action":"order_status","token":"'+sensitiveMarker+'",',
      "null",
    ]){
      mode={target:null,kind:"ok"};
      seen.length=0;
      const response=await fetch(url,{
        method:"POST",headers:{cookie,"content-type":"application/json"},
        body:badBody,signal:AbortSignal.timeout(15000),
      });
      assert.equal(response.status,409,"malformed operator POST");
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
      const responseText=await response.text();
      assert.deepEqual(JSON.parse(responseText),{error:"Production operation failed."});
      assert.ok(!responseText.includes(sensitiveMarker),"no customer content in operator error");
      assert.equal(seen.length,0,"invalid JSON must not reach upstream RPC");
    }
    // Known validation errors retain useful public wording.
    const safeResponse=await fetch(url,{
      method:"POST",headers:{cookie,"content-type":"application/json"},
      body:JSON.stringify({action:"create_quote",revisionId:"synthetic-revision-123",
        recipeHash:"a".repeat(64),recoveryToken:"malformed-token"}),
      signal:AbortSignal.timeout(15000),
    });
    assert.equal(safeResponse.status,409);
    assert.match(safeResponse.headers.get("cache-control")||"",/private.*no-store/);
    assert.deepEqual(await safeResponse.json(),
      {error:"A valid locked-design recovery token is required."});
    assert.equal(seen.length,0,"invalid recovery token must not reach upstream RPC");
    assert.ok(!output.includes(sensitiveMarker),"no private request marker in server logs");
    const cases=[{name:"valid empty ledger",target:null,kind:"ok",status:200}];
    for(const target of allowed){
      for(const kind of ["successObject","successNull","successScalarRow","successTooMany","successWrongMime","successMalformedJson","successOversizedBytes"])
        cases.push({name:target+" "+kind,target,kind,status:503});
    }
    for(const target of optional){
      cases.push({name:target+" missing",target,kind:"missing",status:200});
      for(const kind of ["generic404","gateway","unavailable","malformed","oversized"])
        cases.push({name:target+" "+kind,target,kind,status:503});
    }
    for(const c of cases){
      mode={target:c.target,kind:c.kind};
      seen.length=0;
      const response=await fetch(url,{headers:{cookie},signal:AbortSignal.timeout(15000)});
      assert.equal(response.status,c.status,c.name);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/,c.name);
      const body=await response.json();
      // Drain other Promise.all reads before switching the synthetic scenario.
      await new Promise(resolve=>setTimeout(resolve,60));
      if(c.status===200)
        assert.deepEqual(body,{configured:true,quotes:[],orders:[],qcInspections:[],customerOutcomes:[],learningContexts:[]},c.name);
      else
        assert.deepEqual(body,{error:"Production records could not be read."},c.name);
      // Promise.all rejects on the first failed read; other in-flight reads
      // are not guaranteed to finish before the HTTP 503 reaches the client.
      assert.ok(seen.length>=1 && seen.length<=5,c.name+" bounded read count");
      if(c.status===200)assert.equal(seen.length,5,c.name+" must read all five lists");
      if(c.target)assert.ok(seen.some(req=>req.name===c.target),c.name+" target read required");
      for(const req of seen){
        assert.ok(allowed.has(req.name),c.name+" unexpected RPC "+req.name);
        assert.equal(req.method,"POST",c.name);
        assert.equal(req.apikey,key,c.name);
        assert.equal(req.authorization,undefined,c.name+" must not send bearer secret");
      }
    }
    assert.ok(!output.includes("SYNTHETIC_PRIVATE_RECOVERY_TOKEN_DO_NOT_ECHO"),
      "GET parser failures must not log raw customer JSON");
    // The delivery POST uses a separate QC read path; invalid responses must
    // block a status mutation even if the main GET ledger is protected.
    const deliveryKinds=["successObject","successNull","successScalarRow","successTooMany",
      "successWrongMime","successMalformedJson","successOversizedBytes"];
    for(const kind of deliveryKinds){
      mode={target:deliveryQc,kind};
      seen.length=0;
      const response=await fetch(url,{
        method:"POST",headers:{cookie,"content-type":"application/json"},
        body:JSON.stringify({action:"order_status",orderId:"synthetic-order",status:"delivered"}),
        signal:AbortSignal.timeout(15000),
      });
      assert.equal(response.status,409,"delivery "+kind);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
      assert.deepEqual(await response.json(),
        {error:"Finished-garment QC backend must be installed before delivery can be recorded."},kind);
      assert.equal(seen.filter(x=>x.name===deliveryQc).length,1,kind);
      assert.equal(seen.find(x=>x.name===deliveryQc)?.payload?.p_order_id,"synthetic-order",kind+" order-scoped");
      assert.equal(seen.filter(x=>x.name==="production_order_set_status").length,0,kind+" must not write");
    }
    // Non-delivery status writes must accept only genuine PostgREST JSON
    // booleans, not truthy objects, strings, malformed payloads or null.
    for(const [action,rpcName,entityKey] of [
      ["quote_status","production_quote_set_status","quoteId"],
      ["order_status","production_order_set_status","orderId"],
    ]){
      for(const kind of ["ackFalse","ackNull","ackString","ackObject","ackArray","ackNumber","ackMalformed","ackWrongMime","ackOversized","ok"]){
        mode={target:rpcName,kind};
        seen.length=0;
        const response=await fetch(url,{
          method:"POST",headers:{cookie,"content-type":"application/json"},
          body:JSON.stringify({action,[entityKey]:"synthetic-order",status:action==="quote_status"?"sent":"ready"}),
          signal:AbortSignal.timeout(15000),
        });
        const expectedStatus=kind==="ok"||kind==="ackFalse"?200:409;
        assert.equal(response.status,expectedStatus,action+" "+kind);
        assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
        assert.deepEqual(await response.json(),expectedStatus===200?
          {updated:kind!=="ackFalse"}:{error:"Production operation failed."},
          action+" "+kind);
        assert.equal(seen.filter(x=>x.name===rpcName).length,1,action+" "+kind+" RPC");
        assert.equal(seen.length,1,action+" "+kind+" must not request another RPC");
      }
    }
    // Control: valid synthetic, provenance-backed QC still permits the existing
    // delivery contract. No real Supabase or customer data is touched.
    mode={target:deliveryQc,kind:"qcApproved"};
    seen.length=0;
    const approved=await fetch(url,{
      method:"POST",headers:{cookie,"content-type":"application/json"},
      body:JSON.stringify({action:"order_status",orderId:"synthetic-order",status:"delivered"}),
      signal:AbortSignal.timeout(15000),
    });
    assert.equal(approved.status,200,"approved synthetic delivery");
    assert.match(approved.headers.get("cache-control")||"",/private.*no-store/);
    assert.deepEqual(await approved.json(),{updated:true});
    assert.equal(seen.filter(x=>x.name==="production_order_set_status").length,1);
    assert.equal(seen.find(x=>x.name===deliveryQc)?.payload?.p_order_id,"synthetic-order");
    // A stale approval must not win merely because it was listed first.
    for(const kind of ["qcStaleApproval","qcTied","qcMissingTime"]){
      mode={target:deliveryQc,kind};
      seen.length=0;
      const response=await fetch(url,{
        method:"POST",headers:{cookie,"content-type":"application/json"},
        body:JSON.stringify({action:"order_status",orderId:"synthetic-order",status:"delivered"}),
        signal:AbortSignal.timeout(15000),
      });
      assert.equal(response.status,409,"delivery "+kind);
      assert.deepEqual(await response.json(),
        {error:"Finished-garment QC approval is required before delivery."},kind);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/,kind);
      assert.equal(seen.filter(x=>x.name==="production_order_set_status").length,0,kind+" must not write");
    }
    mode={target:deliveryQc,kind:"qcUnsortedApproved"};
    seen.length=0;
    const unordered=await fetch(url,{
      method:"POST",headers:{cookie,"content-type":"application/json"},
      body:JSON.stringify({action:"order_status",orderId:"synthetic-order",status:"delivered"}),
      signal:AbortSignal.timeout(15000),
    });
    assert.equal(unordered.status,200,"newest approval wins even when upstream rows are unordered");
    assert.equal(seen.filter(x=>x.name==="production_order_set_status").length,1);
    // Authenticated built-Next creation with a properly hashed synthetic
    // locked recipe. HTTP 200 from a broken backend must never claim an ID.
    for(const [action,rpcName,idKey] of [
      ["create_quote","production_quote_create","quoteId"],
      ["create_order","production_order_create_with_context","orderId"],
    ]){
      for(const kind of ["ok","createNull","createObject","createArray",
        "createString","createWrongVariant","createMalformed","createOversized","createWrongMime"]){
        mode={target:rpcName,kind};
        seen.length=0;
        const body={action,revisionId,recipeHash,recoveryToken};
        if(action==="create_quote"){
          body.currency="INR";
          body.lineItems=[{label:"Synthetic linen",amount:1000}];
          body.adjustment=0;
        }
        const response=await fetch(url,{method:"POST",
          headers:{cookie,"content-type":"application/json"},
          body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
        const isGood=kind==="ok";
        assert.equal(response.status,isGood?200:409,action+" "+kind);
        assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
        const actual=await response.json();
        assert.deepEqual(actual,isGood?
          (action==="create_quote"?
            {quoteId:syntheticCreatedId,lockedRevisionVerified:true}:
            {orderId:syntheticCreatedId,learningContextAttached:true,lockedRevisionVerified:true}):
          {error:"Production operation failed."},action+" "+kind);
        assert.equal(seen.filter(x=>x.name==="designer_locked_revision_vault_get").length,1);
        assert.equal(seen.filter(x=>x.name===rpcName).length,1);
        assert.equal(seen.length,2,"creation must use only vault read then create RPC");
        for(const req of seen){
          assert.equal(req.apikey,key);
          assert.equal(req.authorization,undefined);
          assert.equal(req.method,"POST");
        }
      }
    }
    console.log("TITAN create UUID PASS: 18 synthetic signed quote/order HTTP cases.");
    console.log("TITAN operator status ACK PASS: 20 synthetic signed quote/order POST cases.");
    console.log("TITAN operator ledger + delivery QC PASS: "+cases.length+
      " GET and "+(deliveryKinds.length+5)+" POST signed synthetic HTTP cases; zero real writes.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>backend.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
