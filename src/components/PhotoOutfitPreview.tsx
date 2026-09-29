"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignerFabric, DesignerStyle } from "@/lib/designer/engine";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import { CREATIVE_FEEDBACK_REASONS, type CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import {
  DESIGNER_PHOTO_TEMPLATES, PHOTO_COLLAR_MASK, PHOTO_CUFF_MASK, PHOTO_TUCKED_COLLAR_MASK, PHOTO_TUCKED_COLLAR_STAND_MASK,
  PHOTO_TUCKED_CUFF_MASK, PHOTO_TUCKED_NECK_CLEAR, PHOTO_TUCKED_SHIRT_CLIP, PHOTO_TUCKED_TROUSER_CLIP,
  PHOTO_TUCKED_SHIRT_BODY_CLIP, PHOTO_TUCKED_LEFT_SLEEVE_CLIP, PHOTO_TUCKED_RIGHT_SLEEVE_CLIP,
  PHOTO_TUCKED_LEFT_TROUSER_CLIP, PHOTO_TUCKED_RIGHT_TROUSER_CLIP,
  photoTemplateForStyle, photoTemplateGaps, previewFabricLabel,
} from "@/lib/designer/photo-preview";

const WIDTH = 1024;
const HEIGHT = 1536;
const images = new Map<string, Promise<HTMLImageElement>>();
const fabricTiles = new Map<string, HTMLCanvasElement>();
const featheredMasks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const tuckedMasks = new WeakMap<HTMLImageElement, { shirt: HTMLCanvasElement; pant: HTMLCanvasElement }>();
const untuckedMasks = new WeakMap<HTMLImageElement, { shirt: HTMLCanvasElement; pant: HTMLCanvasElement }>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = images.get(url);
  if (cached) return cached;
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
  images.set(url, loading);
  void loading.catch(() => { images.delete(url); });
  return loading;
}

function swatchTile(image: HTMLImageElement, fabric: DesignerFabric): HTMLCanvasElement {
  const cached = fabricTiles.get(fabric.id);
  if (cached) {
    fabricTiles.delete(fabric.id);
    fabricTiles.set(fabric.id, cached);
    return cached;
  }
  const tile = document.createElement("canvas");
  tile.width = 320;
  tile.height = 320;
  const context = tile.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = fabric.hex;
  context.fillRect(0, 0, 320, 320);

  // Read the actual upper cloth field. The catalogue HEX is an approximate
  // fallback, not a substitute for the swatch colour and woven texture.
  const plain = fabric.patternType === "Solid";
  const stripe = /stripe/i.test(fabric.patternType);
  if (plain || stripe) {
    const sourceX = image.width * (plain ? .35 : .31);
    const sourceY = image.height * (plain ? .22 : .16);
    const sourceWidth = image.width * (plain ? .3 : .38);
    const sourceHeight = image.height * (plain ? .22 : .27);
    // Mirroring only solid weaves and straight stripes joins tile edges. It
    // leaves irregular prints unmirrored, since reflection would invent motifs.
    for (const [column, row] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      context.save();
      context.translate(column * 160, row * 160);
      context.scale(column ? -1 : 1, row ? -1 : 1);
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight,
        column ? -160 : 0, row ? -160 : 0, 160, 160);
      context.restore();
    }
  }
  if (plain) {
    const original = context.getImageData(0, 0, 320, 320);
    const soft = document.createElement("canvas");
    soft.width = 368;
    soft.height = 368;
    const softContext = soft.getContext("2d");
    if (!softContext) throw new Error("Canvas is unavailable.");
    softContext.filter = "blur(12px)";
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      softContext.drawImage(tile, 24 + x * 320, 24 + y * 320);
    }
    const blurred = softContext.getImageData(24, 24, 320, 320).data;
    const mean = [0, 0, 0];
    for (let index = 0; index < original.data.length; index += 4) {
      for (let channel = 0; channel < 3; channel++) mean[channel] += original.data[index + channel];
    }
    for (let channel = 0; channel < 3; channel++) mean[channel] /= 320 * 320;
    // Remove broad swatch-photo shadows and old creases while preserving
    // fine woven detail. The mirrored edges blend without a painted stripe.
    for (let index = 0; index < original.data.length; index += 4) {
      for (let channel = 0; channel < 3; channel++) {
        original.data[index + channel] = Math.round(mean[channel] +
          (original.data[index + channel] - blurred[index + channel]) * .22);
      }
    }
    context.putImageData(original, 0, 0);
  } else if (!stripe) {
    context.drawImage(image, image.width * .08, image.height * .06,
      image.width * .84, image.height * .62, 0, 0, 320, 320);
  }
  fabricTiles.set(fabric.id, tile);
  if (fabricTiles.size > 12) {
    const oldest = fabricTiles.keys().next().value;
    if (oldest) fabricTiles.delete(oldest);
  }
  return tile;
}

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }

