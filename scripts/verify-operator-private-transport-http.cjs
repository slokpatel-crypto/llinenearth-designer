"use strict";
// Synthetic, backend-free built-Next verification of every operator response class.
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {spawn}=require("node:child_process");
const {createHmac,randomBytes}=require("node:crypto");

async function port(){
  const server=http.createServer();
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  const n=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return n;
}
async function main(){
  const n=await port();
  const secret=randomBytes(32).toString("hex");
  const env={PATH:process.env.PATH,HOME:process.env.HOME,
    NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",
    LINEN_OPERATOR_SESSION_SECRET:secret};
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
    "start","-H","127.0.0.1","-p",String(n)],
    {env,stdio:["ignore","pipe","pipe"]});
  let output="";
  for(const stream of [child.stdout,child.stderr])
    stream.on("data",chunk=>{output=(output+chunk).slice(-6000);});
  const url=`http://127.0.0.1:${n}/api/operator/production`;
  try{
    let ready=false;
    for(let i=0;i<100;i++){
      if(child.exitCode!==null)throw Error("Next exited: "+output);
      try{ready=(await fetch(url,{signal:AbortSignal.timeout(600)})).status===401;}catch{}
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,"Next failed to start: "+output);
    const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+120000})).toString("base64url");
    const sig=createHmac("sha256",secret).update(payload).digest("base64url");
    const cookie=`linen_operator_session=${payload}.${sig}`;
    const cases=[
      ["anonymous GET",{},401],
      ["anonymous POST",{method:"POST",headers:{"content-type":"application/json"},body:"{}"},401],
      ["invalid session GET",{headers:{cookie:"linen_operator_session=invalid"}},401],
      ["configured-false signed GET",{headers:{cookie}},200],
      ["unsupported signed POST",{method:"POST",headers:{cookie,"content-type":"application/json"},body:JSON.stringify({action:"not_supported"})},400],
      ["missing locked revision signed POST",{method:"POST",headers:{cookie,"content-type":"application/json"},body:JSON.stringify({action:"create_quote"})},400],
      ["malformed signed POST",{method:"POST",headers:{cookie,"content-type":"application/json"},body:"{broken"},409],
    ];
    for(const [name,options,status] of cases){
      const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
      assert.equal(response.status,status,name);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/,name);
      const body=await response.json();
      if(name==="configured-false signed GET")
        assert.deepEqual(body,{configured:false,quotes:[],orders:[]});
      if(status===401)assert.deepEqual(body,{error:"Unauthorized."});
    }
    console.log(`TITAN private operator transport PASS: ${cases.length} built-Next HTTP cases, zero backend configuration and writes.`);
  }finally{
    if(child.exitCode===null){
      child.kill("SIGTERM");
      await once(child,"exit");
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
