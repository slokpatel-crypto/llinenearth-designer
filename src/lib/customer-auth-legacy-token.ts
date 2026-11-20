/** Strict compatibility-only bearer transport guard.
 * Supabase access tokens are URL-safe JWT text; rejecting oversized or
 * decoded control characters prevents unsafe Authorization forwarding.
 * Remove this bridge once signed-only session revocation is enabled. */
export function validLegacyCustomerAccessBearer(token:unknown):token is string{
  return typeof token==="string"&&token.length>=1&&token.length<=4096&&
    /^[A-Za-z0-9._~-]+$/.test(token);
}
