// Actual HTTP negative checks; does not create audit rows or access private data.
const assert=require("node:assert/strict");
const base=(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000").replace(/\/$/,"");
async function check(label,body,headers,expected){
  const response=await fetch(base+"/api/designer/enquiry",{
    method:"POST",
    headers:{"content-type":"application/json",...headers},
    body,
  });
  const payload=await response.json();
  assert.equal(response.status,expected,label+": "+JSON.stringify(payload).slice(0,180));
  assert.equal(typeof payload.error,"string",label+" must return an error");
  assert.equal(Object.hasOwn(payload,"audited"),false,label+" cannot present a success audit");
  assert.match(response.headers.get("cache-control")||"",/no-store/,label);
}
async function main(){
  await check("cross-site origin",'{}',{origin:"https://cross-site.example"},403);
  await check("cross-site fetch metadata",'{}',{"sec-fetch-site":"cross-site"},403);
  await check("wrong content type",'{}',{"content-type":"text/plain"},415);
  await check("JSON array",'[]',{},400);
  await check("invalid UTF-8 JSON",'{this-is-not-json',{},400);
  await check("unconsented envelope",JSON.stringify({revision:{}}),{},400);
  await check("coerced recovery token",JSON.stringify({revision:{},consentToContact:true,recoveryToken:["fake"]}),{},400);
  await check("non-verifiable locked revision",JSON.stringify({revision:{version:"linen-earth-design-lock-v1"},consentToContact:true}),{},409);
  await check("oversized JSON body",JSON.stringify({revision:{huge:"x".repeat(120000)},consentToContact:true}),{},413);
  console.log("Designer enquiry same-origin/size/consent HTTP boundaries passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