function patternScaleForFabric(fabric: DesignerFabric) {
  const pattern = fabric.patternType.toLowerCase();
  if (pattern === "solid") return .82;
  if (/micro|fine|pinstripe/.test(pattern)) return .9;
  if (/stripe|check|windowpane/.test(pattern)) return 1.02;
  if (/floral|botanical|leaf|geometric|mosaic|chevron|abstract|block/.test(pattern)) return 1.12;
  return 1;
}

function featherMaskInside(mask: HTMLCanvasElement, blurPx = 1.6) {
  const cached = featheredMasks.get(mask);
  if (cached) return cached;

  const feathered = document.createElement("canvas");
  feathered.width = WIDTH;
  feathered.height = HEIGHT;
  const context = feathered.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");

  // Blur the alpha edge, then intersect it with the original mask. This makes
  // the edge softer only on the garment side; no alpha is allowed to spread
  // onto the mannequin, neck, studio floor or neighbouring garment.
  context.filter = `blur(${blurPx}px)`;
  context.drawImage(mask, 0, 0);
  context.filter = "none";
  context.globalCompositeOperation = "destination-in";
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = "source-over";
  featheredMasks.set(mask, feathered);
  return feathered;
}


// The tucked photo has dark, cool shirting and warm trousers. Separate them
// by their photographed colour, so cloth never spills onto arms, neck, the
// studio set, or through the gap between the legs.
function tuckedGarmentMasks(photo: HTMLImageElement) {
  const cached = tuckedMasks.get(photo);
  if (cached) return cached;
  const source = document.createElement("canvas");
  source.width = WIDTH; source.height = HEIGHT;
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  const mask = (region: "shirt" | "pant") => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    const data = ctx.createImageData(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      if (region === "shirt" && (y < 188 || y > 705 || x < 270 || x > 748)) continue;
      if (region === "pant" && (y < 541 || y > 1360 || x < 342 || x > 680)) continue;
      const i = (y * WIDTH + x) * 4;
      const red = pixels[i], green = pixels[i + 1], blue = pixels[i + 2];
      const opacity = region === "shirt"
        ? clamp((Math.min(green - red, blue - red - 1) - 1) / 4) * clamp((165 - Math.max(red, green, blue)) / 35)
        : clamp((Math.min(red - green - 3, red - blue - 5)) / 7) * clamp((195 - red) / 12);
      data.data[i] = 255;
      data.data[i + 1] = 255;
      data.data[i + 2] = 255;
      data.data[i + 3] = Math.round(opacity * 255);
    }
    ctx.putImageData(data, 0, 0);

    // Keep the adaptive colour mask for folds and antialiasing, but intersect
    // it with the photographed garment silhouette so similar colours in the
    // studio or mannequin can never receive fabric.
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "#fff";
    ctx.fill(new Path2D(region === "shirt" ? PHOTO_TUCKED_SHIRT_CLIP : PHOTO_TUCKED_TROUSER_CLIP));

    if (region === "shirt") {
      // The collar is composited separately below. Clearing the photographed
      // neck opening here prevents cloth from painting over the mannequin.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill(new Path2D(PHOTO_TUCKED_NECK_CLEAR));
    }
    ctx.globalCompositeOperation = "source-over";
    return canvas;
  };
  const result = { shirt: mask("shirt"), pant: mask("pant") };
  tuckedMasks.set(photo, result);
  return result;
}

