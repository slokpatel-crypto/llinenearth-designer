"use strict";

// Synthetic inventory for isolated GitHub Actions browser tests ONLY.
// NEVER imported by the application, deployed, or treated as real physical stock.
// The public/customer path must continue to fail closed on missing real ledger rows.
const http=require("node:http");
const FIXTURE_KEY="sb_secret_titan_ci_fixture_only";
const FIXTURE_PORT=54324;
const STOCK_PATH="/rest/v1/rpc/fabric_stock_snapshot_v2";
const METADATA_PATH="/rest/v1/style_events";

function rowsFor(payload){
  const ids=payload?.p_fabric_ids;
  if(!Array.isArray(ids)||ids.length>500||ids.some(id=>typeof id!=="string"||id.length<1||id.length>160||id!==id.trim())) return null;
  if(new Set(ids).size!==ids.length) return null;
  // Deliberately synthesized only inside the GitHub Actions mock server.
  return ids.map(fabric_id=>({fabric_id,available_metres:"5.000",provenance_ready:true,
    manual_event_count:1,provenance_event_count:1,legacy_unverified_event_count:0}));
}
// A reachable, genuinely empty metadata ledger is different from a 404 or
// timeout. Only isolated CI browser QA may use this deliberately synthetic
// empty ledger: it is NEVER an operator sold-out review or supplier receipt.
function metadataRowsFor(method,path,apiKey) {
  if(method!=="GET"||typeof path!=="string"||apiKey!==FIXTURE_KEY) return null;
  const url=new URL(path,"http://127.0.0.1");
  if(url.pathname!==METADATA_PATH) return null;
  if(url.searchParams.get("type")!=="eq.operator_note"||
     url.searchParams.get("source")!=="eq.operator") return null;
  return [];
}
function send(res,status,payload){
  res.writeHead(status,{"content-type":"application/json","cache-control":"private, no-store"});
  res.end(JSON.stringify(payload));
}
async function handle(req,res){
  if(req.method==="GET"&&req.url==="/__fixture/health") return send(res,200,{ciFixture:true,physicalEvidence:false});
  if(req.method==="GET"&&req.url?.startsWith(METADATA_PATH+"?")){
    const rows=metadataRowsFor(req.method,req.url,req.headers.apikey);
    return rows===null?send(res,403,{error:"Not a CI metadata fixture request"}):send(res,200,rows);
  }
  if(req.method!=="POST"||req.url!==STOCK_PATH) return send(res,404,{error:"Unknown CI mock route"});
  if(req.headers.apikey!==FIXTURE_KEY) return send(res,403,{error:"Not a CI fixture request"});
  let raw="";
  try{
    for await (const chunk of req){
      raw+=chunk.toString("utf8");
      if(Buffer.byteLength(raw)>8192) return send(res,413,{error:"CI fixture request too large"});
    }
    const rows=rowsFor(JSON.parse(raw));
    if(!rows) return send(res,400,{error:"Invalid CI fixture fabric IDs"});
    return send(res,200,rows);
  }catch{return send(res,400,{error:"Invalid CI fixture request"});}
}
if(require.main===module){
  if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
    console.error("Refusing synthetic stock fixture outside GitHub Actions CI");
    process.exit(2);
  }
  http.createServer((req,res)=>{void handle(req,res);}).listen(FIXTURE_PORT,"127.0.0.1",()=>{
    console.log("Synthetic CI-only stock fixture listening on loopback; NOT physical evidence");
  });
}
module.exports={rowsFor,metadataRowsFor,handle,FIXTURE_KEY,STOCK_PATH,METADATA_PATH};
