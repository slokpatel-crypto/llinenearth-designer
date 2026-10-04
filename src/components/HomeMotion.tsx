"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion/mini";

/** One-time reveals, scoped to this page. Content stays visible without JS. */
export function HomeMotion() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = progressRef.current?.closest("main");
    const progress = progressRef.current?.firstElementChild as HTMLElement | null;
    if (!root || !progress) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map<HTMLElement, ReturnType<typeof animate>>();
    let observer: IntersectionObserver | undefined;
    let raf = 0;

    const finishReveals = () => {
      for (const [node, animation] of animations) {
        animation.cancel();
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
      }
      animations.clear();
    };
    const reveal = (node: HTMLElement, delay = 0) => {
      animations.set(node, animate(node, {
        opacity: [0.15, 1],
        transform: ["translateY(18px)", "translateY(0px)"],
      }, { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }));
    };
    const updateScroll = () => {
      if (preference.matches || raf) return;
      raf = requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        progress.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / max))})`;
        raf = 0;
      });
    };
    const configure = () => {
      observer?.disconnect();
      finishReveals();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (preference.matches) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = entry.target as HTMLElement;
          const children = section.matches(".gatewayBrandHero")
            ? section.querySelectorAll<HTMLElement>(".gatewayBrandCopy > *, .gatewayHeroModel")
            : section.matches(".gatewayChoices, .editorialGarments")
              ? section.querySelectorAll<HTMLElement>(".gatewayCard, .editorialGarmentCard")
              : [];
          if (children.length) children.forEach((node, index) => reveal(node, Math.min(index * 0.055, 0.22)));
          else reveal(section);
          observer?.unobserve(section);
        }
      }, { threshold: 0.08 });
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(node => observer?.observe(node));
      updateScroll();
    };
    // Keyboard focus always wins over a decorative entrance animation.
    const handleFocus = () => finishReveals();
    configure();
    preference.addEventListener("change", configure);
    root.addEventListener("focusin", handleFocus);
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    return () => {
      observer?.disconnect();
      finishReveals();
      preference.removeEventListener("change", configure);
      root.removeEventListener("focusin", handleFocus);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={progressRef} className="pageProgress atelierPageProgress" aria-hidden="true"><i /></div>;
}
