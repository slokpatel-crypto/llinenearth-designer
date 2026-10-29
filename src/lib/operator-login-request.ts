import { isIP } from "node:net";

export const OPERATOR_LOGIN_JSON_MAX_BYTES=4_096;
export const MAX_OPERATOR_LOGIN_RATE_KEYS=1_024;
const WINDOW_MS=15*60_000;
const MAX_PER_IP=8;
const MAX_GLOBAL=300;

type Entry={at:number;count:number};
export type OperatorLoginRateState={
  identities:Map<string,Entry>;
  global:Entry|null;
};

/** Passwords are opaque secrets; never stringify, trim or silently truncate. */
export function parseOperatorLoginPassword(value:unknown):string|null{
  return typeof value==="string"&&value.length>=1&&value.length<=300?value:null;
}

function rateKey(value:unknown):string{
  const candidate=typeof value==="string"?value.split(",")[0].trim():"";
  return isIP(candidate)?candidate.toLowerCase():"unknown";
}

/** Best-effort local guard. Full active maps deny new identities rather than
 * erasing a live operator brute-force counter; edge/provider protection is
 * still required across instances.
 */
export function operatorLoginRateBlocked(
  state:OperatorLoginRateState,
  forwardedIp:unknown,
  now:number=Date.now(),
):boolean{
  if(!Number.isFinite(now)) return true;
  const previousGlobal=state.global;
  const globalCount=previousGlobal&&now>=previousGlobal.at&&now-previousGlobal.at<=WINDOW_MS
    ?previousGlobal.count+1:1;
  state.global={at:globalCount===1?now:previousGlobal!.at,count:globalCount};

  const key=rateKey(forwardedIp);
  const previous=state.identities.get(key);
  if(!previous&&state.identities.size>=MAX_OPERATOR_LOGIN_RATE_KEYS){
    for(const [identity,entry] of state.identities){
      if(now<entry.at||now-entry.at>WINDOW_MS){
        state.identities.delete(identity);
        break;
      }
    }
    if(state.identities.size>=MAX_OPERATOR_LOGIN_RATE_KEYS) return true;
  }
  const count=previous&&now>=previous.at&&now-previous.at<=WINDOW_MS
    ?previous.count+1:1;
  state.identities.delete(key);
  state.identities.set(key,{at:count===1?now:previous!.at,count});
  return globalCount>MAX_GLOBAL||count>MAX_PER_IP;
}
