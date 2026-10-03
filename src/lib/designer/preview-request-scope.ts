export type PreviewRequest = {
  signal: AbortSignal;
  isCurrent: () => boolean;
  finish: () => void;
};

/** Owns one async chain for one committed preview or questionnaire step. */
export function createPreviewRequestScope() {
  let active: AbortController | null = null;
  let enabled = false;

  return {
    // Local preview callbacks also need ownership before a network request
    // begins, including while an old view is retained by an exit animation.
    isEnabled: () => enabled,
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
