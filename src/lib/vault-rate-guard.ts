export type VaultRateEntry={at:number;count:number};
export type VaultRateStore=Map<string,VaultRateEntry>;

const WINDOW_MS=60_000;
const MAX_REQUESTS=30;
export const MAX_VAULT_RATE_KEYS=4096;

/**
 * A bounded, process-local best-effort throttling cache, NOT a distributed
 * abuse prevention or authentication control. Real multi-instance rate
 * limiting still needs an edge/store-backed service before launch.
 */
export function vaultRateBlocked(
  entries:VaultRateStore, identity:string, now:number=Date.now(),
):boolean{
  // The incoming forwarded header can be malformed or untrusted. Avoid keeping
  // arbitrarily long user-controlled cache keys in long-lived server processes.
  const key=identity.length<=128&&identity.trim()?identity:"unknown";
  const previous=entries.get(key);
  if(!previous || now-previous.at>WINDOW_MS || now<previous.at){
    if(!entries.has(key)&&entries.size>=MAX_VAULT_RATE_KEYS){
      for(const [candidate,entry] of entries){
        if(now<entry.at||now-entry.at>WINDOW_MS) entries.delete(candidate);
      }
      // Preserve a hard bound even when many unique addresses stay active.
      // Eviction is capacity protection only, not an abuse-security guarantee.
      while(entries.size>=MAX_VAULT_RATE_KEYS){
        const oldest=entries.keys().next().value;
        if(oldest===undefined) break;
        entries.delete(oldest);
      }
    }
    entries.delete(key);
    entries.set(key,{at:now,count:1});
    return false;
  }
  previous.count++;
  return previous.count>MAX_REQUESTS;
}
