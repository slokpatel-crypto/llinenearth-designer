import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MODEL_VIEWER_URL="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js";

export async function GET(){
  try{
    const upstream=await fetch(MODEL_VIEWER_URL,{
      cache:"force-cache",
      next:{revalidate:60*60*24*30},
      signal:AbortSignal.timeout(12_000),
    });
    if(!upstream.ok) throw new Error(`model-viewer upstream returned ${upstream.status}`);
    const body=await upstream.text();
    return new NextResponse(body,{
      status:200,
      headers:{
        "content-type":"text/javascript; charset=utf-8",
        "cache-control":"public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
        "x-content-type-options":"nosniff",
      },
    });
  }catch(error){
    return new NextResponse(
      `console.error("Linen Earth 3D engine unavailable:", ${JSON.stringify(error instanceof Error?error.message:"unknown error")});`,
      {
        status:503,
        headers:{
          "content-type":"text/javascript; charset=utf-8",
          "cache-control":"no-store",
          "x-content-type-options":"nosniff",
        },
      },
    );
  }
}
