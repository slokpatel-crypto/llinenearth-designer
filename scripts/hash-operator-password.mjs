import { randomBytes, scryptSync } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";

const rl = readline.createInterface({ input, output });
const password = await rl.question("Operator password: ");
rl.close();

if (password.length < 12) {
  console.error("Use at least 12 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
console.log("\nSet this as LLINEN_OPERATOR_PASSWORD_HASH:");
console.log(`scrypt-v1$${salt.toString("base64url")}$${hash.toString("base64url")}`);
console.log("\nAlso create LLINEN_OPERATOR_SESSION_SECRET as a separate random secret of at least 32 characters.");
