"use strict";
// Real built-Next HTTP regression: anonymous requests must never be cached.
// Fixed loopback target; no production credentials, Supabase writes or providers.
const assert=require("node:assert/strict");
const base="http://127.0.0.1:3000";
if(new URL(base).hostname!=="127.0.0.1") throw Error("Loopback only");
(async()=>{
  for(const endpoint of ["/api/operator/production","/api/operator/garment-qc"]){
    for(const method of ["GET","POST"]){
      const response=await fetch(base+endpoint,{
        method,redirect:"manual",cache:"no-store",
        ...(method==="POST"?{
          headers:{"content-type":"application/json"},
          body:JSON.stringify({action:"probe-no-auth"}),
        }:{}),
      });
      assert.equal(response.status,401,method+" "+endpoint+" must reject anonymous access");
      const cache=response.headers.get("cache-control")||"";
      assert.match(cache,/\bprivate\b/i,method+" "+endpoint+" must be private");
      assert.match(cache,/\bno-store\b/i,method+" "+endpoint+" must not be stored");
      assert.equal(response.headers.get("pragma"),"no-cache",
        method+" "+endpoint+" must prohibit legacy intermediary caches");
      const body=await response.json();
      assert.equal(body?.error,"Unauthorized.");
    }
  }
  process.stdout.write("Operator production/QC private response HTTP smoke PASS (anonymous; no live writes).\n");
})().catch(error=>{console.error(error);process.exitCode=1;});
