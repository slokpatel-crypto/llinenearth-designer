import { createHash } from "node:crypto";
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


function reserveIdentityKey(entries:Map<string,Entry>,key:string,now:number):void {
  if(entries.has(key)||entries.size<MAX_CUSTOMER_AUTH_RATE_KEYS) return;
  // Oldest entries are at the front. Preserve a hard memory bound even
  // during a flood of distinct IPs and email identities.
  for(let i=0;i<8&&entries.size>=MAX_CUSTOMER_AUTH_RATE_KEYS;i++){
    const oldest=entries.keys().next().value;
    if(oldest===undefined) break;
    const entry=entries.get(oldest)!;
    if(now>=entry.at&&now-entry.at<=WINDOW_MS) break;
    entries.delete(oldest);
  }
  if(entries.size>=MAX_CUSTOMER_AUTH_RATE_KEYS){
    const oldest=entries.keys().next().value;
    if(oldest!==undefined) entries.delete(oldest);
  }
}

/** A hashed per-address budget prevents simple IP rotation from spamming
 * one mailbox or brute-forcing one OTP. No plaintext email is stored.
 * It remains per-instance and cannot replace distributed/provider limits.
 */
export function customerAuthEmailRateBlocked(
  state:CustomerAuthRateState,
  action:AuthAction,
  normalizedEmail:string,
  now:number=Date.now(),
):boolean {
  if(!Number.isFinite(now)) return true;
  const digest=createHash("sha256").update(normalizedEmail,"utf8").digest("hex");
  const key="email:"+action+":"+digest;
  reserveIdentityKey(state.identities,key,now);
  return countRequest(state.identities,key,action==="otp"?4:10,now);
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
  reserveIdentityKey(state.identities,key,now);
  const globalBlocked=countRequest(state.global,action,action==="otp"?300:1_000,now);
  const identityBlocked=countRequest(state.identities,key,action==="otp"?8:12,now);
  return globalBlocked||identityBlocked;
}
