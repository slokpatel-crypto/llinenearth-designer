"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BRAND_LOGO_SRC, BRAND_LOGO_SIZE } from "@/lib/brand-logo-data";
import { BrandThreadwork } from "@/components/BrandThreadwork";

export function BrandIntro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReduced = preference.matches;
    let seen: string | null = null;
    try { seen = window.sessionStorage.getItem("linen-earth:intro-shown:v1"); } catch { /* Privacy mode can disable storage. */ }
    if (prefersReduced || seen) {
      setShow(false);
      return;
    }
    try { window.sessionStorage.setItem("linen-earth:intro-shown:v1", "1"); } catch { /* The entrance remains optional. */ }
    setShow(true);
    let introTimer = 0;
    const cleanup = () => {
      window.clearTimeout(introTimer);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("wheel", dismiss);
      preference.removeEventListener("change", handlePreference);
    };
    const dismiss = () => { cleanup(); setShow(false); };
    const handlePreference = () => { if (preference.matches) dismiss(); };
    introTimer = window.setTimeout(dismiss, 2400);
    // The opening is decoration, not a loading gate. First interaction wins.
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("pointerdown", dismiss, { once: true });
    window.addEventListener("wheel", dismiss, { once: true, passive: true });
    preference.addEventListener("change", handlePreference);
    return cleanup;
  }, []);

  if (!show) return null;

  return (
    <div className="brandIntro brandThreadIntro" aria-label="Linen Earth opening brand animation">
      <div className="introGlow" />
      <div className="introCard">
        <div className="introThreads"><BrandThreadwork /></div>
        <Image src={BRAND_LOGO_SRC} alt="Linen Earth" {...BRAND_LOGO_SIZE} unoptimized priority />
        <i className="introLogoRule" aria-hidden="true" />
      </div>
      <p>FABRIC · DESIGN · CRAFT</p>
    </div>
  );
}
