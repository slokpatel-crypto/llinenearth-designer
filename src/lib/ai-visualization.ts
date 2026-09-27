import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import Fashn from "fashn";
import sharp from "sharp";
import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import {
  repairDevelopmentRender,
  renderDevelopmentSet,
  type RenderSet,
  type RenderView,
  type VisualizationSpec,
} from "@/lib/visualization-engine";

const OFFICIAL_FASHN_OUTPUT = /^https:\/\/(cdn|media)\.fashn\.ai\//i;

export class FashnVisualizationError extends Error {
  constructor(message: string, readonly code: "not_configured" | "invalid_source" | "rate_limited" | "generation_failed" = "generation_failed") {
    super(message);
  }
}

type RateRegistry = { lastByIp: Map<string, number> };
const rateRegistry = (globalThis as typeof globalThis & { __llinenFashnRate?: RateRegistry }).__llinenFashnRate
  ||= { lastByIp: new Map<string, number>() };

export function assertFashnRateLimit(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const last = rateRegistry.lastByIp.get(ip) || 0;
  if (now - last < 45_000) throw new FashnVisualizationError("Please wait a moment before starting another photorealistic render.", "rate_limited");
  rateRegistry.lastByIp.set(ip, now);
  for (const [key, timestamp] of rateRegistry.lastByIp) if (now - timestamp > 10 * 60_000) rateRegistry.lastByIp.delete(key);
}

function fashnClient() {
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) throw new FashnVisualizationError("FASHN_API_KEY is not configured for this deployment.", "not_configured");
  return new Fashn({ apiKey, timeout: 30_000, maxRetries: 2 });
}

function svgMarkupFromDataUri(src: string) {
  const prefix = "data:image/svg+xml;charset=utf-8,";
  if (!src.startsWith(prefix) || src.length > 250_000) throw new FashnVisualizationError("The locked mannequin reference is unavailable.", "invalid_source");
  const svg = decodeURIComponent(src.slice(prefix.length));
  if (!svg.trimStart().startsWith("<svg")) throw new FashnVisualizationError("The locked mannequin reference is invalid.", "invalid_source");
  return svg;
}

