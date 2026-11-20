import {createHmac} from "node:crypto";

export type LocalOtpWindow={at:number;count:number};
/** Per-process fallback for environments not yet running the distributed RPC.
 * Never use forwarded client IP as a trustworthy identity. The subject must
 * already be a process-secret HMAC of the normalized recipient email. */
export function consumeLocalOtpBudget(
  windows:Map<string,LocalOtpWindow>,
  subject:string,now:number,limit=8,maxSubjects=4_096
):boolean{
  if(!/^[a-f0-9]{64}$/.test(subject)||!Number.isFinite(now)||
    !Number.isSafeInteger(limit)||limit<1||limit>100||
    !Number.isSafeInteger(maxSubjects)||maxSubjects<1)
    return false;
  const duration=600_000;
  const current=windows.get(subject);
  if(windows.size>=maxSubjects){
    for(const [key,entry] of windows){
      if(now-entry.at>=duration||now<entry.at)windows.delete(key);
    }
    if(windows.size>=maxSubjects&&!windows.has(subject))return false;
  }
  const live=windows.get(subject);
  if(!live||now-live.at>=duration||now<live.at){
    windows.set(subject,{at:now,count:1});
    return true;
  }
  live.count=Math.min(limit+1,live.count+1);
  return live.count<=limit;
}


// This contract is pure and Node-testable. Raw emails never enter the database.
// An independently rotated signing secret prevents dictionary lookups of the
// email limiter records in a hypothetical read-only database compromise.
export function otpRateSubjectHash(
  email:string,secret:string,purpose:"request"|"verify"="request"
):string{
  if(typeof email!=="string"||email.length<3||email.length>254||
    email!==email.trim().toLowerCase()||!email.includes("@")||
    typeof secret!=="string"||secret.length<32)
    throw new Error("Invalid OTP throttle identity or configuration.");
  const scope=purpose==="verify"?"linen-earth:customer-otp-verify:v1\0":
    "linen-earth:customer-otp:v1\0";
  return createHmac("sha256",secret).update(scope+email).digest("hex");
}

export function requireOtpRateAck(value:unknown):boolean{
  if(typeof value!=="boolean")throw new Error("Invalid OTP throttle acknowledgement.");
  return value;
}
