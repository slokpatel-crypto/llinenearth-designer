import { createHash } from "node:crypto";

// Only a valid already-verified signed customer cookie may reach this helper.
// Hash only the bearer: never send its plaintext to the revocation database.
export function hashCustomerSessionBearer(token:string):string{
  if(typeof token!=="string"||token.length<16||token.length>4_096)
    throw new Error("Invalid customer session revocation input.");
  return createHash("sha256").update(token,"utf8").digest("hex");
}

export function requireCustomerSessionRevocationAck(value:unknown):boolean{
  if(typeof value!=="boolean")
    throw new Error("Invalid customer session revocation acknowledgment.");
  return value;
}
