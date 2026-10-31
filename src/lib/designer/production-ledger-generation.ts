/**
 * A React state update is not a synchronous permission boundary. A production
 * history refresh invalidates previously verified rows immediately, before
 * React can render disabled mutation/review controls.
 */
export function isCurrentVerifiedProductionLedger(
  latestReadVersion: number,
  verifiedReadVersion: number,
  renderedReadVersion: number,
): boolean {
  return Number.isSafeInteger(latestReadVersion)
    && latestReadVersion > 0
    && verifiedReadVersion === latestReadVersion
    && renderedReadVersion === latestReadVersion;
}
