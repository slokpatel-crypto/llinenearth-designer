// In-process, defensive vault rate limiting. This is a bounded best-effort
// guard, not a cross-instance/global anti-abuse or identity guarantee.
export const VAULT_RATE_WINDOW_MS=60_000;
export const VAULT_RATE_ATTEMPTS=30;
export const VAULT_RATE_MAX_SUBJECTS=4_096;
export type VaultRateEntry={at:number;count:number};

export function checkDesignVaultRateLimit(
  entries:Map<string,VaultRateEntry>,
  subject:string,
  now:number,
):boolean {
  if(!Number.isSafeInteger(now)||now<0)return true;
  const key=subject.trim().slice(0,128)||"unknown";
  const current=entries.get(key);
  if(current&&Number.isSafeInteger(current.at)&&current.at<=now&&
    now-current.at<VAULT_RATE_WINDOW_MS){
    current.count+=1;
    return current.count>VAULT_RATE_ATTEMPTS;
  }

  // Do not let forged/distinct forwarded identifiers increase process memory
  // without bound. Expire old subjects only when capacity is reached.
  if(entries.size>=VAULT_RATE_MAX_SUBJECTS){
    for(const [identity,entry] of entries){
      if(!Number.isSafeInteger(entry.at)||entry.at>now||
        now-entry.at>=VAULT_RATE_WINDOW_MS)entries.delete(identity);
    }
    if(entries.size>=VAULT_RATE_MAX_SUBJECTS)return true;
  }
  entries.set(key,{at:now,count:1});
  return false;
}
