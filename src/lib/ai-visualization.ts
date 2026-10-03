import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import Fashn from "fashn";
import sharp from "sharp";
import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import type { DesignerFabric, DesignerStyle } from "@/lib/designer/engine";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import type { CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import type { StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import { styleSpecRenderSummary } from "@/lib/designer/style-spec-v2";
import type { BodyPreviewProfile } from "@/lib/designer/body-profile";
import { bodyProfileRenderSummary } from "@/lib/designer/body-profile";
import { compareRenderMeasuredColors, compareRenderMeasuredPatterns, worstRenderColorStatus, worstRenderPatternStatus, type RenderColorFidelityResult, type RenderPatternFidelityResult } from "@/lib/designer/render-fidelity-core";
import { selectedLookRenderCacheKey } from "@/lib/designer/render-cache-key";
import { classifyProtectedRegionChange, protectedRegionChangePercent, type ProtectedRegionStatus } from "@/lib/designer/render-protected-region";
import {
  DESIGNER_PHOTO_TEMPLATES,
  PHOTO_TUCKED_SHIRT_CLIP,
  PHOTO_TUCKED_TROUSER_CLIP,
  photoTemplateForStyle,
} from "@/lib/designer/photo-preview";
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
const rateRegistry = (globalThis as typeof globalThis & { __linenFashnRate?: RateRegistry }).__linenFashnRate
  ||= { lastByIp: new Map<string, number>() };

export function assertFashnRateLimit(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const last = rateRegistry.lastByIp.get(ip) || 0;
  if (now - last < 45_000) throw new FashnVisualizationError("Please wait a moment before starting another photorealistic render.", "rate_limited");
  rateRegistry.lastByIp.set(ip, now);
  for (const [key, timestamp] of rateRegistry.lastByIp) if (now - timestamp > 10 * 60_000) rateRegistry.lastByIp.delete(key);
}

type RepairRateRegistry = { lastByIp: Map<string, number> };
const repairRateRegistry = (globalThis as typeof globalThis & { __linenFashnRepairRate?: RepairRateRegistry }).__linenFashnRepairRate
  ||= { lastByIp: new Map<string, number>() };

export function assertFashnRepairRateLimit(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const last = repairRateRegistry.lastByIp.get(ip) || 0;
  if (now - last < 45_000) throw new FashnVisualizationError("Only one immediate render repair is allowed at a time.", "rate_limited");
  repairRateRegistry.lastByIp.set(ip, now);
  for (const [key, timestamp] of repairRateRegistry.lastByIp) if (now - timestamp > 10 * 60_000) repairRateRegistry.lastByIp.delete(key);
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

export type CreativeFashnRequest = {
  shirt: Pick<DesignerFabric,"id"|"name"|"line"|"image"|"hex"|"patternType">;
  pant: Pick<DesignerFabric,"id"|"name"|"line"|"image"|"hex"|"patternType">;
  style: DesignerStyle;
  creative: Pick<CreativeDirection,"id"|"name"|"thesis"|"treatments"|"pattern"> & {
    renderRisk?: "low"|"moderate"|"high";
    renderCaution?: CreativeFeedbackReason;
    repairInstruction?: string;
  };
};

export type SelectedLookFabricRenderEvidence={
  gsm:number|null;
  drape:"Fluid"|"Balanced"|"Structured"|null;
  fiberContent:string|null;
  measuredColorHex:string|null;
  measurementQuality:number|null;
  patternContrastDeltaE:number|null;
  patternOrientation:"none"|"vertical"|"horizontal"|"grid"|"uncertain"|null;
  repeatMm:number|null;
  stripeWidthMm:number|null;
  physicalScaleStatus:"declared_repeat"|"declared_swatch_width"|"unknown"|null;
};

export type SelectedLookRenderEvidence={
  shirt?:SelectedLookFabricRenderEvidence;
  pant?:SelectedLookFabricRenderEvidence;
};

export type SelectedLookFashnRequest = {
  shirt: Pick<DesignerFabric,"id"|"name"|"line"|"image"|"hex"|"patternType">;
  pant: Pick<DesignerFabric,"id"|"name"|"line"|"image"|"hex"|"patternType">;
  style: DesignerStyle;
  styleSpec?:StyleSpecV2;
  bodyProfile?:BodyPreviewProfile;
  renderEvidence?:SelectedLookRenderEvidence;
  lockedPreviewImage?:string;
  locked?:boolean;
  lookKey?:string;
};

export type SelectedLookView = "front"|"three-quarter"|"side"|"back";

export type SelectedLookVisualCheck = {
  available:boolean;
  status:"pass"|"review";
  fabricFidelity:"strong"|"review"|"weak";
  colorFidelity:"strong"|"review"|"weak";
  patternFidelity:"strong"|"review"|"weak";
  boundary:"strong"|"review"|"weak";
  construction:"strong"|"review"|"weak";
  mannequinConsistency:"strong"|"review"|"weak";
  artifact:"none"|"minor"|"major";
  issue:string;
  repairInstruction:string;
  measuredColorDeltaE?:{shirt:number|null;pant:number|null};
  measuredPatternOrientation?:{shirt:string|null;pant:string|null};
  protectedRegionChange?:number;
  protectedRegionStatus?:ProtectedRegionStatus;
};

export type CreativeRenderVisualCheck = {
  status:"pass"|"review";
  heroVisibility:number;
  boundaryIntegrity:number;
  protectedChange:number;
  notes:string[];
  evidenceAvailable:boolean;
  semanticAvailable:boolean;
  semanticStatus?:"pass"|"review";
  semanticIssue?:string;
  redesignReason?:CreativeFeedbackReason;
  improvement?:"improved"|"same"|"worse"|"not_applicable";
};

export type CreativeFashnResult = {
  image:string;
  jobId:string;
  creditsUsed:number;
  conceptId:string;
  generatedAt:string;
  cached?:boolean;
};

async function stockSwatchDataUri(swatchImageUrl?: string) {
  if (!swatchImageUrl?.startsWith("/fabrics/") || !/^[a-zA-Z0-9/_-]+\.webp$/.test(swatchImageUrl)) return undefined;
  const fabricRoot = path.resolve(process.cwd(), "public", "fabrics");
  const filePath = path.resolve(process.cwd(), "public", swatchImageUrl.slice(1));
  if (!filePath.startsWith(`${fabricRoot}${path.sep}`)) return undefined;
  try {
    const bytes = await readFile(filePath);
    return `data:image/webp;base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
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
    fabricUse ? `Fabric placement: ${safe(fabricUse, 420)}` : "",
  ].filter(Boolean).join(" ");
}

function frontPrompt(spec: VisualizationSpec, fabricUse: string) {
  return `Transform this flat outfit reference into a premium photorealistic full-body menswear catalogue photograph. Use one elegant faceless male atelier mannequin with realistic Indian menswear proportions, a smooth matte warm-neutral resin head, no eyes, no facial features and no hair. Straight front view, relaxed arms, natural tailoring drape, accurate seams and construction, soft directional studio lighting, seamless deep navy studio background, clean luxury e-commerce styling. Preserve the exact garment combination, silhouette and palette from the source. ${lockedOutfit(spec, fabricUse)} ${spec.fabric.swatchImageUrl ? "Use the supplied fabric-context image for the cloth's exact visible color, weave, slub and print character; do not copy its background or framing." : "Render the described cloth honestly without inventing a loud print."} Treat every garment as a physically separate sewn object: fabric must never spill onto the mannequin neck, hands, skin, adjacent garment, or background. Keep collar edges clean around the exposed neck, sleeves terminating exactly at the cuffs, and trouser legs separated naturally at the crotch. If the shirt is tucked, place the shirt hem fully inside the trousers and render the trouser waistband in front of it; never let shirt fabric overlay the waistband, fly, crotch, or upper trouser surface. No text, logos, props, extra garments, human face or cropped limbs.`;
}

function viewPrompt(spec: VisualizationSpec, view: RenderView) {
  const camera = view === "back"
    ? "Turn the same mannequin and outfit to a straight full-body back view."
    : view === "detail"
      ? "Turn the same mannequin and outfit to a full-body three-quarter view, angled about 35 degrees."
      : "Refine this as a straight full-body front view.";
  return `${camera} Preserve the mannequin identity, garment construction, exact fabric appearance, colors, fit, footwear, deep navy studio background and lighting. ${lockedOutfit(spec)} Keep the head completely faceless and matte with no eyes, hair or human facial details. Preserve physically clean garment boundaries: no fabric bleeding onto neck, hands, background or the other garment; clean collar opening, clean cuff termination, distinct trouser crotch seam, and when tucked the waistband must visibly sit over the shirt hem. No text, logos, props, extra garments or cropped limbs.`;
}

async function publicImageDataUri(publicPath:string,allowedRootName:string) {
  if(!publicPath.startsWith(`/${allowedRootName}/`) || !/^[a-zA-Z0-9/_-]+\.(webp|png|jpe?g)$/i.test(publicPath)) return undefined;
  const root=path.resolve(process.cwd(),"public",allowedRootName);
  const filePath=path.resolve(process.cwd(),"public",publicPath.slice(1));
  if(!filePath.startsWith(`${root}${path.sep}`)) return undefined;
  try {
    const bytes=await readFile(filePath);
    const ext=path.extname(filePath).toLowerCase();
    const mime=ext===".png"?"image/png":ext===".webp"?"image/webp":"image/jpeg";
    return {bytes,mime};
  } catch {
    return undefined;
  }
}

const FABRIC_CONTEXT_PANEL_WIDTH=500;
const FABRIC_CONTEXT_HEIGHT=620;
const FABRIC_CONTEXT_GUTTER=32;
const FABRIC_CONTEXT_BACKGROUND={r:235,g:231,b:224} as const;

async function fabricContextPanel(bytes:Buffer|undefined) {
  const placeholder=await sharp({
    create:{
      width:FABRIC_CONTEXT_PANEL_WIDTH,
      height:FABRIC_CONTEXT_HEIGHT,
      channels:3,
      background:{r:218,g:212,b:202},
    },
  }).png().toBuffer();

  // Preserve the complete photographed swatch rather than cover-cropping it.
  // Cropping can remove a stripe/check repeat or edge variation that the final
  // renderer and visual QA need to distinguish the actual catalogue fabric.
  return sharp(bytes||placeholder)
    .resize(FABRIC_CONTEXT_PANEL_WIDTH,FABRIC_CONTEXT_HEIGHT,{
      fit:"contain",
      background:FABRIC_CONTEXT_BACKGROUND,
      withoutEnlargement:false,
    })
    .removeAlpha()
    .png()
    .toBuffer();
}

async function creativeFabricContext(shirtImage:string,pantImage:string) {
  const [shirt,pant]=await Promise.all([
    publicImageDataUri(shirtImage,"fabrics"),
    publicImageDataUri(pantImage,"fabrics"),
  ]);
  if(!shirt && !pant) return undefined;
  try {
    const [left,right]=await Promise.all([
      fabricContextPanel(shirt?.bytes),
      fabricContextPanel(pant?.bytes),
    ]);
    const rightOffset=FABRIC_CONTEXT_PANEL_WIDTH+FABRIC_CONTEXT_GUTTER;
    const joined=await sharp({
      create:{
        width:FABRIC_CONTEXT_PANEL_WIDTH*2+FABRIC_CONTEXT_GUTTER,
        height:FABRIC_CONTEXT_HEIGHT,
        channels:3,
        background:FABRIC_CONTEXT_BACKGROUND,
      },
    }).composite([
      {input:left,left:0,top:0},
      {input:right,left:rightOffset,top:0},
    ]).webp({quality:96,nearLossless:true,smartSubsample:true}).toBuffer();

    // The neutral gutter deliberately keeps shirt and trouser references
    // visually separate without adding labels/text that a generative model
    // could accidentally reproduce in the garment or studio scene.
    return `data:image/webp;base64,${joined.toString("base64")}`;
  } catch {
    return undefined;
  }
}

async function creativeModelDataUri(style:DesignerStyle) {
  const source=style.shirtWear==="Tucked" ? "/designer/studio-tucked.webp"
    : style.trouser==="Wide-leg / Relaxed Drape Trouser" ? "/designer/studio-wide.webp"
      : "/designer/studio-pleated.webp";
  const image=await publicImageDataUri(source,"designer");
  if(!image) throw new FashnVisualizationError("The studio model reference is unavailable.","invalid_source");
  return `data:${image.mime};base64,${image.bytes.toString("base64")}`;
}

async function selectedLookGarmentEditMask(style:DesignerStyle) {
  const templateId=photoTemplateForStyle(style);
  const template=DESIGNER_PHOTO_TEMPLATES[templateId];
  const shirtPath=templateId==="tucked" ? PHOTO_TUCKED_SHIRT_CLIP : template.shirtPath;
  const trouserPath=templateId==="tucked" ? PHOTO_TUCKED_TROUSER_CLIP : template.trouserPath;
  if(!shirtPath || !trouserPath) return undefined;

  // FASHN Edit treats white mask pixels as the priority edit region and black
  // as preserve. Reuse the same 1024×1536 garment geometry as the deterministic
  // preview so the final refinement concentrates on cloth while the faceless
  // head, hands, shoes and studio remain protected by default.
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
    <rect width="1024" height="1536" fill="#000"/>
    <path d="${shirtPath}" fill="#fff"/>
    <path d="${trouserPath}" fill="#fff"/>
  </svg>`;
  const mask=await sharp(Buffer.from(svg))
    .png({compressionLevel:9})
    .toBuffer();
  return `data:image/png;base64,${mask.toString("base64")}`;
}

type NormalizedBox={x:number;y:number;w:number;h:number};

const CREATIVE_ZONE_BOXES:Record<string,NormalizedBox>={
  collar:{x:.36,y:.10,w:.28,h:.12},
  cuff:{x:.12,y:.34,w:.76,h:.19},
  placket:{x:.45,y:.17,w:.10,h:.36},
  "shirt-body":{x:.28,y:.17,w:.44,h:.38},
  pocket:{x:.29,y:.22,w:.20,h:.18},
  waistband:{x:.29,y:.48,w:.42,h:.10},
  pleat:{x:.33,y:.53,w:.34,h:.22},
  "trouser-leg":{x:.25,y:.51,w:.50,h:.43},
};

const PROTECTED_RENDER_BOXES:NormalizedBox[]=[
  {x:.35,y:.00,w:.30,h:.12}, // faceless head / neck
  {x:.00,y:.25,w:.18,h:.38}, // left hand / outer background
  {x:.82,y:.25,w:.18,h:.38}, // right hand / outer background
  {x:.00,y:.00,w:1,h:.07},   // upper background
  {x:.00,y:.88,w:1,h:.12},   // floor / shoes
];

const LOCKED_PREVIEW_DATA_URI=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i;
const LOCKED_PREVIEW_MAX_BYTES=4_500_000;
const LOCKED_PREVIEW_IDENTITY_BOXES:NormalizedBox[]=[
  {x:.39,y:.015,w:.22,h:.105}, // faceless head / upper neck
  {x:.00,y:.00,w:1,h:.06},     // upper studio background
  {x:.00,y:.10,w:.11,h:.72},   // left outer studio background
  {x:.89,y:.10,w:.11,h:.72},   // right outer studio background
  {x:.00,y:.92,w:1,h:.08},     // floor / lower studio
];

async function validatedLockedPreviewSource(input:SelectedLookFashnRequest) {
  const fallback=await creativeModelDataUri(input.style);
  const candidate=String(input.lockedPreviewImage||"");
  const match=LOCKED_PREVIEW_DATA_URI.exec(candidate);
  if(!match) return {source:fallback,usedLockedPreview:false};

  let bytes:Buffer;
  try {
    bytes=Buffer.from(match[2],"base64");
  } catch {
    return {source:fallback,usedLockedPreview:false};
  }
  if(bytes.length<40_000 || bytes.length>LOCKED_PREVIEW_MAX_BYTES) return {source:fallback,usedLockedPreview:false};

  try {
    const metadata=await sharp(bytes,{limitInputPixels:1024*1536*2}).metadata();
    if(metadata.width!==1024 || metadata.height!==1536 || (metadata.pages||1)!==1) {
      return {source:fallback,usedLockedPreview:false};
    }

    // Strip browser/file metadata while preserving fine weave and directional
    // pattern detail. FASHN accepts WebP inputs, so avoid an extra JPEG
    // generation between the deterministic customer preview and final render.
    // Only the canonical 1024×1536 live-preview coordinate system is accepted.
    const sanitized=await sharp(bytes,{limitInputPixels:1024*1536*2})
      .removeAlpha()
      .webp({quality:96,nearLossless:true,smartSubsample:true})
      .toBuffer();

    const [preview,reference]=await Promise.all([
      normalizedRgb(sanitized),
      normalizedRgb(fallback),
    ]);
    const deltas=LOCKED_PREVIEW_IDENTITY_BOXES.map((box)=>boxDelta(preview,reference,box));
    const average=deltas.reduce((sum,value)=>sum+value,0)/deltas.length;
    const maximum=Math.max(...deltas);
    if(average>.16 || maximum>.28) return {source:fallback,usedLockedPreview:false};

    return {
      source:`data:image/webp;base64,${sanitized.toString("base64")}`,
      usedLockedPreview:true,
    };
  } catch {
    return {source:fallback,usedLockedPreview:false};
  }
}

async function remoteImageBuffer(url:string) {
  if(!OFFICIAL_FASHN_OUTPUT.test(url)) throw new FashnVisualizationError("Generated render URL is not trusted.","invalid_source");
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok) throw new FashnVisualizationError("Generated render could not be inspected.","generation_failed");
  const contentType=response.headers.get("content-type")||"";
  if(!/^image\//i.test(contentType)) throw new FashnVisualizationError("Generated render response is not an image.","generation_failed");
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>12_000_000) throw new FashnVisualizationError("Generated render is too large to inspect.","generation_failed");
  return bytes;
}

async function normalizedRgb(input:Buffer|string) {
  const source=typeof input==="string"
    ? Buffer.from(input.split(",")[1]||"","base64")
    : input;
  const {data,info}=await sharp(source).resize(400,500,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  return {data,width:info.width,height:info.height,channels:info.channels};
}

function boxDelta(
  a:{data:Buffer;width:number;height:number;channels:number},
  b:{data:Buffer;width:number;height:number;channels:number},
  box:NormalizedBox,
) {
  const x0=Math.max(0,Math.floor(box.x*a.width));
  const y0=Math.max(0,Math.floor(box.y*a.height));
  const x1=Math.min(a.width,Math.ceil((box.x+box.w)*a.width));
  const y1=Math.min(a.height,Math.ceil((box.y+box.h)*a.height));
  let total=0,count=0;
  for(let y=y0;y<y1;y+=2){
    for(let x=x0;x<x1;x+=2){
      const ai=(y*a.width+x)*a.channels;
      const bi=(y*b.width+x)*b.channels;
      total+=Math.abs(a.data[ai]-b.data[bi])+Math.abs(a.data[ai+1]-b.data[bi+1])+Math.abs(a.data[ai+2]-b.data[bi+2]);
      count+=3;
    }
  }
  return count ? total/(count*255) : 0;
}

async function inspectCreativeRender(
  referenceDataUri:string,
  outputUrl:string,
  input:CreativeFashnRequest,
):Promise<CreativeRenderVisualCheck> {
  try {
    const [reference,outputBytes]=await Promise.all([
      normalizedRgb(referenceDataUri),
      remoteImageBuffer(outputUrl),
    ]);
    const output=await normalizedRgb(outputBytes);
    const ordered=[...input.creative.treatments].sort((a,b)=>b.intensity-a.intensity);
    const hero=ordered[0];
    const heroBox=CREATIVE_ZONE_BOXES[hero?.zone || "shirt-body"] || CREATIVE_ZONE_BOXES["shirt-body"];
    const heroDelta=boxDelta(reference,output,heroBox);
    const supportDeltas=ordered.slice(1,3).map((move)=>boxDelta(reference,output,CREATIVE_ZONE_BOXES[move.zone]||CREATIVE_ZONE_BOXES["shirt-body"]));
    const protectedDelta=PROTECTED_RENDER_BOXES.reduce((sum,box)=>sum+boxDelta(reference,output,box),0)/PROTECTED_RENDER_BOXES.length;
    const intendedDelta=Math.max(heroDelta,...supportDeltas,0.001);
    const heroVisibility=Math.round(Math.min(100,heroDelta/.26*100));
    const protectedChange=Math.round(Math.min(100,protectedDelta/.22*100));
    const boundaryIntegrity=Math.round(Math.max(0,100-protectedChange));
    const notes:string[]=[];

    if(heroVisibility<38) notes.push(`The intended ${hero?.label || "hero detail"} is not visually distinct enough in the generated render.`);
    if(protectedChange>34) notes.push("Protected areas changed too much relative to the locked studio reference; possible garment bleed or model/background drift.");
    if(heroDelta<intendedDelta*.72 && supportDeltas.length) notes.push("A supporting detail appears stronger than the intended hero move.");
    if(input.style.shirtWear==="Tucked") {
      const waistDelta=boxDelta(reference,output,CREATIVE_ZONE_BOXES.waistband);
      const shirtDelta=boxDelta(reference,output,CREATIVE_ZONE_BOXES["shirt-body"]);
      if(waistDelta>shirtDelta*1.35) notes.push("The tucked waist region changed disproportionately; inspect waistband layering before approval.");
    }
    return {
      status:notes.length ? "review" : "pass",
      heroVisibility,
      boundaryIntegrity,
      protectedChange,
      notes:notes.length?notes:["The intended focal zone is visible and protected regions remain comparatively stable."],
      evidenceAvailable:true,
      semanticAvailable:false,
    };
  } catch {
    return {
      status:"review",
      heroVisibility:0,
      boundaryIntegrity:0,
      protectedChange:100,
      notes:["Automatic render inspection was unavailable; require manual visual review before approval."],
      evidenceAvailable:false,
      semanticAvailable:false,
    };
  }
}


type SemanticCreativeCheck = {
  status:"pass"|"review";
  hierarchy:"strong"|"review"|"weak";
  proportion:"strong"|"review"|"weak";
  fidelity:"strong"|"review"|"weak";
  heroAccuracy:"strong"|"review"|"weak";
  fabricFidelity:"strong"|"review"|"weak";
  boundary:"strong"|"review"|"weak";
  supportCompetition:"none"|"minor"|"major";
  artifact:"none"|"minor"|"major";
  redesignReason:CreativeFeedbackReason;
  improvement:"improved"|"same"|"worse"|"not_applicable";
  issue:string;
};

function gatewayAuthToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "";
}

function visualCriticModels() {
  const configured=(process.env.LINEN_VISUAL_CRITIC_MODEL || "").trim();
  return [...new Set([
    ...(configured?[configured]:[]),
    "openai/gpt-5.4",
    "google/gemini-3-flash",
  ])].slice(0,2);
}

function gatewayOutputText(payload:unknown) {
  if(!payload || typeof payload!=="object") return "";
  const value=payload as Record<string,unknown>;
  if(typeof value.output_text==="string") return value.output_text;
  const output=Array.isArray(value.output)?value.output:[];
  for(const item of output) {
    if(!item || typeof item!=="object") continue;
    const content=Array.isArray((item as Record<string,unknown>).content)?(item as Record<string,unknown>).content as unknown[]:[];
    for(const part of content) {
      if(!part || typeof part!=="object") continue;
      const p=part as Record<string,unknown>;
      if(typeof p.text==="string") return p.text;
    }
  }
  return "";
}


export async function inspectSelectedLookFashnOutput(
  outputUrl:string,
  input:SelectedLookFashnRequest,
  view:SelectedLookView="front",
):Promise<SelectedLookVisualCheck> {
  if(!OFFICIAL_FASHN_OUTPUT.test(outputUrl)) {
    return {
      available:false,
      status:"review",
      fabricFidelity:"review",
      colorFidelity:"review",
      patternFidelity:"review",
      boundary:"review",
      construction:"review",
      mannequinConsistency:"review",
      artifact:"minor",
      issue:"Automatic photoreal QA is unavailable; keep this render for manual review.",
      repairInstruction:"",
    };
  }

  let measuredColor:RenderColorFidelityResult|null=null;
  let measuredPattern:RenderPatternFidelityResult|null=null;
  let outputBytes:Buffer|null=null;
  let deterministicReferenceDataUri:string|undefined;
  let protectedRegionChange:number|null=null;
  let protectedRegionStatus:ProtectedRegionStatus="unavailable";
  const shirtMeasured=input.renderEvidence?.shirt?.measuredColorHex || null;
  const pantMeasured=input.renderEvidence?.pant?.measuredColorHex || null;
  const shirtOrientation=input.renderEvidence?.shirt?.patternOrientation || null;
  const pantOrientation=input.renderEvidence?.pant?.patternOrientation || null;
  const shirtPatternContrast=Number.isFinite(input.renderEvidence?.shirt?.patternContrastDeltaE)
    ? input.renderEvidence?.shirt?.patternContrastDeltaE as number
    : null;
  const pantPatternContrast=Number.isFinite(input.renderEvidence?.pant?.patternContrastDeltaE)
    ? input.renderEvidence?.pant?.patternContrastDeltaE as number
    : null;
  const hasPatternTarget=[shirtOrientation,pantOrientation].some((value)=>value && !["none","uncertain"].includes(value));

  if(view==="front" || shirtMeasured || pantMeasured || hasPatternTarget) {
    try {
      outputBytes=await remoteImageBuffer(outputUrl);
      if(shirtMeasured || pantMeasured) {
        measuredColor=await compareRenderMeasuredColors(outputBytes,view,{
          shirtHex:shirtMeasured,
          pantHex:pantMeasured,
        });
      }
      if(hasPatternTarget) {
        measuredPattern=await compareRenderMeasuredPatterns(outputBytes,view,{
          shirtOrientation,
          pantOrientation,
          shirtContrastDeltaE:shirtPatternContrast,
          pantContrastDeltaE:pantPatternContrast,
          shirtRepeatMm:input.renderEvidence?.shirt?.repeatMm ?? null,
          pantRepeatMm:input.renderEvidence?.pant?.repeatMm ?? null,
          shirtStripeWidthMm:input.renderEvidence?.shirt?.stripeWidthMm ?? null,
          pantStripeWidthMm:input.renderEvidence?.pant?.stripeWidthMm ?? null,
          bodyHeightCm:input.bodyProfile?.heightCm ?? null,
        });
      }
      if(view==="front") {
        deterministicReferenceDataUri=await creativeModelDataUri(input.style);
        const [reference,output]=await Promise.all([
          normalizedRgb(deterministicReferenceDataUri),
          normalizedRgb(outputBytes),
        ]);
        const protectedDeltas=PROTECTED_RENDER_BOXES.map((box)=>boxDelta(reference,output,box));
        protectedRegionChange=protectedRegionChangePercent(protectedDeltas);
        protectedRegionStatus=classifyProtectedRegionChange(protectedRegionChange);
      }
    } catch {
      measuredColor=null;
      measuredPattern=null;
      protectedRegionChange=null;
      protectedRegionStatus="unavailable";
    }
  }

  const codeColorStatus=measuredColor ? worstRenderColorStatus(measuredColor) : "unavailable";
  const codePatternStatus=measuredPattern ? worstRenderPatternStatus(measuredPattern) : "unavailable";
  const measuredColorDeltaE=measuredColor ? {
    shirt:measuredColor.shirt.deltaE,
    pant:measuredColor.pant.deltaE,
  } : undefined;
  const measuredPatternOrientation=measuredPattern ? {
    shirt:measuredPattern.shirt.observedOrientation,
    pant:measuredPattern.pant.observedOrientation,
  } : undefined;
  const measuredColorIssue=measuredColor && (codeColorStatus==="review"||codeColorStatus==="weak")
    ? [
      measuredColor.shirt.deltaE!==null ? `shirt ΔE ${measuredColor.shirt.deltaE}` : "",
      measuredColor.pant.deltaE!==null ? `trouser ΔE ${measuredColor.pant.deltaE}` : "",
    ].filter(Boolean).join(", ")
    : "";
  const measuredPatternIssue=measuredPattern && (codePatternStatus==="review"||codePatternStatus==="weak")
    ? [
      measuredPattern.shirt.status!=="unavailable"
        ? [
          `shirt ${measuredPattern.shirt.expectedOrientation}→${measuredPattern.shirt.observedOrientation}`,
          measuredPattern.shirt.expectedRepeatMm!==null
            ? `repeat ${measuredPattern.shirt.expectedRepeatMm}→${measuredPattern.shirt.observedRepeatMm ?? "unavailable"} mm`
            : "",
          measuredPattern.shirt.expectedStripeWidthMm!==null
            ? `stripe ${measuredPattern.shirt.expectedStripeWidthMm}→${measuredPattern.shirt.observedStripeWidthMm ?? "unavailable"} mm`
            : "",
        ].filter(Boolean).join(" ")
        : "",
      measuredPattern.pant.status!=="unavailable"
        ? [
          `trouser ${measuredPattern.pant.expectedOrientation}→${measuredPattern.pant.observedOrientation}`,
          measuredPattern.pant.expectedRepeatMm!==null
            ? `repeat ${measuredPattern.pant.expectedRepeatMm}→${measuredPattern.pant.observedRepeatMm ?? "unavailable"} mm`
            : "",
          measuredPattern.pant.expectedStripeWidthMm!==null
            ? `stripe ${measuredPattern.pant.expectedStripeWidthMm}→${measuredPattern.pant.observedStripeWidthMm ?? "unavailable"} mm`
            : "",
        ].filter(Boolean).join(" ")
        : "",
    ].filter(Boolean).join(", ")
    : "";
  const protectedRegionIssue=protectedRegionStatus==="review"||protectedRegionStatus==="weak"
    ? `protected model/background change ${protectedRegionChange ?? "unavailable"}%`
    : "";


  const token=gatewayAuthToken();
  if(!token) {
    const deterministicAvailable=codeColorStatus!=="unavailable" || codePatternStatus!=="unavailable" || protectedRegionStatus!=="unavailable";
    const deterministicIssues=[
      measuredColorIssue ? `colour ${measuredColorIssue}` : "",
      measuredPatternIssue ? `pattern ${measuredPatternIssue}` : "",
      protectedRegionIssue,
    ].filter(Boolean).join("; ");
    const deterministicRepair=[
      measuredColorIssue||measuredPatternIssue ? "Restore measured fabric colour, pattern direction and physical scale." : "",
      protectedRegionIssue ? "Restore the locked mannequin and studio outside the garment edit region." : "",
    ].filter(Boolean).join(" ");
    return {
      available:deterministicAvailable,
      status:"review",
      fabricFidelity:"review",
      colorFidelity:codeColorStatus==="unavailable"?"review":codeColorStatus,
      patternFidelity:codePatternStatus==="unavailable"?"review":codePatternStatus,
      boundary:"review",
      construction:"review",
      mannequinConsistency:protectedRegionStatus==="unavailable"?"review":protectedRegionStatus,
      artifact:"minor",
      issue:deterministicAvailable
        ? (deterministicIssues ? `Measured render fidelity needs review (${deterministicIssues}). Other QA checks are unavailable.` : "Available deterministic colour, pattern and protected-region checks are within tolerance; other photoreal QA checks are unavailable.")
        : "Automatic photoreal QA is unavailable; keep this render for manual review.",
      repairInstruction:deterministicRepair.slice(0,180),
      ...(measuredColorDeltaE?{measuredColorDeltaE}:{}),
      ...(measuredPatternOrientation?{measuredPatternOrientation}:{}),
      ...(protectedRegionChange!==null?{protectedRegionChange,protectedRegionStatus}:{}),
    };
  }

  const [referenceDataUri,fabricContext]=await Promise.all([
    deterministicReferenceDataUri ? Promise.resolve(deterministicReferenceDataUri) : creativeModelDataUri(input.style),
    creativeFabricContext(input.shirt.image,input.pant.image),
  ]);
  const prompt=[
    "You are a strict production QA inspector for a premium menswear visualizer.",
    "Judge render fidelity, not fashion taste. The customer already chose the outfit.",
    `Expected camera/view: ${view}. The locked studio reference may be front-facing; allow only the camera/body rotation needed for this requested view while preserving mannequin identity and outfit.`,
    `Required shirt: ${input.shirt.name}; ${input.shirt.line}; ${input.shirt.patternType}.`,
    `Required trousers: ${input.pant.name}; ${input.pant.line}; ${input.pant.patternType}.`,
    `Required construction: ${selectedLookConstruction(input)}.`,
    `Required body/model: ${input.bodyProfile ? bodyProfileRenderSummary(input.bodyProfile) : "preserve existing proportions and skin tone"}.`,
    `Verified physical evidence: ${selectedLookPhysicalEvidence(input)}.`,
    measuredColorIssue ? `Deterministic colour check before vision review: ${measuredColorIssue}.` : "",
    measuredPatternIssue ? `Deterministic pattern-axis check before vision review: ${measuredPatternIssue}.` : "",
    protectedRegionStatus!=="unavailable" ? `Deterministic protected-region check for the front view: ${protectedRegionStatus}, normalized change ${protectedRegionChange}%.` : "",
    "Images are supplied in this order: GENERATED RENDER, LOCKED STUDIO MODEL, then SPLIT FABRIC CONTEXT when available (shirt left, trouser right).",
    "Check visible cloth colour, pattern scale/orientation/contrast, weave character, collar and cuff cleanliness, neck opening, hands, shirt/trouser boundary, tucked waistband layering, trouser silhouette, mannequin identity, background stability and synthesis artifacts.",
    "Use code-measured colour/pattern anchors when supplied as objective references; allow realistic lighting/shading but review obvious hue drift, pattern re-scaling, stripe-width drift or orientation changes.",
    "Do not fail minor natural drape variation. Review when cloth visibly bleeds onto skin/background/adjacent garment, the chosen construction is contradicted, fabric identity drifts materially, or the mannequin/background changes materially.",
    "If review is needed, give one concise repair instruction that fixes the rendering defect without redesigning the outfit. Keep issue and repairInstruction each under 180 characters."
  ].filter(Boolean).join("\n");

  const schema={
    type:"object",
    properties:{
      status:{type:"string",enum:["pass","review"]},
      fabricFidelity:{type:"string",enum:["strong","review","weak"]},
      colorFidelity:{type:"string",enum:["strong","review","weak"]},
      patternFidelity:{type:"string",enum:["strong","review","weak"]},
      boundary:{type:"string",enum:["strong","review","weak"]},
      construction:{type:"string",enum:["strong","review","weak"]},
      mannequinConsistency:{type:"string",enum:["strong","review","weak"]},
      artifact:{type:"string",enum:["none","minor","major"]},
      issue:{type:"string",maxLength:180},
      repairInstruction:{type:"string",maxLength:180},
    },
    required:["status","fabricFidelity","colorFidelity","patternFidelity","boundary","construction","mannequinConsistency","artifact","issue","repairInstruction"],
    additionalProperties:false,
  };

  const model=visualCriticModels()[0];
  try {
    const response=await fetch("https://ai-gateway.vercel.sh/v1/responses",{
      method:"POST",
      headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
      body:JSON.stringify({
        model,
        input:[{
          role:"user",
          content:[
            {type:"input_text",text:prompt},
            {type:"input_image",image_url:outputUrl,detail:"auto"},
            {type:"input_image",image_url:referenceDataUri,detail:"auto"},
            ...(fabricContext?[{type:"input_image",image_url:fabricContext,detail:"auto"}]:[]),
          ],
        }],
        text:{format:{type:"json_schema",name:"linen_selected_look_qa",strict:true,schema}},
      }),
      cache:"no-store",
      signal:AbortSignal.timeout(12_000),
    });
    if(!response.ok) throw new Error("visual QA unavailable");
    const raw=await response.json() as unknown;
    const text=gatewayOutputText(raw);
    if(!text) throw new Error("visual QA empty");
    const parsed=JSON.parse(text) as Omit<SelectedLookVisualCheck,"available">;
    const fidelityRank={strong:0,review:1,weak:2} as const;
    const codeColor=codeColorStatus==="unavailable" ? null : codeColorStatus;
    const codePattern=codePatternStatus==="unavailable" ? null : codePatternStatus;
    const codeProtected=protectedRegionStatus==="unavailable" ? null : protectedRegionStatus;
    const combinedColor=codeColor && fidelityRank[codeColor]>fidelityRank[parsed.colorFidelity] ? codeColor : parsed.colorFidelity;
    const combinedPattern=codePattern && fidelityRank[codePattern]>fidelityRank[parsed.patternFidelity] ? codePattern : parsed.patternFidelity;
    const combinedMannequin=codeProtected && fidelityRank[codeProtected]>fidelityRank[parsed.mannequinConsistency] ? codeProtected : parsed.mannequinConsistency;
    const forcedMeasuredReview=[codeColor,codePattern,codeProtected].some((value)=>value==="review"||value==="weak");
    const deterministicIssues=[
      measuredColorIssue ? `colour: ${measuredColorIssue}` : "",
      measuredPatternIssue ? `pattern: ${measuredPatternIssue}` : "",
      protectedRegionIssue ? `identity: ${protectedRegionIssue}` : "",
    ].filter(Boolean).join("; ");
    const issue=forcedMeasuredReview && deterministicIssues
      ? `Measured render drift — ${deterministicIssues}.`
      : String(parsed.issue||"").replace(/\s+/g," ").trim().slice(0,180);
    const deterministicRepair=[
      measuredColorIssue||measuredPatternIssue ? "Restore measured fabric colour, pattern direction and physical scale." : "",
      protectedRegionIssue ? "Restore the locked mannequin and studio outside the garment edit region." : "",
    ].filter(Boolean).join(" ");
    const repairInstruction=forcedMeasuredReview
      ? deterministicRepair.slice(0,180)
      : String(parsed.repairInstruction||"").replace(/\s+/g," ").trim().slice(0,180);
    return {
      ...parsed,
      available:true,
      status:forcedMeasuredReview?"review":parsed.status,
      colorFidelity:combinedColor,
      patternFidelity:combinedPattern,
      mannequinConsistency:combinedMannequin,
      issue:issue.slice(0,180),
      repairInstruction:repairInstruction.slice(0,180),
      ...(measuredColorDeltaE?{measuredColorDeltaE}:{}),
      ...(measuredPatternOrientation?{measuredPatternOrientation}:{}),
      ...(protectedRegionChange!==null?{protectedRegionChange,protectedRegionStatus}:{}),
    };
  } catch {
    const deterministicAvailable=codeColorStatus!=="unavailable" || codePatternStatus!=="unavailable" || protectedRegionStatus!=="unavailable";
    const deterministicIssues=[
      measuredColorIssue ? `colour ${measuredColorIssue}` : "",
      measuredPatternIssue ? `pattern ${measuredPatternIssue}` : "",
      protectedRegionIssue,
    ].filter(Boolean).join("; ");
    const deterministicRepair=[
      measuredColorIssue||measuredPatternIssue ? "Restore measured fabric colour, pattern direction and physical scale." : "",
      protectedRegionIssue ? "Restore the locked mannequin and studio outside the garment edit region." : "",
    ].filter(Boolean).join(" ");
    return {
      available:deterministicAvailable,
      status:"review",
      fabricFidelity:"review",
      colorFidelity:codeColorStatus==="unavailable"?"review":codeColorStatus,
      patternFidelity:codePatternStatus==="unavailable"?"review":codePatternStatus,
      boundary:"review",
      construction:"review",
      mannequinConsistency:protectedRegionStatus==="unavailable"?"review":protectedRegionStatus,
      artifact:"minor",
      issue:deterministicAvailable
        ? (deterministicIssues ? `Measured render fidelity needs review (${deterministicIssues}); semantic QA is unavailable.` : "Available deterministic render evidence is within tolerance; semantic QA is unavailable.")
        : "Automatic photoreal QA is unavailable; keep this render for manual review.",
      repairInstruction:deterministicRepair.slice(0,180),
      ...(measuredColorDeltaE?{measuredColorDeltaE}:{}),
      ...(measuredPatternOrientation?{measuredPatternOrientation}:{}),
      ...(protectedRegionChange!==null?{protectedRegionChange,protectedRegionStatus}:{}),
    };
  }
}

function semanticCheckNeedsReview(check:SemanticCreativeCheck) {
  return check.status==="review" ||
    check.hierarchy==="weak" ||
    check.proportion==="weak" ||
    check.fidelity==="weak" ||
    check.heroAccuracy==="weak" ||
    check.fabricFidelity==="weak" ||
    check.boundary==="weak" ||
    check.supportCompetition==="major" ||
    check.artifact==="major";
}

function semanticCheckSevere(check:SemanticCreativeCheck) {
  return check.heroAccuracy==="weak" ||
    check.fabricFidelity==="weak" ||
    check.boundary==="weak" ||
    check.artifact==="major";
}

async function semanticCreativeRenderCheck(
  outputUrl:string,
  referenceDataUri:string,
  fabricContext:string|undefined,
  input:CreativeFashnRequest,
  previousOutputUrl?:string,
):Promise<SemanticCreativeCheck|null> {
  const token=gatewayAuthToken();
  if(!token || !OFFICIAL_FASHN_OUTPUT.test(outputUrl)) return null;
  const hero=[...input.creative.treatments].sort((a,b)=>b.intensity-a.intensity)[0];
  const support=[...input.creative.treatments].sort((a,b)=>b.intensity-a.intensity).slice(1,4);
  const prompt=[
    "You are a diagnostic menswear visual critic. Judge only whether this rendered image expresses the supplied design specification clearly and coherently.",
    "Do not decide whether the fashion is objectively good or bad. Do not reward conventionality merely because it is familiar.",
    `Concept: ${input.creative.name}. Thesis: ${input.creative.thesis}`,
    hero ? `Hero move: ${hero.zone} / ${hero.label}. ${hero.instruction}. Intended purpose: ${hero.visualPurpose}.` : "",
    support.map((move)=>`Support move: ${move.zone} / ${move.label}. ${move.instruction}.`).join(" "),
    input.creative.pattern ? `Pattern: ${input.creative.pattern.name}; ${input.creative.pattern.layout}; placement: ${input.creative.pattern.placement}.` : "",
    `Base cut: ${input.style.collar}; ${input.style.cuff}; ${input.style.placket}; ${input.style.shirtFit}; ${input.style.shirtWear}; ${input.style.trouser}.`,
    previousOutputUrl
      ? "You receive four visual references in this order: CURRENT GENERATED RENDER, PREVIOUS FAILED/REVIEW RENDER, LOCKED STUDIO REFERENCE, then (when present) SPLIT FABRIC CONTEXT with shirt on the left and trouser on the right."
      : "You receive three visual references in this order: GENERATED RENDER, LOCKED STUDIO REFERENCE, then (when present) SPLIT FABRIC CONTEXT with shirt on the left and trouser on the right.",
    previousOutputUrl
      ? "Compare the current render with the previous failed/review render. Reward a targeted fix only when the cited problem visibly improved without damaging fabric fidelity, boundaries or the hero hierarchy."
      : "Compare them rather than judging the generated render in isolation.",
    "Check: (1) the hero detail is visibly and geometrically expressed, (2) proportion is intentional, (3) supporting details do not compete, (4) the render follows the supplied concept instead of normalizing it, (5) shirt/trouser fabric appearance remains faithful to the supplied swatches, (6) protected areas and garment boundaries remain stable relative to the locked studio reference, (7) there are no obvious synthesis artifacts.",
    "A concept may be unconventional and still pass. Fail it for unclear execution, fidelity loss, proportion failure, competing hierarchy, or rendering artifacts—not merely because it is unusual.",
    "If review is needed, choose the single most useful redesign reason. Keep issue under 140 characters."
  ].filter(Boolean).join("\n");

  const schema={
    type:"object",
    properties:{
      status:{type:"string",enum:["pass","review"]},
      hierarchy:{type:"string",enum:["strong","review","weak"]},
      proportion:{type:"string",enum:["strong","review","weak"]},
      fidelity:{type:"string",enum:["strong","review","weak"]},
      heroAccuracy:{type:"string",enum:["strong","review","weak"]},
      fabricFidelity:{type:"string",enum:["strong","review","weak"]},
      boundary:{type:"string",enum:["strong","review","weak"]},
      supportCompetition:{type:"string",enum:["none","minor","major"]},
      artifact:{type:"string",enum:["none","minor","major"]},
      redesignReason:{type:"string",enum:["visual_balance","too_busy","too_safe","pattern_detail","proportion","originality","render_mismatch","other"]},
      improvement:{type:"string",enum:["improved","same","worse","not_applicable"]},
      issue:{type:"string",maxLength:140},
    },
    required:["status","hierarchy","proportion","fidelity","heroAccuracy","fabricFidelity","boundary","supportCompetition","artifact","redesignReason","improvement","issue"],
    additionalProperties:false,
  };

  const runModel=async(model:string):Promise<SemanticCreativeCheck|null>=>{
    try {
      const response=await fetch("https://ai-gateway.vercel.sh/v1/responses",{
        method:"POST",
        headers:{
          authorization:`Bearer ${token}`,
          "content-type":"application/json",
        },
        body:JSON.stringify({
          model,
          input:[{
            role:"user",
            content:[
              {type:"input_text",text:prompt},
              {type:"input_image",image_url:outputUrl,detail:"auto"},
              ...(previousOutputUrl?[{type:"input_image",image_url:previousOutputUrl,detail:"auto"}]:[]),
              {type:"input_image",image_url:referenceDataUri,detail:"auto"},
              ...(fabricContext?[{type:"input_image",image_url:fabricContext,detail:"auto"}]:[]),
            ],
          }],
          text:{
            format:{
              type:"json_schema",
              name:"linen_creative_render_critic",
              strict:true,
              schema,
            },
          },
        }),
        cache:"no-store",
        signal:AbortSignal.timeout(12_000),
      });
      if(!response.ok) return null;
      const raw=await response.json() as unknown;
      const text=gatewayOutputText(raw);
      if(!text) return null;
      const parsed=JSON.parse(text) as SemanticCreativeCheck;
      if(!["pass","review"].includes(parsed.status)) return null;
      return {
        ...parsed,
        issue:String(parsed.issue||"").replace(/\s+/g," ").trim().slice(0,140),
      };
    } catch {
      return null;
    }
  };

  const models=visualCriticModels();
  const primary=await runModel(models[0]);
  if(!primary && models[1]) return runModel(models[1]);
  if(!primary) return null;
  if(!semanticCheckNeedsReview(primary) || !models[1]) return primary;

  // A second independent visual critic is only spent on a disputed/failed render.
  // Two critics must agree on ordinary visual problems before we spend another FASHN render.
  const secondary=await runModel(models[1]);
  if(!secondary) return primary;
  const primaryReview=semanticCheckNeedsReview(primary);
  const secondaryReview=semanticCheckNeedsReview(secondary);
  if(primaryReview && secondaryReview) {
    const preferred=semanticCheckSevere(primary) && !semanticCheckSevere(secondary) ? primary
      : semanticCheckSevere(secondary) && !semanticCheckSevere(primary) ? secondary
        : primary;
    return {
      ...preferred,
      status:"review",
      issue:[primary.issue,secondary.issue].filter(Boolean).filter((value,index,all)=>all.indexOf(value)===index).join(" / ").slice(0,140),
    };
  }
  if(semanticCheckSevere(primary) && !secondaryReview) return primary;

  return {
    ...secondary,
    status:"pass",
    issue:"Visual critics disagreed; no automatic rerender without stronger evidence.",
  };
}

function selectedLookPhysicalEvidence(input:SelectedLookFashnRequest) {
  const line=(label:string,value:SelectedLookFabricRenderEvidence|undefined)=>{
    if(!value) return `${label}: no verified physical evidence; do not invent GSM, fibre or real drape.`;
    const facts:string[]=[];
    if(value.measuredColorHex) facts.push(`code-measured visible colour ${value.measuredColorHex}`);
    if(Number.isFinite(value.measurementQuality)) facts.push(`source image quality ${Math.round(value.measurementQuality as number)}/100`);
    if(Number.isFinite(value.patternContrastDeltaE)) facts.push(`code-measured pattern contrast delta-E ${value.patternContrastDeltaE}`);
    if(value.patternOrientation && value.patternOrientation!=="uncertain") facts.push(`code-measured pattern orientation ${value.patternOrientation}`);
    if(Number.isFinite(value.gsm)) facts.push(`${value.gsm} GSM verified`);
    if(value.drape) facts.push(`${value.drape} drape class verified`);
    if(value.fiberContent) facts.push(`verified fibre ${value.fiberContent}`);
    if(Number.isFinite(value.repeatMm)) facts.push(`verified pattern repeat ${value.repeatMm} mm`);
    if(Number.isFinite(value.stripeWidthMm)) facts.push(`verified stripe width ${value.stripeWidthMm} mm`);
    if(value.physicalScaleStatus==="unknown") facts.push("physical pattern scale is unverified");
    return `${label}: ${facts.length?facts.join(", "):"no verified physical evidence; do not invent physical properties"}.`;
  };
  return [line("shirt",input.renderEvidence?.shirt),line("trouser",input.renderEvidence?.pant)].join(" ");
}

function selectedLookConstruction(input:SelectedLookFashnRequest) {
  return input.styleSpec
    ? styleSpecRenderSummary(input.styleSpec)
    : `${input.style.collar}; ${input.style.cuff}; ${input.style.placket}; ${input.style.shirtFit}; ${input.style.shirtWear}; ${input.style.trouser}; ${input.style.rise}; ${input.style.waistband}; ${input.style.break}`;
}

function selectedLookPrompt(input:SelectedLookFashnRequest,usedLockedPreview=false) {
  const safe=(value:unknown,limit=360)=>String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
  const sourceContract=usedLockedPreview
    ? "The edit source is the customer's deterministic locked live preview. Treat its mannequin identity, pose, garment boundaries, tuck layering, silhouette, cloth placement and visible pattern geometry as the primary visual contract. Add photographic realism without replacing or reinterpreting that layout."
    : "The edit source is the canonical Linen Earth studio photograph. Preserve its mannequin identity, pose, body proportions, camera angle, studio lighting and deep navy environment.";
  return `Edit this existing premium menswear studio photograph into the exact Linen Earth outfit configured by the customer. ${sourceContract}

The image-context is split vertically: LEFT HALF is the exact shirt-fabric reference; RIGHT HALF is the exact trouser-fabric reference. Use those references only for their matching garments.

Shirt: ${safe(input.shirt.name)} ${safe(input.shirt.line)}, ${safe(input.shirt.patternType)}.
Trousers: ${safe(input.pant.name)} ${safe(input.pant.line)}, ${safe(input.pant.patternType)}.
Exact locked construction: ${safe(selectedLookConstruction(input),900)}.
Body/model target: ${input.bodyProfile ? safe(bodyProfileRenderSummary(input.bodyProfile),220) : "preserve the existing model proportions and exposed skin tone"}.
Verified render evidence: ${safe(selectedLookPhysicalEvidence(input),700)}.
When a repeat or stripe width is verified, preserve its apparent scale consistently across the garment and across future views. If physical scale is unknown, do not make an exact-scale claim.

This is a fidelity render, not a redesign. Do not invent contrast panels, embroidery, piping, extra pockets, extra seams, prints, logos or decorative details. Preserve the configured collar, cuffs, placket, shirt fit, tuck state, trouser shape, rise, waistband and break. Keep natural linen weave, realistic folds and tailoring structure. Shirt fabric must remain inside the shirt silhouette and must not spill over the neck, hands, trouser waistband or background. Trouser fabric must remain inside the trouser silhouette. For a tucked shirt, the waistband must sit physically in front of the tucked shirt. Keep the mannequin fully faceless with no eyes, hair or facial features. No text, props, extra garments or cropped limbs. Full-body front fashion-catalogue photograph.`;
}

function selectedLookViewPrompt(input:SelectedLookFashnRequest,view:Exclude<SelectedLookView,"front">) {
  const safe=(value:unknown,limit=260)=>String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
  const camera=view==="three-quarter"
    ? "Rotate the same mannequin to a natural three-quarter catalogue angle, about 35 degrees from front."
    : view==="side"
      ? "Rotate the same mannequin to a clean full-body side profile."
      : "Rotate the same mannequin to a clean full-body back view.";
  return `Create the ${view} view of this exact Linen Earth outfit using the supplied front render as the identity and garment reference. ${camera}

Do not redesign the outfit. Preserve the exact same faceless mannequin, body proportions, shirt fabric, trouser fabric, colour balance, weave character, collar, cuff, placket, shirt fit, tuck state, trouser shape, rise, waistband, break, shoes, lighting and deep navy studio environment.

Shirt: ${safe(input.shirt.name)} ${safe(input.shirt.line)}, ${safe(input.shirt.patternType)}.
Trousers: ${safe(input.pant.name)} ${safe(input.pant.line)}, ${safe(input.pant.patternType)}.
Locked construction: ${safe(selectedLookConstruction(input),900)}.
Body/model target: ${input.bodyProfile ? safe(bodyProfileRenderSummary(input.bodyProfile),220) : "preserve the existing model proportions and exposed skin tone"}.
Verified render evidence: ${safe(selectedLookPhysicalEvidence(input),700)}.
Preserve any verified repeat/stripe scale from the approved front render; never invent a physical scale when it is unknown.

Keep hard garment boundaries. Shirt fabric must not spill onto the neck, hands, waistband, trousers or background. Trouser fabric must remain inside the trouser silhouette. For a tucked shirt, preserve the waistband physically in front of the shirt. Keep the mannequin completely faceless. No text, logo, extra props, new garments or cropped limbs. Full-body premium menswear catalogue photograph.`;
}

function creativeConceptPrompt(input:CreativeFashnRequest) {
  const safe=(value:unknown,limit=360)=>String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
  const orderedMoves=[...input.creative.treatments].sort((a,b)=>b.intensity-a.intensity).slice(0,6);
  const heroMove=orderedMoves[0];
  const moves=orderedMoves.map((move,index)=>
    `${index+1}. ${index===0?"HERO":"SUPPORT"} / ${safe(move.zone,40)} — ${safe(move.label,100)}; intensity ${Math.max(1,Math.min(100,Number(move.intensity)||50))}/100; construction ${safe(move.buildability,30)}. Instruction: ${safe(move.instruction,360)} Visual purpose: ${safe(move.visualPurpose,200)}.`
  ).join(" ");
  const protectedZones=["face/head","hands","neck opening","trouser waistband over a tucked shirt","background","shoes"];
  const priorRenderCaution=input.creative.renderRisk==="high"
    ? "Previous renders of this idea family have often under-expressed the design. Make the HERO geometry unmistakable, simplify supporting changes, and preserve clean boundaries."
    : input.creative.renderRisk==="moderate"
      ? "This idea family has mixed render reliability. Prioritize the HERO geometry before any supporting surface treatment."
      : "";
  const learnedRenderEdit=input.creative.renderCaution==="proportion"
    ? "Prior attempts struggled with proportion. Preserve the intended scale relationship exactly; do not shrink or normalize the hero geometry."
    : input.creative.renderCaution==="pattern_detail"
      ? "Prior attempts lost the pattern/detail logic. Keep motif placement, scale and protected empty zones clearly visible."
      : input.creative.renderCaution==="too_busy"
        ? "Prior attempts became visually busy. Preserve the hero move and suppress any unrequested secondary decoration."
        : input.creative.renderCaution==="visual_balance"
          ? "Prior attempts lost visual balance. Keep the hero dominant while maintaining deliberate quiet space around it."
          : input.creative.renderCaution==="render_mismatch"
            ? "Prior attempts did not match the specification. Follow the written construction and placement instructions literally before adding realism."
            : "";
  const renderHierarchy=heroMove
    ? `Visual hierarchy contract: the clear focal move is ${safe(heroMove.label,100)} on the ${safe(heroMove.zone,40)}. Render it unmistakably. Supporting moves must remain visibly subordinate. Preserve quiet fabric around the focal detail so the concept reads in one glance. ${priorRenderCaution} ${learnedRenderEdit}`
    : `Keep one dominant visual idea and preserve quiet surrounding cloth. ${priorRenderCaution} ${learnedRenderEdit}`;
  const repairInstruction=input.creative.repairInstruction
    ? `Previous render QA correction: ${safe(input.creative.repairInstruction,420)}. Fix this exact rendering failure while preserving the concept, fabric references, pose and every unrelated successful detail. Do not make the design safer or more conventional to hide the failure.`
    : "";
  const pattern=input.creative.pattern
    ? `Generated surface concept: ${safe(input.creative.pattern.name,100)}. Family ${safe(input.creative.pattern.family,50)}, ${safe(input.creative.pattern.scale,40)} scale, about ${Math.max(0,Math.min(60,Number(input.creative.pattern.coverage)||0))}% intended coverage. Layout: ${safe(input.creative.pattern.layout,420)} Placement: ${safe(input.creative.pattern.placement,260)}. The image-context is split vertically: LEFT HALF is the exact shirt-fabric reference; RIGHT HALF is the exact trouser-fabric reference. Use the generated motif logic on the shirt only where specified, while preserving the underlying cloth colour and woven character.`
    : "The image-context is split vertically: LEFT HALF is the exact shirt-fabric reference; RIGHT HALF is the exact trouser-fabric reference.";

  return `Edit this existing premium menswear studio photograph into the selected Linen Earth Creative Lab concept. Preserve the same faceless male mannequin, pose, body proportions, camera angle, deep navy studio environment and realistic tailoring quality. Keep the outfit physically believable and premium, but the DESIGN APPEARANCE is the priority.

Base shirt: ${safe(input.shirt.name)} ${safe(input.shirt.line)}, ${safe(input.shirt.patternType)}. Base trousers: ${safe(input.pant.name)} ${safe(input.pant.line)}, ${safe(input.pant.patternType)}.
Supported base cut: ${safe(input.style.collar)}, ${safe(input.style.cuff)}, ${safe(input.style.placket)}, ${safe(input.style.shirtFit)}, ${safe(input.style.shirtWear)}, ${safe(input.style.trouser)}, ${safe(input.style.rise)}, ${safe(input.style.waistband)}, ${safe(input.style.break)}.

Creative concept: ${safe(input.creative.name)}. Thesis: ${safe(input.creative.thesis,420)}.
${renderHierarchy}
${repairInstruction}
Design moves: ${moves}
${pattern}

Render the custom visual details as geometry and construction, not merely as colour changes. First satisfy the HERO move exactly, then add supporting moves only where specified. If a move changes cuff depth, collar proportion, pocket geometry, panel placement, border position, fastening axis or line rhythm, visibly change that garment detail while keeping the rest controlled. Do not average an unconventional design back into a normal shirt or trouser.

Protected zones that must not be recoloured or redesigned: ${protectedZones.join(", ")}. Do not add random decorations, embroidery, piping, pockets, seams, buttons or prints that are not in the concept. Preserve natural seams, folds, drape and hard garment boundaries. Shirt fabric must never spill over the neck, hands, trouser waistband or background. Trouser fabric must remain inside the trouser silhouette. For a tucked shirt, the waistband must sit physically in front of the tucked shirt. Keep the mannequin fully faceless with no eyes, hair or facial features. No text, logos, props, extra garments or cropped limbs. Full-body front fashion-catalogue photograph.`;
}

type SelectedRenderCacheEntry={result:CreativeFashnResult;createdAt:number};
type SelectedRenderCache={items:Map<string,SelectedRenderCacheEntry>};
const selectedRenderCache=(globalThis as typeof globalThis & {__linenSelectedRenderCache?:SelectedRenderCache}).__linenSelectedRenderCache
  ||= {items:new Map<string,SelectedRenderCacheEntry>()};

function selectedLookCacheKey(input:SelectedLookFashnRequest) {
  return selectedLookRenderCacheKey(input,"front");
}

export function getCachedSelectedLookRender(input:SelectedLookFashnRequest) {
  const key=selectedLookCacheKey(input);
  const entry=selectedRenderCache.items.get(key);
  if(!entry) return null;
  if(Date.now()-entry.createdAt>6*60*60_000) {
    selectedRenderCache.items.delete(key);
    return null;
  }
  selectedRenderCache.items.delete(key);
  selectedRenderCache.items.set(key,entry);
  return {...entry.result,cached:true};
}

function storeSelectedRender(input:SelectedLookFashnRequest,result:CreativeFashnResult) {
  const key=selectedLookCacheKey(input);
  selectedRenderCache.items.set(key,{result:{...result,cached:false},createdAt:Date.now()});
  while(selectedRenderCache.items.size>32) {
    const oldest=selectedRenderCache.items.keys().next().value;
    if(!oldest) break;
    selectedRenderCache.items.delete(oldest);
  }
}

export async function renderSelectedLookFashnFront(input:SelectedLookFashnRequest):Promise<CreativeFashnResult> {
  if(input.locked!==true) throw new FashnVisualizationError("Lock the final design before using the photoreal renderer.","invalid_source");
  const cached=getCachedSelectedLookRender(input);
  if(cached) return cached;
  const {source,usedLockedPreview}=await validatedLockedPreviewSource(input);
  const [context,garmentMask]=await Promise.all([
    creativeFabricContext(input.shirt.image,input.pant.image),
    selectedLookGarmentEditMask(input.style),
  ]);
  const generated=await runEdit(source,selectedLookPrompt(input,usedLockedPreview),context,garmentMask);
  const result:CreativeFashnResult={
    image:generated.output,
    jobId:generated.jobId,
    creditsUsed:generated.creditsUsed,
    conceptId:usedLockedPreview?"selected-look-locked-preview":"selected-look",
    generatedAt:new Date().toISOString(),
    cached:false,
  };
  storeSelectedRender(input,result);
  return result;
}


export async function repairSelectedLookFashnFront(
  input:SelectedLookFashnRequest,
  previousImage:string,
  repairInstruction:string,
):Promise<CreativeFashnResult> {
  if(!OFFICIAL_FASHN_OUTPUT.test(previousImage)) {
    throw new FashnVisualizationError("A trusted photoreal front render is required before repair.","invalid_source");
  }
  const instruction=String(repairInstruction||"").replace(/\s+/g," ").trim().slice(0,240);
  if(!instruction) throw new FashnVisualizationError("A focused QA repair instruction is required.","invalid_source");
  const context=await creativeFabricContext(input.shirt.image,input.pant.image);
  const prompt=`Repair this existing Linen Earth photoreal render without redesigning it. QA defect to fix: ${instruction}

Preserve the same faceless mannequin, pose, camera, body proportions, exposed skin tone, deep navy studio, shirt fabric, trouser fabric, footwear and every successful garment detail. Required construction remains ${selectedLookConstruction(input)}. Body/model target remains ${input.bodyProfile ? bodyProfileRenderSummary(input.bodyProfile) : "the existing model"}.

Use the supplied split fabric context only to restore the exact shirt and trouser cloth appearance. Fix the cited defect locally. Do not add styling ideas, decorative seams, contrast panels, prints, logos, props or extra garments. Keep cloth off the neck, hands, background and neighbouring garment. If tucked, keep the waistband physically in front of the shirt. Full-body front catalogue photograph.`;
  const generated=await runEdit(previousImage,prompt,context);
  const result:CreativeFashnResult={
    image:generated.output,
    jobId:generated.jobId,
    creditsUsed:generated.creditsUsed,
    conceptId:"selected-look-repair",
    generatedAt:new Date().toISOString(),
  };
  // A repair replaces the stale in-memory front result for this exact locked
  // design identity; otherwise a later cache hit could resurrect the defect.
  storeSelectedRender(input,result);
  return result;
}

export async function renderSelectedLookFashnView(
  input:SelectedLookFashnRequest,
  frontImage:string,
  view:Exclude<SelectedLookView,"front">,
):Promise<CreativeFashnResult> {
  if(!OFFICIAL_FASHN_OUTPUT.test(frontImage)) {
    throw new FashnVisualizationError("Generate the photoreal front view first.", "invalid_source");
  }
  const context=await creativeFabricContext(input.shirt.image,input.pant.image);
  const generated=await runEdit(frontImage,selectedLookViewPrompt(input,view),context);
  return {
    image:generated.output,
    jobId:generated.jobId,
    creditsUsed:generated.creditsUsed,
    conceptId:`selected-look-${view}`,
    generatedAt:new Date().toISOString(),
  };
}

export async function renderCreativeFashnFront(input:CreativeFashnRequest):Promise<CreativeFashnResult> {
  const source=await creativeModelDataUri(input.style);
  const context=await creativeFabricContext(input.shirt.image,input.pant.image);
  const generated=await runEdit(source,creativeConceptPrompt(input),context);
  return {
    image:generated.output,
    jobId:generated.jobId,
    creditsUsed:generated.creditsUsed,
    conceptId:input.creative.id,
    generatedAt:new Date().toISOString(),
  };
}

export async function inspectCreativeFashnOutput(
  outputUrl:string,
  input:CreativeFashnRequest,
  previousOutputUrl?:string,
):Promise<CreativeRenderVisualCheck> {
  if(!OFFICIAL_FASHN_OUTPUT.test(outputUrl)) throw new FashnVisualizationError("Generated render URL is not trusted.","invalid_source");
  if(previousOutputUrl && !OFFICIAL_FASHN_OUTPUT.test(previousOutputUrl)) throw new FashnVisualizationError("Previous render URL is not trusted.","invalid_source");
  const [source,fabricContext]=await Promise.all([
    creativeModelDataUri(input.style),
    creativeFabricContext(input.shirt.image,input.pant.image),
  ]);
  const heuristic=await inspectCreativeRender(source,outputUrl,input);
  const previousHeuristic=previousOutputUrl ? await inspectCreativeRender(source,previousOutputUrl,input) : null;
  const semantic=await semanticCreativeRenderCheck(outputUrl,source,fabricContext,input,previousOutputUrl);
  if(!semantic) {
    if(!previousHeuristic?.evidenceAvailable) return {...heuristic,improvement:"not_applicable"};
    const currentQuality=heuristic.heroVisibility+heuristic.boundaryIntegrity-heuristic.protectedChange;
    const previousQuality=previousHeuristic.heroVisibility+previousHeuristic.boundaryIntegrity-previousHeuristic.protectedChange;
    const delta=currentQuality-previousQuality;
    return {...heuristic,improvement:delta>12?"improved":delta<-8?"worse":"same"};
  }

  const semanticNeedsReview=semanticCheckNeedsReview(semantic);

  const notes=[
    ...heuristic.notes,
    ...(semantic.issue?[semantic.issue]:[]),
  ].slice(0,3);

  return {
    ...heuristic,
    status:(heuristic.evidenceAvailable && heuristic.status==="review") || semanticNeedsReview ? "review" : "pass",
    notes,
    evidenceAvailable:true,
    semanticAvailable:true,
    semanticStatus:semanticNeedsReview?"review":"pass",
    semanticIssue:semantic.issue,
    redesignReason:semanticNeedsReview ? semantic.redesignReason : undefined,
    improvement:previousOutputUrl ? semantic.improvement : "not_applicable",
  };
}

async function runEdit(image: string, prompt: string, imageContext?: string, mask?: string) {
  // FASHN Edit currently derives output geometry from the source image; its
  // documented input contract does not expose an aspect-ratio override. Keep
  // the locked model framing intact instead of forcing a separate 4:5 reframe.
  const response = await fashnClient().predictions.subscribe({
    model_name: "edit",
    inputs: {
      image,
      prompt,
      image_context: imageContext,
      mask,
      resolution: "1k",
      generation_mode: "balanced",
      num_images: 1,
      // Final renders are quality assets and feed later view/repair steps. PNG avoids
      // another lossy generation without changing the requested model resolution.
      output_format: "png",
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
  const swatch = await stockSwatchDataUri(base.spec.fabric.swatchImageUrl);
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
  const swatch = await stockSwatchDataUri(canonical.spec.fabric.swatchImageUrl);
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
