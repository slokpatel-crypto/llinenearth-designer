"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { DESIGNER_SHIRTS, DESIGNER_PANTS, type DesignerFabric } from "@/lib/designer/engine";
import {
  rankReferenceSwatches,
  sampleReferencePatch,
  type Rgb,
} from "@/lib/designer/reference-look-matcher";
import styles from "./ReferenceLookMatcher.module.css";

type Garment = "shirt" | "pant";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Client-only exploratory colour finder. Uploaded photographs never leave this tab. */
export function ReferenceLookMatcher() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestId = useRef(0);
  const [garment, setGarment] = useState<Garment>("shirt");
  const [sample, setSample] = useState<Rgb | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fabrics: DesignerFabric[] = garment === "shirt" ? DESIGNER_SHIRTS : DESIGNER_PANTS;
  const matches = sample ? rankReferenceSwatches(sample, fabrics, 6) : [];
  const sampleHex = sample ? "#" + sample.map((part) => part.toString(16).padStart(2, "0")).join("") : null;

  function chooseFile(file?: File) {
    const thisRequest = ++requestId.current;
    setError("");
    setSample(null);
    setImageReady(false);
    setFileName("");
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES || file.size === 0) {
      setError("Choose a JPG, PNG or WebP photo up to 8 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    const picture = new window.Image();
    picture.onload = () => {
      URL.revokeObjectURL(url);
      if (thisRequest !== requestId.current) return;
      const canvas = canvasRef.current;
      if (!canvas || !picture.naturalWidth || !picture.naturalHeight) {
        setError("Unable to inspect this photo.");
        return;
      }
      const ratio = Math.min(720 / picture.naturalWidth, 500 / picture.naturalHeight, 1);
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(picture.naturalHeight * ratio));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        setError("Your browser does not support the photo colour picker.");
        return;
      }
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      setFileName(file.name.slice(0, 100));
      setImageReady(true);
    };
    picture.onerror = () => {
      URL.revokeObjectURL(url);
      if (thisRequest === requestId.current) setError("The selected image could not be decoded.");
    };
    picture.src = url;
  }

  function chooseColour(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !imageReady) return;
    const rectangle = canvas.getBoundingClientRect();
    if (!rectangle.width || !rectangle.height) return;
    const x = Math.floor((event.clientX - rectangle.left) * canvas.width / rectangle.width);
    const y = Math.floor((event.clientY - rectangle.top) * canvas.height / rectangle.height);
    const imageData = canvas.getContext("2d", { willReadFrequently: true })?.getImageData(
      0, 0, canvas.width, canvas.height,
    );
    if (!imageData) return;
    const sampled = sampleReferencePatch(imageData, x, y);
    if (!sampled) {
      setError("Tap an opaque garment area in the photo.");
      return;
    }
    setSample(sampled);
    setError("");
  }

  return (
    <div className={styles.workflow}>
      <section className={styles.photoPanel}>
        <div className={styles.panelHeading}><span>01 / YOUR REFERENCE</span><h2>Tap the colour you want to match.</h2></div>
        <label className={styles.upload}>
          <span>Choose a reference photo</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
        <p className={styles.hint}>Your picture stays in your browser. No image is uploaded or sent to an AI service.</p>
        <div className={styles.photoSurface}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onClick={chooseColour}
            role="img"
            aria-label="Reference photo. Tap or click the garment fabric to sample its colour."
            style={{ display: imageReady ? "block" : "none" }}
          />
          {!imageReady && <div className={styles.empty}>Upload a photo to start matching its fabric colour.</div>}
        </div>
        {fileName && <p className={styles.hint}>Selected reference: {fileName}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>

      <section className={styles.matchesPanel} aria-live="polite">
        <div className={styles.panelHeading}><span>02 / LINEN EARTH FABRICS</span><h2>Closest catalogue colours.</h2></div>
        <div className={styles.switches} role="group" aria-label="Choose garment fabric category">
          <button type="button" aria-pressed={garment === "shirt"} onClick={() => setGarment("shirt")}>Shirt fabrics</button>
          <button type="button" aria-pressed={garment === "pant"} onClick={() => setGarment("pant")}>Trouser fabrics</button>
        </div>
        {sample && sampleHex ? (
          <>
            <div className={styles.sampled}>
              <span className={styles.sampleSwatch} style={{ backgroundColor: sampleHex }} />
              <div><strong>Sampled photo colour</strong><small>{sampleHex.toUpperCase()} · approximate on-screen sample</small></div>
            </div>
            <div className={styles.matchList}>
              {matches.map(({ fabric }) => (
                <article className={styles.match} key={fabric.id}>
                  <div className={styles.matchImage}>
                    <img src={fabric.image} alt="" loading="lazy" />
                  </div>
                  <div className={styles.matchCopy}>
                    <strong>{fabric.name}</strong>
                    <small>{fabric.line} · {fabric.id}</small>
                    <span>Visual colour candidate · confirm physical cloth and stock</span>
                  </div>
                  <span className={styles.matchSwatch} style={{ backgroundColor: fabric.hex }} aria-hidden="true" />
                </article>
              ))}
              {matches.length === 0 && <p>No catalogue swatches have usable colour data in this category.</p>}
            </div>
            <p className={styles.disclaimer}>This matches a selected photo colour to approximate catalogue swatch colours. Lighting and screens change colour. It does not identify fabric weave, verify stock, infer the garment cut, or approve a fit.</p>
            <Link className={styles.continue} href="/designer-studio">Open Designer to choose fabric and customize <span aria-hidden="true">↗</span></Link>
          </>
        ) : (
          <div className={styles.instructions}>
            <b>To see suggestions</b>
            <p>Upload a picture, then tap the shirt, trouser or jacket area whose colour you like. Select which fabric category to search.</p>
          </div>
        )}
      </section>
    </div>
  );
}
