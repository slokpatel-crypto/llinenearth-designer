"use strict";
// Synthetic authenticated built-Next/PostgREST loopback verification.
// No live Supabase, production writes, customer records, or provider calls.
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {spawn}=require("node:child_process");
const {createHmac,randomBytes}=require("node:crypto");

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
async function main(){
  let mode={target:null,kind:"ok"};
  const seen=[];
  const backend=http.createServer(async(req,res)=>{
    const name=(req.url||"").split("/").pop();
    seen.push({name,method:req.method,apikey:req.headers.apikey,authorization:req.headers.authorization});
    let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>2048)break;}
    if(!allowed.has(name)||req.method!=="POST"){
      res.writeHead(500,{"content-type":"application/json"});
      res.end(JSON.stringify({code:"UNEXPECTED_RPC"}));return;
    }
    if(name===mode.target && mode.kind!=="ok"){
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
    const cases=[{name:"valid empty ledger",target:null,kind:"ok",status:200}];
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
    console.log("TITAN optional operator evidence PASS: "+cases.length+
      " signed built-Next HTTP cases against synthetic loopback PostgREST; zero real writes.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>backend.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
