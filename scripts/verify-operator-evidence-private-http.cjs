"use strict";
// Real built-Next API + fake localhost PostgREST (never real Supabase/data).
// Validates security boundaries for cutting and delivery evidence operations.
const assert=require("node:assert/strict");
const http=require("node:http");
const {spawn}=require("node:child_process");
const {once}=require("node:events");
const {createHmac,randomBytes}=require("node:crypto");

async function listen(server){
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  return server.address().port;
}
async function freePort(){
  const server=http.createServer();
  const port=await listen(server);
  await new Promise(resolve=>server.close(resolve));
  return port;
}
const uuid="d45179ea-d13a-4e4e-91b7-aac903b01d63";
const orderId="c287dc33-30ac-4674-bf1b-51626948ee99";
const secretMarker="SYNTH_PRIVATE_SUPPLIER_TOKEN_NO_ECHO_9fa6";
const listNames=new Set([
  "production_order_list","production_delivery_evidence_list",
  "production_cut_evidence_list",
]);
const createNames=new Set([
  "production_delivery_evidence_record_v2","production_cut_evidence_record",
]);
const routes=[
  {path:"production-evidence",read:"production_delivery_evidence_list",
    write:"production_delivery_evidence_record_v2",
    draft:{action:"record",orderId,manualDesignReentry:false,
      reentryFields:[],note:"",operator:"Synthetic checker",
      evidenceReference:"Synthetic ticket 001"}},
  {path:"production-calibration",read:"production_cut_evidence_list",
    write:"production_cut_evidence_record",
    draft:{action:"record",caseId:"SYN-CUT-001",orderId,garment:"shirt",
      fabricId:"SYNTH-SHIRT",fabricWidthCm:150,actualMetres:1.875,
      patternRepeatMm:null,patternMatching:false,cutContext:"",
      checkedBy:"Synthetic tailor",evidenceReference:"Synthetic cut ticket 001",note:""}},
];

