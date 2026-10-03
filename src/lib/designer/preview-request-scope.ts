export type PreviewRequest = {
  signal: AbortSignal;
  isCurrent: () => boolean;
  finish: () => void;
};

/** Owns one generation / repair / view / QA chain for one committed design. */
export function createPreviewRequestScope() {
  let active: AbortController | null = null;
  let enabled = false;

  return {
    // React may mount, clean up and remount the same scope in Strict Mode.
    activate() {
      enabled = true;
    },
    invalidate() {
      enabled = false;
      active?.abort();
      active = null;
    },
    begin(): PreviewRequest | null {
      // State updates are asynchronous; this lock also prevents two clicks in
      // the same frame from dispatching duplicate paid generation requests.
      if (!enabled || active) return null;
      const controller = new AbortController();
      active = controller;
      return {
        signal: controller.signal,
        isCurrent: () => enabled && active === controller && !controller.signal.aborted,
        finish: () => {
          // An old completion must never release a newer request's lock.
          if (active === controller) active = null;
        },
      };
    },
  };
}