// On the older neutral photograph the shirt, floor and trousers are similar
// colours. Start with separate tight garment outlines, then use the source
// brightness to discard the pale neck, floor and space between the legs.
function untuckedGarmentMasks(photo: HTMLImageElement, shirtPath: string, pantPath: string) {
  const cached = untuckedMasks.get(photo);
  if (cached) return cached;
  const source = document.createElement("canvas");
  source.width = WIDTH; source.height = HEIGHT;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Canvas is unavailable.");
  sourceContext.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  const pixels = sourceContext.getImageData(0, 0, WIDTH, HEIGHT).data;
  function prepare(path: string, region: "shirt" | "pant") {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable.");
    context.fillStyle = "white";
    context.fill(new Path2D(path));
    const result = context.getImageData(0, 0, WIDTH, HEIGHT);
    for (let y = region === "shirt" ? 180 : 675; y < (region === "shirt" ? 716 : 1360); y++) {
      for (let x = region === "shirt" ? 275 : 345; x < (region === "shirt" ? 743 : 681); x++) {
        const i = (y * WIDTH + x) * 4;
        if (!result.data[i + 3]) continue;
        const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        // The neutral cloth itself has bright folds. Only the neck opening
        // needs skin rejection; the trouser mask rejects the pale floor gap.
        if (region === "pant" || (y < 263 && x > 469 && x < 556)) {
          const limit = region === "pant" ? 229 : 226;
          result.data[i + 3] = Math.round(result.data[i + 3] * clamp((limit - luminance) / 20));
        }
      }
    }
    context.putImageData(result, 0, 0);
    return canvas;
  }
  const result = { shirt: prepare(shirtPath, "shirt"), pant: prepare(pantPath, "pant") };
  untuckedMasks.set(photo, result);
  return result;
}

function drawGarment(
  target: CanvasRenderingContext2D, photo: CanvasImageSource,
  swatch: HTMLImageElement, fabric: DesignerFabric, path: string,
  mask?: HTMLCanvasElement, lightingFilter = "grayscale(1) brightness(1.3) contrast(1.04)",
  placement: { offsetX?: number; offsetY?: number; scale?: number } = {},
) {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  const context = layer.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");

  const tile = swatchTile(swatch, fabric);
  const pattern = context.createPattern(tile, "repeat");
  if (!pattern) throw new Error("Could not prepare the fabric pattern.");
  const scale = patternScaleForFabric(fabric) * (placement.scale ?? 1);
  pattern.setTransform(new DOMMatrix().translate(placement.offsetX ?? 0, placement.offsetY ?? 0).scale(scale));
  context.fillStyle = pattern;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Normalize the neutral studio photo's midtone before multiplying. The cloth
  // retains its photographed hue instead of turning dull or too dark, while
  // the model's creases and seams still shape the result.
  context.globalCompositeOperation = "multiply";
  context.filter = lightingFilter;
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);

  // Reintroduce a small amount of the photograph's high-level seam/fold
  // information after recolouring. Grayscale + soft-light preserves garment
  // construction without bringing the original cloth colour back.
  context.filter = "grayscale(1) contrast(1.22) brightness(1.05)";
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .24;
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  context.globalAlpha = 1;
  context.filter = "none";

  context.globalCompositeOperation = "destination-in";
  if (mask) context.drawImage(featherMaskInside(mask), 0, 0);
  if (path) {
    context.fillStyle = "#fff";
    context.fill(new Path2D(path));
  }
  context.globalCompositeOperation = "source-over";
  target.drawImage(layer, 0, 0);
}

type CreativePreviewSpec = Pick<CreativeDirection,"id"|"name"|"treatments"|"pattern">;

function creativeHas(creative:CreativePreviewSpec|undefined,id:string) {
  return Boolean(creative?.treatments.some((item)=>item.id===id));
}

function clipCreativeLayer(
  context:CanvasRenderingContext2D,
  path:string,
  mask?:HTMLCanvasElement,
) {
  context.globalCompositeOperation="destination-in";
  if(mask) context.drawImage(featherMaskInside(mask),0,0);
  if(path) {
    context.fillStyle="#fff";
    context.fill(new Path2D(path));
  }
  context.globalCompositeOperation="source-over";
}