async function main(){
  let scenario={target:null,kind:"ok"};
  const seen=[];
  const fake=http.createServer(async(req,res)=>{
    const name=(req.url||"").split("/").pop();
    const item={name,method:req.method,apikey:req.headers.apikey,
      authorization:req.headers.authorization};
    seen.push(item);
    let bytes=0;const chunks=[];
    for await(const chunk of req){
      bytes+=chunk.length;
      if(bytes>4096)break;
      chunks.push(chunk);
    }
    try{item.payload=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{}
    if(req.method!=="POST"||(!listNames.has(name)&&!createNames.has(name))){
      res.writeHead(500,{"content-type":"application/json"});
      res.end(JSON.stringify({error:"unexpected synthetic RPC"}));return;
    }
    const kind=scenario.target===name?scenario.kind:"ok";
    if(kind==="sqlLeak"){
      res.writeHead(500,{"content-type":"application/json"});
      res.end(JSON.stringify({code:"PGRST999",message:secretMarker}));return;
    }
    if(kind==="wrongMime"){
      res.writeHead(200,{"content-type":"text/plain"});
      res.end("[]");return;
    }
    if(kind==="malformed"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end('{"secret":"'+secretMarker+'",');return;
    }
    if(kind==="oversized"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end('"'+ "x".repeat(4_194_305)+'"');return;
    }
    if(kind==="invalidList"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end(JSON.stringify({rows:[]}));return;
    }
    if(kind==="cappedList"){
      // Test 500 genuinely schema-valid synthetic records: malformed
      // responses should be 503, valid but non-exhaustive history 409.
      const makeId=(n)=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
      const records=Array.from({length:500},(_,i)=>{
        const id=makeId(i+1);
        if(name==="production_order_list")
          return {order_id:id,revision_id:"LE-REV-"+(i+1),
            recipe_hash:"a".repeat(64),quote_id:null,status:"delivered",
            note:"",created_at:"2026-10-01T10:00:00+00:00",
            updated_at:"2026-10-02T10:00:00+00:00"};
        return {evidence_id:makeId(i+10001),order_id:id,
          revision_id:"LE-REV-"+(i+1),recipe_hash:"a".repeat(64),
          manual_design_reentry:false,reentry_fields:[],note:"",
          operator:"Synthetic checker",
          evidence_reference:"Synthetic dispatch "+(i+1),
          created_at:"2026-10-03T10:00:00+00:00",
          order_created_at:"2026-10-01T10:00:00+00:00"};
      });
      res.writeHead(200,{"content-type":"application/json"});
      res.end(JSON.stringify(records));
      return;
    }
    if(kind==="ackNull"||kind==="ackObject"||kind==="ackString"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end(kind==="ackNull"?"null":kind==="ackObject"?
        JSON.stringify({id:uuid}):JSON.stringify("not-an-id"));return;
    }
    res.writeHead(200,{"content-type":"application/json"});
    res.end(listNames.has(name)?"[]":JSON.stringify(uuid));
  });
  const upstreamPort=await listen(fake);
  const nextPort=await freePort();
  const secret=randomBytes(32).toString("hex");
  const key="sb_secret_titan_evidence_test_only";
  const env={...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",
    LINEN_OPERATOR_SESSION_SECRET:secret,
    SUPABASE_URL:"http://127.0.0.1:"+upstreamPort,
    SUPABASE_SECRET_KEY:key,SUPABASE_SERVICE_ROLE_KEY:"",
    VERCEL:""};
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
    "start","-H","127.0.0.1","-p",String(nextPort)],{
      env,stdio:["ignore","pipe","pipe"],
    });
  let output="";
  for(const stream of [child.stdout,child.stderr])
    stream.on("data",chunk=>{output=(output+chunk).slice(-10000);});
  const origin="http://127.0.0.1:"+nextPort;
  let count=0;
  try{
    let started=false;
    for(let i=0;i<120;i++){
      if(child.exitCode!==null)throw Error("Next exited during test: "+output);
      try{
        const res=await fetch(origin+"/api/operator/production-evidence",{
          signal:AbortSignal.timeout(900)});
        started=res.status===401;
      }catch{}
      if(started)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(started,"built Next evidence routes did not start: "+output);
    const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+120000})).toString("base64url");
    const sig=createHmac("sha256",secret).update(payload).digest("base64url");
    const cookie="linen_operator_session="+payload+"."+sig;
    async function request(path,opts={}){
      const res=await fetch(origin+"/api/operator/"+path,{
        ...opts,signal:AbortSignal.timeout(15000)});
      const raw=await res.text();
      assert.match(res.headers.get("cache-control")||"",/private.*no-store/,path);
      assert.ok(!raw.includes(secretMarker),path+" leaked upstream SQL/source message");
      let data;
      try{data=JSON.parse(raw);}catch{throw Error(path+" returned invalid JSON: "+raw.slice(0,200));}
      count++;
      return {res,data};
    }
    for(const route of routes){
      const path=route.path;
      seen.length=0;
      let r=await request(path);
      assert.equal(r.res.status,401);
      assert.deepEqual(r.data,{error:"Unauthorized."});
      r=await request(path,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(route.draft)});
      assert.equal(r.res.status,401);
      assert.equal(seen.length,0,"unauthorized requests may not reach fake PostgREST");

      // Signed operator cookie alone is insufficient: block cross-site browser
      // origins and simple HTML form submissions before any privileged RPC.
      for(const attack of [
        {headers:{origin:"https://cross-site.invalid","content-type":"application/json"},expected:403},
        {headers:{origin:"null","content-type":"application/json"},expected:403},
        {headers:{"sec-fetch-site":"cross-site","content-type":"application/json"},expected:403},
        {headers:{"sec-fetch-site":"same-site","content-type":"application/json"},expected:403},
        {headers:{origin,"sec-fetch-site":"cross-site","content-type":"application/json"},expected:403},
        {headers:{"content-type":"text/plain"},expected:415},
        {headers:{"content-type":"application/x-www-form-urlencoded"},expected:415},
      ]){
        scenario={target:null,kind:"ok"};
        seen.length=0;
        const rejected=await request(path,{method:"POST",
          headers:{cookie,...attack.headers},
          body:JSON.stringify(route.draft)});
        assert.equal(rejected.res.status,attack.expected,path+" blocked metadata");
        assert.equal(seen.length,0,"rejected request reached private production RPC");
      }
      seen.length=0;
      const sameOrigin=await request(path,{method:"POST",
        headers:{cookie,origin,"content-type":"application/json"},
        body:JSON.stringify(route.draft)});
      assert.equal(sameOrigin.res.status,200,"same-origin signed JSON must work");
      assert.deepEqual(sameOrigin.data,{evidenceId:uuid});
      assert.equal(seen.length,1);

      scenario={target:null,kind:"ok"};
      seen.length=0;
      r=await request(path,{headers:{cookie}});
      assert.equal(r.res.status,200);
      assert.equal(r.data.configured,true);
      if(path==="production-calibration"){
        assert.deepEqual(r.data.cases,[]);
        assert.equal(r.data.summary.readyForModel,false);
      }else{
        assert.deepEqual(r.data.orders,[]);
        assert.deepEqual(r.data.evidence,[]);
      }
      assert.equal(seen.length,path==="production-calibration"?1:2);

      if(path==="production-evidence"){
        // Order RPC returns newest 500; receipt RPC returns oldest 500.
        // Either bound makes first-ten historical coverage unverifiable.
        for(const truncated of ["production_order_list",
          "production_delivery_evidence_list"]){
          scenario={target:truncated,kind:"cappedList"};
          seen.length=0;
          const capped=await request(path,{headers:{cookie}});
          assert.equal(capped.res.status,409,"capped "+truncated+" must fail closed");
          assert.deepEqual(capped.data,{error:
            "Delivery ledger is incomplete; full historical pagination is required before acceptance."});
          assert.equal(seen.length,2,"both list RPCs must be checked");
        }
        scenario={target:null,kind:"ok"};
      }

      seen.length=0;
      r=await request(path,{method:"POST",headers:{cookie,"content-type":"application/json"},
        body:JSON.stringify(route.draft)});
      assert.equal(r.res.status,200);
      assert.deepEqual(r.data,{evidenceId:uuid});
      assert.equal(seen.length,1);
      assert.equal(seen[0].name,route.write);
      assert.equal(seen[0].method,"POST");
      assert.equal(seen[0].apikey,key);
      assert.equal(seen[0].authorization,undefined);
      assert.equal(seen[0].payload?.p_order_id,orderId);

      for(const kind of ["ackNull","ackObject","ackString","wrongMime","malformed","oversized","sqlLeak"]){
        scenario={target:route.write,kind};
        seen.length=0;
        r=await request(path,{method:"POST",
          headers:{cookie,"content-type":"application/json"},
          body:JSON.stringify(route.draft)});
        assert.equal(r.res.status,503,path+" "+kind);
        assert.deepEqual(r.data,{error:"Production evidence could not be recorded or verified."});
        assert.equal(seen.length,1,path+" "+kind+" must reach only one fake mutation RPC");
      }
      for(const kind of ["sqlLeak","wrongMime","malformed","oversized","invalidList"]){
        scenario={target:route.read,kind};
        seen.length=0;
        r=await request(path,{headers:{cookie}});
        assert.equal(r.res.status,503,path+" GET "+kind);
        assert.deepEqual(r.data,{error:path==="production-calibration"?
          "Production cut evidence could not be read.":
          "Production completion evidence could not be read."});
      }
      scenario={target:null,kind:"ok"};
      for(const [invalid,expectedStatus] of [
        ["{broken",400],["null",400],["[]",400],
        ['{"action":"record","token":"'+secretMarker+'",',400],
        [JSON.stringify({...route.draft,operator:"",checkedBy:"",evidenceReference:""}),400],
        [JSON.stringify({...route.draft,extra:"x".repeat(33_000)}),413],
      ]){
        seen.length=0;
        r=await request(path,{method:"POST",headers:{cookie,"content-type":"application/json"},
          body:invalid});
        assert.equal(r.res.status,expectedStatus,path+" rejected invalid or oversized input");
        assert.equal(seen.length,0,"rejected POST must not reach privileged RPC");
      }
    }
    assert.ok(!output.includes(secretMarker),"built Next server logs exposed private backend/request marker");
    console.log("TITAN private production evidence HTTP PASS: "+count+
      " authenticated/unauthorized, read, strict ACK, malformed/oversized, and redacted backend cases; localhost fake only.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>fake.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
