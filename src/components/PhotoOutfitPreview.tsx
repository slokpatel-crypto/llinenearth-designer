"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignerFabric, DesignerStyle } from "@/lib/designer/engine";
import {
  DESIGNER_PHOTO_TEMPLATES, PHOTO_COLLAR_MASK, PHOTO_CUFF_MASK, PHOTO_TUCKED_COLLAR_MASK, PHOTO_TUCKED_COLLAR_STAND_MASK,
  PHOTO_TUCKED_CUFF_MASK, photoTemplateForStyle, photoTemplateGaps, previewFabricLabel,
} from "@/lib/designer/photo-preview";

const WIDTH = 1024;
const HEIGHT = 1536;
const images = new Map<string, Promise<HTMLImageElement>>();
const fabricTiles = new Map<string, HTMLCanvasElement>();
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
) {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  const context = layer.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");

  const tile = swatchTile(swatch, fabric);
  const pattern = context.createPattern(tile, "repeat");
  if (!pattern) throw new Error("Could not prepare the fabric pattern.");
  pattern.setTransform(new DOMMatrix().scale(fabric.patternType === "Solid" ? .83 : 1.08));
  context.fillStyle = pattern;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Normalize the neutral studio photo's midtone before multiplying. The cloth
  // retains its photographed hue instead of turning dull or too dark, while
  // the model's creases and seams still shape the result.
  context.globalCompositeOperation = "multiply";
  context.filter = lightingFilter;
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  context.filter = "none";
  context.globalCompositeOperation = "destination-in";
  if (mask) context.drawImage(mask, 0, 0);
  else {
    context.fillStyle = "#fff";
    context.fill(new Path2D(path));
  }
  context.globalCompositeOperation = "source-over";
  target.drawImage(layer, 0, 0);
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
) {
  const template = DESIGNER_PHOTO_TEMPLATES[photoTemplateForStyle(style)];
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(modelPhoto, 0, 0, WIDTH, HEIGHT);
  const tucked = style.shirtWear === "Tucked";
  if (tucked) {
    const masks = tuckedGarmentMasks(modelPhoto);
    drawGarment(context, modelPhoto, pantImage, pant, "", masks.pant, "grayscale(1) brightness(1.9) contrast(1.03)");
    drawGarment(context, modelPhoto, shirtImage, shirt, "", masks.shirt, "grayscale(1) brightness(3.05) contrast(.94)");
    if (style.collarFinish === "Self-fabric") {
      drawGarment(context, modelPhoto, shirtImage, shirt, PHOTO_TUCKED_COLLAR_MASK, undefined, "grayscale(1) brightness(3.05) contrast(.94)");
    } else {
      drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_STAND_MASK, masks.shirt, 3.6);
      drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_COLLAR_MASK, undefined, 3.6);
    }
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_TUCKED_CUFF_MASK, masks.shirt, 3.6);
  } else {
    const shirtMask = untuckedGarmentMasks(modelPhoto, template.shirtPath, DESIGNER_PHOTO_TEMPLATES.pleated.trouserPath).shirt;
    const trouserMask = untuckedGarmentMasks(trouserPhoto, template.shirtPath, template.trouserPath).pant;
    drawGarment(context, trouserPhoto, pantImage, pant, "", trouserMask);
    drawGarment(context, modelPhoto, shirtImage, shirt, "", shirtMask);
    if (style.collarFinish !== "Self-fabric") drawWhiteDetail(context, modelPhoto, PHOTO_COLLAR_MASK);
    if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_CUFF_MASK);
  }
}

export function PhotoOutfitPreview({ shirt, pant, style }: {
  shirt: DesignerFabric;
  pant: DesignerFabric;
  style: DesignerStyle;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const templateId = photoTemplateForStyle(style);
  const template = DESIGNER_PHOTO_TEMPLATES[templateId];
  const gaps = photoTemplateGaps(style, templateId);
  const tucked = style.shirtWear === "Tucked";

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
        composePhotoOutfit(context, modelPhoto, trouserPhoto, shirtImage, pantImage, shirt, pant, style);
        setError(false);
        setReady(true);
      })
      .catch(() => { if (!cancelled) { setReady(false); setError(true); } });
    return () => { cancelled = true; };
  }, [shirt, pant, template, tucked, style.collarFinish]);

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
    <div className="newDesignerPhotoIntro">
      <span>FABRIC PREVIEW / 01</span>
      <h2 id="designerPhotoTitle">See the cloth on a real-looking form.</h2>
      <p>The shirt and trouser fabrics update as you select them. This photo composition runs in your browser, with no AI render request per look.</p>
    </div>
    <div className="newDesignerPhotoStage">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} role="img" aria-label={`${previewFabricLabel(shirt, pant)}, ${style.shirtWear.toLowerCase()} with ${style.collarFinish.toLowerCase()}`} />
      <span className="newDesignerPhotoTag">FRONT / STUDIO MODEL</span>
      {error && <span className="newDesignerPhotoError" role="alert">Preview could not load. Check the local fabric images.</span>}
      {!ready && !error && <span className="newDesignerPhotoLoading">Preparing your look…</span>}
    </div>
    <div className="newDesignerPhotoSummary">
      <div><span>SHIRT CLOTH</span><strong>{shirt.name}</strong></div>
      <div><span>TROUSER CLOTH</span><strong>{pant.name}</strong></div>
      <button type="button" onClick={download} disabled={!ready}>Save preview PNG ↗</button>
    </div>
    <div className="newDesignerPhotoAccuracy">
      <strong>What the photo shows</strong>
      <p>Photographed point collar and barrel cuff, {tucked ? "a real photographed tucked waist with belt loops" : "the original untucked hem"}, and {template.trouser} trousers with a {template.break.toLowerCase()}. {style.collarFinish !== "Self-fabric" && "The white collar fabric is visual only until a real cloth is chosen."}</p>
      {gaps.length > 0 && <p className="newDesignerPhotoGap"><strong>Selected details awaiting their own photo template:</strong> {gaps.join(" · ")}.</p>}
      <p>Colour, motif scale, drape and fit are illustrative until checked against the physical roll and a sewn sample. {tucked ? "The photographed waistband and belt loops stay the same for every fabric; other selected waist details need their own photo." : "The waistband stays hidden in this view."}</p>
    </div>
  </section>;
}
