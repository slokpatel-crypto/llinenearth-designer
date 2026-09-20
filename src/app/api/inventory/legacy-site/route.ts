import { NextResponse } from "next/server";
import { scanLegacySite } from "@/lib/legacy-site-inventory";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json(await scanLegacySite());
}