function drawCreativePattern(
  target:CanvasRenderingContext2D,
  creative:CreativePreviewSpec|undefined,
  path:string,
  mask?:HTMLCanvasElement,
) {
  const pattern=creative?.pattern;
  if(!pattern) return;
  const layer=document.createElement("canvas");
  layer.width=WIDTH; layer.height=HEIGHT;
  const context=layer.getContext("2d");
  if(!context) return;

  const ink=pattern.palette[1] || "#f0ece4";
  const shadow=pattern.palette[2] || "#26384d";
  context.lineCap="round";
  context.lineJoin="round";

  if(pattern.id==="broken-rail-pattern") {
    context.strokeStyle=ink;
    context.globalAlpha=.48;
    context.lineWidth=2.4;
    context.setLineDash([34,18,12,24]);
    for(let x=330;x<=700;x+=72) {
      context.beginPath(); context.moveTo(x,210); context.lineTo(x,720); context.stroke();
      context.beginPath(); context.moveTo(x+12,210); context.lineTo(x+12,720); context.stroke();
    }
    context.setLineDash([]);
  } else if(pattern.id==="offset-grid-pattern") {
    context.strokeStyle=ink;
    context.globalAlpha=.34;
    context.lineWidth=1.6;
    context.setLineDash([28,6]);
    for(let x=318;x<=714;x+=44){context.beginPath();context.moveTo(x,205);context.lineTo(x,730);context.stroke();}
    context.setLineDash([42,10]);
    for(let y=275;y<=700;y+=48){context.beginPath();context.moveTo(290,y);context.lineTo(735,y);context.stroke();}
    context.setLineDash([]);
  } else if(pattern.id==="negative-space-pattern") {
    context.fillStyle=ink;
    context.globalAlpha=.40;
    for(let y=285;y<700;y+=26) {
      for(let x=300;x<730;x+=25) {
        const distance=Math.abs(x-512);
        if(distance<105) continue;
        const threshold=distance>165 ? 1 : 2;
        if(((x+y)/25)%threshold<1) {
          context.beginPath(); context.arc(x,y,distance>170?2.1:1.4,0,Math.PI*2); context.fill();
        }
      }
    }
  } else if(pattern.id==="drift-chevron-pattern") {
    context.strokeStyle=ink;
    context.globalAlpha=.36;
    context.lineWidth=1.5;
    for(let y=275;y<705;y+=30) {
      for(let x=310;x<720;x+=34) {
        const drift=((x-310)/410)*7;
        context.save();
        context.translate(x,y);
        context.rotate(drift*Math.PI/180);
        context.beginPath(); context.moveTo(-7,-3); context.lineTo(0,4); context.lineTo(7,-3); context.stroke();
        context.restore();
      }
    }
  } else if(pattern.id==="edge-code") {
    // Edge Code is intentionally kept off the body; it is drawn on the cuffs
    // after the base shirt so the placement concept stays local.
    return;
  } else {
    context.strokeStyle=shadow;
    context.globalAlpha=.22;
    context.lineWidth=1.4;
    for(let y=280;y<700;y+=34){context.beginPath();context.moveTo(300,y);context.lineTo(730,y);context.stroke();}
  }

  clipCreativeLayer(context,path,mask);
  target.save();
  target.globalCompositeOperation="multiply";
  target.globalAlpha=.78;
  target.drawImage(layer,0,0);
  target.restore();
}

function drawCreativeDetails(
  target:CanvasRenderingContext2D,
  creative:CreativePreviewSpec|undefined,
  tucked:boolean,
  shirtMask?:HTMLCanvasElement,
) {
  if(!creative) return;

  if(creativeHas(creative,"tonal-panel")) {
    const layer=document.createElement("canvas");
    layer.width=WIDTH; layer.height=HEIGHT;
    const ctx=layer.getContext("2d");
    if(ctx) {
      ctx.fillStyle="#17243a";
      ctx.globalAlpha=.16;
      ctx.beginPath();
      ctx.moveTo(365,250); ctx.lineTo(430,228); ctx.lineTo(410,555); ctx.lineTo(382,548); ctx.closePath(); ctx.fill();
      clipCreativeLayer(ctx,tucked?PHOTO_TUCKED_SHIRT_BODY_CLIP:"",shirtMask);
      target.save(); target.globalCompositeOperation="multiply"; target.drawImage(layer,0,0); target.restore();
    }
  }

  if(creativeHas(creative,"collar-line") && tucked) {
    target.save();
    target.strokeStyle="#f4f0e8";
    target.lineWidth=4;
    target.globalAlpha=.88;
    target.stroke(new Path2D(PHOTO_TUCKED_COLLAR_MASK));
    target.restore();
  }

  if(creative?.pattern?.id==="edge-code") {
    const cuffPath=tucked?PHOTO_TUCKED_CUFF_MASK:PHOTO_CUFF_MASK;
    const layer=document.createElement("canvas");
    layer.width=WIDTH; layer.height=HEIGHT;
    const ctx=layer.getContext("2d");
    if(ctx) {
      ctx.strokeStyle=creative.pattern.palette[1] || "#f1ece4";
      ctx.lineWidth=2.3;
      ctx.globalAlpha=.72;
      ctx.setLineDash([10,6,3,7]);
      for(const y of tucked?[665,678]:[674,688]) {
        ctx.beginPath();ctx.moveTo(275,y);ctx.lineTo(342,y);ctx.moveTo(675,y);ctx.lineTo(738,y);ctx.stroke();
      }
      ctx.globalCompositeOperation="destination-in";
      ctx.fill(new Path2D(cuffPath));
      target.save();target.globalCompositeOperation="multiply";target.drawImage(layer,0,0);target.restore();
    }
  }
}

