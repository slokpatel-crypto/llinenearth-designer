import Fashn from "fashn";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const OFFICIAL_FASHN_OUTPUT = /^https:\/\/(cdn|media)\.fashn\.ai\//i;
const FALLBACK = "/editorial/suit.webp";

const HERO_PROMPT = [
  "Photorealistic full-body luxury menswear editorial photograph.",
  "One handsome Indian male fashion model, around 30 years old, natural medium-brown skin, realistic pores and skin texture, short well-groomed black hair, subtle beard, confident calm expression.",
  "He wears a premium midnight navy softly tailored two-piece suit with an off-white textured linen shirt, open collar, no tie, dark brown leather loafers.",
  "Modern Indian luxury tailoring proportions, clean natural drape, believable fabric folds, precise seams, realistic hands and anatomy.",
  "Relaxed standing pose, body angled slightly three-quarter toward camera, one hand relaxed near trouser pocket, elegant but not theatrical.",
  "Deep navy seamless atelier studio background, soft directional key light from upper left, subtle rim light, refined shadows.",
  "High-end menswear campaign photography, understated European editorial composition with Indian identity, 85mm lens feel, shallow but controlled depth of field.",
  "No text, no logo, no props, no extra people, no cropped feet, no surreal styling."
].join(" ");

function fallback(request: Request, reason: string) {
  console.warn("[homepage-model] fallback", reason);
  return NextResponse.redirect(new URL(FALLBACK, request.url), 307);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const extraKeys = [...url.searchParams.keys()].filter((key) => key !== "_vercel_share");
  if (extraKeys.length) return NextResponse.json({ error: "Unsupported query." }, { status: 400 });

  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) return fallback(request, "FASHN_API_KEY missing", "not-configured");

  try {
    const client = new Fashn({ apiKey, timeout: 35_000, maxRetries: 2 });
    const result = await client.predictions.subscribe({
      model_name: "model-create",
      inputs: {
        prompt: HERO_PROMPT,
        aspect_ratio: "3:4",
        resolution: "2k",
        generation_mode: "balanced",
        num_images: 1,
        output_format: "jpeg",
        return_base64: false,
        seed: 1147,
      },
      pollInterval: 1_200,
      timeout: 58_000,
      maxRetries: 2,
    });

    const output = result.output?.[0];
    if (result.status !== "completed" || !output || !OFFICIAL_FASHN_OUTPUT.test(output)) {
      return fallback(request, result.error?.message || `status ${result.status}`, "generation-failed");
    }

    const image = await fetch(output, { cache: "no-store" });
    if (!image.ok) return fallback(request, `image fetch HTTP ${image.status}`, "output-fetch-failed");
    const type = image.headers.get("content-type") || "";
    if (!type.toLowerCase().startsWith("image/")) return fallback(request, "non-image output", "invalid-output");

    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > 16 * 1024 * 1024) return fallback(request, "output too large", "output-too-large");

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "Vercel-CDN-Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
        "X-LLinen-Render": "fashn-model-create",
      },
    });
  } catch (error) {
    return fallback(request, error instanceof Error ? error.message : "unknown generation error", "exception");
  }
}
