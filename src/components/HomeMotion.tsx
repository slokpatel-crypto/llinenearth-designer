"use client";

import { useEffect } from "react";

export function HomeMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduced) {
      nodes.forEach((node) => node.classList.add("isVisible"));
      return;
    }

    document.documentElement.classList.add("motionReady");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("isVisible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });

    nodes.forEach((node) => observer.observe(node));

    let raf = 0;
    const updateScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / max));
        document.documentElement.style.setProperty("--page-progress", String(progress));
        document.documentElement.style.setProperty("--hero-shift", `${Math.min(28, window.scrollY * 0.035)}px`);
        raf = 0;
      });
    };

    window.addEventListener("scroll", updateScroll, { passive: true });
    updateScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div className="pageProgress" aria-hidden="true"><i /></div>;
}