function creativePreviewCoverage(creative?:CreativePreviewSpec) {
  if(!creative) return {visible:[] as string[],specOnly:[] as string[]};
  const visible:string[]=[];
  const specOnly:string[]=[];
  if(creative.pattern) visible.push(`Surface preview · ${creative.pattern.name}`);
  const partiallyVisible=new Set(["extended-white-cuff","quiet-collar-echo","tonal-panel","collar-line","border-cuff","direction-control"]);
  for(const move of creative.treatments) {
    if(partiallyVisible.has(move.id)) visible.push(move.label);
    else specOnly.push(move.label);
  }
  return {visible:[...new Set(visible)],specOnly:[...new Set(specOnly)]};
}

function drawWhiteDetail(target: CanvasRenderingContext2D, photo: HTMLImageElement, path: string, mask?: HTMLCanvasElement, brightness = 1.38) {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  const context = layer.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.fillStyle = "#faf9f5";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.globalCompositeOperation = "multiply";
  context.filter = `grayscale(1) brightness(${brightness}) contrast(1.05)`;
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  context.filter = "none";
  context.globalCompositeOperation = "destination-in";
  context.fill(new Path2D(path));
  if (mask) context.drawImage(mask, 0, 0);
  target.drawImage(layer, 0, 0);
}

export function composePhotoOutfit(
  context: CanvasRenderingContext2D, modelPhoto: HTMLImageElement, trouserPhoto: HTMLImageElement,
  shirtImage: HTMLImageElement, pantImage: HTMLImageElement,
  shirt: DesignerFabric, pant: DesignerFabric, style: DesignerStyle,
  creative?: CreativePreviewSpec,
) {
  const template = DESIGNER_PHOTO_TEMPLATES[photoTemplateForStyle(style)];
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(modelPhoto, 0, 0, WIDTH, HEIGHT);
  const tucked = style.shirtWear === "Tucked";
  if (tucked) {
    const masks = tuckedGarmentMasks(modelPhoto);

    // A tucked shirt must physically sit behind the trouser waistband. Draw
    // the shirt first, then the trouser garment on top. This removes the
    // pasted-on band of shirt texture across the waist/fly/crotch.
    drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_SHIRT_BODY_CLIP, masks.shirt, "grayscale(1) brightness(3.05) contrast(.94)", { offsetX: 0 });
    drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_LEFT_SLEEVE_CLIP, masks.shirt, "grayscale(1) brightness(3.05) contrast(.94)", { offsetX: 11 });
    drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_RIGHT_SLEEVE_CLIP, masks.shirt, "grayscale(1) brightness(3.05) contrast(.94)", { offsetX: -9 });

    drawCreativePattern(context,creative,PHOTO_TUCKED_SHIRT_BODY_CLIP,masks.shirt);
    drawCreativePattern(context,creative,PHOTO_TUCKED_LEFT_SLEEVE_CLIP,masks.shirt);
    drawCreativePattern(context,creative,PHOTO_TUCKED_RIGHT_SLEEVE_CLIP,masks.shirt);
    drawCreativeDetails(context,creative,true,masks.shirt);

    if (style.collarFinish === "Self-fabric") {
      drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_COLLAR_MASK, undefined, "grayscale(1) brightness(3.05) contrast(.94)");
    } else {
      drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_STAND_MASK, undefined, 3.6);
      if (!creativeHas(creative,"quiet-collar-echo")) drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_MASK, undefined, 3.6);
    }
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_CUFF_MASK, undefined, 3.6);

    drawGarment(context, modelPhoto, pantImage, pant, PHOTO_TUCKED_LEFT_TROUSER_CLIP, masks.pant, "grayscale(1) brightness(1.9) contrast(1.03)", { offsetX: 5 });
    drawGarment(context, modelPhoto, pantImage, pant, PHOTO_TUCKED_RIGHT_TROUSER_CLIP, masks.pant, "grayscale(1) brightness(1.9) contrast(1.03)", { offsetX: -5 });
  } else {
    const shirtMask = untuckedGarmentMasks(modelPhoto, template.shirtPath, DESIGNER_PHOTO_TEMPLATES.pleated.trouserPath).shirt;
    const trouserMask = untuckedGarmentMasks(trouserPhoto, template.shirtPath, template.trouserPath).pant;
    drawGarment(context, trouserPhoto, pantImage, pant, "", trouserMask);
    drawGarment(context, modelPhoto, shirtImage, shirt, "", shirtMask);
    drawCreativePattern(context,creative,"",shirtMask);
    drawCreativeDetails(context,creative,false,shirtMask);
    if (style.collarFinish !== "Self-fabric") drawWhiteDetail(context, modelPhoto, PHOTO_COLLAR_MASK);
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_CUFF_MASK);
  }
}

