"use client";

import { useEffect, useState } from "react";
import { BRAND_LOGO_SRC } from "@/lib/brand-logo-data";

export function BrandIntro() {
  const [show, setShow] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(prefersReduced);
    const timer = window.setTimeout(() => setShow(false), 3600);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className={`brandIntro${reducedMotion ? " reducedMotion" : ""}`} aria-label="LLinen Earth opening brand animation">
      <div className="introGlow" />
      <div className="introCard">
        <img src={BRAND_LOGO_SRC} alt="LLinen Earth" width="1273" height="531" />
      </div>
      <p>FABRIC · DESIGN · CRAFT</p>
    </div>
  );
}
