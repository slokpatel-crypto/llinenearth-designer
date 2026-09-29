import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import {
  enqueueFabricAnalyzerBatch,
  loadFabricAnalyzerBatchStatus,
  type FabricAnalyzerBatchItem,
} from "@/lib/fabric-analyzer-store";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function json(body:unknown,init?:ResponseInit) {
  const response=NextResponse.json(body,init);
  response.headers.set("cache-control","private, no-store, max-age=0");
  response.headers.set("x-content-type-options","nosniff");
  return response;
}
async function authorized() {
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}
function sameOrigin(request:Request) {
  const origin=request.headers.get("origin");
  if(!origin) return true;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}

export async function GET(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  const batchId=new URL(request.url).searchParams.get("batchId")?.trim() || "";
  if(!/^[0-9a-f-]{36}$/i.test(batchId)) return json({error:"A valid batchId is required."},{status:400});
  const rows=await loadFabricAnalyzerBatchStatus(batchId);
  const counts=Object.fromEntries(rows.map((row)=>[row.status,Number(row.count)||0]));
  const total=Object.values(counts).reduce((sum,value)=>sum+Number(value||0),0);
  return json({batchId,total,counts,done:(counts.complete||0)+(counts.error||0)});
}

export async function POST(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  if(!sameOrigin(request)) return json({error:"Cross-site Analyzer queue requests are not allowed."},{status:403});
  const length=Number(request.headers.get("content-length")||0);
  if(length>1_500_000) return json({error:"Queue request is too large."},{status:413});

  try {
    const body=await request.json() as {items?:FabricAnalyzerBatchItem[]};
    const items=Array.isArray(body.items)?body.items.slice(0,500):[];
    if(!items.length) return json({error:"Provide 1 to 500 backend analysis items."},{status:400});
    const batch=await enqueueFabricAnalyzerBatch(items);
    if(!batch || batch.queued<1) return json({error:"No valid fabric items were queued."},{status:400});
    return json({engine:"private-fabric-analyzer-queue-v1",batchId:batch.batch_id,queued:batch.queued});
  } catch(error) {
    console.error("[operator/fabric-analyzer/queue]",error);
    return json({error:error instanceof Error?error.message:"Analyzer batch could not be queued."},{status:400});
  }
}