async function mannequinPngDataUri(src: string) {
  const svg = svgMarkupFromDataUri(src);
  const png = await sharp(Buffer.from(svg)).resize({ width: 900, height: 1120, fit: "fill" }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function stockSwatchBuffer(swatchImageUrl?: string) {
  if (!swatchImageUrl?.startsWith("/fabrics/") || !/^[a-zA-Z0-9/_-]+\.webp$/.test(swatchImageUrl)) return undefined;
  const fabricRoot = path.resolve(process.cwd(), "public", "fabrics");
  const filePath = path.resolve(process.cwd(), "public", swatchImageUrl.slice(1));
  if (!filePath.startsWith(`${fabricRoot}${path.sep}`)) return undefined;
  try {
    return await readFile(filePath);
  } catch {
    return undefined;
  }
}

async function stockSwatchDataUri(swatchImageUrl?: string) {
  const bytes = await stockSwatchBuffer(swatchImageUrl);
  return bytes ? `data:image/webp;base64,${bytes.toString("base64")}` : undefined;
}

async function stockPairingContextDataUri(spec: VisualizationSpec) {
  const pair = spec.stockPairing;
  if (!pair) return stockSwatchDataUri(spec.fabric.swatchImageUrl);

  const [shirt,trouser] = await Promise.all([
    stockSwatchBuffer(pair.shirt.swatchImageUrl),
    stockSwatchBuffer(pair.trouser.swatchImageUrl),
  ]);
  if (!shirt && !trouser) return stockSwatchDataUri(spec.fabric.swatchImageUrl);
  if (!shirt || !trouser) {
    const bytes = shirt || trouser;
    return bytes ? `data:image/webp;base64,${bytes.toString("base64")}` : undefined;
  }

  const shirtPanel = await sharp(shirt).resize({width:768,height:384,fit:"cover"}).toBuffer();
  const trouserPanel = await sharp(trouser).resize({width:768,height:384,fit:"cover"}).toBuffer();
  const board = await sharp({
    create:{width:768,height:768,channels:3,background:{r:245,g:242,b:236}},
  }).composite([
    {input:shirtPanel,left:0,top:0},
    {input:trouserPanel,left:0,top:384},
  ]).jpeg({quality:92}).toBuffer();
  return `data:image/jpeg;base64,${board.toString("base64")}`;
}

function lockedOutfit(spec: VisualizationSpec, fabricUse?: string) {
  const safe = (value: string, limit = 260) => value.replace(/\s+/g, " ").trim().slice(0, limit);
  return [
    `Shirt: ${safe(spec.garments.shirt)}.`,
    `Trousers: ${safe(spec.garments.trouser)}.`,
    `Outer layer: ${safe(spec.garments.layer)}.`,
    `Footwear: ${safe(spec.garments.footwear)}.`,
    `Aesthetic: ${safe(spec.aesthetic)}.`,
    `Fabric: ${safe(spec.fabric.material)}, ${safe(spec.fabric.tone)}. ${safe(spec.fabric.summary, 420)}`,
    spec.stockPairing ? `Locked stock pair: shirt ${safe(spec.stockPairing.shirt.colorName)} (${safe(spec.stockPairing.shirt.line)}); trouser ${safe(spec.stockPairing.trouser.colorName)} (${safe(spec.stockPairing.trouser.line)}).` : "",
    fabricUse ? `Fabric placement: ${safe(fabricUse, 420)}` : "",
  ].filter(Boolean).join(" ");
}

function frontPrompt(spec: VisualizationSpec, fabricUse: string) {
  const fabricInstruction = spec.stockPairing
    ? "The supplied fabric-context image is a two-panel reference: TOP HALF is the exact shirt fabric and BOTTOM HALF is the exact trouser fabric. Keep these two fabrics distinct and map each only to its named garment. Preserve their visible color, weave/slub and print character; do not blend the two panels or copy the board framing."
    : spec.fabric.swatchImageUrl
      ? "Use the supplied fabric-context image for the cloth's exact visible color, weave, slub and print character; do not copy its background or framing."
      : "Render the described cloth honestly without inventing a loud print.";
  return `Transform this flat outfit reference into a premium photorealistic full-body menswear catalogue photograph. Use one elegant faceless male atelier mannequin with realistic Indian menswear proportions, a smooth matte warm-neutral resin head, no eyes, no facial features and no hair. Straight front view, relaxed arms, natural tailoring drape, accurate seams and construction, soft directional studio lighting, seamless deep navy studio background, clean luxury e-commerce styling. Preserve the exact garment combination, silhouette and palette from the source. ${lockedOutfit(spec, fabricUse)} ${fabricInstruction} No text, logos, props, extra garments, human face or cropped limbs.`;
}

function viewPrompt(spec: VisualizationSpec, view: RenderView) {
  const camera = view === "back"
    ? "Turn the same mannequin and outfit to a straight full-body back view."
    : view === "detail"
      ? "Turn the same mannequin and outfit to a full-body three-quarter view, angled about 35 degrees."
      : "Refine this as a straight full-body front view.";
  return `${camera} Preserve the mannequin identity, garment construction, exact fabric appearance, colors, fit, footwear, deep navy studio background and lighting. ${lockedOutfit(spec)} Keep the head completely faceless and matte with no eyes, hair or human facial details. No text, logos, props, extra garments or cropped limbs.`;
}

async function runEdit(image: string, prompt: string, imageContext?: string) {
  const response = await fashnClient().predictions.subscribe({
    model_name: "edit",
    inputs: {
      image,
      prompt,
      image_context: imageContext,
      aspect_ratio: "4:5",
      resolution: "1k",
      generation_mode: "balanced",
      num_images: 1,
      output_format: "jpeg",
      return_base64: false,
      seed: 4137,
    },
    pollInterval: 1_200,
    timeout: 55_000,
    maxRetries: 2,
  });
  const output = response.output?.[0];
  if (response.status !== "completed" || !output || !OFFICIAL_FASHN_OUTPUT.test(output)) {
    const reason = response.error?.message || `FASHN generation ended with status ${response.status}.`;
    throw new FashnVisualizationError(reason);
  }
  return { output, jobId: response.id, creditsUsed: response.creditsUsed || 0 };
}

export async function renderFashnFront(brief: DesignerBrief, version: DesignVersion): Promise<RenderSet> {
  const base = renderDevelopmentSet(brief, version);
  const front = base.renders.find((render) => render.view === "front");
  if (!front) throw new FashnVisualizationError("The front mannequin reference is missing.", "invalid_source");
  const source = await mannequinPngDataUri(front.src);
  const swatch = await stockPairingContextDataUri(base.spec);
  const generated = await runEdit(source, frontPrompt(base.spec, version.candidate.fabricUse), swatch);
  return {
    ...base,
    provider: "fashn-edit",
    providerLabel: "FASHN photorealistic atelier renderer",
    status: "generated",
    generatedAt: new Date().toISOString(),
    creditsUsed: (base.creditsUsed || 0) + generated.creditsUsed,
    providerJobIds: [...(base.providerJobIds || []), generated.jobId],
    renders: base.renders.map((render) => render.view === "front" ? {
      ...render,
      src: generated.output,
      label: "Photorealistic front view",
      provider: "fashn-edit",
      providerJobId: generated.jobId,
    } : render),
  };
}

export async function renderFashnView(set: RenderSet, view: RenderView, brief: DesignerBrief, version: DesignVersion): Promise<RenderSet> {
  const canonical = renderDevelopmentSet(brief, version);
  if (canonical.specHash !== set.specHash || canonical.designVersionId !== set.designVersionId) {
    throw new FashnVisualizationError("The render does not match the locked design.", "invalid_source");
  }
  const front = set.renders.find((render) => render.view === "front" && render.provider === "fashn-edit");
  if (!front || !OFFICIAL_FASHN_OUTPUT.test(front.src)) {
    throw new FashnVisualizationError("Generate the photorealistic front view first.", "invalid_source");
  }
  const swatch = await stockPairingContextDataUri(canonical.spec);
  const generated = await runEdit(front.src, viewPrompt(canonical.spec, view), swatch);
  const repaired = repairDevelopmentRender({ ...set, spec: canonical.spec }, view);
  return {
    ...repaired,
    provider: "fashn-edit",
    providerLabel: "FASHN photorealistic atelier renderer",
    status: "generated",
    creditsUsed: (set.creditsUsed || 0) + generated.creditsUsed,
    providerJobIds: [...(set.providerJobIds || []), generated.jobId],
    renders: repaired.renders.map((render) => render.view === view ? {
      ...render,
      src: generated.output,
      label: view === "detail" ? "Photorealistic 3/4 view" : `Photorealistic ${view} view`,
      provider: "fashn-edit",
      providerJobId: generated.jobId,
    } : render),
  };
}
