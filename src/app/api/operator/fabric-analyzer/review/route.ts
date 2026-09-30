import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  loadFabricAnalysesForFabricIds,
  loadFabricAnalyzerProfilesForReview,
  recordFabricAnalyzerCorrection,
  reviewFabricAnalyzerProfile,
  type BoundFabricAnalysis,
} from "@/lib/fabric-analyzer-store";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";

export const runtime="nodejs";
export const maxDuration=30;

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

function newestFirst(a:BoundFabricAnalysis,b:BoundFabricAnalysis) {
  return new Date(b.updated_at||b.created_at).getTime()-new Date(a.updated_at||a.created_at).getTime();
}

export async function GET(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  const url=new URL(request.url);
  const limit=Math.max(1,Math.min(200,Number(url.searchParams.get("limit"))||50));
  const scope=url.searchParams.get("scope")==="all" ? "all" : "pending";

  if(scope==="all") {
    const [pending,bound]=await Promise.all([
      loadFabricAnalyzerProfilesForReview(limit),
      loadFabricAnalysesForFabricIds(FABRIC_STOCK.map((fabric)=>fabric.id),{includeUnreviewed:true}),
    ]);
    const byId=new Map<string,BoundFabricAnalysis>();
    for(const profile of [...pending,...bound]) byId.set(profile.id,profile);
    const profiles=[...byId.values()].sort(newestFirst).slice(0,limit);
    return json({profiles,count:profiles.length,scope});
  }

  const profiles=await loadFabricAnalyzerProfilesForReview(limit);
  return json({profiles,count:profiles.length,scope});
}

export async function POST(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  if(!sameOrigin(request)) return json({error:"Cross-site Analyzer review is not allowed."},{status:403});

  try {
    const body=await request.json() as {
      profileId?:unknown;
      status?:unknown;
      notes?:unknown;
      corrections?:Array<{
        fieldPath?:unknown;
        previousValue?:unknown;
        correctedValue?:unknown;
        reason?:unknown;
      }>;
    };
    const profileId=clean(body.profileId,80);
    const requested=clean(body.status,30);
    if(!profileId || !["unreviewed","approved","corrected","rejected"].includes(requested)) {
      return json({error:"A valid profile and review status are required."},{status:400});
    }

    const corrections=Array.isArray(body.corrections)?body.corrections.slice(0,20):[];
    const correctionIds:string[]=[];
    for(const correction of corrections) {
      const fieldPath=clean(correction.fieldPath,180);
      if(!fieldPath) continue;
      const id=await recordFabricAnalyzerCorrection({
        profileId,
        fieldPath,
        previousValue:correction.previousValue,
        correctedValue:correction.correctedValue,
        reason:clean(correction.reason,600),
      });
      if(id) correctionIds.push(id);
    }

    const finalStatus=correctionIds.length && requested!=="rejected" ? "corrected" : requested as "unreviewed"|"approved"|"corrected"|"rejected";
    const reviewed=await reviewFabricAnalyzerProfile({
      profileId,
      status:finalStatus,
      notes:clean(body.notes,1200),
    });
    if(!reviewed) return json({error:"Analyzer profile could not be reviewed."},{status:404});

    return json({ok:true,profileId,status:finalStatus,correctionIds});
  } catch(error) {
    console.error("[operator/fabric-analyzer/review]",error);
    return json({error:error instanceof Error?error.message:"Analyzer review failed."},{status:400});
  }
}
