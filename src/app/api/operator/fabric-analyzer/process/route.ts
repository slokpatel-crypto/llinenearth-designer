import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import {
  analyzeMenswearFabricWithStore,
  analyzeMenswearReferencePage,
  type FabricAnalyzerContext,
} from "@/lib/fabric-analyzer";
import {
  claimFabricAnalyzerJobs,
  finishFabricAnalyzerJob,
  type ClaimedFabricAnalyzerJob,
} from "@/lib/fabric-analyzer-store";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

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
function clean(value:unknown,limit:number) {
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}
function physicalIndex(value:unknown) {
  return typeof value==="number" && Number.isFinite(value) ? value : undefined;
}

async function processJob(job:ClaimedFabricAnalyzerJob) {
  try {
    const declared=job.declared_context || {};
    let profileId:string|null=null;
    let reviewPriority:"low"|"normal"|"high"="normal";

    if(job.source_page_url && !job.image_url) {
      const result=await analyzeMenswearReferencePage(job.source_page_url,{persist:true,fabricId:job.fabric_id || undefined});
      profileId=result.run.profileId;
      reviewPriority=result.run.reviewPriority;
    } else if(job.image_url) {
      const input:FabricAnalyzerContext={
        fabricId:job.fabric_id || undefined,
        imageUrl:job.image_url,
        macroImageUrl:clean(declared.macroImageUrl,1800) || undefined,
        foldImageUrl:clean(declared.foldImageUrl,1800) || undefined,
        sourcePageUrl:job.source_page_url || undefined,
        sourceId:job.source_id || undefined,
        declaredMaterial:clean(declared.declaredMaterial,120) || undefined,
        declaredFabricType:clean(declared.declaredFabricType,120) || undefined,
        supplierColorName:clean(declared.supplierColorName,120) || undefined,
        supplierPatternName:clean(declared.supplierPatternName,120) || undefined,
        notes:clean(declared.notes,500) || undefined,
        swatchRealWidthMm:Number.isFinite(Number(declared.swatchRealWidthMm)) ? Number(declared.swatchRealWidthMm) : undefined,
        repeatRealMm:Number.isFinite(Number(declared.repeatRealMm)) ? Number(declared.repeatRealMm) : undefined,
        verifiedGsm:Number.isFinite(Number(declared.verifiedGsm)) ? Number(declared.verifiedGsm) : undefined,
        verifiedDrape:["Fluid","Balanced","Structured"].includes(String(declared.verifiedDrape)) ? declared.verifiedDrape as FabricAnalyzerContext["verifiedDrape"] : undefined,
        verifiedFiberContent:clean(declared.verifiedFiberContent,220) || undefined,
        verifiedStructure:physicalIndex(declared.verifiedStructure),
        verifiedBreathability:physicalIndex(declared.verifiedBreathability),
        verifiedWrinkleResistance:physicalIndex(declared.verifiedWrinkleResistance),
        verifiedStretch:physicalIndex(declared.verifiedStretch),
        verifiedPhysicalSourceUrl:clean(declared.verifiedPhysicalSourceUrl,1800) || undefined,
        verifiedPhysicalEvidenceNote:clean(declared.verifiedPhysicalEvidenceNote,500) || undefined,
      };
      const result=await analyzeMenswearFabricWithStore(input,{reuseReviewed:!job.force,persist:true});
      profileId=result.profileId;
      reviewPriority=result.reviewPriority;
    } else {
      throw new Error("Queued job has no analyzable image or source page.");
    }

    await finishFabricAnalyzerJob({jobId:job.id,status:"complete",profileId});
    return {id:job.id,batchId:job.batch_id,ok:true,profileId,reviewPriority};
  } catch(error) {
    const message=error instanceof Error?error.message:"Analysis failed.";
    await finishFabricAnalyzerJob({jobId:job.id,status:"error",error:message});
    return {id:job.id,batchId:job.batch_id,ok:false,error:message};
  }
}

export async function POST(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  if(!sameOrigin(request)) return json({error:"Cross-site Analyzer processing is not allowed."},{status:403});
  const body=await request.json().catch(()=>({})) as {limit?:unknown};
  const limit=Math.max(1,Math.min(6,Number(body.limit)||4));
  const jobs=await claimFabricAnalyzerJobs(limit);
  if(!jobs.length) return json({engine:"private-fabric-analyzer-worker-v1",claimed:0,results:[]});

  const results:Array<Awaited<ReturnType<typeof processJob>>>=new Array(jobs.length);
  let cursor=0;
  const worker=async()=>{
    while(true) {
      const index=cursor++;
      if(index>=jobs.length) return;
      results[index]=await processJob(jobs[index]);
    }
  };
  await Promise.all([worker(),worker()]);
  return json({
    engine:"private-fabric-analyzer-worker-v1",
    claimed:jobs.length,
    succeeded:results.filter((item)=>item.ok).length,
    failed:results.filter((item)=>!item.ok).length,
    results,
  });
}
