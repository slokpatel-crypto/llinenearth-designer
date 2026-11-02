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
  const proxy=http.createServer((req,res)=>{
    if(!req.url.startsWith("/rest/v1/rpc/")){
      res.writeHead(404);res.end();return;
    }
    const incoming=http.request({
      hostname:"127.0.0.1",port:3017,path:req.url.slice("/rest/v1".length),
      method:req.method,headers:req.headers,
    },remote=>{
      if(loseOneCommittedReceiptAck&&
         req.url==="/rest/v1/rpc/fabric_stock_record_v3"){
        loseOneCommittedReceiptAck=false;
        // Consume the real upstream 200 fully first: PostgREST/PostgreSQL
        // have already inserted and committed. Replace only its HTTP ack.
        const committed=remote.statusCode===200;
        remote.resume();
        remote.on("end",()=>{
          swallowedCommittedReceiptAck=committed;
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
    console.log("TITAN M49 PASS: committed-but-lost HTTP ack returns 503; same-key retry preserves physical stock.");
    console.log("TITAN M48 Next->PostgREST PASS: authorized v3, replay, mismatch, CSRF, 401, v2 snapshot.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>proxy.close(resolve));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
