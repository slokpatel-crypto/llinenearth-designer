/**
 * A successful RPC HTTP response is not proof that its JSON result contains
 * exactly one intact, unexpired vault record. Both token recovery and
 * authenticated owned recovery must use the same fail-closed boundary.
 *
 * This is validation only: server-side ownership and access-token checks must
 * still occur inside the corresponding database RPC.
 */
export type VaultReadEnvelope = Record<string, unknown> & {expires_at:string};

const TIMESTAMPTZ=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/** Postgres timestamptz JSON must be a real calendar instant with explicit offset. */
export function parseVaultTimestamptz(value:unknown):number|null{
  if(typeof value!=="string")return null;
  const match=TIMESTAMPTZ.exec(value);
  if(!match)return null;
  const year=Number(match[1]);
  const month=Number(match[2]);
  const day=Number(match[3]);
  const hour=Number(match[4]);
  const minute=Number(match[5]);
  const second=Number(match[6]);
  const offsetHour=match[8]===undefined?0:Number(match[8]);
  const offsetMinute=match[9]===undefined?0:Number(match[9]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year===0||month<1||month>12||day<1||day>days[month-1]||
    hour>23||minute>59||second>59||offsetHour>15||offsetMinute>59)return null;
  // Date.parse alone normalizes impossible calendar days and accepts 24:00.
  const time=Date.parse(value);
  return Number.isFinite(time)?time:null;
}

export function selectVaultReadRow(
  response:unknown,
  nowMs:number=Date.now(),
):VaultReadEnvelope|null{
  // Ambiguous duplicate rows are never arbitrarily resolved to the first.
  if(!Array.isArray(response)||response.length!==1)return null;
  const row=response[0];
  if(!row||typeof row!=="object"||Array.isArray(row))return null;
  const expiry=(row as Record<string,unknown>).expires_at;
  const time=parseVaultTimestamptz(expiry);
  if(time===null||!Number.isFinite(nowMs)||time<=nowMs)return null;
  return row as VaultReadEnvelope;
}
