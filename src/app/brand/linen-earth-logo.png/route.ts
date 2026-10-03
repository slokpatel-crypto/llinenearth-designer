import { BRAND_LOGO_SRC } from "@/lib/brand-logo-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Preserve the old public URL while every current surface uses the same
  // versioned, decodable asset. The alias can change with later brand updates.
  return new Response(null,{
    status: 307,
    headers:{
      "location":new URL(BRAND_LOGO_SRC,request.url).href,
      "cache-control":"public, max-age=3600",
    },
  });
}
