/**
 * A React setState(null) does not synchronously revoke an old event handler.
 * The displayed lock is actionable only when it is the exact object returned
 * by the latest successful, independently verified vault recovery.
 * Revoke the ref before changing recovery credentials or starting another load.
 */
export function isCurrentVerifiedOperatorLock(
  displayed: object | null,
  verified: object | null,
): boolean {
  return displayed !== null && displayed === verified;
}