export type CreativeVisualCheck = {
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
};

export function PhotoOutfitPreview({ shirt, pant, style, creativeDirection, onCreativeFeedback, onCreativeInspection }: {
  shirt: DesignerFabric;
  pant: DesignerFabric;
  style: DesignerStyle;
  creativeDirection?: CreativeDirection | null;
  onCreativeFeedback?: (rating:"up"|"down",reason?:CreativeFeedbackReason)=>void;
  onCreativeInspection?: (check:CreativeVisualCheck)=>void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [inspectFit, setInspectFit] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [creativeAi, setCreativeAi] = useState<{image:string;jobId:string;creditsUsed:number;conceptId:string;generatedAt:string;visualCheck?:CreativeVisualCheck}|null>(null);
  const [creativeAiLoading, setCreativeAiLoading] = useState(false);
  const [creativeAiError, setCreativeAiError] = useState("");
  const [showCreativeAi, setShowCreativeAi] = useState(false);
  const [creativeReview, setCreativeReview] = useState<"up"|"down"|null>(null);
  const [creativeReviewReason, setCreativeReviewReason] = useState<CreativeFeedbackReason|null>(null);
  const templateId = photoTemplateForStyle(style);
  const template = DESIGNER_PHOTO_TEMPLATES[templateId];
  const gaps = photoTemplateGaps(style, templateId);
  const tucked = style.shirtWear === "Tucked";
  const creativeCoverage = creativePreviewCoverage(creativeDirection || undefined);

  useEffect(() => {
    setCreativeAi(null);
    setCreativeAiError("");
    setShowCreativeAi(false);
    setCreativeReview(null);
    setCreativeReviewReason(null);
  },[creativeDirection?.id,shirt.id,pant.id]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(false);
    Promise.all([
      loadImage(tucked ? template.src : DESIGNER_PHOTO_TEMPLATES.pleated.src), loadImage(template.src),
      loadImage(shirt.image), loadImage(pant.image),
    ]).then(([modelPhoto, trouserPhoto, shirtImage, pantImage]) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) throw new Error("Canvas is unavailable.");
        composePhotoOutfit(context, modelPhoto, trouserPhoto, shirtImage, pantImage, shirt, pant, style, creativeDirection || undefined);
        setError(false);
        setReady(true);
      })
      .catch(() => { if (!cancelled) { setReady(false); setError(true); } });
    return () => { cancelled = true; };
  }, [shirt, pant, template, tucked, style.collarFinish, creativeDirection]);

  async function renderCreativePhotoreal() {
    if(!creativeDirection || creativeAiLoading) return;
    setCreativeAiLoading(true);
    setCreativeAiError("");
    try {
      const response=await fetch("/api/designer/creative-render",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          shirt:{id:shirt.id,name:shirt.name,line:shirt.line,image:shirt.image,hex:shirt.hex,patternType:shirt.patternType},
          pant:{id:pant.id,name:pant.name,line:pant.line,image:pant.image,hex:pant.hex,patternType:pant.patternType},
          style,
          creative:{
            id:creativeDirection.id,
            name:creativeDirection.name,
            thesis:creativeDirection.thesis,
            treatments:creativeDirection.treatments,
            pattern:creativeDirection.pattern,
            renderRisk:creativeDirection.learning.renderRisk,
          },
        }),
      });
      const data=await response.json() as {result?:{image:string;jobId:string;creditsUsed:number;conceptId:string;generatedAt:string};error?:string};
      if(!response.ok || !data.result) throw new Error(data.error || "Photoreal render failed.");
      setCreativeAi(data.result);
      setShowCreativeAi(true);

      try {
        const inspectResponse=await fetch("/api/designer/creative-inspect",{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({
            image:data.result.image,
            shirt:{id:shirt.id,name:shirt.name,line:shirt.line,image:shirt.image,hex:shirt.hex,patternType:shirt.patternType},
            pant:{id:pant.id,name:pant.name,line:pant.line,image:pant.image,hex:pant.hex,patternType:pant.patternType},
            style,
            creative:{
              id:creativeDirection.id,
              name:creativeDirection.name,
              thesis:creativeDirection.thesis,
              treatments:creativeDirection.treatments,
              pattern:creativeDirection.pattern,
            },
          }),
        });
        const inspected=await inspectResponse.json() as {check?:CreativeVisualCheck};
        if(inspectResponse.ok && inspected.check) {
          setCreativeAi((current)=>current && current.conceptId===data.result?.conceptId ? {...current,visualCheck:inspected.check} : current);
          onCreativeInspection?.(inspected.check);
        }
      } catch {
        // The photoreal result remains usable when automatic inspection is unavailable.
      }
    } catch(error) {
      setCreativeAiError(error instanceof Error ? error.message : "Photoreal render failed.");
    } finally {
      setCreativeAiLoading(false);
    }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `designer-${shirt.id}-${pant.id}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    }, "image/png");
  }

  return <section className="newDesignerPhoto" aria-labelledby="designerPhotoTitle">
    <div className="newDesignerPhotoIntro newDesignerPhotoIntroCompact">
      <span>LIVE PREVIEW</span>
      <h2 id="designerPhotoTitle">Your look.</h2>
    </div>
    <div className={`newDesignerPhotoStage ${inspectFit ? "inspectFit" : ""}`}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} role="img" aria-label={`${previewFabricLabel(shirt, pant)}, ${style.shirtWear.toLowerCase()} with ${style.collarFinish.toLowerCase()}`} />
      {showCreativeAi && creativeAi && <img className="newDesignerPhotoAi" src={creativeAi.image} alt={`Photoreal V5 render of ${creativeDirection?.name || "selected creative concept"}`} />}
      {showOriginal && <img className="newDesignerPhotoOriginal" src={tucked ? template.src : DESIGNER_PHOTO_TEMPLATES.pleated.src} alt="Original photographed model template for comparison" />}
      {showBoundaries && <svg className="newDesignerBoundaryQa" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-label="Garment boundary QA overlay">
        {tucked ? <>
          <path d={PHOTO_TUCKED_SHIRT_BODY_CLIP} className="shirtBoundary" />
          <path d={PHOTO_TUCKED_LEFT_SLEEVE_CLIP} className="shirtBoundary" />
          <path d={PHOTO_TUCKED_RIGHT_SLEEVE_CLIP} className="shirtBoundary" />
          <path d={PHOTO_TUCKED_LEFT_TROUSER_CLIP} className="trouserBoundary" />
          <path d={PHOTO_TUCKED_RIGHT_TROUSER_CLIP} className="trouserBoundary" />
          <path d={PHOTO_TUCKED_NECK_CLEAR} className="clearBoundary" />
        </> : <>
          <path d={template.shirtPath} className="shirtBoundary" />
          <path d={template.trouserPath} className="trouserBoundary" />
        </>}
      </svg>}
      <span className="newDesignerPhotoTag">FRONT / STUDIO MODEL</span>
      {error && <span className="newDesignerPhotoError" role="alert">Preview could not load. Check the local fabric images.</span>}
      {!ready && !error && <span className="newDesignerPhotoLoading">Preparing your look…</span>}
    </div>
    <div className="newDesignerPhotoSummary newDesignerPhotoSummaryCompact">
      <div><span>SHIRT</span><strong>{shirt.name}</strong></div>
      <div><span>TROUSER</span><strong>{pant.name}</strong></div>
      <div className="newDesignerPhotoActions newDesignerPhotoActionsCompact">
        {creativeDirection && !creativeAi && <button className="primary" type="button" onClick={renderCreativePhotoreal} disabled={!ready || creativeAiLoading}>{creativeAiLoading ? "Rendering…" : "Photoreal render ✦"}</button>}
        {creativeDirection && creativeAi && <button className="primary" type="button" onClick={()=>setShowCreativeAi((value)=>!value)}>{showCreativeAi ? "Instant preview" : "Photoreal render"}</button>}
        <button type="button" onClick={() => setShowOriginal((value) => !value)} disabled={!ready}>{showOriginal ? "Show design" : "Compare"}</button>
        <button type="button" onClick={download} disabled={!ready}>Save</button>
      </div>
    </div>
    <details className="newDesignerTechnicalDrawer newDesignerPreviewTools">
      <summary>Preview tools</summary>
      <div>
        <button type="button" onClick={() => setInspectFit((value) => !value)} disabled={!ready}>{inspectFit ? "Full view" : "Zoom fit"}</button>
        <button type="button" onClick={() => setShowBoundaries((value) => !value)} disabled={!ready} aria-pressed={showBoundaries}>{showBoundaries ? "Hide boundaries" : "Boundary QA"}</button>
      </div>
    </details>
    {creativeDirection && <div className="newDesignerPhotoCreative newDesignerPhotoCreativeCompact">
      <span>SELECTED · {creativeDirection.name.toUpperCase()}</span>
      <div className="newDesignerPhotoCreativeTags">
        {creativeCoverage.visible.slice(0,2).map((item)=><b key={item}>{item}</b>)}
        {creativeCoverage.specOnly.length>0 && <b>{creativeCoverage.specOnly.length} detail{creativeCoverage.specOnly.length===1?"":"s"} need photoreal render</b>}
      </div>
      {creativeAi?.visualCheck && <div className="newDesignerRenderCheck" data-status={creativeAi.visualCheck.evidenceAvailable ? creativeAi.visualCheck.status : "review"}>
        <span>{!creativeAi.visualCheck.evidenceAvailable ? "VISUAL CHECK UNAVAILABLE" : creativeAi.visualCheck.status==="pass" ? "VISUAL CHECK PASSED" : "VISUAL CHECK / REDESIGNING"}</span>
        <p>{!creativeAi.visualCheck.evidenceAvailable ? "Keep the render for manual review; V5 will not redesign from missing evidence." : creativeAi.visualCheck.status==="pass" ? "The main design detail reads clearly and the garment boundaries remain stable." : "The render did not express the design cleanly enough, so V5 is moving to a revised direction."}</p>
      </div>}
      {creativeAi && onCreativeFeedback && <div className="newDesignerCreativeReview newDesignerCreativeReviewCompact">
        <span>DOES IT WORK?</span>
        <div>
          <button type="button" aria-pressed={creativeReview==="up"} onClick={()=>{setCreativeReview("up");setCreativeReviewReason(null);onCreativeFeedback("up");}}>Yes</button>
          <button type="button" aria-pressed={creativeReview==="down"} onClick={()=>{setCreativeReview("down");setCreativeReviewReason(null);onCreativeFeedback("down");}}>Redesign</button>
        </div>
        {creativeReview==="down" && <>
          <small className="newDesignerCreativeReviewHint">Choose what failed. Designer will switch to a revised direction automatically.</small>
          <div className="newDesignerCreativeReviewReasons">{CREATIVE_FEEDBACK_REASONS.slice(0,7).map(([id,label])=><button key={id} type="button" aria-pressed={creativeReviewReason===id} onClick={()=>{setCreativeReviewReason(id);onCreativeFeedback("down",id);}}>{label}</button>)}</div>
        </>}
      </div>}
      {creativeAiError && <p className="newDesignerCreativeRenderError">{creativeAiError}</p>}
    </div>}
    <details className="newDesignerTechnicalDrawer newDesignerPhotoAccuracyCompact">
      <summary>Preview accuracy</summary>
      <p>{tucked ? "Tucked studio template" : "Untucked studio template"} · {template.trouser} · {template.break.toLowerCase()}.</p>
      {gaps.length > 0 && <p><b>Not yet exact:</b> {gaps.join(" · ")}.</p>}
      <p>Final colour, drape and fit still need physical fabric / sample verification.</p>
    </details>
  </section>;
}
