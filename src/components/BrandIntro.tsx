"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BRAND_LOGO_SRC, BRAND_LOGO_SIZE } from "@/lib/brand-logo-data";

export function BrandIntro() {
  const [show, setShow] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(prefersReduced);
    let seen: string | null = null;
    try { seen = window.sessionStorage.getItem("linen-earth:intro-shown:v1"); } catch { /* Privacy mode can disable storage. */ }
    if (prefersReduced || seen) {
      setShow(false);
      return;
    }
    try { window.sessionStorage.setItem("linen-earth:intro-shown:v1", "1"); } catch { /* The entrance remains optional. */ }
    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 3600);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className={`brandIntro${reducedMotion ? " reducedMotion" : ""}`} aria-label="Linen Earth opening brand animation">
      <div className="introGlow" />
      <div className="introCard">
        <Image src={BRAND_LOGO_SRC} alt="Linen Earth" {...BRAND_LOGO_SIZE} unoptimized priority />
      </div>
      <p>FABRIC · DESIGN · CRAFT</p>
    </div>
  );
}
