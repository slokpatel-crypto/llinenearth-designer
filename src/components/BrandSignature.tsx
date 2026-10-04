"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { animate } from "motion/mini";
import { BRAND_LOGO_SRC, BRAND_LOGO_SIZE } from "@/lib/brand-logo-data";
import { BrandThreadwork } from "@/components/BrandThreadwork";
import { AtelierButtonIcon } from "@/components/AtelierButtonIcon";

/** A finite brand film. The complete artwork is readable before hydration. */
export function BrandSignature() {
  const rootRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const threads = root.querySelectorAll<SVGPathElement>("[data-brand-thread]");
    const logo = root.querySelector<HTMLElement>(".brandSignatureLogo");
    const light = root.querySelector<HTMLElement>(".brandSignatureLight");
    const caption = root.querySelector<HTMLElement>(".brandSignatureCaption");
    if (!logo || !light || !caption) return;
    let controls: ReturnType<typeof animate>[] = [];
    let visible = false;
    let played = false;
    let running = false;
    let generation = 0;

    const cancel = () => {
      generation++;
      controls.forEach(animation => animation.cancel());
      controls = [];
      running = false;
      threads.forEach(thread => {
        thread.style.removeProperty("stroke-dashoffset");
        thread.style.removeProperty("opacity");
      });
      for (const node of [logo, light, caption]) {
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
      }
    };
    const syncVisibility = () => {
      if (!running) return;
      const active = visible && !document.hidden;
      controls.forEach(animation => active ? animation.play() : animation.pause());
      root.dataset.motionState = active ? "playing" : "paused";
    };
    const play = () => {
      if (preference.matches) return;
      cancel();
      played = running = true;
      const current = generation;
      threads.forEach((thread, index) => controls.push(animate(thread, {
        strokeDashoffset: ["100", "0"], opacity: [0, .65],
      }, { duration: 1.3, delay: 1.2 + Math.min(index * .012, .25), ease: [.22, 1, .36, 1] })));
      controls.push(animate(logo, {
        opacity: [0, 1], transform: ["translateY(8px)", "translateY(0px)"],
      }, { duration: 1.1, delay: 1.5, ease: [.22, 1, .36, 1] }));
      controls.push(animate(caption, {
        opacity: [0, 1], transform: ["translateY(4px)", "translateY(0px)"],
      }, { duration: .8, delay: 1.75, ease: [.22, 1, .36, 1] }));
      controls.push(animate(light, {
        transform: ["translateX(-110%)", "translateX(110%)"], opacity: [0, .55, 0],
      }, { duration: 1.8, delay: 1.2, ease: "easeInOut" }));
      syncVisibility();
      void Promise.all(controls.map(animation => animation.finished)).then(() => {
        if (current !== generation) return;
        running = false;
        root.dataset.motionState = "complete";
      }).catch(() => { /* Cancelled route/replay work cannot update the new film. */ });
    };
    const syncPreference = () => {
      if (preference.matches) {
        cancel();
        root.dataset.motionState = "reduced";
      } else {
        root.dataset.motionState = "complete";
        if (visible && !played) play();
      }
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .25);
      if (visible && !played && !preference.matches) play();
      else syncVisibility();
    }, { threshold: .25 });
    observer.observe(root);
    root.dataset.enhanced = "true";
    syncPreference();
    replayRef.current = play;
    preference.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      replayRef.current = undefined;
      observer.disconnect();
      preference.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      cancel();
    };
  }, []);

  return <div className="brandSignature wrap" ref={rootRef} data-motion-state="still" aria-label="Linen Earth brand signature">
    <div className="brandSignatureArt" aria-hidden="true"><BrandThreadwork /><i className="brandSignatureLight" /></div>
    <div className="brandSignatureLogo"><Image src={BRAND_LOGO_SRC} alt="Linen Earth" {...BRAND_LOGO_SIZE} unoptimized /></div>
    <div className="brandSignatureCaption"><span>FABRIC</span><i /><span>DESIGN</span><i /><span>CRAFT</span></div>
    <button className="brandSignatureReplay atelierControl" onClick={() => replayRef.current?.()} aria-label="Replay Linen Earth brand animation"><AtelierButtonIcon kind="thread" /><span className="atelierButtonText">Replay</span><span className="atelierButtonArrow" aria-hidden="true">↺</span></button>
  </div>;
}
