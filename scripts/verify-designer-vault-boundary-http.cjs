"use strict";
// Built-Next synthetic design vault boundary checks. No real Supabase or
// customer records, no paid services and no database writes.
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {spawn}=require("node:child_process");
const {randomBytes,createHash,createHmac}=require("node:crypto");

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
  // The vault-boundary fixture is intentionally sparse. The public-share
  // fixture must contain the complete recipe fields required by the signed
  // share verifier, without borrowing any real customer or fabric records.
  const shareSpec={
    version:"linen-earth-garment-spec-v1",
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{
      shirt:{id:"SYNTHETIC-SHIRT",name:"Synthetic Shirt",line:"Synthetic Linen"},
      trouser:{id:"SYNTHETIC-TROUSER",name:"Synthetic Trouser",line:"Synthetic Linen"},
    },
    shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",
      cuff:"Barrel",placket:"Standard",button:"Corozo"},
    trouser:{shape:"Regular",rise:"Mid Rise",waistband:"Standard",break:"Slight Break"},
    creative:null,
  };
  const shareRecipeHash=createHash("sha256").update(JSON.stringify(canonical(shareSpec))).digest("hex");
  const shareRevision={...revision,recipeHash:shareRecipeHash,garmentSpec:shareSpec,
    revisionId:"LE-LOCK-20261101180000-"+shareRecipeHash.slice(0,12).toUpperCase()};
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
  let revocationMode="ok";
  const revokedHashes=new Set();
  const shareRecords=new Map();
  let shareMode="ok";
  let otpMode="ok";
  const otpSubjects=new Map();
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
    if(path==="/rest/v1/rpc/customer_otp_rate_consume"){
      assert.match(payload.p_subject_hash,/^[a-f0-9]{64}$/);
      assert.ok(!JSON.stringify(payload).includes("@"),"the database must never receive raw customer emails");
      if(otpMode==="backend500"){
        res.writeHead(503,{"content-type":"application/json"});
        res.end(JSON.stringify({error:privateMarker}));return;
      }
      res.writeHead(200,{"content-type":"application/json"});
      if(otpMode==="malformed"){res.end('"true"');return;}
      const count=(otpSubjects.get(payload.p_subject_hash)||0)+1;
      otpSubjects.set(payload.p_subject_hash,count);
      res.end(count<=8?"true":"false");return;
    }
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
    if(path==="/rest/v1/rpc/design_share_audit_record"){
      assert.equal(payload.p_revision_id,shareRevision.revisionId);
      assert.equal(payload.p_recipe_hash,shareRevision.recipeHash);
      res.writeHead(200,{"content-type":"application/json"});
      res.end("true");return;
    }
    if(path==="/rest/v1/rpc/designer_share_register"){
      assert.match(payload.p_token_hash,/^[a-f0-9]{64}$/);
      assert.match(payload.p_revoke_key_hash,/^[a-f0-9]{64}$/);
      assert.ok(Date.parse(payload.p_expires_at)>Date.now());
      const exists=shareRecords.has(payload.p_token_hash);
      if(!exists&&shareMode!=="register500"&&shareMode!=="registerMalformed"
        &&shareMode!=="registerFalse")shareRecords.set(payload.p_token_hash,{
        key:payload.p_revoke_key_hash,revoked:false,
        owner:payload.p_owner_user_id||null,expiresAt:payload.p_expires_at,
      });
      res.writeHead(shareMode==="register500"?503:200,
        {"content-type":"application/json"});
      res.end(shareMode==="register500"?JSON.stringify({error:privateMarker}):
        shareMode==="registerMalformed"?'"true"':
        (shareMode==="registerFalse"||exists)?"false":"true");return;
    }
    if(path==="/rest/v1/rpc/designer_share_list_owned"){
      assert.match(payload.p_owner_user_id,/^[0-9a-f-]{36}$/);
      res.writeHead(shareMode==="list500"?503:200,{"content-type":"application/json"});
      if(shareMode==="list500"){res.end(JSON.stringify({error:privateMarker}));return;}
      if(shareMode==="listMalformed"){res.end(JSON.stringify({token_hash:privateMarker}));return;}
      const rows=Array.from(shareRecords.entries())
        .filter(([,record])=>record.owner===payload.p_owner_user_id)
        .map(([token_hash,record])=>({token_hash,expires_at:record.expiresAt,
          revoked_at:record.revoked?"2026-11-03T00:00:00Z":null}));
      res.end(JSON.stringify(rows));return;
    }
    if(path==="/rest/v1/rpc/designer_share_revoke_owned"){
      assert.match(payload.p_token_hash,/^[0-9a-f]{64}$/);
      const record=shareRecords.get(payload.p_token_hash);
      const ownerMatches=Boolean(record?.owner&&record.owner===payload.p_owner_user_id);
      if(ownerMatches&&shareMode!=="ownedRevoke500")record.revoked=true;
      res.writeHead(shareMode==="ownedRevoke500"?503:200,{"content-type":"application/json"});
      res.end(shareMode==="ownedRevoke500"?JSON.stringify({error:privateMarker}):
        shareMode==="ownedRevokeMalformed"?'"true"':ownerMatches?"true":"false");return;
    }
    if(path==="/rest/v1/rpc/designer_share_is_revoked"){
      assert.match(payload.p_token_hash,/^[a-f0-9]{64}$/);
      res.writeHead(shareMode==="lookup500"?503:200,
        {"content-type":"application/json"});
      res.end(shareMode==="lookup500"?JSON.stringify({error:privateMarker}):
        shareMode==="lookupMalformed"?'"false"':
        shareRecords.get(payload.p_token_hash)?.revoked?"true":"false");return;
    }
    if(path==="/rest/v1/rpc/designer_share_revoke"){
      assert.match(payload.p_token_hash,/^[a-f0-9]{64}$/);
      assert.match(payload.p_revoke_key_hash,/^[a-f0-9]{64}$/);
      const record=shareRecords.get(payload.p_token_hash);
      const valid=Boolean(record&&record.key===payload.p_revoke_key_hash);
      if(valid&&shareMode!=="revoke500"&&shareMode!=="revokeMalformed")record.revoked=true;
      res.writeHead(shareMode==="revoke500"?503:200,
        {"content-type":"application/json"});
      res.end(shareMode==="revoke500"?JSON.stringify({error:privateMarker}):
        shareMode==="revokeMalformed"?'"true"':valid?"true":"false");return;
    }
    if(path==="/rest/v1/rpc/customer_session_is_revoked"){
      assert.match(payload.p_token_hash,/^[0-9a-f]{64}$/);
      if(revocationMode==="check500"){
        res.writeHead(503,{"content-type":"application/json"});
        res.end(JSON.stringify({error:privateMarker}));return;
      }
      res.writeHead(200,{"content-type":"application/json"});
      res.end(revocationMode==="checkMalformed"?'"false"':
        revokedHashes.has(payload.p_token_hash)?"true":"false");return;
    }
    if(path==="/rest/v1/rpc/customer_session_revoke"){
      assert.match(payload.p_token_hash,/^[0-9a-f]{64}$/);
      if(revocationMode==="revoke500"){
        res.writeHead(503,{"content-type":"application/json"});
        res.end(JSON.stringify({error:privateMarker}));return;
      }
      res.writeHead(200,{"content-type":"application/json"});
      if(revocationMode==="revokeMalformed"){res.end('"true"');return;}
      if(revocationMode==="revokeFalse"){res.end("false");return;}
      revokedHashes.add(payload.p_token_hash);
      res.end("true");return;
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
    LINEN_CUSTOMER_SESSION_SECRET:"synthetic-session-secret-32-chars-not-live-012345",
    LINEN_DESIGN_SHARE_SECRET:"synthetic-design-share-secret-32-chars-not-live-012345",
    LINEN_CUSTOMER_OTP_RATE_SECRET:"dedicated-synthetic-otp-hmac-secret-12345678901234567890"};
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
    // Revocation rollout is opt-in. Run a SECOND isolated Next instance with the
    // synthetic migration flag enabled: no live auth, backend or customer data.
    const enforcedPort=await freePort();
    const enforcedOrigin="http://127.0.0.1:"+enforcedPort;
    const enforcedEnv={...env,LINEN_CUSTOMER_SESSION_REVOCATION_REQUIRED:"1",
      LINEN_DESIGN_SHARE_REVOCATION_REQUIRED:"1",
      LINEN_CUSTOMER_OTP_DISTRIBUTED_REQUIRED:"1"};
    const enforcedChild=spawn(process.execPath,[require.resolve("next/dist/bin/next"),
      "start","-H","127.0.0.1","-p",String(enforcedPort)],
      {env:enforcedEnv,stdio:["ignore","pipe","pipe"]});
    let enforcedOutput="";
    for(const stream of [enforcedChild.stdout,enforcedChild.stderr])
      stream.on("data",chunk=>{enforcedOutput=(enforcedOutput+chunk).slice(-8000);});
    try{
      let ready=false;
      for(let i=0;i<120;i++){
        if(enforcedChild.exitCode!==null)throw Error("Revocation Next exited: "+enforcedOutput);
        try{
          const response=await fetch(enforcedOrigin+"/api/customer-auth/session",{
            signal:AbortSignal.timeout(1200)});
          ready=response.status===200;
        }catch{}
        if(ready)break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      assert.ok(ready,"Revocation Next did not start: "+enforcedOutput);

      // Eight OTP emails per normalized subject per ten minutes, regardless
      // of untrusted forwarded IP/header rotation or serverless instance.
      otpSubjects.clear();otpMode="ok";seen.length=0;
      const expectedOtpDigest=createHmac("sha256",enforcedEnv.LINEN_CUSTOMER_OTP_RATE_SECRET)
        .update("linen-earth:customer-otp:v1\0alice@example.com").digest("hex");
      for(let i=0;i<8;i++){
        const response=await fetch(enforcedOrigin+"/api/customer-auth/otp",{
          method:"POST",headers:fixtureHeaders(),
          body:JSON.stringify({email:i%2?"Alice@Example.Com":"alice@example.com"}),
          signal:AbortSignal.timeout(15000)});
        assert.equal(response.status,200,"eight distributed OTP requests should be allowed");
      }
      assert.equal(otpSubjects.get(expectedOtpDigest),8,"normalized email must consume one digest budget");
      assert.equal(seen.filter(item=>item.path==="/auth/v1/otp").length,8);
      seen.length=0;
      const ninthOtp=await fetch(enforcedOrigin+"/api/customer-auth/otp",{
        method:"POST",headers:fixtureHeaders(),
        body:JSON.stringify({email:"alice@example.com"}),signal:AbortSignal.timeout(15000)});
      assert.equal(ninthOtp.status,429,"ninth OTP request must be blocked server-wide");
      assert.deepEqual(seen.map(item=>item.path),["/rest/v1/rpc/customer_otp_rate_consume"],
        "denied OTP must never reach auth provider");
      for(const failure of ["backend500","malformed"]){
        otpMode=failure;seen.length=0;
        const response=await fetch(enforcedOrigin+"/api/customer-auth/otp",{
          method:"POST",headers:fixtureHeaders(),
          body:JSON.stringify({email:"bob@example.com"}),signal:AbortSignal.timeout(15000)});
        assert.equal(response.status,503,failure+" must fail closed before OTP dispatch");
        assert.deepEqual(seen.map(item=>item.path),["/rest/v1/rpc/customer_otp_rate_consume"]);
      }
      otpMode="ok";seen.length=0;
      const signed=await fetch(enforcedOrigin+"/api/customer-auth/verify",{
        method:"POST",headers:fixtureHeaders(),
        body:JSON.stringify({email:"alice@example.com",token:"123456"}),
        signal:AbortSignal.timeout(15000)});
      assert.equal(signed.status,200,"revocation-enabled sign-in requires backend proof");
      const cookie=signed.headers.get("set-cookie")?.match(/le_customer_session=([^;]+)/)?.[1];
      assert.ok(cookie);
      assert.deepEqual(seen.map(item=>item.path),
        ["/auth/v1/verify","/rest/v1/rpc/customer_session_is_revoked"]);

      seen.length=0;
      const legacyOnly=await fetch(enforcedOrigin+"/api/customer-auth/session",{
        headers:{cookie:"le_customer_access=valid-legacy"}});
      assert.deepEqual(await legacyOnly.json(),{customer:null});
      assert.equal(seen.length,0,"legacy token must not bypass revocation enforcement");

      async function session(){
        return await fetch(enforcedOrigin+"/api/customer-auth/session",{
          headers:{cookie:"le_customer_session="+cookie},signal:AbortSignal.timeout(15000)});
      }
      async function signOut(){
        return await fetch(enforcedOrigin+"/api/customer-auth/logout",{
          method:"POST",headers:{cookie:"le_customer_session="+cookie,
            "sec-fetch-site":"same-origin"},signal:AbortSignal.timeout(15000)});
      }
      seen.length=0;
      const before=await session();
      assert.equal((await before.json()).customer?.email,"alice@example.com");
      assert.equal(seen.length,1);
      assert.equal(seen[0].path,"/rest/v1/rpc/customer_session_is_revoked");
      for(const rejection of ["revokeFalse","revokeMalformed","revoke500"]){
        revocationMode=rejection;seen.length=0;
        const response=await signOut();
        assert.equal(response.status,503,"signout cannot claim backend failure as success");
        assert.equal(response.headers.get("set-cookie"),null,
          "failed revocation must leave cookie available for retry");
        assert.equal(seen.length,1);
        assert.equal(seen[0].path,"/rest/v1/rpc/customer_session_revoke");
      }

      revocationMode="ok";seen.length=0;
      const logoutResponse=await signOut();
      assert.equal(logoutResponse.status,200);
      assert.match(logoutResponse.headers.get("set-cookie")||"",/le_customer_session=/);
      assert.equal(revokedHashes.size,1,"only a SHA-256 digest is stored");
      assert.equal(seen.length,1);
      assert.equal(seen[0].path,"/rest/v1/rpc/customer_session_revoke");
      seen.length=0;
      const replay=await session();
      assert.deepEqual(await replay.json(),{customer:null},"signed bearer replay must be denied");
      assert.equal(seen[0]?.path,"/rest/v1/rpc/customer_session_is_revoked");

      for(const failure of ["checkMalformed","check500"]){
        revocationMode=failure;seen.length=0;
        const response=await session();
        assert.deepEqual(await response.json(),{customer:null},
          "malformed/unavailable revocation checks must fail closed");
        assert.equal(seen.length,1);
      }
      // Secure public design-sharing must never reveal a public link unless
      // the independent private cancellation capability was registered.
      shareMode="register500";seen.length=0;
      const deniedIssue=await fetch(enforcedOrigin+"/api/designer/share",{
        method:"POST",headers:fixtureHeaders(),body:JSON.stringify(shareRevision),
        signal:AbortSignal.timeout(15000)});
      assert.equal(deniedIssue.status,503);
      assert.ok(!("token" in await deniedIssue.json()));
      assert.equal(seen.at(-1).path,"/rest/v1/rpc/designer_share_register");
      shareMode="ok";seen.length=0;
      const issued=await fetch(enforcedOrigin+"/api/designer/share",{
        method:"POST",headers:fixtureHeaders(),body:JSON.stringify(shareRevision),
        signal:AbortSignal.timeout(15000)});
      assert.equal(issued.status,200,"share token requires revocation capability registration");
      const shared=await issued.json();
      assert.ok(shared.token?.startsWith("v1."));
      assert.match(shared.revokeKey,/^[A-Za-z0-9_-]{43}$/);
      const shareHash=createHash("sha256").update(shared.token).digest("hex");
      assert.ok(shareRecords.has(shareHash));
      assert.equal(seen[0].path,"/rest/v1/rpc/designer_share_register");
      assert.equal(shareRecords.get(shareHash).key,
        createHash("sha256").update(Buffer.from(shared.revokeKey,"base64url")).digest("hex"));
      const publicUrl=enforcedOrigin+"/share/"+shared.token;
      const publicBefore=await fetch(publicUrl,{signal:AbortSignal.timeout(15000)});
      assert.equal(publicBefore.status,200,"public design link initially readable");
      assert.match(await publicBefore.text(),/SHARED LOCKED DESIGN/);
      async function cancelShare(revokeKey){
        return await fetch(enforcedOrigin+"/api/designer/share",{
          method:"POST",headers:fixtureHeaders(),
          body:JSON.stringify({action:"revoke",token:shared.token,revokeKey}),
          signal:AbortSignal.timeout(15000)});
      }
      const forged=await cancelShare("A".repeat(43));
      assert.notEqual(forged.status,200,"public URL holder cannot forge a cancellation key");
      assert.equal(shareRecords.get(shareHash).revoked,false);
      shareMode="revoke500";
      const backendDown=await cancelShare(shared.revokeKey);
      assert.equal(backendDown.status,503);
      assert.equal(shareRecords.get(shareHash).revoked,false);
      shareMode="ok";
      const cancelled=await cancelShare(shared.revokeKey);
      assert.equal(cancelled.status,200);
      assert.deepEqual(await cancelled.json(),{revoked:true});
      assert.equal(shareRecords.get(shareHash).revoked,true);
      const publicAfter=await fetch(publicUrl,{signal:AbortSignal.timeout(15000)});
      assert.equal(publicAfter.status,404,"revoked public share must never render");
      shareMode="lookup500";
      const unavailableView=await fetch(publicUrl,{signal:AbortSignal.timeout(15000)});
      assert.equal(unavailableView.status,404,"unavailable share control store must fail closed");
      shareMode="ok";

      // A signed-in creator may revoke an issued link from another device,
      // without the private cancellation key or a public bearer URL.
      async function signInForShare(email){
        const response=await fetch(enforcedOrigin+"/api/customer-auth/verify",{
          method:"POST",headers:fixtureHeaders(),
          body:JSON.stringify({email,token:"123456"}),signal:AbortSignal.timeout(15000)});
        assert.equal(response.status,200);
        const signed=response.headers.get("set-cookie")?.match(/le_customer_session=([^;]+)/)?.[1];
        assert.ok(signed);return signed;
      }
      const aliceCookie=await signInForShare("alice@example.com");
      const bobShareCookie=await signInForShare("bob@example.com");
      async function ownedAction(action,cookie,other={}){
        return await fetch(enforcedOrigin+"/api/designer/share",{
          method:"POST",headers:{...fixtureHeaders(),cookie:"le_customer_session="+cookie},
          body:JSON.stringify({action,...other}),signal:AbortSignal.timeout(15000)});
      }
      seen.length=0;
      const ownedCreation=await fetch(enforcedOrigin+"/api/designer/share",{
        method:"POST",headers:{...fixtureHeaders(),cookie:"le_customer_session="+aliceCookie},
        body:JSON.stringify(shareRevision),signal:AbortSignal.timeout(15000)});
      assert.equal(ownedCreation.status,200);
      const ownedIssued=await ownedCreation.json();
      const ownedHash=createHash("sha256").update(ownedIssued.token).digest("hex");
      assert.equal(shareRecords.get(ownedHash)?.owner,"123e4567-e89b-12d3-a456-426614174000");
      assert.ok(seen.some(item=>item.path==="/rest/v1/rpc/customer_session_is_revoked"));
      const anonymousList=await fetch(enforcedOrigin+"/api/designer/share",{
        method:"POST",headers:fixtureHeaders(),body:JSON.stringify({action:"listOwned"}),
        signal:AbortSignal.timeout(15000)});
      assert.equal(anonymousList.status,401,"anonymous visitors cannot enumerate share digests");
      seen.length=0;
      const bobList=await ownedAction("listOwned",bobShareCookie,{
        ownerUserId:"123e4567-e89b-12d3-a456-426614174000"});
      assert.equal(bobList.status,200);
      assert.deepEqual((await bobList.json()).shares,[],
        "forged owner fields must not cross account boundaries");
      const aliceList=await ownedAction("listOwned",aliceCookie);
      assert.equal(aliceList.status,200);
      const myShares=(await aliceList.json()).shares;
      assert.equal(myShares.length,1);
      assert.equal(myShares[0].tokenHash,ownedHash);
      assert.ok(!JSON.stringify(myShares).includes(ownedIssued.revokeKey),
        "owner listing must not disclose issuer cancellation capability");
      for(const fail of ["listMalformed","list500"]){
        shareMode=fail;
        const response=await ownedAction("listOwned",aliceCookie);
        assert.equal(response.status,503,"share listing must fail closed on bad backend");
      }
      shareMode="ok";
      const anonymousRevocation=await fetch(enforcedOrigin+"/api/designer/share",{
        method:"POST",headers:fixtureHeaders(),
        body:JSON.stringify({action:"revokeOwned",tokenHash:ownedHash}),
        signal:AbortSignal.timeout(15000)});
      assert.equal(anonymousRevocation.status,401);
      const deniedBob=await ownedAction("revokeOwned",bobShareCookie,{
        tokenHash:ownedHash,ownerUserId:"123e4567-e89b-12d3-a456-426614174000"});
      assert.equal(deniedBob.status,404,"Bob must not revoke Alice's share");
      assert.equal(shareRecords.get(ownedHash).revoked,false);
      shareMode="ownedRevoke500";
      const backendDenied=await ownedAction("revokeOwned",aliceCookie,{tokenHash:ownedHash});
      assert.equal(backendDenied.status,503);
      assert.equal(shareRecords.get(ownedHash).revoked,false);
      shareMode="ok";
      const ownerRevoked=await ownedAction("revokeOwned",aliceCookie,{tokenHash:ownedHash});
      assert.equal(ownerRevoked.status,200);
      assert.deepEqual(await ownerRevoked.json(),{revoked:true});
      const ownerReplayed=await fetch(enforcedOrigin+"/share/"+ownedIssued.token,{
        signal:AbortSignal.timeout(15000)});
      assert.equal(ownerReplayed.status,404,"owner-controlled revocation must deny old public URL");

      revocationMode="check500";seen.length=0;
      const failedVerify=await fetch(enforcedOrigin+"/api/customer-auth/verify",{
        method:"POST",headers:fixtureHeaders(),
        body:JSON.stringify({email:"bob@example.com",token:"123456"}),
        signal:AbortSignal.timeout(15000)});
      assert.equal(failedVerify.status,503);
      assert.ok(!failedVerify.headers.get("set-cookie"),
        "new customer cookie must not be issued without working revocation store");
      assert.deepEqual(seen.map(item=>item.path),
        ["/auth/v1/verify","/rest/v1/rpc/customer_session_is_revoked"]);
    }finally{
      if(enforcedChild.exitCode===null){
        enforcedChild.kill("SIGTERM");
        await once(enforcedChild,"exit");
      }
    }
    assert.ok(!enforcedOutput.includes(privateMarker),"revocation errors must redact upstream details");
    assert.ok(!output.includes(privateMarker),"sensitive upstream error/JSON must not enter server logs");
    console.log("TITAN designer vault boundary PASS: synthetic HTTP cases; zero real writes.");
  }finally{
    if(child.exitCode===null){child.kill("SIGTERM");await once(child,"exit");}
    await new Promise(resolve=>upstream.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
