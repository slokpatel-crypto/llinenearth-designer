import {createHmac} from "node:crypto";

// This contract is pure and Node-testable. Raw emails never enter the database.
// An independently rotated signing secret prevents dictionary lookups of the
// email limiter records in a hypothetical read-only database compromise.
export function otpRateSubjectHash(email:string,secret:string):string{
  if(typeof email!=="string"||email.length<3||email.length>254||
    email!==email.trim().toLowerCase()||!email.includes("@")||
    typeof secret!=="string"||secret.length<32)
    throw new Error("Invalid OTP throttle identity or configuration.");
  return createHmac("sha256",secret).update("linen-earth:customer-otp:v1\0"+email).digest("hex");
}

export function requireOtpRateAck(value:unknown):boolean{
  if(typeof value!=="boolean")throw new Error("Invalid OTP throttle acknowledgement.");
  return value;
}
