import { NextResponse } from "next/server";
import { analyzeFabricDevelopment, type FabricVisualSignals } from "@/lib/fabric-analysis";

const MAX_UPLOAD = 10 * 1024 * 1024;

function validSignalObject(value: unknown): value is FabricVisualSignals {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const numeric = ["meanLightness","saturation","contrast","texture","edgeDensity","horizontalStructure","verticalStructure","colorVariation"];
  return typeof v.dominantHex === "string" && numeric.every((key) => typeof v[key] === "number" && Number.isFinite(v[key]));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, contentType, size, visualSignals } = body ?? {};

    if (!fileName || !contentType || typeof size !== "number") {
      return NextResponse.json({ error: "Missing file metadata." }, { status: 400 });
    }
    if (!String(contentType).startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image file." }, { status: 415 });
    }
    if (size > MAX_UPLOAD) {
      return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 413 });
    }

    const profile = analyzeFabricDevelopment({ fileName, contentType, size, visualSignals: validSignalObject(visualSignals) ? visualSignals : undefined });
    return NextResponse.json({ profile, mode: "development_visual_classifier_v3" });
  } catch {
    return NextResponse.json({ error: "Unable to analyze this fabric right now." }, { status: 500 });
  }
}
