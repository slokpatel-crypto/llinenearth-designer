import {
  fabricFamilies,
  confidenceLabelFromScore,
  type FabricProfile,
  type FabricCandidate,
} from "@/lib/fabric-analysis";

// ---------------------------------------------------------------------------
// Real fabric analysis via Claude vision.
//
// This is a drop-in replacement for analyzeFabricDevelopment() in
// fabric-analysis.ts: same FabricProfile return shape, so nothing downstream
// (FabricStudio, designer-engine, refinement-engine, visualization-engine)
// needs to change. The API route decides which one to call based on whether
// ANTHROPIC_API_KEY is configured and an image was actually sent.
//
// Cost note: this uses Haiku, not Sonnet/Opus — fabric classification is a
// cheap, high-volume task and Haiku's vision quality is plenty for "what
// fibre family / weave / tone is this", which is what we're asking for.
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";

export type AiFabricAnalysisInput = {
  fileName: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  imageBase64: string; // no data: prefix
};

// The shape we ask Claude to return. Kept intentionally small and flat so the
// model reliably produces valid JSON on the first try.
type ClaudeFabricJson = {
  family: string;
  family_confidence: number; // 0-1
  alternative_families: { family: string; confidence: number }[];
  dominant_color_name: string;
  dominant_hex: string;
  pattern: string;
  surface: string;
  drape: string;
  estimated_weight_gsm: number | null;
  summary: string;
  cautions: string[];
};

const SYSTEM_PROMPT = `You are a textile analyst for LLinen Earth, an Indian menswear fabric retailer. \
You will be shown a photo of a fabric swatch or roll. Identify it as precisely as a photo alone allows.

Only ever choose "family" and entries inside "alternative_families" from this exact list (use the \
label exactly as written, including punctuation): ${fabricFamilies.join(", ")}.

Respond with ONLY a single JSON object, no markdown fences, no prose before or after, matching exactly \
this shape:
{
  "family": string,
  "family_confidence": number between 0 and 1,
  "alternative_families": [{ "family": string, "confidence": number between 0 and 1 }, ... up to 3],
  "dominant_color_name": short human color name e.g. "Slate blue",
  "dominant_hex": "#rrggbb" best estimate of the dominant color,
  "pattern": short phrase e.g. "Solid with subtle slub texture",
  "surface": short phrase e.g. "Dry, visibly textured surface",
  "drape": short phrase e.g. "Likely soft, moderate structure",
  "estimated_weight_gsm": integer estimate or null if genuinely not inferable from a photo,
  "summary": one or two plain sentences a customer would understand,
  "cautions": array of 1-2 short strings noting this is a visual estimate only, not a lab measurement
}

Be honest about uncertainty in the confidence numbers rather than defaulting to high confidence.`;

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function toCandidates(json: ClaudeFabricJson): FabricCandidate[] {
  const main: FabricCandidate = {
    family: json.family,
    confidence: json.family_confidence,
    evidence: [],
  };
  const alts = (json.alternative_families || []).map((a) => ({
    family: a.family,
    confidence: a.confidence,
    evidence: [] as string[],
  }));
  return [main, ...alts].slice(0, 4);
}

export class AiFabricAnalysisError extends Error {}

export async function analyzeFabricWithClaude(input: AiFabricAnalysisInput): Promise<FabricProfile> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiFabricAnalysisError("ANTHROPIC_API_KEY is not configured.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 },
            },
            {
              type: "text",
              text: `Analyze this fabric photo. Original filename (may or may not be informative): ${input.fileName}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiFabricAnalysisError(`Claude API error ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
  if (!textBlock?.text) throw new AiFabricAnalysisError("Claude returned no text content.");

  let parsed: ClaudeFabricJson;
  try {
    parsed = JSON.parse(extractJson(textBlock.text));
  } catch {
    throw new AiFabricAnalysisError("Could not parse Claude's response as JSON.");
  }

  if (!parsed.family || typeof parsed.family_confidence !== "number") {
    throw new AiFabricAnalysisError("Claude's response was missing required fields.");
  }

  const alternatives = toCandidates(parsed);

  return {
    id: `FAB-${Date.now()}`,
    source: "claude_vision_v1",
    summary: parsed.summary,
    observations: [
      {
        label: "Likely material family",
        value: parsed.family,
        confidence: parsed.family_confidence,
        confidenceLabel: confidenceLabelFromScore(parsed.family_confidence),
        basis: "ai_vision_estimate",
      },
      {
        label: "Dominant color",
        value: parsed.dominant_color_name,
        confidence: 0.85,
        confidenceLabel: confidenceLabelFromScore(0.85),
        basis: "ai_vision_estimate",
      },
      {
        label: "Pattern structure",
        value: parsed.pattern,
        confidence: 0.75,
        confidenceLabel: confidenceLabelFromScore(0.75),
        basis: "ai_vision_estimate",
      },
      {
        label: "Surface / weave",
        value: parsed.surface,
        confidence: 0.72,
        confidenceLabel: confidenceLabelFromScore(0.72),
        basis: "ai_vision_estimate",
      },
      {
        label: "Drape proxy",
        value: parsed.drape,
        confidence: 0.55,
        confidenceLabel: confidenceLabelFromScore(0.55),
        basis: "ai_vision_estimate",
      },
      {
        label: "Estimated weight",
        value: parsed.estimated_weight_gsm ? `${parsed.estimated_weight_gsm} gsm (est.)` : "Not estimable from photo",
        confidence: parsed.estimated_weight_gsm ? 0.45 : 0.2,
        confidenceLabel: confidenceLabelFromScore(parsed.estimated_weight_gsm ? 0.45 : 0.2),
        basis: "ai_vision_estimate",
      },
    ],
    palette: [parsed.dominant_hex],
    alternatives,
    cautions: parsed.cautions?.length
      ? parsed.cautions
      : [
          "This is a Claude vision estimate from a single photo, not a lab test.",
          "Exact fibre percentages, GSM and finish should be confirmed in person at the shop.",
        ],
  };
}
