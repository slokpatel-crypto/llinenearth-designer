"use client";

import { useEffect } from "react";

/**
 * Legacy journey entrypoint retained only for old bookmarked routes.
 * Fabric analysis is private/backend-only; customer journeys are redirected
 * to the current photographic Designer instead of mounting the old analyzer UI.
 */
export function DesignerJourney() {
  useEffect(()=>{
    window.location.replace("/designer-studio");
  },[]);

  return <section className="journeyLoading" aria-live="polite">
    <span>Opening Linen Earth Designer…</span>
  </section>;
}
