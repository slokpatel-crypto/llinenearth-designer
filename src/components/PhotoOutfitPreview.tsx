"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignerFabric, DesignerStyle } from "@/lib/designer/engine";
import {
  DESIGNER_PHOTO_TEMPLATES, PHOTO_COLLAR_MASK, PHOTO_CUFF_MASK, PHOTO_TUCKED_SHIRT_MASK,
  PHOTO_TUCKED_WAIST_MASK, photoTemplateForStyle, photoTemplateGaps, previewFabricLabel,
} from "@/lib/designer/photo-preview";

const WIDTH = 1024;
const HEIGHT = 1536;
const images = new Map<string, Promise<HTMLImageElement>>();
const fabricTiles = new Map<string, HTMLCanvasElement>();

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

function drawGarment(
  target: CanvasRenderingContext2D, photo: CanvasImageSource,
  swatch: HTMLImageElement, fabric: DesignerFabric, path: string,
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
  context.filter = "grayscale(1) brightness(1.3) contrast(1.04)";
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  context.filter = "none";
  context.globalCompositeOperation = "destination-in";
  context.fillStyle = "#fff";
  context.fill(new Path2D(path));
  context.globalCompositeOperation = "source-over";
  target.drawImage(layer, 0, 0);
}

function drawWhiteDetail(target: CanvasRenderingContext2D, photo: HTMLImageElement, path: string) {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  const context = layer.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.fillStyle = "#faf9f5";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.globalCompositeOperation = "multiply";
  context.filter = "grayscale(1) brightness(1.38) contrast(1.05)";
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  context.filter = "none";
  context.globalCompositeOperation = "destination-in";
  context.fill(new Path2D(path));
  target.drawImage(layer, 0, 0);
}

function tuckedTrouserLighting(photo: HTMLImageElement): HTMLCanvasElement {
  const lighting = document.createElement("canvas");
  lighting.width = WIDTH;
  lighting.height = HEIGHT;
  const context = lighting.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  // Reuse the same mannequin's upper trouser folds for the waist that was
  // hidden by the untucked hem in the original photograph.
  const patch = document.createElement("canvas");
  patch.width = 292;
  patch.height = 125;
  const patchContext = patch.getContext("2d");
  if (!patchContext) throw new Error("Canvas is unavailable.");
  patchContext.drawImage(photo, 365, 750, 292, 125, 0, 0, 292, 125);
  const fade = patchContext.createLinearGradient(0, 0, 0, 125);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(.63, "rgba(255,255,255,1)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  patchContext.globalCompositeOperation = "destination-in";
  patchContext.fillStyle = fade;
  patchContext.fillRect(0, 0, 292, 125);
  context.drawImage(patch, 365, 640);
  return lighting;
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
  const trouserLighting = tucked ? tuckedTrouserLighting(trouserPhoto) : trouserPhoto;
  drawGarment(context, trouserLighting, pantImage, pant, template.trouserPath);
  drawGarment(context, modelPhoto, shirtImage, shirt, tucked ? PHOTO_TUCKED_SHIRT_MASK : template.shirtPath);
  if (tucked) drawGarment(context, trouserLighting, pantImage, pant, PHOTO_TUCKED_WAIST_MASK);
  if (style.collarFinish !== "Self-fabric") drawWhiteDetail(context, modelPhoto, PHOTO_COLLAR_MASK);
  if (style.collarFinish === "White contrast collar + cuffs") drawWhiteDetail(context, modelPhoto, PHOTO_CUFF_MASK);
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
      loadImage(DESIGNER_PHOTO_TEMPLATES.pleated.src), loadImage(template.src),
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
      <span>THE LIVE MODEL / 01</span>
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
      <p>Photographed point collar and barrel cuff, {tucked ? "an illustrative tucked waist" : "the original untucked hem"}, and {template.trouser} trousers with a {template.break.toLowerCase()}. {style.collarFinish !== "Self-fabric" && "The white collar fabric is visual only until a real cloth is chosen."}</p>
      {gaps.length > 0 && <p className="newDesignerPhotoGap"><strong>Selected details awaiting their own photo template:</strong> {gaps.join(" · ")}.</p>}
      <p>Colour, motif scale, drape and fit are illustrative until checked against the physical roll and a sewn sample. {tucked ? "The waist is composed from the existing photo; its actual rise and fastening need a tailored photo." : "The waistband stays hidden in this view."}</p>
    </div>
  </section>;
}
