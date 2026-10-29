import { normalizeCustomerEmail } from "./customer-account.ts";

/** A small, fail-closed public OTP transport boundary. No email is sent until these checks pass. */
export const CUSTOMER_AUTH_JSON_MAX_BYTES = 4_096;
export const MAX_CUSTOMER_AUTH_RATE_KEYS = 2_048;
const WINDOW_MS = 10 * 60_000;

type AuthAction = "otp" | "verify";
type Entry = {at:number;count:number};
export type CustomerAuthRateState = {
  identities:Map<string,Entry>;
  global:Map<AuthAction,Entry>;
};

export function parseCustomerAuthEmail(value:unknown):string|null {
  return typeof value === "string" ? normalizeCustomerEmail(value) : null;
}

/** Preserve the legacy whitespace-tolerant code UX, but never coerce JSON arrays/numbers. */
export function parseCustomerOtpCode(value:unknown):string|null {
  if(typeof value !== "string") return null;
  const code=value.replace(/\s/g,"");
  return /^[A-Za-z0-9]{6,12}$/.test(code) ? code : null;
}

function countRequest(entries:Map<string,Entry>,key:string,limit:number,now:number):boolean {
  const previous=entries.get(key);
  if(!previous || now<previous.at || now-previous.at>WINDOW_MS) {
    entries.delete(key);
    entries.set(key,{at:now,count:1});
    return false;
  }
  entries.delete(key);
  entries.set(key,{at:previous.at,count:previous.count+1});
  return previous.count+1>limit;
}

/**
 * Bounded, process-local best-effort OTP throttling. Forwarded IP headers are
 * untrusted; a separate global bucket limits trivial header rotation. This
 * is NOT a distributed abuse control or a replacement for Supabase rate limits.
 */
export function customerAuthRateBlocked(
  state:CustomerAuthRateState,
  action:AuthAction,
  forwardedIp:unknown,
  now:number=Date.now(),
):boolean {
  if(!Number.isFinite(now)) return true;
  const candidate=typeof forwardedIp==="string"?forwardedIp.trim():"";
  const ip=candidate.length<=45 && /^[0-9a-fA-F.:]{3,45}$/.test(candidate)
    ? candidate.toLowerCase() : "unknown";
  const key=action+":"+ip;
  if(!state.identities.has(key)&&state.identities.size>=MAX_CUSTOMER_AUTH_RATE_KEYS){
    // Oldest entries are at the front. Retain a strict memory bound even if
    // every identity is fresh; the global bucket still limits IP rotation.
    for(let i=0;i<8&&state.identities.size>=MAX_CUSTOMER_AUTH_RATE_KEYS;i++){
      const oldest=state.identities.keys().next().value;
      if(oldest===undefined) break;
      const entry=state.identities.get(oldest)!;
      if(now>=entry.at && now-entry.at<=WINDOW_MS) break;
      state.identities.delete(oldest);
    }
    if(state.identities.size>=MAX_CUSTOMER_AUTH_RATE_KEYS){
      const oldest=state.identities.keys().next().value;
      if(oldest!==undefined) state.identities.delete(oldest);
    }
  }
  const globalBlocked=countRequest(state.global,action,action==="otp"?300:1_000,now);
  const identityBlocked=countRequest(state.identities,key,action==="otp"?8:12,now);
  return globalBlocked||identityBlocked;
}
