"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DesignerFabric, DesignerStyle } from "@/lib/designer/engine";
import type { StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import type { BodyPreviewProfile } from "@/lib/designer/body-profile";
import { applyRuntimeFabricScale, photoFabricPatternScale, visiblePatternScaleVerified, type FabricRenderAsset } from "@/lib/designer/live-preview";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import { photoCraftAreaPath, photoCraftZone, resolvePhotoCraft } from "@/lib/designer/photo-craft";
import { drawPhotoCraftDecoration } from "@/lib/designer/photo-craft-canvas";
import fabricTileManifest from "../../public/fabric-tiles/manifest.json";
import { CREATIVE_FEEDBACK_REASONS, type CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import { UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION, type CustomerPhotoCalibration } from "@/lib/designer/photo-calibration-types";
import { customerPhotoCalibrationIdentity, fetchCustomerPhotoCalibration } from "@/lib/designer/photo-calibration-client";
import { maskedPhotographicLuminance, neutralizePhotographicLuminance, weightedGarmentLuminanceMean } from "@/lib/designer/photo-shading";
import { createPreviewRequestScope, type PreviewRequest } from "@/lib/designer/preview-request-scope";
import { LINEN_EARTH_MODEL_IDENTITY_ID } from "@/lib/designer/model-identity";
import { photographicCollarOpacity, photographicGarmentOpacity } from "@/lib/designer/photo-garment-mask";
import {
  PHOTO_TUCKED_PANEL_GRAIN_ROTATION,
  PHOTO_TUCKED_PANEL_PATTERN_ANCHOR,
  PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION,
  PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR,
  PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION,
  PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR,
} from "@/lib/designer/photo-panel-grain";
import {
  DESIGNER_PHOTO_TEMPLATES, PHOTO_COLLAR_MASK, PHOTO_CUFF_MASK, PHOTO_TUCKED_COLLAR_MASK, PHOTO_TUCKED_COLLAR_STAND_MASK,
  PHOTO_TUCKED_CUFF_MASK, PHOTO_TUCKED_NECK_CLEAR, PHOTO_TUCKED_SHIRT_CLIP, PHOTO_TUCKED_TROUSER_CLIP,
  PHOTO_TUCKED_SHIRT_BODY_CLIP, PHOTO_TUCKED_LEFT_SLEEVE_CLIP, PHOTO_TUCKED_RIGHT_SLEEVE_CLIP,
  PHOTO_TUCKED_LEFT_TROUSER_CLIP, PHOTO_TUCKED_RIGHT_TROUSER_CLIP,
  PHOTO_UNTUCKED_SHIRT_BODY_CLIP, PHOTO_UNTUCKED_LEFT_SLEEVE_CLIP, PHOTO_UNTUCKED_RIGHT_SLEEVE_CLIP, PHOTO_UNTUCKED_COLLAR_CLIP,
  photoTemplateForStyle, photoTemplateGaps, previewFabricLabel,
} from "@/lib/designer/photo-preview";

const WIDTH = 1024;
const HEIGHT = 1536;
const LOCKED_PREVIEW_MIME="image/webp";
const LOCKED_PREVIEW_QUALITY=.96;

function serializeLockedPreview(canvas:HTMLCanvasElement) {
  // Keep fine weave/stripe detail for the final-render handoff. Modern browsers
  // emit WebP here; per Canvas semantics an unsupported type falls back to PNG,
  // which the server validator also accepts.
  return canvas.toDataURL(LOCKED_PREVIEW_MIME,LOCKED_PREVIEW_QUALITY);
}
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
const panelLightingMasks = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
const tuckedMasks = new WeakMap<HTMLImageElement, { shirt: HTMLCanvasElement; pant: HTMLCanvasElement; collar: HTMLCanvasElement }>();
const untuckedMasks = new WeakMap<HTMLImageElement, { shirt: HTMLCanvasElement; pant: HTMLCanvasElement }>();
const untuckedTrouserLegMasks = new WeakMap<HTMLCanvasElement, { left: HTMLCanvasElement; right: HTMLCanvasElement }>();
const photographicReliefMaps = new WeakMap<HTMLImageElement, Map<HTMLCanvasElement | null, HTMLCanvasElement>>();
const photographicShapeMaps = new WeakMap<HTMLImageElement, Map<HTMLCanvasElement | null, HTMLCanvasElement>>();
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
  // An operator can replace a reference without changing its catalogue ID.
  // Cache the actual loaded source and crop inputs, not the ID alone.
  const tileKey=JSON.stringify([fabric.id,image.currentSrc||image.src,fabric.patternType,fabric.hex]);
  const cached = fabricTiles.get(tileKey);
  if (cached) {
    fabricTiles.delete(tileKey);
    fabricTiles.set(tileKey, cached);
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
    fabricTiles.set(tileKey,tile);
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
  fabricTiles.set(tileKey, tile);
  if (fabricTiles.size > 12) {
    const oldest = fabricTiles.keys().next().value;
    if (oldest) fabricTiles.delete(oldest);
  }
  return tile;
}

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }

function photographicReliefMap(photo: HTMLImageElement, garmentMask?: HTMLCanvasElement) {
  let cachedByMask = photographicReliefMaps.get(photo);
  if (!cachedByMask) {
    cachedByMask = new Map<HTMLCanvasElement | null, HTMLCanvasElement>();
    photographicReliefMaps.set(photo, cachedByMask);
  }
  const cacheKey = garmentMask ?? null;
  const cached = cachedByMask.get(cacheKey);
  if (cached) return cached;

  // Extract colour-neutral high/medium-frequency structure only from the
  // photographed garment region. Outside pixels are replaced by that garment's
  // own mean luminance before blurring, preventing neck/skin/background values
  // from creating false edge halos inside the cloth.
  const reliefWidth = WIDTH / 2;
  const reliefHeight = HEIGHT / 2;
  const source = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const blurred = document.createElement("canvas");
  const broad = document.createElement("canvas");
  const detail = document.createElement("canvas");
  source.width = maskCanvas.width = blurred.width = broad.width = detail.width = reliefWidth;
  source.height = maskCanvas.height = blurred.height = broad.height = detail.height = reliefHeight;

  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  const blurContext = blurred.getContext("2d", { willReadFrequently: true });
  const broadContext = broad.getContext("2d", { willReadFrequently: true });
  const detailContext = detail.getContext("2d");
  if (!sourceContext || !maskContext || !blurContext || !broadContext || !detailContext) throw new Error("Canvas is unavailable.");

  sourceContext.filter = "grayscale(1)";
  sourceContext.drawImage(photo, 0, 0, reliefWidth, reliefHeight);
  if (garmentMask) maskContext.drawImage(garmentMask, 0, 0, reliefWidth, reliefHeight);
  else {
    maskContext.fillStyle = "#fff";
    maskContext.fillRect(0, 0, reliefWidth, reliefHeight);
  }

  const original = sourceContext.getImageData(0, 0, reliefWidth, reliefHeight);
  const maskPixels = maskContext.getImageData(0, 0, reliefWidth, reliefHeight);
  const garmentMean = weightedGarmentLuminanceMean(original.data, maskPixels.data);
  const maskedSource = sourceContext.createImageData(reliefWidth, reliefHeight);
  for (let index = 0; index < original.data.length; index += 4) {
    const value = maskedPhotographicLuminance(original.data[index],garmentMean,maskPixels.data[index+3]);
    maskedSource.data[index] = value;
    maskedSource.data[index + 1] = value;
    maskedSource.data[index + 2] = value;
    maskedSource.data[index + 3] = 255;
  }
  sourceContext.putImageData(maskedSource, 0, 0);

  blurContext.filter = "grayscale(1) blur(1.25px)";
  blurContext.drawImage(source, 0, 0, reliefWidth, reliefHeight);
  broadContext.filter = "grayscale(1) blur(7px)";
  broadContext.drawImage(source, 0, 0, reliefWidth, reliefHeight);

  const localSource = sourceContext.getImageData(0, 0, reliefWidth, reliefHeight);
  const soft = blurContext.getImageData(0, 0, reliefWidth, reliefHeight);
  const broadPixels = broadContext.getImageData(0, 0, reliefWidth, reliefHeight);
  const pixels = detailContext.createImageData(reliefWidth, reliefHeight);
  for (let index = 0; index < localSource.data.length; index += 4) {
    const microDetail = localSource.data[index] - soft.data[index];
    const foldDetail = soft.data[index] - broadPixels.data[index];
    // Two neutral frequency bands preserve seams/weave plus medium folds while
    // cancelling source-cloth base value and neighbouring non-garment pixels.
    const neutralRelief = Math.max(0, Math.min(255, Math.round(128 + microDetail * 1.8 + foldDetail * 1.15)));
    pixels.data[index] = neutralRelief;
    pixels.data[index + 1] = neutralRelief;
    pixels.data[index + 2] = neutralRelief;
    pixels.data[index + 3] = 255;
  }
  detailContext.putImageData(pixels, 0, 0);
  cachedByMask.set(cacheKey, detail);
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
  const blurred = document.createElement("canvas");
  const shape = document.createElement("canvas");
  source.width = maskCanvas.width = blurred.width = shape.width = mapWidth;
  source.height = maskCanvas.height = blurred.height = shape.height = mapHeight;

  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  const blurContext = blurred.getContext("2d", { willReadFrequently: true });
  const shapeContext = shape.getContext("2d");
  if (!sourceContext || !maskContext || !blurContext || !shapeContext) throw new Error("Canvas is unavailable.");

  sourceContext.filter = "grayscale(1)";
  sourceContext.drawImage(photo, 0, 0, mapWidth, mapHeight);
  if (garmentMask) maskContext.drawImage(garmentMask, 0, 0, mapWidth, mapHeight);
  else {
    maskContext.fillStyle = "#fff";
    maskContext.fillRect(0, 0, mapWidth, mapHeight);
  }

  const original = sourceContext.getImageData(0, 0, mapWidth, mapHeight);
  const maskPixels = maskContext.getImageData(0, 0, mapWidth, mapHeight);
  const output = shapeContext.createImageData(mapWidth, mapHeight);

  const garmentMean = weightedGarmentLuminanceMean(original.data, maskPixels.data);
  // Mask BEFORE blurring. Blurring the full photo first pulled bright skin,
  // arm gaps and floor into sleeve/leg edges and produced a pasted-on halo.
  for(let index=0;index<original.data.length;index+=4) {
    const value=maskedPhotographicLuminance(original.data[index],garmentMean,maskPixels.data[index+3]);
    original.data[index]=original.data[index+1]=original.data[index+2]=value;
    original.data[index+3]=255;
  }
  sourceContext.putImageData(original,0,0);
  blurContext.filter="blur(5px)";
  blurContext.drawImage(source,0,0);
  const input=blurContext.getImageData(0,0,mapWidth,mapHeight);

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


function photoLightingMask(mask?:HTMLCanvasElement,path="",maskPrepared=false) {
  if(mask && path) {
    let byPath=panelLightingMasks.get(mask);
    if(!byPath) {
      byPath=new Map<string,HTMLCanvasElement>();
      panelLightingMasks.set(mask,byPath);
    }
    const cacheKey=`${maskPrepared?"prepared":"raw"}:${path}`;
    const cached=byPath.get(cacheKey);
    if(cached) return cached;

    // Lighting normalization must follow the exact photographed panel being
    // drawn, not the whole shirt or both trouser legs. Intersect the adaptive
    // cloth mask with the traced panel path before deriving shape/relief.
    const combined=document.createElement("canvas");
    combined.width=WIDTH;
    combined.height=HEIGHT;
    const context=combined.getContext("2d");
    if(!context) throw new Error("Canvas is unavailable.");
    context.drawImage(maskPrepared?mask:featherMaskInside(mask),0,0);
    context.globalCompositeOperation="destination-in";
    context.drawImage(featheredPathMask(path),0,0);
    context.globalCompositeOperation="source-over";
    byPath.set(cacheKey,combined);
    return combined;
  }
  if(mask) return maskPrepared?mask:featherMaskInside(mask);
  if(path) return featheredPathMask(path);
  return undefined;
}

// The tucked photo has dark, cool shirting and warm trousers. Separate them
// by their traced geometry and photographic colour at uncertain edges. Neutral
// cloth folds inside that geometry must not become holes in the new fabric.
function tuckedGarmentMasks(photo: HTMLImageElement) {
  const cached = tuckedMasks.get(photo);
  if (cached) return cached;
  const source = document.createElement("canvas");
  source.width = WIDTH; source.height = HEIGHT;
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  const mask = (region: "shirt" | "pant" | "collar") => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.fillStyle="#fff";
    const geometryPath=region==="collar" ? PHOTO_TUCKED_NECK_CLEAR : region==="shirt" ? PHOTO_TUCKED_SHIRT_CLIP : PHOTO_TUCKED_TROUSER_CLIP;
    ctx.fill(new Path2D(geometryPath));
    if(region==="shirt") {
      ctx.globalCompositeOperation="destination-out";
      ctx.fill(new Path2D(PHOTO_TUCKED_NECK_CLEAR));
      ctx.globalCompositeOperation="source-over";
    }
    const geometry=ctx.getImageData(0,0,WIDTH,HEIGHT).data;
    const interior=document.createElement("canvas");
    interior.width=WIDTH; interior.height=HEIGHT;
    const interiorContext=interior.getContext("2d");
    if(!interiorContext) throw new Error("Canvas is unavailable.");
    // This is prepared once per photograph and reused across option changes.
    // Blur only the geometric coverage, never the selected fabric or its repeat.
    interiorContext.filter="blur(3px)";
    interiorContext.drawImage(canvas,0,0);
    const blurredGeometry=interiorContext.getImageData(0,0,WIDTH,HEIGHT).data;
    const data = ctx.createImageData(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      if (region === "shirt" && (y < 188 || y > 705 || x < 270 || x > 748)) continue;
      if (region === "pant" && (y < 541 || y > 1360 || x < 342 || x > 680)) continue;
      if (region === "collar" && (y < 165 || y > 260 || x < 440 || x > 590)) continue;
      const i = (y * WIDTH + x) * 4;
      const red = pixels[i], green = pixels[i + 1], blue = pixels[i + 2];
      // The neckline contains both cloth and skin. Recover only actual cool
      // source cloth there; interior geometry alone cannot classify neck skin.
      const opacity=region==="collar" ? photographicCollarOpacity(red,green,blue,geometry[i+3]) : photographicGarmentOpacity(region,red,green,blue,geometry[i+3],blurredGeometry[i+3]);
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
    ctx.fill(new Path2D(geometryPath));

    if (region === "shirt") {
      // The collar is composited separately below. Clearing the photographed
      // neck opening here prevents cloth from painting over the mannequin.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill(new Path2D(PHOTO_TUCKED_NECK_CLEAR));
    }
    ctx.globalCompositeOperation = "source-over";
    return canvas;
  };
  const result = { shirt: mask("shirt"), pant: mask("pant"), collar: mask("collar") };
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

const UNTUCKED_TROUSER_SEAM_X=512;

function splitUntuckedTrouserLegMasks(mask:HTMLCanvasElement) {
  const cached=untuckedTrouserLegMasks.get(mask);
  if(cached) return cached;

  // Start from the already inward-feathered photographed trouser silhouette,
  // then divide its alpha into complementary left/right leg masks. Across a
  // narrow center transition the two alpha values sum back to the original,
  // avoiding a bright gap or doubled textile at the fly/crotch seam.
  const prepared=featherMaskInside(mask);
  const preparedContext=prepared.getContext("2d",{willReadFrequently:true});
  if(!preparedContext) throw new Error("Canvas is unavailable.");
  const source=preparedContext.getImageData(0,0,WIDTH,HEIGHT);
  const make=()=> {
    const canvas=document.createElement("canvas");
    canvas.width=WIDTH;
    canvas.height=HEIGHT;
    const context=canvas.getContext("2d");
    if(!context) throw new Error("Canvas is unavailable.");
    return {canvas,context,data:context.createImageData(WIDTH,HEIGHT)};
  };
  const left=make();
  const right=make();
  const transitionHalfWidth=3;
  for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
    const index=(y*WIDTH+x)*4;
    const alpha=source.data[index+3];
    if(!alpha) continue;
    const rightWeight=clamp((x-(UNTUCKED_TROUSER_SEAM_X-transitionHalfWidth))/(transitionHalfWidth*2));
    const leftWeight=1-rightWeight;
    for(const target of [left,right]) {
      target.data.data[index]=255;
      target.data.data[index+1]=255;
      target.data.data[index+2]=255;
    }
    left.data.data[index+3]=Math.round(alpha*leftWeight);
    right.data.data[index+3]=Math.round(alpha*rightWeight);
  }
  left.context.putImageData(left.data,0,0);
  right.context.putImageData(right.data,0,0);
  const result={left:left.canvas,right:right.canvas};
  untuckedTrouserLegMasks.set(mask,result);
  return result;
}

type FabricPatternPlacement={
  offsetX?:number;
  offsetY?:number;
  scale?:number;
  rotationDeg?:number;
  photoPxPerMm?:number;
  anchorX?:number;
  anchorY?:number;
  maskPrepared?:boolean;
  // Base panels are assembled into one cloth layer; its outer photographed
  // silhouette is applied once, after all panels have been painted.
  deferCoverage?:boolean;
};

function fabricPatternTransform(fabric:DesignerFabric,placement:FabricPatternPlacement,scale:number) {
  const offsetX=placement.offsetX??0;
  const offsetY=placement.offsetY??0;
  const rotation=fabricOrientation(fabric)+(placement.rotationDeg??0);
  const anchorX=Number(placement.anchorX);
  const anchorY=Number(placement.anchorY);
  const hasAnchor=Number.isFinite(anchorX)&&Number.isFinite(anchorY);
  let transform=new DOMMatrix().translate(offsetX,offsetY);
  if(hasAnchor) {
    // Keep the photographed seam/waist anchor stationary while repeat scale or
    // panel rotation changes. Otherwise the infinite texture is re-phased
    // around the canvas origin and stripes visibly jump at the panel start.
    transform=transform
      .translate(anchorX,anchorY)
      .rotate(rotation)
      .scale(scale)
      .translate(-anchorX,-anchorY);
  } else {
    transform=transform.rotate(rotation).scale(scale);
  }
  return transform;
}

function drawGarment(
  target: CanvasRenderingContext2D, photo: HTMLImageElement,
  swatch: HTMLImageElement, fabric: DesignerFabric, path: string,
  mask?: HTMLCanvasElement,
  placement: FabricPatternPlacement = {},
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
  pattern.setTransform(fabricPatternTransform(fabric,placement,scale));
  context.fillStyle = pattern;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Use a neutral, low-frequency lighting field rather than directly blending
  // the source garment's luminance/albedo into the selected Linen Earth cloth.
  // This keeps the actual swatch hue and woven texture authoritative while the
  // studio photograph contributes broad three-dimensional form.
  const lightingMask = photoLightingMask(mask,path,Boolean(placement.maskPrepared));
  const shape = photographicShapeMap(photo, lightingMask);
  context.filter = "none";
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .9;
  context.drawImage(shape, 0, 0, WIDTH, HEIGHT);

  // A tiny multiply reinforcement is enough for deep folds because the shape
  // map is already centered around neutral gray. We intentionally do not blend
  // the original navy/beige template cloth back into the selected fabric.
  context.globalCompositeOperation = "multiply";
  context.globalAlpha = .07;
  context.drawImage(shape, 0, 0, WIDTH, HEIGHT);

  // Restore seam, weave, wrinkle and medium-fold contrast only from a
  // colour-neutral multi-band relief map. Direct source-photo detail blending
  // is intentionally avoided because even grayscale passes can reintroduce the
  // original garment's value bias into a pale or dark selected fabric.
  const relief = photographicReliefMap(photo, lightingMask);
  context.filter = "none";
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .7;
  context.drawImage(relief, 0, 0, WIDTH, HEIGHT);
  context.globalCompositeOperation = "overlay";
  context.globalAlpha = .14;
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
  if(placement.deferCoverage) {
    if(!path) throw new Error("Deferred garment panels require a bounded path.");
    context.fillStyle="#fff";
    context.fill(new Path2D(path));
  } else {
    if (mask) context.drawImage(placement.maskPrepared?mask:featherMaskInside(mask), 0, 0);
    // Hard SVG-like clip edges make fabric look pasted onto the photograph.
    // Feather only toward the garment interior so collar/cuff/body boundaries
    // inherit the photographed antialiasing without leaking onto skin or set.
    if (path) context.drawImage(featheredPathMask(path), 0, 0);
  }
  context.globalCompositeOperation = "source-over";
  target.drawImage(layer, 0, 0);
}

function drawGarmentAtlas(target:CanvasRenderingContext2D,mask:HTMLCanvasElement,paint:(context:CanvasRenderingContext2D)=>void) {
  const atlas=document.createElement("canvas");
  atlas.width=WIDTH;atlas.height=HEIGHT;
  const context=atlas.getContext("2d");
  if(!context) throw new Error("Canvas is unavailable.");
  paint(context);
  // The adaptive silhouette already contains photographed edge coverage and
  // path antialiasing. Apply it once: blurring it again would expose a strip of
  // source cloth along the waist and other otherwise fully covered boundaries.
  context.globalCompositeOperation="destination-in";
  context.drawImage(mask,0,0);
  target.drawImage(atlas,0,0);
}

type CreativePreviewSpec = Pick<CreativeDirection,"id"|"name"|"treatments"|"pattern"|"craft">;
type PhotoCraftPanel={fabric:DesignerFabric;image:HTMLImageElement};

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

function drawPhotoCraft(
  target:CanvasRenderingContext2D, modelPhoto:HTMLImageElement, trouserPhoto:HTMLImageElement,
  style:DesignerStyle, creative:CreativePreviewSpec|undefined, panel:PhotoCraftPanel|undefined,
  calibration:PhotoPreviewCalibration|undefined,
) {
  const craft=creative?.craft;
  if(!craft)return;
  const tucked=style.shirtWear==="Tucked",template=DESIGNER_PHOTO_TEMPLATES[photoTemplateForStyle(style)];
  const tuckedMask=tucked?tuckedGarmentMasks(modelPhoto):null;
  const shirtMask=tuckedMask?.shirt||untuckedGarmentMasks(modelPhoto,template.shirtPath,DESIGNER_PHOTO_TEMPLATES.pleated.trouserPath).shirt;
  const pantMask=tuckedMask?.pant||untuckedGarmentMasks(trouserPhoto,template.shirtPath,template.trouserPath).pant;
  const draw=(zone:NonNullable<CreativePreviewSpec["craft"]>["panels"][number]["zone"],decoration:boolean)=>{
    const placement=photoCraftZone(zone,style);
    if(placement.status!=="approximate")return;
    const path=photoCraftAreaPath(placement.areas),region=placement.region;
    const boundary=region==="collar"?(tucked?PHOTO_TUCKED_COLLAR_MASK:PHOTO_UNTUCKED_COLLAR_CLIP):
      region==="cuff"?(tucked?PHOTO_TUCKED_CUFF_MASK:PHOTO_CUFF_MASK):
      region==="shirt"?(tucked?PHOTO_TUCKED_SHIRT_BODY_CLIP:PHOTO_UNTUCKED_SHIRT_BODY_CLIP):
      tucked?PHOTO_TUCKED_TROUSER_CLIP:template.trouserPath;
    const mask=photoLightingMask(region==="collar"?undefined:region==="pant"?pantMask:shirtMask,boundary);
    const photo=region==="pant"?trouserPhoto:modelPhoto;
    if(!decoration&&panel){
      const grain=region==="pant"?(tucked?PHOTO_TUCKED_PANEL_GRAIN_ROTATION.rightTrouser:PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION[photoTemplateForStyle(style)==="wide"?"wide":"pleated"].rightTrouser):0;
      drawGarment(target,photo,panel.image,panel.fabric,path,mask,{...calibration,maskPrepared:true,rotationDeg:grain,anchorX:placement.areas[0].x,anchorY:placement.areas[0].y});
    }
    if(decoration&&craft.decoration){
      const layer=document.createElement("canvas");layer.width=WIDTH;layer.height=HEIGHT;
      const ctx=layer.getContext("2d");if(!ctx)return;
      drawPhotoCraftDecoration(ctx,craft.decoration,placement.areas);
      // A light neutral relief tint preserves the marks' alpha; source-atop
      // cannot turn transparent gaps into a rectangular layer over the cloth.
      ctx.globalCompositeOperation="source-atop";ctx.globalAlpha=.15;
      ctx.drawImage(photographicReliefMap(photo,mask),0,0);
      ctx.globalAlpha=1;ctx.globalCompositeOperation="destination-in";
      if(mask)ctx.drawImage(mask,0,0);
      ctx.drawImage(featheredPathMask(path),0,0);
      target.drawImage(layer,0,0);
    }
  };
  if(panel&&craft.panels[0]?.fabric.id===panel.fabric.id)draw(craft.panels[0].zone,false);
  if(craft.decoration)draw(craft.decoration.zone,true);
}

function creativePreviewCoverage(creative:CreativePreviewSpec|undefined,style:DesignerStyle,craftReady:boolean) {
  if(!creative) return {visible:[] as string[],specOnly:[] as string[]};
  const visible:string[]=[];
  const specOnly:string[]=[];
  if(creative.pattern) visible.push(`Surface preview · ${creative.pattern.name}`);
  const partiallyVisible=new Set(["extended-white-cuff","quiet-collar-echo","tonal-panel","collar-line","border-cuff","direction-control"]);
  for(const move of creative.treatments) {
    if(move.id==="craft-panel"||move.id==="craft-decoration"){
      const zone=move.id==="craft-panel"?creative.craft?.panels[0]?.zone:creative.craft?.decoration?.zone;
      if(craftReady&&zone&&photoCraftZone(zone,style).status==="approximate")visible.push(`Proposed · ${move.label}`);
      else specOnly.push(move.label);
      continue;
    }
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

  // White contrast cloth uses the same baseline-neutral studio structure as
  // the garment body. The detail path defines its own luminance baseline, so
  // dark source collars/cuffs cannot turn selected white cloth grey or muddy.
  const detailMask = featheredPathMask(path);
  const shape = photographicShapeMap(photo, detailMask);
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = .42;
  context.drawImage(shape, 0, 0, WIDTH, HEIGHT);

  const relief = photographicReliefMap(photo, detailMask);
  context.globalAlpha = .32;
  context.drawImage(relief, 0, 0, WIDTH, HEIGHT);
  context.globalCompositeOperation = "overlay";
  context.globalAlpha = .06;
  context.drawImage(relief, 0, 0, WIDTH, HEIGHT);

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
  craftPanel?: PhotoCraftPanel,
) {
  const templateKey=photoTemplateForStyle(style);
  const template = DESIGNER_PHOTO_TEMPLATES[templateKey];
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
    // Directional fabric grain follows each photographed panel's screen-space
    // fall, so stripes/checks do not stay unnaturally vertical on angled sleeves.
    drawGarmentAtlas(context,masks.shirt,atlas=>{
      drawGarment(atlas, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_SHIRT_BODY_CLIP, masks.shirt, { ...calibratedPlacement, deferCoverage:true, offsetX: 0, rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.body, anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.body.x, anchorY:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.body.y });
      drawGarment(atlas, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_LEFT_SLEEVE_CLIP, masks.shirt, { ...calibratedPlacement, deferCoverage:true, offsetX: 11, rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.leftSleeve, anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.leftSleeve.x, anchorY:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.leftSleeve.y });
      drawGarment(atlas, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_RIGHT_SLEEVE_CLIP, masks.shirt, { ...calibratedPlacement, deferCoverage:true, offsetX: -9, rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.rightSleeve, anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.rightSleeve.x, anchorY:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.rightSleeve.y });
    });

    drawCreativePattern(context,creative,PHOTO_TUCKED_SHIRT_BODY_CLIP,masks.shirt);
    drawCreativePattern(context,creative,PHOTO_TUCKED_LEFT_SLEEVE_CLIP,masks.shirt);
    drawCreativePattern(context,creative,PHOTO_TUCKED_RIGHT_SLEEVE_CLIP,masks.shirt);
    drawCreativeDetails(context,creative,true,masks.shirt);

    if (style.collarFinish === "Self-fabric") {
      // The broad neck clear zone removed inner collar folds as well as skin.
      // Put back selected cloth only where source-colour segmentation confirms
      // collar cloth, then draw the existing traced collar wings over it.
      drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_NECK_CLEAR, masks.collar,{...calibratedPlacement,rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.collar,anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.collar.x,anchorY:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.collar.y});
      drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_COLLAR_MASK, undefined,{...calibratedPlacement,rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.collar,anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.collar.x,anchorY:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.collar.y});
    } else {
      drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_STAND_MASK, undefined);
      if (!creativeHas(creative,"quiet-collar-echo")) drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_MASK, undefined);
    }
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_CUFF_MASK, undefined);

    drawGarmentAtlas(context,masks.pant,atlas=>{
      drawGarment(atlas, modelPhoto, pantImage, pant, PHOTO_TUCKED_LEFT_TROUSER_CLIP, masks.pant, { ...calibratedPlacement, deferCoverage:true, offsetX: 5, rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.leftTrouser, anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.leftTrouser.x, anchorY:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.leftTrouser.y });
      drawGarment(atlas, modelPhoto, pantImage, pant, PHOTO_TUCKED_RIGHT_TROUSER_CLIP, masks.pant, { ...calibratedPlacement, deferCoverage:true, offsetX: -5, rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION.rightTrouser, anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.rightTrouser.x, anchorY:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR.rightTrouser.y });
    });
  } else {
    const shirtMask = untuckedGarmentMasks(modelPhoto, template.shirtPath, DESIGNER_PHOTO_TEMPLATES.pleated.trouserPath).shirt;
    const trouserMask = untuckedGarmentMasks(trouserPhoto, template.shirtPath, template.trouserPath).pant;
    const trouserLegMasks=splitUntuckedTrouserLegMasks(trouserMask);
    const trouserGeometry=templateKey==="wide"?"wide":"pleated";

    // Split the untucked trouser photograph into complementary leg masks. Each
    // leg gets its own photographed lighting baseline and screen-space fall,
    // while the seam transition preserves the original silhouette alpha.
    drawGarmentAtlas(context,trouserMask,atlas=>{
      drawGarment(atlas, trouserPhoto, pantImage, pant, `M 0 0 H ${UNTUCKED_TROUSER_SEAM_X} V ${HEIGHT} H 0 Z`, trouserLegMasks.left, {
        ...calibratedPlacement,
        maskPrepared:true,
        deferCoverage:true,
        rotationDeg:PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION[trouserGeometry].leftTrouser,
        anchorX:PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR[trouserGeometry].leftTrouser.x,
        anchorY:PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR[trouserGeometry].leftTrouser.y,
      });
      drawGarment(atlas, trouserPhoto, pantImage, pant, `M ${UNTUCKED_TROUSER_SEAM_X} 0 H ${WIDTH} V ${HEIGHT} H ${UNTUCKED_TROUSER_SEAM_X} Z`, trouserLegMasks.right, {
        ...calibratedPlacement,
        maskPrepared:true,
        deferCoverage:true,
        rotationDeg:PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION[trouserGeometry].rightTrouser,
        anchorX:PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR[trouserGeometry].rightTrouser.x,
        anchorY:PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR[trouserGeometry].rightTrouser.y,
      });
    });

    // The untucked shirt photograph is also panelized. Torso, sleeves and
    // collar borrow their own photographed lighting region and directional
    // cloth follows each traced arm instead of staying globally vertical.
    drawGarmentAtlas(context,shirtMask,atlas=>{
      drawGarment(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_SHIRT_BODY_CLIP, shirtMask, {
        ...calibratedPlacement,
        deferCoverage:true,
        rotationDeg:PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION.body,
        anchorX:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.body.x,
        anchorY:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.body.y,
      });
      drawGarment(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_LEFT_SLEEVE_CLIP, shirtMask, {
        ...calibratedPlacement,
        deferCoverage:true,
        rotationDeg:PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION.leftSleeve,
        anchorX:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.leftSleeve.x,
        anchorY:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.leftSleeve.y,
      });
      drawGarment(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_RIGHT_SLEEVE_CLIP, shirtMask, {
        ...calibratedPlacement,
        deferCoverage:true,
        rotationDeg:PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION.rightSleeve,
        anchorX:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.rightSleeve.x,
        anchorY:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.rightSleeve.y,
      });
      drawGarment(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_COLLAR_CLIP, shirtMask, {
        ...calibratedPlacement,
        deferCoverage:true,
        rotationDeg:PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION.collar,
        anchorX:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.collar.x,
        anchorY:PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR.collar.y,
      });
    });
    drawCreativePattern(context,creative,"",shirtMask);
    drawCreativeDetails(context,creative,false,shirtMask);
    if (style.collarFinish !== "Self-fabric") drawWhiteDetail(context, modelPhoto, PHOTO_COLLAR_MASK);
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_CUFF_MASK);
  }
  // Craft is composed last so contrast details cannot erase the selected
  // catalogue panel or its thread marks. Zone/garment masks protect skin/set.
  drawPhotoCraft(context,modelPhoto,trouserPhoto,style,creative,craftPanel,calibration);
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
          onPreviewReadyRef.current(serializeLockedPreview(canvas),resolvedCalibrationIdentity);
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

