"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignerFabric, DesignerStyle } from "@/lib/designer/engine";
import type { StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import type { BodyPreviewProfile } from "@/lib/designer/body-profile";
import { applyRuntimeFabricScale, photoFabricPatternScale, visiblePatternScaleVerified, type FabricRenderAsset } from "@/lib/designer/live-preview";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import fabricTileManifest from "../../public/fabric-tiles/manifest.json";
import { CREATIVE_FEEDBACK_REASONS, type CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import { UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION, type CustomerPhotoCalibration } from "@/lib/designer/photo-calibration-types";
import { customerPhotoCalibrationIdentity, fetchCustomerPhotoCalibration } from "@/lib/designer/photo-calibration-client";
import { neutralizePhotographicBandDifference, neutralizePhotographicLuminance, weightedGarmentLuminanceMean } from "@/lib/designer/photo-shading";
import {
  DESIGNER_PHOTO_TEMPLATES, PHOTO_COLLAR_MASK, PHOTO_CUFF_MASK, PHOTO_TUCKED_COLLAR_MASK, PHOTO_TUCKED_COLLAR_STAND_MASK,
  PHOTO_TUCKED_CUFF_MASK, PHOTO_TUCKED_NECK_CLEAR, PHOTO_TUCKED_SHIRT_CLIP, PHOTO_TUCKED_TROUSER_CLIP,
  PHOTO_TUCKED_SHIRT_BODY_CLIP, PHOTO_TUCKED_LEFT_SLEEVE_CLIP, PHOTO_TUCKED_RIGHT_SLEEVE_CLIP,
  PHOTO_TUCKED_LEFT_TROUSER_CLIP, PHOTO_TUCKED_RIGHT_TROUSER_CLIP,
  photoTemplateForStyle, photoTemplateGaps, previewFabricLabel,
} from "@/lib/designer/photo-preview";

const WIDTH = 1024;
const HEIGHT = 1536;
type PhotorealView = "front"|"three-quarter"|"side"|"back";
type SelectedLookVisualCheck = {
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
};
type PhotorealResult = {
  image:string;
  jobId:string;
  creditsUsed:number;
  conceptId:string;
  generatedAt:string;
  cached?:boolean;
  visualCheck?:CreativeVisualCheck;
  selectedCheck?:SelectedLookVisualCheck;
};
const images = new Map<string, Promise<HTMLImageElement>>();
const fabricTiles = new Map<string, HTMLCanvasElement>();
const featheredMasks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const pathMasks = new Map<string, HTMLCanvasElement>();
const tuckedMasks = new WeakMap<HTMLImageElement, { shirt: HTMLCanvasElement; pant: HTMLCanvasElement }>();
const untuckedMasks = new WeakMap<HTMLImageElement, { shirt: HTMLCanvasElement; pant: HTMLCanvasElement }>();
const photographicReliefMaps = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
const photographicShapeMaps = new WeakMap<HTMLImageElement, Map<HTMLCanvasElement | null, HTMLCanvasElement>>();
const photographicFoldMaps = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
const selectedLookSessionCache=new Map<string,PhotorealResult>();
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

function loadFabricImage(fabric:DesignerFabric):Promise<HTMLImageElement> {
  const stem=fabric.image.split("/").pop()?.match(/^([a-z0-9-]+)\.webp(?:\?.*)?$/i)?.[1];
  return stem ? loadImage(`/fabric-tiles/${stem}.webp`).catch(()=>loadImage(fabric.image)) : loadImage(fabric.image);
}
function fabricRenderAsset(fabric:DesignerFabric):FabricRenderAsset|null {
  const stem=fabric.image.split("/").pop()?.replace(/\.webp(?:\?.*)?$/,"")||"";
  const asset=(fabricTileManifest.assets as Record<string,FabricRenderAsset>)[stem] || null;
  return applyRuntimeFabricScale(asset,fabric.renderScale);
}
function fabricOrientation(fabric:DesignerFabric) {
  const entry=fabricRenderAsset(fabric);
  return entry?.orientation==="horizontal"?90:0;
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
  if (image.src.includes("/fabric-tiles/")) {
    // Prepared tiles omit captions and selvage; photo lighting remains in drawGarment.
    context.drawImage(image,0,0,320,320);
    fabricTiles.set(fabric.id,tile);
    if(fabricTiles.size>12) {
      const oldest=fabricTiles.keys().next().value;
      if(oldest) fabricTiles.delete(oldest);
    }
    return tile;
  }

  // Read the actual upper cloth field. The catalogue HEX is an approximate
  // fallback, not a substitute for the swatch colour and woven texture.
  const plain = fabric.patternType === "Solid";
  const stripe = /stripe/i.test(fabric.patternType);
  if (plain || stripe) {
    const sourceX = image.width * (plain ? .35 : .31);
    const sourceY = image.height * (plain ? .22 : .16);
    const sourceWidth = image.width * (plain ? .3 : .38);
    const sourceHeight = image.height * (plain ? .22 : .27);
    if(plain) {
      // Only visually plain cloth is mirrored to soften source-photo lighting
      // seams. Mirroring stripes would manufacture false stripe spacing.
      for (const [column, row] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        context.save();
        context.translate(column * 160, row * 160);
        context.scale(column ? -1 : 1, row ? -1 : 1);
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight,
          column ? -160 : 0, row ? -160 : 0, 160, 160);
        context.restore();
      }
    } else {
      context.drawImage(image,sourceX,sourceY,sourceWidth,sourceHeight,0,0,320,320);
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
    // enough high-frequency linen weave to avoid a flat painted-shirt look.
    // The gain stays below 1 so catalogue lighting does not become a fake
    // garment fold once the photographed model luminance is applied later.
    const plainTextureDetailGain = .34;
    for (let index = 0; index < original.data.length; index += 4) {
      for (let channel = 0; channel < 3; channel++) {
        original.data[index + channel] = Math.round(mean[channel] +
          (original.data[index + channel] - blurred[index + channel]) * plainTextureDetailGain);
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

function photographicReliefMap(photo: HTMLImageElement) {
  const cached = photographicReliefMaps.get(photo);
  if (cached) return cached;

  // Extract a neutral high-pass relief map from the real studio photograph.
  // Working at half resolution keeps the first preview fast while retaining
  // the folds, placket seams, cuff edges and trouser creases that make the
  // garment read as photographed rather than painted.
  const reliefWidth = WIDTH / 2;
  const reliefHeight = HEIGHT / 2;
  const source = document.createElement("canvas");
  const blurred = document.createElement("canvas");
  const detail = document.createElement("canvas");
  source.width = blurred.width = detail.width = reliefWidth;
  source.height = blurred.height = detail.height = reliefHeight;

  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const blurContext = blurred.getContext("2d", { willReadFrequently: true });
  const detailContext = detail.getContext("2d");
  if (!sourceContext || !blurContext || !detailContext) throw new Error("Canvas is unavailable.");

  sourceContext.filter = "grayscale(1)";
  sourceContext.drawImage(photo, 0, 0, reliefWidth, reliefHeight);
  blurContext.filter = "grayscale(1) blur(4px)";
  blurContext.drawImage(photo, 0, 0, reliefWidth, reliefHeight);

  const original = sourceContext.getImageData(0, 0, reliefWidth, reliefHeight);
  const soft = blurContext.getImageData(0, 0, reliefWidth, reliefHeight);
  const pixels = detailContext.createImageData(reliefWidth, reliefHeight);
  for (let index = 0; index < original.data.length; index += 4) {
    const luminance = original.data[index];
    const blurredLuminance = soft.data[index];
    const neutralRelief = neutralizePhotographicBandDifference(luminance, blurredLuminance, 1.8);
    pixels.data[index] = neutralRelief;
    pixels.data[index + 1] = neutralRelief;
    pixels.data[index + 2] = neutralRelief;
    pixels.data[index + 3] = 255;
  }
  detailContext.putImageData(pixels, 0, 0);
  photographicReliefMaps.set(photo, detail);
  return detail;
}

function photographicShapeMap(photo: HTMLImageElement, garmentMask?: HTMLCanvasElement) {
  let cachedByMask = photographicShapeMaps.get(photo);
  if (!cachedByMask) {
    cachedByMask = new Map<HTMLCanvasElement | null, HTMLCanvasElement>();
    photographicShapeMaps.set(photo, cachedByMask);
  }
  const cacheKey = garmentMask ?? null;
  const cached = cachedByMask.get(cacheKey);
  if (cached) return cached;

  // Build a low-frequency lighting field and normalize it against the actual
  // photographed garment region. This removes the source cloth's base albedo
  // instead of relying on a hand-tuned brightness multiplier for navy/beige
  // templates. Mid gray is neutral under soft-light; only relative highlights
  // and shadows survive into the selected Linen Earth fabric.
  const mapWidth = WIDTH / 2;
  const mapHeight = HEIGHT / 2;
  const source = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const shape = document.createElement("canvas");
  source.width = maskCanvas.width = shape.width = mapWidth;
  source.height = maskCanvas.height = shape.height = mapHeight;

  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  const shapeContext = shape.getContext("2d");
  if (!sourceContext || !maskContext || !shapeContext) throw new Error("Canvas is unavailable.");

  sourceContext.filter = "grayscale(1) blur(7px)";
  sourceContext.drawImage(photo, 0, 0, mapWidth, mapHeight);
  if (garmentMask) maskContext.drawImage(garmentMask, 0, 0, mapWidth, mapHeight);
  else {
    maskContext.fillStyle = "#fff";
    maskContext.fillRect(0, 0, mapWidth, mapHeight);
  }

  const input = sourceContext.getImageData(0, 0, mapWidth, mapHeight);
  const maskPixels = maskContext.getImageData(0, 0, mapWidth, mapHeight);
  const output = shapeContext.createImageData(mapWidth, mapHeight);

  const garmentMean = weightedGarmentLuminanceMean(input.data, maskPixels.data);

  for (let index = 0; index < input.data.length; index += 4) {
    // Center the photographed garment itself on neutral gray. The shared pure
    // transform is regression-tested so equal light/shadow deltas render the
    // same regardless of whether the source template cloth is dark or pale.
    const neutral = neutralizePhotographicLuminance(input.data[index], garmentMean);
    output.data[index] = neutral;
    output.data[index + 1] = neutral;
    output.data[index + 2] = neutral;
    output.data[index + 3] = 255;
  }
  shapeContext.putImageData(output, 0, 0);
  cachedByMask.set(cacheKey, shape);
  return shape;
}

function photographicFoldMap(photo: HTMLImageElement) {
  const cached = photographicFoldMaps.get(photo);
  if (cached) return cached;

  // Keep medium-scale photographed tailoring form without inheriting the base
  // value of the source cloth. The fine-vs-broad difference is centered on
  // neutral gray, so identical folds behave the same on dark and pale sources.
  const mapWidth = WIDTH / 2;
  const mapHeight = HEIGHT / 2;
  const fine = document.createElement("canvas");
  const broad = document.createElement("canvas");
  const folds = document.createElement("canvas");
  fine.width = broad.width = folds.width = mapWidth;
  fine.height = broad.height = folds.height = mapHeight;

  const fineContext = fine.getContext("2d", { willReadFrequently: true });
  const broadContext = broad.getContext("2d", { willReadFrequently: true });
  const foldContext = folds.getContext("2d");
  if (!fineContext || !broadContext || !foldContext) throw new Error("Canvas is unavailable.");

  fineContext.filter = "grayscale(1) blur(1.25px)";
  fineContext.drawImage(photo, 0, 0, mapWidth, mapHeight);
  broadContext.filter = "grayscale(1) blur(12px)";
  broadContext.drawImage(photo, 0, 0, mapWidth, mapHeight);

  const finePixels = fineContext.getImageData(0, 0, mapWidth, mapHeight);
  const broadPixels = broadContext.getImageData(0, 0, mapWidth, mapHeight);
  const output = foldContext.createImageData(mapWidth, mapHeight);
  for (let index = 0; index < finePixels.data.length; index += 4) {
    const neutralFold = neutralizePhotographicBandDifference(
      finePixels.data[index],
      broadPixels.data[index],
      1.42,
      40,
      216,
    );
    output.data[index] = neutralFold;
    output.data[index + 1] = neutralFold;
    output.data[index + 2] = neutralFold;
    output.data[index + 3] = 255;
  }
  foldContext.putImageData(output, 0, 0);
  photographicFoldMaps.set(photo, folds);
  return folds;
}

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

function featheredPathMask(path:string) {
  const cached=pathMasks.get(path);
  if(cached) return featherMaskInside(cached);

  const mask=document.createElement("canvas");
  mask.width=WIDTH;
  mask.height=HEIGHT;
  const context=mask.getContext("2d");
  if(!context) throw new Error("Canvas is unavailable.");
  context.fillStyle="#fff";
  context.fill(new Path2D(path));
  pathMasks.set(path,mask);
  return featherMaskInside(mask);
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
  target: CanvasRenderingContext2D, photo: HTMLImageElement,
  swatch: HTMLImageElement, fabric: DesignerFabric, path: string,
  mask?: HTMLCanvasElement,
  placement: { offsetX?: number; offsetY?: number; scale?: number; rotationDeg?:number; photoPxPerMm?:number } = {},
) {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  const context = layer.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");

  const tile = swatchTile(swatch, fabric);
  const pattern = context.createPattern(tile, "repeat");
  if (!pattern) throw new Error("Could not prepare the fabric pattern.");
  const visualFallback=patternScaleForFabric(fabric);
  const scale = photoFabricPatternScale(fabricRenderAsset(fabric),visualFallback,placement.photoPxPerMm) * (placement.scale ?? 1);
  pattern.setTransform(new DOMMatrix().translate(placement.offsetX ?? 0, placement.offsetY ?? 0).rotate(fabricOrientation(fabric)+(placement.rotationDeg??0)).scale(scale));
  context.fillStyle = pattern;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Broad form is garment-local and neutralized around the photographed cloth
  // baseline, so the selected swatch remains the colour/value authority.
  const lightingMask = mask ?? (path ? featheredPathMask(path) : undefined);
  const shape = photographicShapeMap(photo, lightingMask);
  context.filter = "none";
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .58;
  context.drawImage(shape, 0, 0, WIDTH, HEIGHT);

  context.globalCompositeOperation = "multiply";
  context.globalAlpha = .07;
  context.drawImage(shape, 0, 0, WIDTH, HEIGHT);

  // Medium folds are isolated as a neutral band-pass rather than copied from
  // the source photo. This restores placket rolls, sleeve folds and trouser
  // creases without pulling dark or pale template albedo into the new cloth.
  const folds = photographicFoldMap(photo);
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .34;
  context.drawImage(folds, 0, 0, WIDTH, HEIGHT);

  context.globalCompositeOperation = "overlay";
  context.globalAlpha = .07;
  context.drawImage(folds, 0, 0, WIDTH, HEIGHT);

  // Fine seams and wrinkles use the separate neutral high-pass relief band.
  const relief = photographicReliefMap(photo);
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .24;
  context.drawImage(relief, 0, 0, WIDTH, HEIGHT);

  // Put a faint copy of the real textile back above the lighting model. This
  // keeps weave / print micro-detail visible in highlights, where multiply
  // alone tends to wash the source cloth into a smooth painted surface.
  context.filter = "none";
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = fabric.patternType === "Solid" ? .12 : .16;
  context.fillStyle = pattern;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.globalAlpha = 1;
  context.filter = "none";

  context.globalCompositeOperation = "destination-in";
  if (mask) context.drawImage(featherMaskInside(mask), 0, 0);
  // Hard SVG-like clip edges make fabric look pasted onto the photograph.
  // Feather only toward the garment interior so collar/cuff/body boundaries
  // inherit the photographed antialiasing without leaking onto skin or set.
  if (path) context.drawImage(featheredPathMask(path), 0, 0);
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
  if(path) context.drawImage(featheredPathMask(path),0,0);
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

function drawWhiteDetail(target: CanvasRenderingContext2D, photo: HTMLImageElement, path: string, mask?: HTMLCanvasElement) {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  const context = layer.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.fillStyle = "#faf9f5";
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // White contrast cloth reuses the same neutral shape/fold/relief stack. Its
  // own feathered path defines the normalization region, keeping the detail
  // photographic without importing the source garment's colour or base value.
  const detailMask = featheredPathMask(path);
  const shape = photographicShapeMap(photo, detailMask);
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .42;
  context.drawImage(shape, 0, 0, WIDTH, HEIGHT);

  const folds = photographicFoldMap(photo);
  context.globalAlpha = .28;
  context.drawImage(folds, 0, 0, WIDTH, HEIGHT);

  context.globalAlpha = .22;
  context.drawImage(photographicReliefMap(photo), 0, 0, WIDTH, HEIGHT);

  context.globalAlpha = 1;
  context.filter = "none";
  context.globalCompositeOperation = "destination-in";
  // Contrast collars/cuffs sit directly beside skin and hands. Use the same
  // inward-only edge feather as the base garment so white details do not read
  // as hard vector stickers.
  context.drawImage(featheredPathMask(path), 0, 0);
  if (mask) context.drawImage(featherMaskInside(mask), 0, 0);
  context.globalCompositeOperation = "source-over";
  target.drawImage(layer, 0, 0);
}

export type PhotoPreviewCalibration={photoPxPerMm?:number};

export function composePhotoOutfit(
  context: CanvasRenderingContext2D, modelPhoto: HTMLImageElement, trouserPhoto: HTMLImageElement,
  shirtImage: HTMLImageElement, pantImage: HTMLImageElement,
  shirt: DesignerFabric, pant: DesignerFabric, style: DesignerStyle,
  creative?: CreativePreviewSpec,
  calibration?: PhotoPreviewCalibration,
) {
  const template = DESIGNER_PHOTO_TEMPLATES[photoTemplateForStyle(style)];
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(modelPhoto, 0, 0, WIDTH, HEIGHT);
  const tucked = style.shirtWear === "Tucked";
  const photoPxPerMm=Number(calibration?.photoPxPerMm);
  const calibratedPlacement=Number.isFinite(photoPxPerMm)&&photoPxPerMm>0 ? {photoPxPerMm} : {};
  if (tucked) {
    const masks = tuckedGarmentMasks(modelPhoto);

    // A tucked shirt must physically sit behind the trouser waistband. Draw
    // the shirt first, then the trouser garment on top. This removes the
    // pasted-on band of shirt texture across the waist/fly/crotch.
    drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_SHIRT_BODY_CLIP, masks.shirt, { ...calibratedPlacement, offsetX: 0 });
    drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_LEFT_SLEEVE_CLIP, masks.shirt, { ...calibratedPlacement, offsetX: 11 });
    drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_RIGHT_SLEEVE_CLIP, masks.shirt, { ...calibratedPlacement, offsetX: -9 });

    drawCreativePattern(context,creative,PHOTO_TUCKED_SHIRT_BODY_CLIP,masks.shirt);
    drawCreativePattern(context,creative,PHOTO_TUCKED_LEFT_SLEEVE_CLIP,masks.shirt);
    drawCreativePattern(context,creative,PHOTO_TUCKED_RIGHT_SLEEVE_CLIP,masks.shirt);
    drawCreativeDetails(context,creative,true,masks.shirt);

    if (style.collarFinish === "Self-fabric") {
      drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_COLLAR_MASK, undefined,{...calibratedPlacement,rotationDeg:90});
    } else {
      drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_STAND_MASK, undefined);
      if (!creativeHas(creative,"quiet-collar-echo")) drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_MASK, undefined);
    }
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_CUFF_MASK, undefined);

    drawGarment(context, modelPhoto, pantImage, pant, PHOTO_TUCKED_LEFT_TROUSER_CLIP, masks.pant, { ...calibratedPlacement, offsetX: 5 });
    drawGarment(context, modelPhoto, pantImage, pant, PHOTO_TUCKED_RIGHT_TROUSER_CLIP, masks.pant, { ...calibratedPlacement, offsetX: -5 });
  } else {
    const shirtMask = untuckedGarmentMasks(modelPhoto, template.shirtPath, DESIGNER_PHOTO_TEMPLATES.pleated.trouserPath).shirt;
    const trouserMask = untuckedGarmentMasks(trouserPhoto, template.shirtPath, template.trouserPath).pant;
    drawGarment(context, trouserPhoto, pantImage, pant, "", trouserMask, { ...calibratedPlacement });
    drawGarment(context, modelPhoto, shirtImage, shirt, "", shirtMask, { ...calibratedPlacement });
    drawCreativePattern(context,creative,"",shirtMask);
    drawCreativeDetails(context,creative,false,shirtMask);
    if (style.collarFinish !== "Self-fabric") drawWhiteDetail(context, modelPhoto, PHOTO_COLLAR_MASK);
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_CUFF_MASK);
  }
}

