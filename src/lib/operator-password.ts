import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt-v1";
const KEY_LENGTH = 64;

function decodePart(value: string) {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

export function verifyOperatorPassword(password: string) {
  const stored = process.env.LLINEN_OPERATOR_PASSWORD_HASH;
  if (!stored || !password) return false;
  const [prefix, saltPart, hashPart, extra] = stored.split("$");
  if (prefix !== PREFIX || !saltPart || !hashPart || extra) return false;

  const salt = decodePart(saltPart);
  const expected = decodePart(hashPart);
  if (!salt || !expected || expected.length !== KEY_LENGTH) return false;

  try {
    const actual = scryptSync(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
