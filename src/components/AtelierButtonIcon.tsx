/** Original, decorative action icons. Keep the visible label authoritative. */
export function AtelierButtonIcon({ kind }: { kind: "direction" | "cloth" | "thread" }) {
  return <span className="atelierButtonEmblem" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" focusable="false">
      {kind === "direction" ? <><circle cx="12" cy="12" r="8" /><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3Z" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2" /></>
        : kind === "cloth" ? <><path d="m8 3-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4-4 3Z" /><path d="M12 6v14M9 3l3 3 3-3M8 17h8" /></>
          : <><path d="M4 8c4-7 12-7 16 0M4 16c4 7 12 7 16 0M8 4c-5 4-5 12 0 16m8-16c5 4 5 12 0 16M3 12h18M12 3v18" /><circle cx="12" cy="12" r="3" /></>}
    </svg>
  </span>;
}
