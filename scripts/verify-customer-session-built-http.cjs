// Built-Next network regression: actual HTTP transport and local fake identity provider.
// Synthetic-only: no live Supabase, stock, paid AI or production writes.
const assert = require("node:assert/strict");
const http = require("node:http");
const {spawn} = require("node:child_process");
const {setTimeout:delay} = require("node:timers/promises");

async function listen(server) {
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return server.address().port;
}
async function main() {
  let upstreamStatus=503;
  const provider=http.createServer((req,res)=>{
    assert.equal(req.url,"/auth/v1/user");
    assert.equal(req.headers.authorization,"Bearer synthetic-legacy-token");
    res.writeHead(upstreamStatus,{"content-type":"application/json"});
    res.end(JSON.stringify(upstreamStatus===200?{id:"synthetic-customer-123",email:"synthetic@example.invalid"}:{error:"SYNTHETIC_PRIVATE_PROVIDER_SECRET"}));
  });
  const providerPort=await listen(provider);
  const portServer=http.createServer();
  const appPort=await listen(portServer);
  await new Promise(resolve=>portServer.close(resolve));
  const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(appPort)],{
    env:{...process.env,SUPABASE_URL:`http://127.0.0.1:${providerPort}`,SUPABASE_ANON_KEY:"synthetic-anon",NEXT_TELEMETRY_DISABLED:"1"},
    stdio:["ignore","pipe","pipe"],
  });
  let output="";
  for(const stream of [child.stdout,child.stderr])stream.on("data",data=>{output=(output+String(data)).slice(-20000);});
  try {
    const url=`http://127.0.0.1:${appPort}/api/customer-auth/session`;
    let ready=false;
    for(let i=0;i<80;i++){
      if(child.exitCode!==null)throw new Error("Next exited before ready");
      try{const response=await fetch(url);if(response.status){ready=true;break;}}catch{}
      await delay(250);
    }
    assert.ok(ready,"built Next server did not become ready");
    for(const [providerCode,expectedCode] of [[429,503],[503,503],[401,200]]){
      upstreamStatus=providerCode;
      const response=await fetch(url,{headers:{cookie:"le_customer_access=synthetic-legacy-token"},cache:"no-store"});
      assert.equal(response.status,expectedCode,`upstream ${providerCode}`);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
      const body=await response.text();
      assert.doesNotMatch(body,/SYNTHETIC_PRIVATE_PROVIDER_SECRET|synthetic-legacy-token/);
      assert.deepEqual(JSON.parse(body),providerCode===401?{customer:null}:{customer:null,error:"Customer session temporarily unavailable."});
    }
    // Compatibility: a healthy legacy access-token bridge must still resolve the customer.\n    upstreamStatus=200;\n    const authenticated=await fetch(url,{headers:{cookie:"le_customer_access=synthetic-legacy-token"},cache:"no-store"});\n    assert.equal(authenticated.status,200);\n    assert.match(authenticated.headers.get("cache-control")||"",/private.*no-store/);\n    assert.deepEqual(await authenticated.json(),{customer:{id:"synthetic-customer-123",email:"synthetic@example.invalid"}});\n    const signedOut=await fetch(url);
    assert.equal(signedOut.status,200);
    assert.deepEqual(await signedOut.json(),{customer:null});
    assert.doesNotMatch(output,/SYNTHETIC_PRIVATE_PROVIDER_SECRET|synthetic-legacy-token/);
    console.log("PASS built-Next customer-session HTTP 429/503/401, authenticated legacy bridge and signed-out regression");
  }finally{
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve=>child.once("exit",resolve)),delay(2000)]);
    if(child.exitCode===null)child.kill("SIGKILL");
    await new Promise(resolve=>provider.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