export function PhotoOutfitPreview({ shirt, pant, style, styleSpec, bodyProfile, creativeDirection, craftFabrics, onCreativeFeedback, onCreativeInspection, autoRenderNonce = 0, onCreativeRenderStart, renderRepairInstruction = "" }: {
  shirt: DesignerFabric;
  pant: DesignerFabric;
  style: DesignerStyle;
  styleSpec?: StyleSpecV2;
  bodyProfile?: BodyPreviewProfile;
  creativeDirection?: CreativeDirection | null;
  craftFabrics?: DesignerFabric[];
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
  const resolvedCraft=useMemo(()=>resolvePhotoCraft(creativeDirection?.craft,craftFabrics||[],shirt.id,pant.id),[creativeDirection?.craft,craftFabrics,shirt.id,pant.id]);
  const previewCreative=useMemo(()=>creativeDirection?{...creativeDirection,craft:resolvedCraft?.craft}:undefined,[creativeDirection,resolvedCraft]);
  const creativeCoverage = creativePreviewCoverage(creativeDirection || undefined,style,Boolean(resolvedCraft));
  const shirtPreviewAsset=fabricRenderAsset(shirt);
  const pantPreviewAsset=fabricRenderAsset(pant);
  const shirtScaleEvidenceReady=visiblePatternScaleVerified(shirt.patternType,shirtPreviewAsset);
  const pantScaleEvidenceReady=visiblePatternScaleVerified(pant.patternType,pantPreviewAsset);
  const photoScaleReady=photoCalibration.verified&&Number.isFinite(verifiedPhotoPxPerMm)&&Number(verifiedPhotoPxPerMm)>0;
  const shirtPatternScaleVerified=shirt.patternType.toLowerCase()==="solid" || (shirtScaleEvidenceReady&&photoScaleReady);
  const pantPatternScaleVerified=pant.patternType.toLowerCase()==="solid" || (pantScaleEvidenceReady&&photoScaleReady);
  const visiblePanelFabric=resolvedCraft?.panelFabric&&photoCraftZone(resolvedCraft.craft.panels[0].zone,style).status==="approximate"?resolvedCraft.panelFabric:undefined;
  const panelPatternScaleVerified=!visiblePanelFabric||visiblePanelFabric.patternType.toLowerCase()==="solid"||(visiblePatternScaleVerified(visiblePanelFabric.patternType,fabricRenderAsset(visiblePanelFabric))&&photoScaleReady);
  const previewScaleVerified=shirtPatternScaleVerified&&pantPatternScaleVerified&&panelPatternScaleVerified;
  const approximateScaleItems=[...new Set([
    ...(shirtPatternScaleVerified?[]:[shirt.name]),
    ...(pantPatternScaleVerified?[]:[pant.name]),
    ...(panelPatternScaleVerified||!visiblePanelFabric?[]:[visiblePanelFabric.name]),
  ])];
  const renderSignature=JSON.stringify({
    shirt:shirt.id,
    pant:pant.id,
    fabricReferences:{
      shirt:{image:shirt.image,hex:shirt.hex,patternType:shirt.patternType,renderScale:shirt.renderScale||null},
      pant:{image:pant.image,hex:pant.hex,patternType:pant.patternType,renderScale:pant.renderScale||null},
    },
    style,
    styleSpec:styleSpec||null,
    bodyProfile:bodyProfile||null,
    creative:creativeDirection?{id:creativeDirection.id,craft:creativeDirection.craft||null,treatments:creativeDirection.treatments,pattern:creativeDirection.pattern||null}:null,
    craftCatalogue:resolvedCraft?{craft:resolvedCraft.craft,renderScale:resolvedCraft.panelFabric?.renderScale||null}:null,
    photoCalibration:photoCalibration.verified ? {
      verified:true,
      photoPxPerMm:verifiedPhotoPxPerMm,
      scaleCoordinateSystem:photoCalibration.scaleCoordinateSystem,
      proofVersion:photoCalibration.proofVersion,
    } : {verified:false},
  });
  const requestScope=useMemo(()=>createPreviewRequestScope(),[renderSignature]);

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

  useLayoutEffect(() => {
    requestScope.activate();
    setReady(false);
    setCreativeAi(null);
    setCreativeAiLoading(false);
    setCreativeAiError("");
    setShowCreativeAi(false);
    setPhotorealView("front");
    setPhotorealViews({});
    setPhotorealViewLoading(null);
    setSelectedRepairCount(0);
    setFinalLocked(false);
    setCreativeReview(null);
    setCreativeReviewReason(null);
    // Invalidate before paint: responses from the previous committed design
    // must not repopulate its render, QA, cache or loading state in this look.
    return ()=>requestScope.invalidate();
  },[requestScope]);

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
      resolvedCraft?.panelFabric&&photoCraftZone(resolvedCraft.craft.panels[0].zone,style).status==="approximate"?loadFabricImage(resolvedCraft.panelFabric):Promise.resolve(undefined),
    ]).then(([modelPhoto, trouserPhoto, shirtImage, pantImage, panelImage]) => {
        if (cancelled || !requestScope.isEnabled()) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) throw new Error("Canvas is unavailable.");
        composePhotoOutfit(context, modelPhoto, trouserPhoto, shirtImage, pantImage, shirt, pant, style, previewCreative,{photoPxPerMm:verifiedPhotoPxPerMm},panelImage&&resolvedCraft?.panelFabric?{image:panelImage,fabric:resolvedCraft.panelFabric}:undefined);
        setError(false);
        setReady(true);
      })
      .catch(() => { if (!cancelled && requestScope.isEnabled()) { setReady(false); setError(true); } });
    return () => { cancelled = true; };
  }, [shirt, pant, template, tucked, style, previewCreative, resolvedCraft, verifiedPhotoPxPerMm, requestScope]);

  async function inspectSelectedLook(result:PhotorealResult,view:PhotorealView,request:PreviewRequest):Promise<SelectedLookVisualCheck|null> {
    if(!request.isCurrent()) return null;
    try {
      const response=await fetch("/api/designer/look-inspect",{
        method:"POST",
        signal:request.signal,
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
      if(!request.isCurrent()) return null;
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
    const request=requestScope.begin();
    if(!request) return;
    setCreativeAiLoading(true);
    setCreativeAiError("");
    try {
      if(origin==="manual") {
        previousReviewedRender.current="";
        onCreativeRenderStart?.();
      }
      if(!creativeDirection) {
        const cached=selectedLookSessionCache.get(renderSignature);
        if(cached) {
          const cachedResult={...cached,cached:true};
          setCreativeAi(cachedResult);
          setPhotorealView("front");
          setPhotorealViews({});
          setShowCreativeAi(Boolean(cached.selectedCheck?.available && cached.selectedCheck.status==="pass"));
          if(!cached.selectedCheck?.available) {
            const check=await inspectSelectedLook(cachedResult,"front",request);
            if(!request.isCurrent()) return;
            if(check?.available && check.status==="pass") setShowCreativeAi(true);
          }
          return;
        }
      }
      let lockedPreviewImage:string|undefined;
      if(!creativeDirection && ready && canvasRef.current) {
        try {
          lockedPreviewImage=serializeLockedPreview(canvasRef.current);
        } catch {
          // Final rendering can fall back to the canonical studio photograph
          // if the browser cannot serialize the deterministic live preview.
        }
      }
      const response=await fetch(creativeDirection ? "/api/designer/creative-render" : "/api/designer/look-render",{
        method:"POST",
        signal:request.signal,
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
            craft:creativeDirection.craft,
            renderRisk:creativeDirection.learning.renderRisk,
            renderCaution:creativeDirection.learning.renderCaution,
            repairInstruction:renderRepairInstruction || undefined,
          }} : {}),
        }),
      });
      const data=await response.json() as {result?:{image:string;jobId:string;creditsUsed:number;conceptId:string;generatedAt:string};error?:string};
      if(!request.isCurrent()) return;
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
        const check=await inspectSelectedLook(data.result,"front",request);
        if(!request.isCurrent()) return;
        if(check?.available && check.status==="pass") setShowCreativeAi(true);
      }

      if(creativeDirection) try {
        const inspectResponse=await fetch("/api/designer/creative-inspect",{
          method:"POST",
          signal:request.signal,
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
            craft:creativeDirection.craft,
            },
          }),
        });
        const inspected=await inspectResponse.json() as {check?:CreativeVisualCheck};
        if(!request.isCurrent()) return;
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
      if(request.isCurrent()) setCreativeAiError(error instanceof Error ? error.message : "Photoreal render failed.");
    } finally {
      if(request.isCurrent()) setCreativeAiLoading(false);
      request.finish();
    }
  }

  async function repairSelectedLook() {
    const check=creativeAi?.selectedCheck;
    if(!creativeAi || creativeDirection || selectedRepairCount>=1 || !check?.available || check.status!=="review" || !check.repairInstruction || creativeAiLoading) return;
    const request=requestScope.begin();
    if(!request) return;
    setCreativeAiLoading(true);
    setCreativeAiError("");
    try {
      let lockedPreviewImage:string|undefined;
      if(ready && canvasRef.current) {
        try {
          lockedPreviewImage=serializeLockedPreview(canvasRef.current);
        } catch {
          // Repair still has the existing trusted generated image if browser
          // serialization is unavailable.
        }
      }
      const response=await fetch("/api/designer/look-render",{
        method:"POST",
        signal:request.signal,
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
      if(!request.isCurrent()) return;
      if(!response.ok || !data.result) throw new Error(data.error || "Photoreal repair failed.");
      setCreativeAi(data.result);
      setPhotorealView("front");
      setPhotorealViews({});
      setSelectedRepairCount(1);
      setShowCreativeAi(false);
      const repairCheck=await inspectSelectedLook(data.result,"front",request);
      if(!request.isCurrent()) return;
      selectedLookSessionCache.set(
        renderSignature,
        repairCheck?.available ? {...data.result,selectedCheck:repairCheck} : data.result,
      );
      if(repairCheck?.available && repairCheck.status==="pass") setShowCreativeAi(true);
    } catch(error) {
      if(request.isCurrent()) setCreativeAiError(error instanceof Error ? error.message : "Photoreal repair failed.");
    } finally {
      if(request.isCurrent()) setCreativeAiLoading(false);
      request.finish();
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
      const request=requestScope.begin();
      if(!request) return;
      setPhotorealViewLoading(view);
      setCreativeAiError("");
      try {
        const recheck=await inspectSelectedLook(existing,view,request);
        if(!request.isCurrent()) return;
        if(recheck?.available && recheck.status==="pass") setPhotorealView(view);
        else setCreativeAiError("This view has not cleared fidelity QA. It remains held on the trusted front view.");
      } finally {
        if(request.isCurrent()) setPhotorealViewLoading(null);
        request.finish();
      }
      return;
    }
    if(photorealViewLoading) return;
    const request=requestScope.begin();
    if(!request) return;
    setPhotorealViewLoading(view);
    setCreativeAiError("");
    try {
      const response=await fetch("/api/designer/look-render",{
        method:"POST",
        signal:request.signal,
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
      if(!request.isCurrent()) return;
      if(!response.ok || !data.result) throw new Error(data.error || "Photoreal view failed.");
      setPhotorealViews((current)=>({...current,[view]:data.result}));
      const check=await inspectSelectedLook(data.result,view,request);
      if(!request.isCurrent()) return;
      if(check?.available && check.status==="pass") setPhotorealView(view);
    } catch(error) {
      if(request.isCurrent()) setCreativeAiError(error instanceof Error ? error.message : "Photoreal view failed.");
    } finally {
      if(request.isCurrent()) setPhotorealViewLoading(null);
      request.finish();
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
    <div className={`newDesignerPhotoStage ${inspectFit ? "inspectFit" : ""}`} data-ready={ready?"true":"false"}>
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
    {creativeAi && !creativeDirection && <p className="newDesignerPhotoLock"><strong>MODEL IDENTITY LOCKED</strong> · {LINEN_EARTH_MODEL_IDENTITY_ID} stays identical across Front / 3/4 / Side / Back; only camera angle and hidden garment surfaces may change.</p>}
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
        {creativeCoverage.specOnly.length>0 && <b>{creativeCoverage.specOnly.length} detail{creativeCoverage.specOnly.length===1?"":"s"} remain specification-only</b>}
      </div>
      {creativeDirection.craft && <p className="newDesignerPhotoApproximation newDesignerPhotoCraftNote">Craft placement is proposed. Motif size, thread width and density are illustrative; exact stitch execution needs a sample.</p>}
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
      {creativeDirection?.craft && <p>{[...new Set([...creativeDirection.craft.panels.map(p=>p.zone),...(creativeDirection.craft.decoration?[creativeDirection.craft.decoration.zone]:[])])].map(zone=>`${zone.replaceAll("-"," ")}: ${photoCraftZone(zone,style).reason}`).join(" ")}{!resolvedCraft&&" This craft cannot be reconstructed from the current base fabrics and available catalogue."}</p>}
      <p>Final colour, drape and fit still need physical fabric / sample verification.</p>
    </details>
  </section>;
}
