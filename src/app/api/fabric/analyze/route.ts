import { NextResponse } from "next/server";
import { analyzeFabricDevelopment, type FabricVisualSignals } from "@/lib/fabric-analysis";
import { analyzeFabricWithClaude, AiFabricAnalysisError } from "@/lib/ai-fabric-analysis";

const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validSignalObject(value: unknown): value is FabricVisualSignals {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const numeric = ["meanLightness","saturation","contrast","texture","edgeDensity","horizontalStructure","verticalStructure","colorVariation"];
  return typeof v.dominantHex === "string" && numeric.every((key) => typeof v[key] === "number" && Number.isFinite(v[key]));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, contentType, size, visualSignals, imageBase64, aiConsent } = body ?? {};

    if (!fileName || !contentType || typeof size !== "number") {
      return NextResponse.json({ error: "Missing file metadata." }, { status: 400 });
    }
    if (!String(contentType).startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image file." }, { status: 415 });
    }
    if (size > MAX_UPLOAD) {
      return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 413 });
    }

    // Real AI vision path: only runs when the server has a key configured AND
    // the browser explicitly sent the actual image bytes with consent. Consent
    // matters because the current UI promises "Photo stays in your browser" —
    // that promise only holds for the heuristic path below, so the client must
    // opt in per-upload before we send a photo off-device.
    const canUseAi =
      Boolean(process.env.ANTHROPIC_API_KEY) &&
      aiConsent === true &&
      typeof imageBase64 === "string" &&
      imageBase64.length > 0 &&
      ALLOWED_IMAGE_TYPES.has(contentType);

    if (canUseAi) {
      try {
        const profile = await analyzeFabricWithClaude({
          fileName,
          mediaType: contentType as "image/jpeg" | "image/png" | "image/webp",
          imageBase64,
        });
        return NextResponse.json({ profile, mode: "claude_vision_v1" });
      } catch (err) {
        // Fail open to the heuristic rather than failing the whole request —
        // a slightly-less-accurate answer beats a broken upload flow.
        const reason = err instanceof AiFabricAnalysisError ? err.message : "Unknown AI analysis error.";
        console.error("[fabric/analyze] Claude vision failed, falling back:", reason);
      }
    }

    const profile = analyzeFabricDevelopment({ fileName, contentType, size, visualSignals: validSignalObject(visualSignals) ? visualSignals : undefined });
    return NextResponse.json({ profile, mode: "development_visual_classifier_v3" });
  } catch {
    return NextResponse.json({ error: "Unable to analyze this fabric right now." }, { status: 500 });
  }
}
