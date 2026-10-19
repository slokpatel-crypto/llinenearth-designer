"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Desktop keeps the full navigation visible. On narrow screens the same
 * destinations remain keyboard-accessible behind a controlled disclosure.
 * No customer/garment state or external API is read by this component.
 */
export default function TitanHeaderNavigation() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onResize = () => {
      if (window.innerWidth > 860) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <nav className="titanNav" aria-label="TITAN navigation">
        <a href="#titan-journeys">Explore</a>
        <a href="#titan-process">Our approach</a>
        <Link href="/measurements">Measurements</Link>
        <Link href="/account">My account</Link>
      </nav>

      <div className="titanMobileNav" ref={wrapper}>
        <button
          ref={trigger}
          type="button"
          className="titanMenuButton"
          aria-controls="titan-mobile-menu"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
        >
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
          {open ? "Close" : "Menu"}
        </button>
        {open && (
          <nav className="titanMobileNavPanel" id="titan-mobile-menu" aria-label="TITAN mobile navigation">
            <a href="#titan-journeys" onClick={() => setOpen(false)}>Explore</a>
            <a href="#titan-process" onClick={() => setOpen(false)}>Our approach</a>
            <Link href="/measurements" onClick={() => setOpen(false)}>Measurements</Link>
            <Link href="/account" onClick={() => setOpen(false)}>My account</Link>
          </nav>
        )}
      </div>
    </>
  );
}
