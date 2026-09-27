import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Row = {session_id:string;type:string;at:string;payload?:Record<string,unknown>};

function text(value:unknown,max=180){return String(value??"").trim().slice(0,max);}
function object(value:unknown){return value && typeof value==="object" ? value as Record<string,unknown> : {};}

export async function GET(request:Request){
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid)return NextResponse.json({error:"Unauthorized."},{status:401});

  const cloud=getSupabaseAdminConfig();
  if(!cloud)return NextResponse.json({configured:false,summary:{recommendations:0,feedbackUp:0,feedbackDown:0,approvals:0,wrong:0,safeFallbacks:0},modes:[],rules:[],pairings:[],versions:[]});

  const incoming=new URL(request.url);
  const days=Math.min(365,Math.max(7,Number(incoming.searchParams.get("days")||180)));
  const since=new Date(Date.now()-days*86_400_000).toISOString();

  const params=new URLSearchParams({
    select:"session_id,type,at,payload",
    at:`gte.${since}`,
    order:"at.asc",
    limit:"10000",
  });

  try{
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok){
      console.error("[designer/insights]",response.status,(await response.text()).slice(0,240));
      return NextResponse.json({error:"Designer evidence could not be read."},{status:502});
    }

    const rows=await response.json() as Row[];
    const generated=new Map<string,{mode:string;pairingId:string;label:string;rulesVersion:string}>();
    const modeStats=new Map<string,{recommended:number;up:number;down:number;approve:number;wrong:number;safeFallback:number}>();
    const ruleWarnings=new Map<string,number>();
    const pairingStats=new Map<string,{pairingId:string;label:string;mode:string;up:number;down:number;approve:number;wrong:number;safeFallback:number}>();
    const versionStats=new Map<string,number>();

    let recommendations=0,feedbackUp=0,feedbackDown=0,approvals=0,wrong=0,safeFallbacks=0;

    function mode(mode:string){
      const key=mode||"Primary";
      const current=modeStats.get(key)||{recommended:0,up:0,down:0,approve:0,wrong:0,safeFallback:0};
      modeStats.set(key,current);
      return current;
    }
    function pairing(pairingId:string,label:string,modeName:string){
      const current=pairingStats.get(pairingId)||{pairingId,label,mode:modeName||"Primary",up:0,down:0,approve:0,wrong:0,safeFallback:0};
      if(label)current.label=label;
      if(modeName)current.mode=modeName;
      pairingStats.set(pairingId,current);
      return current;
    }

    for(const row of rows){
      const payload=object(row.payload);

      if(row.type==="looks_generated" && text(payload.experience,80)==="designer-phase1-shirt-pant"){
        const output=object(payload.output);
        const pairingId=text(output.pairingId,220);
        const modeName=text(output.mode,40)||"Primary";
        const label=`${text(output.shirtName,100)} + ${text(output.trouserName,100)}`.replace(/^ \+ $/,"");
        const rulesVersion=text(payload.rulesVersion,80);
        if(pairingId){
          recommendations+=1;
          mode(modeName).recommended+=1;
          pairing(pairingId,label,modeName);
          generated.set(`${row.session_id}|${pairingId}`,{mode:modeName,pairingId,label,rulesVersion});
        }
        if(rulesVersion)versionStats.set(rulesVersion,(versionStats.get(rulesVersion)||0)+1);
        const rules=Array.isArray(payload.rules)?payload.rules:[];
        for(const raw of rules){
          const rule=object(raw);
          if(text(rule.status,20)==="warn"){
            const id=text(rule.id,20);
            if(id)ruleWarnings.set(id,(ruleWarnings.get(id)||0)+1);
          }
        }
      }

      if(row.type==="look_selected"){
        const pairingId=text(payload.lookId,220);
        const feedback=text(payload.feedback,12);
        if(!pairingId||!["up","down"].includes(feedback))continue;
        const linked=generated.get(`${row.session_id}|${pairingId}`);
        const modeName=linked?.mode||"Primary";
        const pair=pairing(pairingId,linked?.label||pairingId,modeName);
        if(feedback==="up"){feedbackUp+=1;mode(modeName).up+=1;pair.up+=1;}
        else{feedbackDown+=1;mode(modeName).down+=1;pair.down+=1;}
      }

      if(row.type==="operator_note" && text(payload.subtype,80)==="designer_pairing_review"){
        const pairingId=text(payload.pairingId,220);
        const decision=text(payload.decision,40);
        const modeName=text(payload.mode,40)||"Primary";
        const label=`${text(payload.shirtName,100)} + ${text(payload.trouserName,100)}`.replace(/^ \+ $/,"")||pairingId;
        if(!pairingId)continue;
        const pair=pairing(pairingId,label,modeName);
        if(decision==="approve"){approvals+=1;mode(modeName).approve+=1;pair.approve+=1;}
        if(decision==="wrong"){wrong+=1;mode(modeName).wrong+=1;pair.wrong+=1;}
        if(decision==="safe_fallback"){safeFallbacks+=1;mode(modeName).safeFallback+=1;pair.safeFallback+=1;}
      }
    }

    const modes=[...modeStats.entries()].map(([name,value])=>({name,...value})).sort((a,b)=>b.recommended-a.recommended);
    const rules=[...ruleWarnings.entries()].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count);
    const pairings=[...pairingStats.values()].map((item)=>({
      ...item,
      negative:item.down+item.wrong,
      positive:item.up+item.approve+item.safeFallback,
    })).sort((a,b)=>b.negative-a.negative||b.positive-a.positive).slice(0,40);
    const versions=[...versionStats.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);

    return NextResponse.json({
      configured:true,
      days,
      generatedAt:new Date().toISOString(),
      summary:{recommendations,feedbackUp,feedbackDown,approvals,wrong,safeFallbacks},
      modes,rules,pairings,versions,
    });
  }catch(error){
    console.error("[designer/insights]",error);
    return NextResponse.json({error:"Designer evidence is temporarily unavailable."},{status:500});
  }
}
