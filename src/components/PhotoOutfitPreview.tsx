"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignerFabric, DesignerStyle } from "@/lib/designer/engine";
import { DESIGNER_PHOTO_TEMPLATES, photoTemplateForStyle, photoTemplateGaps, previewFabricLabel } from "@/lib/designer/photo-preview";

const WIDTH = 1024;
const HEIGHT = 1536;
const images = new Map<string, Promise<HTMLImageElement>>();

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
  const tile = document.createElement("canvas");
  tile.width = 256;
  tile.height = 256;
  const context = tile.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.fillStyle = fabric.hex;
  context.fillRect(0, 0, 256, 256);

  // The catalogue photos include printed names, hems and occasional folds.
  // Read from the upper cloth field instead of repeating those labels on a suit.
  const plain = fabric.patternType === "Solid";
  const sourceX = image.width * (plain ? .23 : .08);
  const sourceY = image.height * (plain ? .13 : .06);
  const sourceWidth = image.width * (plain ? .54 : .84);
  const sourceHeight = image.height * (plain ? .32 : .62);
  context.globalAlpha = plain ? .16 : .94;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 256, 256);
  context.globalAlpha = 1;
  return tile;
}

function drawGarment(
  target: CanvasRenderingContext2D, photo: HTMLImageElement,
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
  pattern.setTransform(new DOMMatrix().scale(fabric.patternType === "Solid" ? .78 : 1.15));
  context.fillStyle = pattern;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Photo light, creases and seams remain in the fabric. This is a local canvas
  // composite, not a server call or a fresh generative render.
  context.globalCompositeOperation = "multiply";
  context.filter = "brightness(1.27)";
  context.drawImage(photo, 0, 0, WIDTH, HEIGHT);
  context.filter = "none";
  context.globalCompositeOperation = "destination-in";
  context.fillStyle = "#fff";
  context.fill(new Path2D(path));
  context.globalCompositeOperation = "source-over";
  target.drawImage(layer, 0, 0);
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
        context.drawImage(modelPhoto, 0, 0, WIDTH, HEIGHT);
        drawGarment(context, trouserPhoto, pantImage, pant, template.trouserPath);
        drawGarment(context, modelPhoto, shirtImage, shirt, template.shirtPath);
        setError(false);
        setReady(true);
      })
      .catch(() => { if (!cancelled) { setReady(false); setError(true); } });
    return () => { cancelled = true; };
  }, [shirt, pant, template]);

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
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} role="img" aria-label={previewFabricLabel(shirt, pant)} />
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
      <p>Point collar, single-button barrel cuff, visible placket, regular untucked shirt and {template.trouser} trousers with a {template.break.toLowerCase()}.</p>
      {gaps.length > 0 && <p className="newDesignerPhotoGap"><strong>Selected details awaiting their own photo template:</strong> {gaps.join(" · ")}.</p>}
      <p>Colour, motif scale, drape and fit are illustrative until checked against the physical roll and a sewn sample. The waistband stays hidden in this view.</p>
    </div>
  </section>;
}
