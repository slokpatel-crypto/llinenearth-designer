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
  // Every independent fixture scenario uses an RFC 5737 documentation IP.
  // Otherwise 30+ synthetic tests correctly trip the real 30/min rate guard.
  let syntheticClientSequence=0;
  function fixtureHeaders(){
    const client=++syntheticClientSequence;
    assert.ok(client<=200,"documentation IP suffix must remain valid");
    return {"content-type":"application/json","connection":"close",
      "x-forwarded-for":"198.51.100."+client};
  }
  let mode="ok";
  const seen=[];
  const upstream=http.createServer(async(req,res)=>{
    const path=req.url||"";
    if(path==="/auth/v1/user"){
      seen.push({path,headers:req.headers});
      if(req.headers.authorization!=="Bearer valid-legacy"){
        res.writeHead(401,{"content-type":"application/json"});res.end("{}");return;
      }
      res.writeHead(200,{"content-type":"application/json"});
      res.end(JSON.stringify({id:"123e4567-e89b-12d3-a456-426614174000",email:"alice@example.com"}));return;
    }
    const parts=[];
    for await(const chunk of req)parts.push(chunk);
    const payload=JSON.parse(Buffer.concat(parts).toString("utf8"));
    seen.push({path,headers:req.headers,payload});
    if(path==="/auth/v1/otp"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end("{}");return;
    }
    if(path==="/auth/v1/verify"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end(JSON.stringify({user:{id:payload.email==="bob@example.com"?"223e4567-e89b-12d3-a456-426614174000":"123e4567-e89b-12d3-a456-426614174000",email:payload.email}}));return;
    }
    if(path==="/rest/v1/rpc/designer_locked_revision_vault_store"){
      assert.equal(req.method,"POST");
      assert.equal(payload.p_revision_id,revision.revisionId);
      assert.equal(payload.p_recipe_hash,recipeHash);
      assert.deepEqual(payload.p_payload,revision);
      assert.match(payload.p_access_hash,/^[0-9a-f]{64}$/);
      const outcomes={
        storeNull:"null",storeObject:JSON.stringify({vaultId}),
        storeArray:JSON.stringify([vaultId]),storeBoolean:"true",
        storeString:'"false"',storeEmpty:'""',
        storeWrongVariant:'"b287e470-0e90-4fd4-75fb-976eecebd244"',
        storeWrongVersion:'"b287e470-0e90-0fd4-b5fb-976eecebd244"',
        storeMalformed:"{invalid-json",
      };
      res.writeHead(mode==="storeBackend500"?500:200,
        {"content-type":mode==="storeWrongMime"?"text/plain":"application/json"});
      res.end(mode==="storeBackend500"?JSON.stringify({error:privateMarker}):
        outcomes[mode]??JSON.stringify(vaultId));return;
    }
    if(path==="/rest/v1/rpc/designer_locked_revision_vault_set_owner"){
      assert.equal(payload.p_vault_id,vaultId);
      assert.match(payload.p_access_hash,/^[0-9a-f]{64}$/);
      res.writeHead(mode==="ownerBackend500"?500:200,{"content-type":"application/json"});
      res.end(mode==="ownerBackend500"?JSON.stringify({error:privateMarker}):
        mode==="ownerMalformed"?'"false"':
        mode==="ownerFalse"?"false":"true");return;
    }
    if(path==="/rest/v1/rpc/production_claim_revision_ownership"){
      res.writeHead(200,{"content-type":"application/json"});res.end("true");return;
    }
    if(path==="/rest/v1/rpc/production_quote_accept_owned"){
      assert.equal(payload.p_quote_id,vaultId);
      res.writeHead(200,{"content-type":"application/json"});
      res.end(mode==="quoteString"?'"false"':mode==="quoteNull"?"null":mode==="quoteObject"?'{"accepted":true}':payload.p_owner_user_id==="123e4567-e89b-12d3-a456-426614174000"?"true":"false");return;
    }
    if(path==="/rest/v1/rpc/designer_locked_revision_vault_get_owned"){
      assert.equal(payload.p_vault_id,vaultId);
      res.writeHead(200,{"content-type":"application/json"});
      res.end(payload.p_owner_user_id==="123e4567-e89b-12d3-a456-426614174000"?
        JSON.stringify([{payload:revision,expires_at:"2027-01-01T00:00:00Z"}]):"[]");return;
    }
    if(path==="/rest/v1/rpc/designer_locked_revision_vault_list_owned"){
      res.writeHead(200,{"content-type":"application/json"});res.end("[]");return;
    }
    if(path==="/rest/v1/rpc/designer_locked_revision_vault_delete_owned"){
      assert.equal(payload.p_vault_id,vaultId);
      res.writeHead(200,{"content-type":"application/json"});
      res.end(payload.p_owner_user_id==="123e4567-e89b-12d3-a456-426614174000"?"true":"false");return;
    }
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
    const badRows={
      rowsNull:"null",rowsObject:"{}",rowsTwo:JSON.stringify([
        {payload:revision,expires_at:"2027-01-01T00:00:00Z"},
        {payload:revision,expires_at:"2027-01-01T00:00:00Z"}]),
      rowsNoPayload:JSON.stringify([{expires_at:"2027-01-01T00:00:00Z"}]),
      rowsScalarPayload:JSON.stringify([{payload:"wrong",expires_at:"2027-01-01T00:00:00Z"}]),
      rowsBadExpiry:JSON.stringify([{payload:revision,expires_at:"not-a-timestamp"}]),
      rowsBadHash:JSON.stringify([{payload:{...revision,recipeHash:"0".repeat(64)},
        expires_at:"2027-01-01T00:00:00Z"}]),
      rowsEmptyObject:JSON.stringify([{}]),
    };
    if(Object.hasOwn(badRows,mode)){
      res.writeHead(200,{"content-type":"application/json"});
      res.end(badRows[mode]);return;
    }
    res.writeHead(200,{"content-type":"application/json"});
    res.end(mode==="missing"?"[]":JSON.stringify([{payload:revision,expires_at:"2027-01-01T00:00:00Z"}]));
  });
  const upstreamPort=await listen(upstream),nextPort=await freePort();
  const env={...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",
    SUPABASE_URL:"http://127.0.0.1:"+upstreamPort,
    SUPABASE_SECRET_KEY:"sb_secret_titan_vault_synthetic_only",
    SUPABASE_SERVICE_ROLE_KEY:"",SUPABASE_ANON_KEY:"synthetic-anon-for-local-auth-only",NEXT_PUBLIC_SUPABASE_ANON_KEY:"",
    LINEN_CUSTOMER_SESSION_SECRET:"synthetic-session-secret-32-chars-not-live-012345"};
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
        const response=await fetch(url,{method:"POST",headers:fixtureHeaders(),
          body:"null",signal:AbortSignal.timeout(1200)});
        ready=response.status===503;
      }catch{}
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,"Next did not start: "+output);
    // Isolated real-Next HTTP OTP/session/signout and share preflight; the fake
    // Supabase server never touches live customer records.
    const origin="http://127.0.0.1:"+nextPort;
    async function authPost(path,body,headers={}){
      return await fetch(origin+path,{method:"POST",
        headers:{...fixtureHeaders(),...headers},
        body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    }
    for(const endpoint of ["/api/customer-auth/otp","/api/customer-auth/verify","/api/designer/share","/api/customer-account/production"]){
      seen.length=0;
      const response=await authPost(endpoint,{email:"alice@example.com",token:"123456"},
        {origin:"https://attacker.invalid"});
      assert.equal(response.status,403,endpoint+" rejects foreign origin");
      assert.equal(seen.length,0,"cross-site request must never touch Supabase");
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
    }
    for(const endpoint of ["/api/customer-auth/otp","/api/customer-auth/verify","/api/designer/share","/api/customer-account/production"]){
      seen.length=0;
      const response=await authPost(endpoint,{email:"alice@example.com",token:"123456"},
        {"sec-fetch-site":"same-site"});
      assert.equal(response.status,403,endpoint+" rejects same-site subdomain");
      assert.equal(seen.length,0);
    }
    seen.length=0;
    const otp=await authPost("/api/customer-auth/otp",{email:"alice@example.com"});
    assert.equal(otp.status,200,"synthetic OTP accepted");
    assert.equal(seen.length,1);
    assert.equal(seen[0].path,"/auth/v1/otp");

    seen.length=0;
    const verify=await authPost("/api/customer-auth/verify",
      {email:"alice@example.com",token:"123456"});
    assert.equal(verify.status,200,"synthetic OTP verification accepted");
    assert.equal(seen.length,1);
    assert.equal(seen[0].path,"/auth/v1/verify");
    const signedCookie=verify.headers.get("set-cookie")?.match(/le_customer_session=([^;]+)/)?.[1];
    assert.ok(signedCookie,"verification must set a signed cookie");
    const authenticated=await fetch(origin+"/api/customer-auth/session",{
      headers:{cookie:"le_customer_session="+signedCookie}});
    assert.equal((await authenticated.json()).customer?.id,"123e4567-e89b-12d3-a456-426614174000");
    assert.match(authenticated.headers.get("cache-control")||"",/private.*no-store/);

    seen.length=0;
    const invalidSession=await fetch(origin+"/api/customer-auth/session",{
      headers:{cookie:"le_customer_session="+signedCookie+"tampered; le_customer_access=valid-legacy"}});
    assert.deepEqual(await invalidSession.json(),{customer:null});
    assert.equal(seen.length,0,"invalid signed cookie must not downgrade to legacy auth");

    seen.length=0;
    const legacy=await fetch(origin+"/api/customer-auth/session",{
      headers:{cookie:"le_customer_access=valid-legacy"}});
    assert.equal((await legacy.json()).customer?.email,"alice@example.com");
    assert.equal(seen.length,1,"legacy bridge only if no signed cookie");
    assert.equal(seen[0].path,"/auth/v1/user");

    // Two synthetic accounts, one locked vault: owner IDs must come from the
    // verified cookie, never from forged JSON fields or another account.
    const bobVerify=await authPost("/api/customer-auth/verify",
      {email:"bob@example.com",token:"123456"});
    assert.equal(bobVerify.status,200);
    const bobCookie=bobVerify.headers.get("set-cookie")?.match(/le_customer_session=([^;]+)/)?.[1];
    assert.ok(bobCookie);
    for(const [name,cookie,expectedStatus,ownerId] of [
      ["alice",signedCookie,200,"123e4567-e89b-12d3-a456-426614174000"],
      ["bob",bobCookie,404,"223e4567-e89b-12d3-a456-426614174000"],
    ]){
      seen.length=0;
      const accepted=await fetch(origin+"/api/customer-account/production",{
        method:"POST",headers:{...fixtureHeaders(),cookie:"le_customer_session="+cookie},
        body:JSON.stringify({action:"accept_quote",quoteId:vaultId,
          ownerUserId:"123e4567-e89b-12d3-a456-426614174000"}),
        signal:AbortSignal.timeout(15000)});
      assert.equal(accepted.status,expectedStatus,name+" owner-only quote acceptance");
      assert.equal(seen.length,1);
      assert.equal(seen[0].path,"/rest/v1/rpc/production_quote_accept_owned");
      assert.equal(seen[0].payload.p_owner_user_id,ownerId);
    }
    for(const kind of ["quoteString","quoteNull","quoteObject"]){
      mode=kind;seen.length=0;
      const response=await fetch(origin+"/api/customer-account/production",{
        method:"POST",headers:{...fixtureHeaders(),cookie:"le_customer_session="+signedCookie},
        body:JSON.stringify({action:"accept_quote",quoteId:vaultId}),
        signal:AbortSignal.timeout(15000)});
      assert.equal(response.status,409,kind+" cannot forge quote acceptance");
      assert.equal(seen.length,1);
      assert.ok(!(await response.text()).includes('"accepted":true'));
    }
    mode="ok";
    seen.length=0;
    const unauthedQuote=await fetch(origin+"/api/customer-account/production",{
      method:"POST",headers:fixtureHeaders(),
      body:JSON.stringify({action:"accept_quote",quoteId:vaultId}),
      signal:AbortSignal.timeout(15000)});
    assert.equal(unauthedQuote.status,401);
    assert.equal(seen.length,0);
    for(const [name,cookie,expectedStatus,expectedOwner] of [
      ["alice",signedCookie,200,"123e4567-e89b-12d3-a456-426614174000"],
      ["bob",bobCookie,404,"223e4567-e89b-12d3-a456-426614174000"],
    ]){
      seen.length=0;
      const response=await fetch(url,{method:"POST",
        headers:{...fixtureHeaders(),cookie:"le_customer_session="+cookie},
        body:JSON.stringify({action:"loadOwned",vaultId,
          ownerUserId:"123e4567-e89b-12d3-a456-426614174000"}),
        signal:AbortSignal.timeout(15000)});
      assert.equal(response.status,expectedStatus,name+" private vault isolation");
      assert.equal(seen.length,1);
      assert.equal(seen[0].path,"/rest/v1/rpc/designer_locked_revision_vault_get_owned");
      assert.equal(seen[0].payload.p_owner_user_id,expectedOwner);
      const data=await response.json();
      if(name==="bob")assert.ok(!JSON.stringify(data).includes(recipeHash));
      else assert.equal(data.revision?.recipeHash,recipeHash);
    }
    seen.length=0;
    const bobDelete=await fetch(url,{method:"POST",
      headers:{...fixtureHeaders(),cookie:"le_customer_session="+bobCookie},
      body:JSON.stringify({action:"deleteOwned",vaultId,ownerUserId:"123e4567-e89b-12d3-a456-426614174000"}),
      signal:AbortSignal.timeout(15000)});
    assert.equal(bobDelete.status,200);
    assert.deepEqual(await bobDelete.json(),{deleted:false});
    assert.equal(seen.length,1);
    assert.equal(seen[0].payload.p_owner_user_id,"223e4567-e89b-12d3-a456-426614174000");
    const crossSiteLogout=await fetch(origin+"/api/customer-auth/logout",{
      method:"POST",headers:{origin:"https://attacker.invalid",cookie:"le_customer_session="+signedCookie}});
    assert.equal(crossSiteLogout.status,403);
    assert.ok(!crossSiteLogout.headers.get("set-cookie"),"cross-site logout must not clear cookies");
    const logout=await fetch(origin+"/api/customer-auth/logout",{method:"POST",
      // Synthetic Node transport has no browser Origin; assert the browser fetch-site boundary instead.
      headers:{"sec-fetch-site":"same-origin",cookie:"le_customer_session="+signedCookie}});
    assert.equal(logout.status,200);
    assert.match(logout.headers.get("set-cookie")||"",/le_customer_session=/);

    // Synthetic real-HTTP authorization preflight: no forged Origin, same-site
    // subdomain, wrong MIME or oversized JSON may reach a service-role RPC.
    for(const [extraHeaders,body,expectedStatus] of [
      [{origin:"https://attacker.invalid"},JSON.stringify({action:"load",recoveryToken:token}),403],
      [{"sec-fetch-site":"cross-site"},JSON.stringify({action:"delete",recoveryToken:token}),403],
      [{origin:"http://127.0.0.1:"+nextPort,"sec-fetch-site":"same-site"},JSON.stringify({action:"load",recoveryToken:token}),403],
      [{"content-type":"text/plain"},JSON.stringify({action:"load",recoveryToken:token}),415],
      [{},JSON.stringify({action:"load",recoveryToken:token,pad:"x".repeat(1_048_576)}),413],
    ]){
      seen.length=0;
      const response=await fetch(url,{method:"POST",headers:{...fixtureHeaders(),...extraHeaders},
        body,signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      assert.equal(response.status,expectedStatus,"vault preflight rejection");
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
      assert.equal(seen.length,0,"rejected request must not reach privileged RPC");
      assert.ok(!JSON.stringify(data).includes(privateMarker));
    }
    for(const body of [
      "null","[]","true",'"load"',"{}",
      JSON.stringify({action:"load",recoveryToken:privateMarker.repeat(25000)}),
      "{bad",
    ]){
      seen.length=0;
      const response=await fetch(url,{method:"POST",headers:fixtureHeaders(),
        body,signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      assert.ok([400,413,503].includes(response.status),"invalid request "+response.status);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/);
      assert.equal(seen.length,0,"malformed requests must never read backend");
      assert.ok(!JSON.stringify(result).includes(privateMarker),"private marker must not appear");
    }
    for(const kind of ["backend500","wrongMime","badJson","oversize","missing","ok",
      "rowsNull","rowsObject","rowsTwo","rowsNoPayload","rowsScalarPayload",
      "rowsBadExpiry","rowsBadHash","rowsEmptyObject"]){
      mode=kind;seen.length=0;
      const response=await fetch(url,{method:"POST",headers:fixtureHeaders(),
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
      const expected=kind==="ok"?200:kind==="missing"?404:kind==="rowsBadHash"?409:503;
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
      if(expected===409)assert.deepEqual(data,{error:"Stored design failed integrity verification."});
    }
    for(const kind of [
      "deleteTrue","deleteFalse","deleteNull","deleteString",
      "deleteObject","deleteArray","deleteMalformed","deleteWrongMime","delete500",
    ]){
      mode=kind;seen.length=0;
      const response=await fetch(url,{method:"POST",headers:fixtureHeaders(),
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
    for(const kind of [
      "storeGood","storeNull","storeObject","storeArray","storeBoolean",
      "storeString","storeEmpty","storeWrongVariant","storeWrongVersion",
      "storeMalformed","storeWrongMime","storeBackend500",
    ]){
      mode=kind;seen.length=0;
      const response=await fetch(url,{method:"POST",headers:fixtureHeaders(),
        body:JSON.stringify({action:"store",revision}),
        signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      assert.equal(response.status,kind==="storeGood"?200:503,kind);
      assert.match(response.headers.get("cache-control")||"",/private.*no-store/,kind);
      assert.equal(seen.length,1,"store must not call owner without customer");
      assert.equal(seen[0].path,"/rest/v1/rpc/designer_locked_revision_vault_store");
      if(kind==="storeGood"){
        assert.equal(data.vaultId,vaultId);
        assert.equal(data.accountOwned,false);
        const parts=data.recoveryToken?.split(".");
        assert.equal(parts?.length,3);
        assert.equal(parts?.[0],"lev1");
        assert.equal(parts?.[1],vaultId);
        assert.equal(createHash("sha256").update(parts[2]).digest("hex"),
          seen[0].payload.p_access_hash);
      }else assert.deepEqual(data,{error:"Secure design storage is temporarily unavailable."});
      assert.ok(!JSON.stringify(data).includes(privateMarker),kind);
    }
    for(const [kind,expectedOwned,expectedCalls] of [
      ["ownerBackend500",false,2],["ownerMalformed",false,2],
      ["ownerFalse",false,2],["ownerGood",true,3],
    ]){
      mode=kind;seen.length=0;
      const response=await fetch(url,{method:"POST",
        headers:{...fixtureHeaders(),cookie:"le_customer_session="+signedCookie},
        body:JSON.stringify({action:"store",revision}),
        signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      assert.equal(response.status,200,"recovery key survives post-store ownership: "+kind);
      assert.equal(data.accountOwned,expectedOwned,kind);
      assert.ok(data.recoveryToken?.startsWith("lev1."+vaultId+"."));
      assert.equal(seen.length,expectedCalls,kind);
      assert.equal(seen[0].path,"/rest/v1/rpc/designer_locked_revision_vault_store");
      assert.equal(seen[1].path,"/rest/v1/rpc/designer_locked_revision_vault_set_owner");
      assert.ok(!JSON.stringify(data).includes(privateMarker));
    }
    assert.ok(!output.includes(privateMarker),"sensitive upstream error/JSON must not enter server logs");
    console.log("TITAN designer vault boundary PASS: synthetic HTTP cases; zero real writes.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>upstream.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
