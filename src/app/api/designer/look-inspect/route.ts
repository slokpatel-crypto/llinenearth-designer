import { NextResponse } from "next/server";
import {
  inspectSelectedLookFashnOutput,
  type SelectedLookFashnRequest,
} from "@/lib/ai-visualization";

export const runtime="nodejs";
export const maxDuration=30;

function valid(body:unknown):body is {image:string;look:SelectedLookFashnRequest} {
  if(!body || typeof body!=="object") return false;
  const value=body as {image?:unknown;look?:Partial<SelectedLookFashnRequest>};
  return Boolean(
    typeof value.image==="string" &&
    value.look?.shirt?.id && value.look?.shirt?.image &&
    value.look?.pant?.id && value.look?.pant?.image &&
    value.look?.style?.collar && value.look?.style?.cuff
  );
}

export async function POST(request:Request) {
  try {
    const body=await request.json() as unknown;
    if(!valid(body)) return NextResponse.json({error:"A generated render and selected look are required."},{status:400});
    const check=await inspectSelectedLookFashnOutput(body.image,body.look);
    return NextResponse.json({check},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/look-inspect]",error);
    return NextResponse.json({error:"Photoreal QA could not inspect this render."},{status:500});
  }
}
