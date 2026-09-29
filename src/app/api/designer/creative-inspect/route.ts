import { NextResponse } from "next/server";
import {
  FashnVisualizationError,
  inspectCreativeFashnOutput,
  type CreativeFashnRequest,
} from "@/lib/ai-visualization";

export const runtime="nodejs";
export const maxDuration=30;

const inspectRegistry=(globalThis as typeof globalThis & {__linenCreativeInspectRate?:Map<string,{at:number;count:number}>}).__linenCreativeInspectRate ||= new Map<string,{at:number;count:number}>();

function inspectRateLimited(request:Request) {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now=Date.now();
  const current=inspectRegistry.get(ip);
  if(!current || now-current.at>60_000) {
    inspectRegistry.set(ip,{at:now,count:1});
    return false;
  }
  current.count+=1;
  return current.count>12;
}

type InspectBody = CreativeFashnRequest & { image:string; previousImage?:string };

function valid(body:unknown):body is InspectBody {
  if(!body || typeof body!=="object") return false;
  const value=body as Partial<InspectBody>;
  return Boolean(
    typeof value.image==="string" &&
    value.image.length<1000 &&
    (value.previousImage===undefined || (typeof value.previousImage==="string" && value.previousImage.length<1000)) &&
    value.shirt?.id && value.shirt?.image &&
    value.pant?.id && value.pant?.image &&
    value.style?.collar && value.style?.cuff &&
    value.creative?.id && value.creative?.name &&
    Array.isArray(value.creative?.treatments) &&
    value.creative.treatments.length>0 &&
    value.creative.treatments.length<=8
  );
}

export async function POST(request:Request) {
  try {
    if(inspectRateLimited(request)) return NextResponse.json({error:"Creative render inspection is temporarily rate limited."},{status:429});
    const body=await request.json() as unknown;
    if(!valid(body)) return NextResponse.json({error:"A generated render and its V5 concept specification are required."},{status:400});
    const check=await inspectCreativeFashnOutput(body.image,body,body.previousImage);
    return NextResponse.json({check});
  } catch(error) {
    if(error instanceof FashnVisualizationError) {
      const status=error.code==="invalid_source"?400:502;
      return NextResponse.json({error:error.message},{status});
    }
    console.error("[designer/creative-inspect]",error);
    return NextResponse.json({error:"Creative render inspection could not be completed."},{status:500});
  }
}
