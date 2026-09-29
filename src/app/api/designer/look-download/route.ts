import { NextResponse } from "next/server";

export const runtime="nodejs";
export const maxDuration=20;

const OFFICIAL_FASHN_OUTPUT=/^https:\/\/(cdn|media)\.fashn\.ai\//i;

function safeName(value:string) {
  return value.replace(/[^a-z0-9._-]+/gi,"-").replace(/-+/g,"-").slice(0,100) || "linen-earth-look";
}

export async function GET(request:Request) {
  try {
    const url=new URL(request.url);
    const source=url.searchParams.get("url") || "";
    const name=safeName(url.searchParams.get("name") || "linen-earth-look");
    if(!OFFICIAL_FASHN_OUTPUT.test(source)) return NextResponse.json({error:"Only trusted Linen Earth render URLs can be saved."},{status:400});
    const response=await fetch(source,{cache:"no-store",signal:AbortSignal.timeout(15_000)});
    if(!response.ok) return NextResponse.json({error:"Render file is unavailable."},{status:502});
    const contentType=response.headers.get("content-type") || "";
    if(!/^image\//i.test(contentType)) return NextResponse.json({error:"Render response is not an image."},{status:502});
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength>12_000_000) return NextResponse.json({error:"Render file is too large."},{status:413});
    const extension=/png/i.test(contentType)?"png":/webp/i.test(contentType)?"webp":"jpg";
    return new NextResponse(bytes,{
      status:200,
      headers:{
        "content-type":contentType,
        "content-disposition":`attachment; filename="${name}.${extension}"`,
        "cache-control":"private, no-store",
      },
    });
  } catch {
    return NextResponse.json({error:"Render could not be saved."},{status:502});
  }
}
