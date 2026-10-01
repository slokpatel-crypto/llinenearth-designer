import { NextResponse } from "next/server";
import { createDesignShareToken, designShareConfigured } from "@/lib/designer/design-share";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";

export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const revision=await request.json() as LockedDesignRevision;
    if(!revision || revision.version!=="linen-earth-design-lock-v1") {
      return NextResponse.json({error:"A locked Linen Earth design revision is required."},{status:400});
    }
    if(!await verifyLockedDesignRevision(revision)) {
      return NextResponse.json({error:"The locked design revision did not pass integrity verification."},{status:409});
    }
    if(!designShareConfigured()) {
      return NextResponse.json({error:"Design sharing is not configured on this deployment."},{status:503});
    }
    const token=createDesignShareToken(revision);
    if(!token) return NextResponse.json({error:"Could not create a share token."},{status:500});
    return NextResponse.json({token,expiresInDays:30});
  }catch{
    return NextResponse.json({error:"Could not create a share link for this design."},{status:400});
  }
}
