// Live HTTP regression against a LOCAL built Next server, not a source-config mock.
// Signed token and design payload are synthetic CI fixtures: no owner consent,
// physical stock, Supabase writes, customer acceptance or production approval.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");

const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.ok(base.protocol==="http:" && ["127.0.0.1","localhost","[::1]"].includes(base.hostname),
  "Share security QA must never request a public or production host");
const secret=process.env.LINEN_DESIGN_SHARE_SECRET;
assert.ok(typeof secret==="string" && secret.length>=32,
  "Set a CI-only LINEN_DESIGN_SHARE_SECRET on the local Next server and this test");

function fixtureToken(){
  const payload={
    version:"linen-earth-share-v1",
    revisionId:"LE-LOCK-CI-SYNTHETIC-NOT-A-CUSTOMER",
    recipeHash:"a".repeat(64),
    expiresAt:Date.now()+5*60*1000,
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    // Deliberately not stock-backed. The page must use its honest fallback.
    fabrics:{
      shirt:{id:"ci-no-stock-shirt",name:"Unverified CI shirt",line:"CI only"},
      trouser:{id:"ci-no-stock-trouser",name:"Unverified CI trouser",line:"CI only"},
    },
    shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",
      cuff:"Barrel",placket:"Standard",button:"Corozo"},
    trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break"},
    creative:null,
  };
  const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig=createHmac("sha256",secret).update("v1."+body).digest("base64url");
  return "v1."+body+"."+sig;
}

async function get(path){
  return fetch(new URL(path,base),{
    redirect:"manual",headers:{accept:"text/html"},signal:AbortSignal.timeout(20000),
  });
}

function assertPrivateShareHeaders(response,label){
  const headers=response.headers;
  assert.equal(headers.get("referrer-policy"),"no-referrer",
    label+": full bearer URL must never appear in Referer");
  assert.match(headers.get("x-robots-tag")||"",/\bnoindex\b/i,label+": noindex");
  assert.match(headers.get("x-robots-tag")||"",/\bnofollow\b/i,label+": nofollow");
  assert.match(headers.get("cache-control")||"",/\bprivate\b/i,label+": private");
  assert.match(headers.get("cache-control")||"",/\bno-store\b/i,label+": no-store");
  assert.match(headers.get("content-type")||"",/text\/html/i,label+": HTML response");
}

async function main(){
  const good=await get("/share/"+fixtureToken());
  assert.equal(good.status,200,"Valid signed CI fixture must exercise the actual shared-design page");
  assertPrivateShareHeaders(good,"valid share");
  const html=await good.text();
  assert.match(html,/SHARED LOCKED DESIGN|Shared locked design/i,
    "Valid token must render the share page rather than an error fallback");
  assert.match(html,/Visual preview unavailable/i,
    "Unverified synthetic fabric must not be presented as physically stocked");

  const invalid=await get("/share/v1.invalid.invalid");
  assert.equal(invalid.status,404,"Invalid bearer credential must not reveal a shared design");
  assertPrivateShareHeaders(invalid,"invalid share");
  await invalid.arrayBuffer();

  const ordinary=await get("/");
  assert.equal(ordinary.status,200,"Control homepage must remain available");
  assert.equal(ordinary.headers.get("referrer-policy"),"strict-origin-when-cross-origin",
    "Share-only policy must not change ordinary page headers");
  await ordinary.arrayBuffer();
  console.log("Actual local Next HTTP share privacy PASS: signed 200, invalid 404, ordinary 200.");
  console.log("CI fixture is not real consent, live customer authentication or physical stock.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
