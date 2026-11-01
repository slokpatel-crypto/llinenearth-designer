"use strict";
// Built-Next synthetic design vault boundary checks. No real Supabase or
// customer records, no paid services and no database writes.
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {spawn}=require("node:child_process");
const {randomBytes,createHash}=require("node:crypto");

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
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object")
    return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,item])=>[key,canonical(item)]));
  return value;
}
async function main(){
  const vaultId="b287e470-0e90-4fd4-b5fb-976eecebd244";
  const key=randomBytes(32).toString("base64url");
  const token="lev1."+vaultId+"."+key;
  const expectedHash=createHash("sha256").update(key).digest("hex");
  const spec={version:"linen-earth-garment-spec-v1",fabrics:{shirt:{id:"SYNTHETIC-SHIRT"},
    trouser:{id:"SYNTHETIC-TROUSER"}},shirt:{collar:"Point"},trouser:{shape:"Regular"}};
  const recipeHash=createHash("sha256").update(JSON.stringify(canonical(spec))).digest("hex");
  const revision={version:"linen-earth-design-lock-v1",
    revisionId:"LE-LOCK-20261101180000-"+recipeHash.slice(0,12).toUpperCase(),
    parentRevisionId:null,recipeHash,lockedAt:"2026-11-01T18:00:00.000Z",garmentSpec:spec};
  const privateMarker="SYNTHETIC_PRIVATE_RECOVERY_TOKEN_NOT_FOR_LOGGING";
  let mode="ok";
  const seen=[];
  const upstream=http.createServer(async(req,res)=>{
    const path=req.url||"";
    const parts=[];
    for await(const chunk of req)parts.push(chunk);
    const payload=JSON.parse(Buffer.concat(parts).toString("utf8"));
    seen.push({path,headers:req.headers,payload});
    if(path==="/rest/v1/rpc/designer_locked_revision_vault_delete"){
      assert.equal(req.method,"POST");
      assert.equal(payload.p_vault_id,vaultId);
      assert.equal(payload.p_access_hash,expectedHash);
      const ack={
        deleteTrue:"true",deleteFalse:"false",deleteNull:"null",
        deleteString:'"false"',deleteObject:'{"deleted":false}',
        deleteArray:"[false]",deleteMalformed:"{not-json",
      };
      const mime=mode==="deleteWrongMime"?"text/plain":"application/json";
      res.writeHead(mode==="delete500"?500:200,{"content-type":mime});
      res.end(mode==="delete500"?JSON.stringify({error:privateMarker}):
        ack[mode]??"true");return;
    }
    assert.equal(path,"/rest/v1/rpc/designer_locked_revision_vault_get");
    assert.equal(req.method,"POST");
    assert.equal(payload.p_vault_id,vaultId);
    assert.equal(payload.p_access_hash,expectedHash);
    if(mode==="backend500"){
      res.writeHead(500,{"content-type":"application/json"});
      res.end(JSON.stringify({error:privateMarker,code:"INTERNAL_SENSITIVE_ERROR"}));return;
    }
    if(mode==="wrongMime"){
      res.writeHead(200,{"content-type":"text/html"});res.end("[]");return;
    }
    if(mode==="badJson"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end('{"private":"'+privateMarker+'",');return;
    }
    if(mode==="oversize"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end('["'+ "x".repeat(8_388_608)+'"]');return;
    }
    res.writeHead(200,{"content-type":"application/json"});
    res.end(mode==="missing"?"[]":JSON.stringify([{payload:revision,expires_at:"2027-01-01T00:00:00Z"}]));
  });
  const upstreamPort=await listen(upstream),nextPort=await freePort();
  const env={...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",
    SUPABASE_URL:"http://127.0.0.1:"+upstreamPort,
    SUPABASE_SECRET_KEY:"sb_secret_titan_vault_synthetic_only",
    SUPABASE_SERVICE_ROLE_KEY:"",SUPABASE_ANON_KEY:"",NEXT_PUBLIC_SUPABASE_ANON_KEY:""};
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
    "start","-H","127.0.0.1","-p",String(nextPort)],
    {env,stdio:["ignore","pipe","pipe"]});
  let output="";
  for(const stream of [child.stdout,child.stderr])
    stream.on("data",chunk=>{output=(output+chunk).slice(-8000);});
  const url="http://127.0.0.1:"+nextPort+"/api/designer/vault";
  try{
    let ready=false;
    for(let i=0;i<120;i++){
      if(child.exitCode!==null)throw Error("Next exited: "+output);
      try{
        // Invalid empty request proves the route is alive without touching RPC.
        const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json","connection":"close"},
          body:"null",signal:AbortSignal.timeout(1200)});
        ready=response.status===503;
      }catch{}
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,"Next did not start: "+output);
    for(const body of [
      "null","[]","true",'"load"',"{}",
      JSON.stringify({action:"load",recoveryToken:privateMarker.repeat(25000)}),
      "{bad",
    ]){
      seen.length=0;
      const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json","connection":"close"},
        body,signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      assert.ok([400,503].includes(response.status),"invalid request "+response.status);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
      assert.equal(seen.length,0,"malformed requests must never read backend");
      assert.ok(!JSON.stringify(result).includes(privateMarker),"private marker must not appear");
    }
    for(const kind of ["backend500","wrongMime","badJson","oversize","missing","ok"]){
      mode=kind;seen.length=0;
      const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json","connection":"close"},
        body:JSON.stringify({action:"load",recoveryToken:token}),
        signal:AbortSignal.timeout(15000)}).catch(error=>{
          // Surface the exact case and exit state, but never the recovery token
          // or any private upstream text in CI diagnostics.
          throw new Error("Vault response fixture failed at "+kind+
            "; Next exit="+String(child.exitCode)+
            "; error="+String(error?.cause?.code||error?.name||"unknown")+
            "; private log marker seen="+String(output.includes(privateMarker)));
        });
      const data=await response.json();
      const expected=kind==="ok"?200:kind==="missing"?404:503;
      assert.equal(response.status,expected,kind);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/,kind);
      assert.equal(seen.length,1,kind+" one vault lookup only");
      assert.ok(!JSON.stringify(data).includes(privateMarker),kind+" must not leak backend text");
      if(kind==="ok"){
        assert.equal(data.revision?.revisionId,revision.revisionId);
        assert.equal(data.revision?.recipeHash,recipeHash);
      }
      if(kind==="missing")assert.deepEqual(data,{error:"Design not found or recovery token expired."});
      if(expected===503)assert.deepEqual(data,{error:"Secure design storage is temporarily unavailable."});
    }
    for(const kind of [
      "deleteTrue","deleteFalse","deleteNull","deleteString",
      "deleteObject","deleteArray","deleteMalformed","deleteWrongMime","delete500",
    ]){
      mode=kind;seen.length=0;
      const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json","connection":"close"},
        body:JSON.stringify({action:"delete",recoveryToken:token}),
        signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      const isBoolean=kind==="deleteTrue"||kind==="deleteFalse";
      assert.equal(response.status,isBoolean?200:503,kind);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/,kind);
      assert.equal(seen.length,1,kind+" one delete RPC");
      assert.equal(seen[0].path,"/rest/v1/rpc/designer_locked_revision_vault_delete");
      assert.deepEqual(data,isBoolean?
        {deleted:kind==="deleteTrue"}:
        {error:"Secure design storage is temporarily unavailable."},kind);
      assert.ok(!JSON.stringify(data).includes(privateMarker),kind+" must redact upstream data");
    }
    assert.ok(!output.includes(privateMarker),"sensitive upstream error/JSON must not enter server logs");
    console.log("TITAN designer vault boundary PASS: 22 synthetic HTTP cases; zero real writes.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>upstream.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