export function StyleDirectorRealModelPreview({shirt,pant,style,onRenderMeasured,onPreviewReady,photoPxPerMm}:{
  shirt:DesignerFabric;
  pant:DesignerFabric;
  style:DesignerStyle;
  onRenderMeasured?:(milliseconds:number)=>void;
  onPreviewReady?:(dataUrl:string,calibrationIdentity:string)=>void;
  photoPxPerMm?:number;
}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const onRenderMeasuredRef=useRef(onRenderMeasured);
  const onPreviewReadyRef=useRef(onPreviewReady);
  onRenderMeasuredRef.current=onRenderMeasured;
  onPreviewReadyRef.current=onPreviewReady;
  const [ready,setReady]=useState(false);
  const [error,setError]=useState(false);
  const [customerCalibration,setCustomerCalibration]=useState<CustomerPhotoCalibration>(UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION);
  const explicitPhotoPxPerMm=Number(photoPxPerMm);
  const resolvedPhotoPxPerMm=Number.isFinite(explicitPhotoPxPerMm)&&explicitPhotoPxPerMm>0
    ? explicitPhotoPxPerMm
    : customerCalibration.verified
      ? Number(customerCalibration.photoPxPerMm)
      : undefined;
  const resolvedCalibrationIdentity=Number.isFinite(explicitPhotoPxPerMm)&&explicitPhotoPxPerMm>0
    ? `explicit:${explicitPhotoPxPerMm.toFixed(6)}`
    : customerPhotoCalibrationIdentity(customerCalibration);
  const templateId=photoTemplateForStyle(style);
  const template=DESIGNER_PHOTO_TEMPLATES[templateId];
  const tucked=style.shirtWear==="Tucked";

  useEffect(()=>{
    if(Number.isFinite(explicitPhotoPxPerMm)&&explicitPhotoPxPerMm>0) return;
    let cancelled=false;
    const refresh=()=>void fetchCustomerPhotoCalibration().then((value)=>{
      if(!cancelled) setCustomerCalibration(value);
    });
    const onVisibility=()=>{if(document.visibilityState==="visible") refresh();};
    refresh();
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{
      cancelled=true;
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[explicitPhotoPxPerMm]);

  useEffect(()=>{
    let cancelled=false;
    const started=performance.now();
    setReady(false);
    setError(false);
    Promise.all([
      loadImage(tucked ? template.src : DESIGNER_PHOTO_TEMPLATES.pleated.src),
      loadImage(template.src),
      loadFabricImage(shirt),
      loadFabricImage(pant),
    ]).then(([modelPhoto,trouserPhoto,shirtImage,pantImage])=>{
      if(cancelled) return;
      const canvas=canvasRef.current;
      const context=canvas?.getContext("2d",{alpha:false});
      if(!canvas || !context) throw new Error("Canvas is unavailable.");
      composePhotoOutfit(context,modelPhoto,trouserPhoto,shirtImage,pantImage,shirt,pant,style,undefined,{photoPxPerMm:resolvedPhotoPxPerMm});
      setReady(true);
      setError(false);
      if(onPreviewReadyRef.current) {
        try {
          onPreviewReadyRef.current(canvas.toDataURL("image/jpeg",.92),resolvedCalibrationIdentity);
        } catch {
          // The visible preview stays usable even if browser serialization fails.
        }
      }
      requestAnimationFrame(()=>{
        if(!cancelled) onRenderMeasuredRef.current?.(performance.now()-started);
      });
    }).catch(()=>{
      if(cancelled) return;
      setReady(false);
      setError(true);
    });
    return ()=>{cancelled=true;};
  },[shirt,pant,template,tucked,style,resolvedPhotoPxPerMm,resolvedCalibrationIdentity]);

  return <div className="directorExistingModel" data-ready={ready?"true":"false"}>
    <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} role="img" aria-label={`Existing Linen Earth real model wearing ${shirt.name} shirt with ${pant.name} trousers`} />
    {!ready && !error && <span className="directorExistingModelState">Dressing the existing model…</span>}
    {error && <span className="directorExistingModelState">Real model preview unavailable.</span>}
  </div>;
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
  improvement?:"improved"|"same"|"worse"|"not_applicable";
};

export function PhotoOutfitPreview({ shirt, pant, style, styleSpec, bodyProfile, creativeDirection, onCreativeFeedback, onCreativeInspection, autoRenderNonce = 0, onCreativeRenderStart, renderRepairInstruction = "" }: {
  shirt: DesignerFabric;
  pant: DesignerFabric;
  style: DesignerStyle;
  styleSpec?: StyleSpecV2;
  bodyProfile?: BodyPreviewProfile;
  creativeDirection?: CreativeDirection | null;
  onCreativeFeedback?: (rating:"up"|"down",reason?:CreativeFeedbackReason)=>void;
  onCreativeInspection?: (check:CreativeVisualCheck)=>void;
  autoRenderNonce?: number;
  onCreativeRenderStart?: ()=>void;
  renderRepairInstruction?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAutoRenderNonce = useRef(0);
  const previousReviewedRender = useRef("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [inspectFit, setInspectFit] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [creativeAi, setCreativeAi] = useState<PhotorealResult|null>(null);
  const [creativeAiLoading, setCreativeAiLoading] = useState(false);
  const [creativeAiError, setCreativeAiError] = useState("");
  const [showCreativeAi, setShowCreativeAi] = useState(false);
  const [photorealView,setPhotorealView]=useState<PhotorealView>("front");
  const [photorealViews,setPhotorealViews]=useState<Partial<Record<Exclude<PhotorealView,"front">,PhotorealResult>>>({});
  const [photorealViewLoading,setPhotorealViewLoading]=useState<Exclude<PhotorealView,"front">|null>(null);
  const [selectedRepairCount,setSelectedRepairCount]=useState(0);
  const [finalLocked,setFinalLocked]=useState(false);
  const [creativeReview, setCreativeReview] = useState<"up"|"down"|null>(null);
  const [creativeReviewReason, setCreativeReviewReason] = useState<CreativeFeedbackReason|null>(null);
  const [photoCalibration,setPhotoCalibration]=useState<CustomerPhotoCalibration>(UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION);
  const verifiedPhotoPxPerMm=photoCalibration.verified ? Number(photoCalibration.photoPxPerMm) : undefined;
  const templateId = photoTemplateForStyle(style);
  const template = DESIGNER_PHOTO_TEMPLATES[templateId];
  const gaps = photoTemplateGaps(style, templateId);
  const tucked = style.shirtWear === "Tucked";
  const creativeCoverage = creativePreviewCoverage(creativeDirection || undefined);
  const shirtPreviewAsset=fabricRenderAsset(shirt);
  const pantPreviewAsset=fabricRenderAsset(pant);
  const shirtScaleEvidenceReady=visiblePatternScaleVerified(shirt.patternType,shirtPreviewAsset);
  const pantScaleEvidenceReady=visiblePatternScaleVerified(pant.patternType,pantPreviewAsset);
  const photoScaleReady=photoCalibration.verified&&Number.isFinite(verifiedPhotoPxPerMm)&&Number(verifiedPhotoPxPerMm)>0;
  const shirtPatternScaleVerified=shirt.patternType.toLowerCase()==="solid" || (shirtScaleEvidenceReady&&photoScaleReady);
  const pantPatternScaleVerified=pant.patternType.toLowerCase()==="solid" || (pantScaleEvidenceReady&&photoScaleReady);
  const previewScaleVerified=shirtPatternScaleVerified&&pantPatternScaleVerified;
  const approximateScaleItems=[
    ...(shirtPatternScaleVerified?[]:[shirt.name]),
    ...(pantPatternScaleVerified?[]:[pant.name]),
  ];
  const renderSignature=JSON.stringify({
    shirt:shirt.id,
    pant:pant.id,
    style,
    styleSpec:styleSpec||null,
    bodyProfile:bodyProfile||null,
    creative:creativeDirection?.id ?? null,
    photoCalibration:photoCalibration.verified ? {
      verified:true,
      photoPxPerMm:verifiedPhotoPxPerMm,
      scaleCoordinateSystem:photoCalibration.scaleCoordinateSystem,
      proofVersion:photoCalibration.proofVersion,
    } : {verified:false},
  });

  useEffect(()=>{
    let cancelled=false;
    const refresh=()=>void fetchCustomerPhotoCalibration().then((value)=>{
      if(!cancelled) setPhotoCalibration(value);
    });
    const onVisibility=()=>{if(document.visibilityState==="visible") refresh();};
    refresh();
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{
      cancelled=true;
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);

  useEffect(() => {
    setCreativeAi(null);
    setCreativeAiError("");
    setShowCreativeAi(false);
    setPhotorealView("front");
    setPhotorealViews({});
    setPhotorealViewLoading(null);
    setSelectedRepairCount(0);
    setFinalLocked(false);
    setCreativeReview(null);
    setCreativeReviewReason(null);
  },[renderSignature]);

  useEffect(()=>{
    previousReviewedRender.current="";
  },[renderSignature]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(false);
    Promise.all([
      loadImage(tucked ? template.src : DESIGNER_PHOTO_TEMPLATES.pleated.src), loadImage(template.src),
      loadFabricImage(shirt), loadFabricImage(pant),
    ]).then(([modelPhoto, trouserPhoto, shirtImage, pantImage]) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) throw new Error("Canvas is unavailable.");
        composePhotoOutfit(context, modelPhoto, trouserPhoto, shirtImage, pantImage, shirt, pant, style, creativeDirection || undefined,{photoPxPerMm:verifiedPhotoPxPerMm});
        setError(false);
        setReady(true);
      })
      .catch(() => { if (!cancelled) { setReady(false); setError(true); } });
    return () => { cancelled = true; };
  }, [shirt, pant, template, tucked, style.collarFinish, creativeDirection, verifiedPhotoPxPerMm]);

  async function inspectSelectedLook(result:PhotorealResult,view:PhotorealView="front"):Promise<SelectedLookVisualCheck|null> {
    try {
      const response=await fetch("/api/designer/look-inspect",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          image:result.image,
          jobId:result.jobId,
          view,
          look:{
            shirt:{id:shirt.id,name:shirt.name,line:shirt.line,image:shirt.image,hex:shirt.hex,patternType:shirt.patternType},
            pant:{id:pant.id,name:pant.name,line:pant.line,image:pant.image,hex:pant.hex,patternType:pant.patternType},
            style,
            styleSpec,
            bodyProfile,
            locked:true,
          },
        }),
      });
      const data=await response.json() as {check?:SelectedLookVisualCheck};
      if(!response.ok || !data.check) return null;
      if(view==="front") {
        setCreativeAi((current)=>current?.image===result.image ? {...current,selectedCheck:data.check} : current);
        // Persist only completed, available QA with the in-session render
        // cache. This avoids paying/latency for inspecting the identical image
        // again while still retrying later when QA was temporarily unavailable.
        if(!creativeDirection && data.check.available) {
          const cached=selectedLookSessionCache.get(renderSignature);
          if(cached?.image===result.image) {
            selectedLookSessionCache.set(renderSignature,{...cached,selectedCheck:data.check});
          }
        }
        // A generated image never outranks the deterministic photographic
        // preview when automated QA finds a blocking fidelity issue. Keep the
        // generated result available for human review/repair, but fail closed
        // to the trusted instant preview instead of presenting it as final.
        if(!data.check.available || data.check.status==="review") setShowCreativeAi(false);
      } else {
        setPhotorealViews((current)=>{
          const existing=current[view];
          if(!existing || existing.image!==result.image) return current;
          return {...current,[view]:{...existing,selectedCheck:data.check}};
        });
        // A failed secondary camera view must not replace the approved front
        // view. Return to front while preserving the generated view for review.
        if(!data.check.available || data.check.status==="review") setPhotorealView("front");
      }
      return data.check;
    } catch {
      // Customer display remains on the deterministic preview when automated
      // inspection is unavailable. The generated image is still kept for
      // explicit human review.
      return null;
    }
  }

  async function renderPhotoreal(origin:"manual"|"automatic"="manual") {
    if(creativeAiLoading) return;
    if(origin==="automatic" && !creativeDirection) return;
    if(!creativeDirection && !finalLocked) {
      setCreativeAiError("Lock the final design before using the photoreal renderer.");
      return;
    }
    if(origin==="manual") {
      previousReviewedRender.current="";
      onCreativeRenderStart?.();
    }
    setCreativeAiLoading(true);
    setCreativeAiError("");
    try {
      if(!creativeDirection) {
        const cached=selectedLookSessionCache.get(renderSignature);
        if(cached) {
          const cachedResult={...cached,cached:true};
          setCreativeAi(cachedResult);
          setPhotorealView("front");
          setPhotorealViews({});
          setShowCreativeAi(Boolean(cached.selectedCheck?.available && cached.selectedCheck.status==="pass"));
          if(!cached.selectedCheck?.available) {
            const check=await inspectSelectedLook(cachedResult);
            if(check?.available && check.status==="pass") setShowCreativeAi(true);
          }
          return;
        }
      }
      let lockedPreviewImage:string|undefined;
      if(!creativeDirection && ready && canvasRef.current) {
        try {
          lockedPreviewImage=canvasRef.current.toDataURL("image/jpeg",.92);
        } catch {
          // Final rendering can fall back to the canonical studio photograph
          // if the browser cannot serialize the deterministic live preview.
        }
      }
      const response=await fetch(creativeDirection ? "/api/designer/creative-render" : "/api/designer/look-render",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          shirt:{id:shirt.id,name:shirt.name,line:shirt.line,image:shirt.image,hex:shirt.hex,patternType:shirt.patternType},
          pant:{id:pant.id,name:pant.name,line:pant.line,image:pant.image,hex:pant.hex,patternType:pant.patternType},
          style,
          ...(!creativeDirection ? {styleSpec,bodyProfile,locked:true,lookKey:renderSignature,lockedPreviewImage} : {}),
          ...(creativeDirection ? {creative:{
            id:creativeDirection.id,
            name:creativeDirection.name,
            thesis:creativeDirection.thesis,
            treatments:creativeDirection.treatments,
            pattern:creativeDirection.pattern,
            renderRisk:creativeDirection.learning.renderRisk,
            renderCaution:creativeDirection.learning.renderCaution,
            repairInstruction:renderRepairInstruction || undefined,
          }} : {}),
        }),
      });
      const data=await response.json() as {result?:{image:string;jobId:string;creditsUsed:number;conceptId:string;generatedAt:string};error?:string};
      if(!response.ok || !data.result) throw new Error(data.error || "Photoreal render failed.");
      setCreativeAi(data.result);
      if(!creativeDirection) {
        selectedLookSessionCache.set(renderSignature,data.result);
        while(selectedLookSessionCache.size>8) {
          const oldest=selectedLookSessionCache.keys().next().value;
          if(!oldest) break;
          selectedLookSessionCache.delete(oldest);
        }
      }
      setPhotorealView("front");
      setPhotorealViews({});
      // Final selected-look renders stay behind QA until fidelity passes.
      // Creative concept renders keep their separate creative-inspection flow.
      setShowCreativeAi(Boolean(creativeDirection));

      if(!creativeDirection) {
        const check=await inspectSelectedLook(data.result);
        if(check?.available && check.status==="pass") setShowCreativeAi(true);
      }

      if(creativeDirection) try {
        const inspectResponse=await fetch("/api/designer/creative-inspect",{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({
            image:data.result.image,
            previousImage:previousReviewedRender.current || undefined,
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
          if(inspected.check.status==="review") previousReviewedRender.current=data.result.image;
          else previousReviewedRender.current="";
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

  async function repairSelectedLook() {
    const check=creativeAi?.selectedCheck;
    if(!creativeAi || creativeDirection || selectedRepairCount>=1 || !check?.available || check.status!=="review" || !check.repairInstruction || creativeAiLoading) return;
    setCreativeAiLoading(true);
    setCreativeAiError("");
    try {
      let lockedPreviewImage:string|undefined;
      if(ready && canvasRef.current) {
        try {
          lockedPreviewImage=canvasRef.current.toDataURL("image/jpeg",.92);
        } catch {
          // Repair still has the existing trusted generated image if browser
          // serialization is unavailable.
        }
      }
      const response=await fetch("/api/designer/look-render",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          view:"front",
          previousImage:creativeAi.image,
          repairInstruction:check.repairInstruction,
          shirt:{id:shirt.id,name:shirt.name,line:shirt.line,image:shirt.image,hex:shirt.hex,patternType:shirt.patternType},
          pant:{id:pant.id,name:pant.name,line:pant.line,image:pant.image,hex:pant.hex,patternType:pant.patternType},
          style,
          styleSpec,
          bodyProfile,
          locked:true,
          lookKey:renderSignature,
          lockedPreviewImage,
        }),
      });
      const data=await response.json() as {result?:PhotorealResult;error?:string};
      if(!response.ok || !data.result) throw new Error(data.error || "Photoreal repair failed.");
      setCreativeAi(data.result);
      setPhotorealView("front");
      setPhotorealViews({});
      setSelectedRepairCount(1);
      setShowCreativeAi(false);
      const repairCheck=await inspectSelectedLook(data.result);
      selectedLookSessionCache.set(
        renderSignature,
        repairCheck?.available ? {...data.result,selectedCheck:repairCheck} : data.result,
      );
      if(repairCheck?.available && repairCheck.status==="pass") setShowCreativeAi(true);
    } catch(error) {
      setCreativeAiError(error instanceof Error ? error.message : "Photoreal repair failed.");
    } finally {
      setCreativeAiLoading(false);
    }
  }

  async function choosePhotorealView(view:PhotorealView) {
    if(!creativeAi || creativeDirection) return;
    if(view==="front") {
      setPhotorealView("front");
      setCreativeAiError("");
      return;
    }
    const frontCheck=creativeAi.selectedCheck;
    if(!frontCheck?.available || frontCheck.status!=="pass") {
      // Never spend another generation credit or propagate identity from a
      // front render that has not cleared customer-facing fidelity QA.
      setPhotorealView("front");
      setCreativeAiError("Front photoreal must pass fidelity QA before generating another view.");
      return;
    }
    const existing=photorealViews[view];
    if(existing) {
      const existingCheck=existing.selectedCheck;
      if(existingCheck?.available && existingCheck.status==="pass") {
        setPhotorealView(view);
        setCreativeAiError("");
        return;
      }
      if(existingCheck?.available && existingCheck.status==="review") {
        // A second explicit click is the review action; never promote this
        // view automatically after generation or cache reuse.
        setPhotorealView(view);
        setCreativeAiError("This view is held for review and is not a trusted save/export source.");
        return;
      }
      if(photorealViewLoading) return;
      setPhotorealViewLoading(view);
      setCreativeAiError("");
      try {
        const recheck=await inspectSelectedLook(existing,view);
        if(recheck?.available && recheck.status==="pass") setPhotorealView(view);
        else setCreativeAiError("This view has not cleared fidelity QA. It remains held on the trusted front view.");
      } finally {
        setPhotorealViewLoading(null);
      }
      return;
    }
    if(photorealViewLoading) return;
    setPhotorealViewLoading(view);
    setCreativeAiError("");
    try {
      const response=await fetch("/api/designer/look-render",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          view,
          frontImage:creativeAi.image,
          frontJobId:creativeAi.jobId,
          shirt:{id:shirt.id,name:shirt.name,line:shirt.line,image:shirt.image,hex:shirt.hex,patternType:shirt.patternType},
          pant:{id:pant.id,name:pant.name,line:pant.line,image:pant.image,hex:pant.hex,patternType:pant.patternType},
          style,
          styleSpec,
          bodyProfile,
          locked:true,
          lookKey:renderSignature,
        }),
      });
      const data=await response.json() as {result?:PhotorealResult;error?:string};
      if(!response.ok || !data.result) throw new Error(data.error || "Photoreal view failed.");
      setPhotorealViews((current)=>({...current,[view]:data.result}));
      const check=await inspectSelectedLook(data.result,view);
      if(check?.available && check.status==="pass") setPhotorealView(view);
    } catch(error) {
      setCreativeAiError(error instanceof Error ? error.message : "Photoreal view failed.");
    } finally {
      setPhotorealViewLoading(null);
    }
  }

  useEffect(()=>{
    if(!autoRenderNonce || autoRenderNonce===lastAutoRenderNonce.current || !creativeDirection || !ready || creativeAiLoading) return;
    lastAutoRenderNonce.current=autoRenderNonce;
    void renderPhotoreal("automatic");
  },[autoRenderNonce,creativeDirection?.id,ready]);

  const activeSelectedCheck=photorealView==="front"
    ? creativeAi?.selectedCheck
    : photorealViews[photorealView]?.selectedCheck;
  const selectedPhotorealApproved=Boolean(
    creativeDirection || (activeSelectedCheck?.available && activeSelectedCheck.status==="pass")
  );

  function download() {
    // Customer exports fail closed to the deterministic studio preview. A
    // reviewed/unavailable AI image may be inspected on screen, but it cannot
    // silently become the saved design asset before fidelity QA passes.
    if(showCreativeAi && creativeAi && selectedPhotorealApproved) {
      const activeImage=photorealView==="front" ? creativeAi.image : (photorealViews[photorealView]?.image || creativeAi.image);
      const anchor=document.createElement("a");
      const name=`linen-earth-${shirt.id}-${pant.id}-${photorealView}`;
      anchor.href=`/api/designer/look-download?url=${encodeURIComponent(activeImage)}&name=${encodeURIComponent(name)}`;
      anchor.click();
      return;
    }
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
      {showCreativeAi && creativeAi && <img className="newDesignerPhotoAi" src={photorealView==="front" ? creativeAi.image : (photorealViews[photorealView]?.image || creativeAi.image)} alt={creativeDirection ? `Photoreal V5 render of ${creativeDirection.name}` : `Photoreal ${photorealView} view of ${shirt.name} with ${pant.name}`} />}
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
      <span className="newDesignerPhotoTag">{showCreativeAi && creativeAi ? `${photorealView.toUpperCase()} / PHOTOREAL` : "FRONT / STUDIO MODEL"}</span>
      {error && <span className="newDesignerPhotoError" role="alert">Preview could not load. Check the local fabric images.</span>}
      {!ready && !error && <span className="newDesignerPhotoLoading">Preparing your look…</span>}
    </div>
    <div className="newDesignerPhotoSummary newDesignerPhotoSummaryCompact">
      <div><span>SHIRT</span><strong>{shirt.name}</strong></div>
      <div><span>TROUSER</span><strong>{pant.name}</strong></div>
      <div className="newDesignerPhotoActions newDesignerPhotoActionsCompact">
        {!creativeAi && !creativeDirection && !finalLocked && <button className="primary" type="button" onClick={()=>{setFinalLocked(true);setCreativeAiError("");}} disabled={!ready}>Lock final design</button>}
        {!creativeAi && !creativeDirection && finalLocked && <button className="primary" type="button" onClick={()=>void renderPhotoreal("manual")} disabled={!ready || creativeAiLoading}>{creativeAiLoading ? "Rendering…" : "Final photoreal ✦"}</button>}
        {!creativeAi && creativeDirection && <button className="primary" type="button" onClick={()=>void renderPhotoreal("manual")} disabled={!ready || creativeAiLoading}>{creativeAiLoading ? "Rendering…" : "Render selected idea ✦"}</button>}
        {creativeAi && <button className="primary" type="button" onClick={()=>setShowCreativeAi((value)=>!value)}>{showCreativeAi ? "Instant preview" : (!creativeDirection && activeSelectedCheck && (!activeSelectedCheck.available || activeSelectedCheck.status==="review") ? "Review photoreal" : "Photoreal render")}</button>}
        {!creativeAi && !creativeDirection && finalLocked && <button type="button" onClick={()=>setFinalLocked(false)} disabled={creativeAiLoading}>Unlock</button>}
        <button type="button" onClick={() => setShowOriginal((value) => !value)} disabled={!ready}>{showOriginal ? "Show design" : "Compare"}</button>
        <button type="button" onClick={download} disabled={!ready}>{showCreativeAi && creativeAi && !selectedPhotorealApproved ? "Save trusted preview" : "Save"}</button>
      </div>
    </div>
    {!showCreativeAi && <p className="newDesignerPhotoApproximation"><strong>Instant preview</strong> · Studio model; {previewScaleVerified ? "pattern scale uses reviewed physical evidence plus accepted studio calibration where a visible repeat exists" : "pattern scale is still approximate for "+approximateScaleItems.join(" / ")}. Fit and drape still require physical verification. FASHN is reserved for the locked final design.</p>}
    {!creativeDirection && finalLocked && !creativeAi && <p className="newDesignerPhotoLock"><strong>FINAL DESIGN LOCKED</strong> · Any fabric or construction change automatically unlocks it before another AI render.</p>}
    {creativeAi?.cached && <p className="newDesignerPhotoCache">Cached final render reused · no new FASHN generation was needed.</p>}
    {creativeAi && !creativeDirection && activeSelectedCheck && (!activeSelectedCheck.available || activeSelectedCheck.status==="review") && <p className="newDesignerPhotoQaHold"><strong>PHOTOREAL HELD FOR REVIEW</strong> · The render has not cleared customer-facing fidelity QA. The trusted instant studio preview remains the save/export source until QA passes; the generated image is preserved only for explicit review or one targeted repair.</p>}
    {creativeAi && !creativeDirection && <div className="newDesignerPhotoViews" role="group" aria-label="Photoreal model views">
      {(["front","three-quarter","side","back"] as PhotorealView[]).map((view)=>{
        const frontQaReady=Boolean(creativeAi.selectedCheck?.available && creativeAi.selectedCheck.status==="pass");
        const existing=view==="front" ? creativeAi : photorealViews[view];
        const ownCheck=existing?.selectedCheck;
        const frontBlocked=view!=="front" && !frontQaReady;
        const ownReview=view!=="front" && Boolean(ownCheck?.available && ownCheck.status==="review");
        const ownUnchecked=view!=="front" && Boolean(existing && !ownCheck?.available);
        const baseLabel=view==="three-quarter" ? "3/4" : view[0].toUpperCase()+view.slice(1);
        const generateLabel=view==="three-quarter" ? "Generate 3/4" : "Generate "+view;
        return <button key={view} type="button" aria-pressed={photorealView===view} disabled={Boolean(photorealViewLoading) || frontBlocked} onClick={()=>void choosePhotorealView(view)}>
          {frontBlocked ? "Front QA first" : photorealViewLoading===view ? "Checking…" : view==="front" ? "Front" : ownReview ? "Review "+baseLabel : ownUnchecked ? "Recheck "+baseLabel : existing ? baseLabel : generateLabel}
        </button>;
      })}
    </div>}
    {creativeAi && !creativeDirection && activeSelectedCheck && <div className="newDesignerSelectedQa" data-status={activeSelectedCheck.available ? activeSelectedCheck.status : "unavailable"}>
      <div>
        <span>{!activeSelectedCheck.available
          ? `${photorealView.toUpperCase()} QA · MANUAL REVIEW`
          : activeSelectedCheck.status==="pass"
            ? `${photorealView.toUpperCase()} QA · PASSED`
            : photorealView==="front" ? "FRONT QA · REPAIR SUGGESTED" : `${photorealView.toUpperCase()} QA · REVIEW`}</span>
        <strong>{activeSelectedCheck.issue}</strong>
      </div>
      {photorealView==="front" && activeSelectedCheck.available && activeSelectedCheck.status==="review" && selectedRepairCount<1 && activeSelectedCheck.repairInstruction && <button type="button" onClick={()=>void repairSelectedLook()} disabled={creativeAiLoading}>{creativeAiLoading?"Repairing…":"Repair once ✦"}</button>}
      {activeSelectedCheck.available && <div className="newDesignerSelectedQaMetrics" aria-label="Photoreal render QA details">
        {([
          ["Colour",activeSelectedCheck.colorFidelity],
          ["Pattern",activeSelectedCheck.patternFidelity],
          ["Fabric",activeSelectedCheck.fabricFidelity],
          ["Construction",activeSelectedCheck.construction],
          ["Model",activeSelectedCheck.mannequinConsistency],
        ] as const).map(([label,status])=><i key={label} data-status={status}><b>{label}</b>{status}</i>)}
      </div>}
      {activeSelectedCheck.available && (activeSelectedCheck.measuredColorDeltaE || activeSelectedCheck.measuredPatternOrientation) && <small className="newDesignerSelectedQaEvidence">
        {activeSelectedCheck.measuredColorDeltaE && <>Measured colour ΔE · shirt {activeSelectedCheck.measuredColorDeltaE.shirt ?? "—"} · trouser {activeSelectedCheck.measuredColorDeltaE.pant ?? "—"}</>}
        {activeSelectedCheck.measuredColorDeltaE && activeSelectedCheck.measuredPatternOrientation && <> · </>}
        {activeSelectedCheck.measuredPatternOrientation && <>Pattern axis · shirt {activeSelectedCheck.measuredPatternOrientation.shirt ?? "—"} · trouser {activeSelectedCheck.measuredPatternOrientation.pant ?? "—"}</>}
      </small>}
      {photorealView==="front" && selectedRepairCount>=1 && <small>One targeted repair used. Review the result before generating again.</small>}
      {photorealView!=="front" && activeSelectedCheck.status==="review" && <small>This camera view needs review; the approved front outfit remains unchanged.</small>}
    </div>}
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
    </div>}
    {creativeAiError && <p className="newDesignerCreativeRenderError">{creativeAiError}</p>}
    <details className="newDesignerTechnicalDrawer newDesignerPhotoAccuracyCompact">
      <summary>Preview accuracy</summary>
      <p>{tucked ? "Tucked studio template" : "Untucked studio template"} · {template.trouser} · {template.break.toLowerCase()}.</p>
      {gaps.length > 0 && <p><b>Not yet exact:</b> {gaps.join(" · ")}.</p>}
      <p>Final colour, drape and fit still need physical fabric / sample verification.</p>
    </details>
  </section>;
}
