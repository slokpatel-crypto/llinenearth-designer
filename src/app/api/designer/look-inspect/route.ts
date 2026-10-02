import { NextResponse } from "next/server";
import {
  inspectSelectedLookFashnOutput,
  type SelectedLookView,
} from "@/lib/ai-visualization";
import { enrichSelectedLookEvidence, resolveSelectedLookRequest } from "@/lib/designer/selected-look-server";
import { attachRenderQa } from "@/lib/designer/render-outcomes";

export const runtime="nodejs";
export const maxDuration=30;

export async function POST(request:Request) {
  try {
    const body=await request.json() as Record<string,unknown>;
    const image=typeof body.image==="string" ? body.image : "";
    if(!image) return NextResponse.json({error:"A generated render is required."},{status:400});

    const resolved=await resolveSelectedLookRequest(body.look);
    if(!resolved || resolved.locked!==true) {
      return NextResponse.json({error:"A locked selected look is required."},{status:400});
    }
    const look=await enrichSelectedLookEvidence(resolved);
    const view:SelectedLookView=["front","three-quarter","side","back"].includes(String(body.view))
      ? body.view as SelectedLookView
      : "front";
    const check=await inspectSelectedLookFashnOutput(image,look,view);
    const jobId=typeof body.jobId==="string"?body.jobId:"";
    if(jobId && (check.status==="pass"||check.status==="review")) {
      await attachRenderQa({jobId,view,status:check.status,payload:check});
    }
    return NextResponse.json({check},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/look-inspect]",error);
    return NextResponse.json({error:"Photoreal QA could not inspect this render."},{status:500});
  }
}
