import { BRAND_LOGO_SRC } from "@/lib/brand-logo-data";

export const runtime = "nodejs";

export async function GET() {
  const base64 = BRAND_LOGO_SRC.split(",")[1] || "";
  const bytes = Buffer.from(base64,"base64");
  return new Response(bytes,{
    headers:{
      "content-type":"image/png",
      "cache-control":"public, max-age=31536000, immutable",
    },
  });
}
