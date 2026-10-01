import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeStyleDirectorUserTest,
  normalizeStyleDirectorValidationSignoff,
  summarizeStyleDirectorValidation,
} from "@/lib/designer/style-director-validation";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Style Director validation backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).slice(0,300);
    throw new Error(`Style Director validation request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) {
    return NextResponse.json({configured:false,tests:[],signoffs:[],summary:summarizeStyleDirectorValidation([],[])});
  }
  try{
    const [tests,signoffs]=await Promise.all([
      rpc<any[]>("style_director_user_test_list",{p_limit:500}),
      rpc<any[]>("style_director_validation_signoff_list",{p_limit:100}),
    ]);
    return NextResponse.json({
      configured:true,
      tests,
      signoffs,
      summary:summarizeStyleDirectorValidation(tests,signoffs),
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/style-director-validation]",error);
    return NextResponse.json({error:"Style Director validation evidence could not be loaded."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");
    if(action==="record_test"){
      const draft=normalizeStyleDirectorUserTest(body);
      const attemptId=await rpc<string>("style_director_user_test_record",{
        p_case_id:draft.caseId,
        p_device_class:draft.deviceClass,
        p_directions_understandable:draft.directionsUnderstandable,
        p_directions_distinct:draft.directionsDistinct,
        p_stock_handoff_worked:draft.stockHandoffWorked,
        p_blocking_issue:draft.blockingIssue,
        p_note:draft.note,
      });
      return NextResponse.json({attemptId});
    }
    if(action==="signoff"){
      const signoff=normalizeStyleDirectorValidationSignoff(body);
      const eventId=await rpc<string>("style_director_validation_signoff_record_v2",{
        p_status:signoff.statusTyped,
        p_required_positive_cases:signoff.requiredPositiveCases,
        p_signed_by:signoff.signedBy,
        p_note:signoff.note,
      });
      return NextResponse.json({eventId});
    }
    return NextResponse.json({error:"Unsupported Style Director validation action."},{status:400});
  }catch(error){
    console.error("[operator/style-director-validation]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Style Director validation could not be saved."},{status:409});
  }
}
