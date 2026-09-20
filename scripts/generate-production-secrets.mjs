import { randomBytes } from "node:crypto";

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

console.log("Generate these as separate server-only secrets. Do not commit them.\n");
console.log(`LLINEN_OPERATOR_SESSION_SECRET=${secret(48)}`);
console.log(`LLINEN_OPERATOR_SYNC_TOKEN=${secret(48)}`);\nconsole.log(`LLINEN_MEMORY_SESSION_SECRET=${secret(48)}`);
