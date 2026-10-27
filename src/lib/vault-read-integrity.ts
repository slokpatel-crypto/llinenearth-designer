/**
 * A successful RPC HTTP response is not proof that its JSON result contains
 * exactly one intact, unexpired vault record. Both token recovery and
 * authenticated owned recovery must use the same fail-closed boundary.
 *
 * This is validation only: server-side ownership and access-token checks must
 * still occur inside the corresponding database RPC.
 */
export type VaultReadEnvelope = Record<string, unknown> & {expires_at:string};

const TIMESTAMPTZ=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function selectVaultReadRow(
  response:unknown,
  nowMs:number=Date.now(),
):VaultReadEnvelope|null{
  // Ambiguous duplicate rows are never arbitrarily resolved to the first.
  if(!Array.isArray(response)||response.length!==1)return null;
  const row=response[0];
  if(!row||typeof row!=="object"||Array.isArray(row))return null;
  const expiry=(row as Record<string,unknown>).expires_at;
  if(typeof expiry!=="string"||!TIMESTAMPTZ.test(expiry))return null;
  const time=Date.parse(expiry);
  if(!Number.isFinite(time)||!Number.isFinite(nowMs)||time<=nowMs)return null;
  return row as VaultReadEnvelope;
}
