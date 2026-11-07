import { createHash,randomBytes } from "node:crypto";
// Keep aligned with MAX_DESIGN_SHARE_TOKEN_LENGTH in design-share.ts.
const MAX_DESIGN_SHARE_TOKEN_LENGTH=65_536;

export function shareBearerDigest(token:unknown):string{
  if(typeof token!=="string"||!token.startsWith("v1.")||token.length>MAX_DESIGN_SHARE_TOKEN_LENGTH||token.length<32)
    throw new Error("Invalid share bearer.");
  return createHash("sha256").update(token,"utf8").digest("hex");
}
export function createShareRevocationKey():string{
  return randomBytes(32).toString("base64url");
}
export function shareRevocationKeyDigest(value:unknown):string{
  if(typeof value!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(value))
    throw new Error("Invalid share revocation credential.");
  const key=Buffer.from(value,"base64url");
  if(key.length!==32||key.toString("base64url")!==value)throw new Error("Invalid share revocation credential.");
  return createHash("sha256").update(key).digest("hex");
}
export function requireShareRevocationBoolean(value:unknown):boolean{
  if(typeof value!=="boolean")throw new Error("Malformed share revocation acknowledgment.");
  return value;
}
