import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The account page is a client component. Keep the UI's success gate tied to
// the exact boolean contract returned by both server routes, not HTTP 200 alone.
const account = readFileSync(new URL("../src/app/account/page.tsx", import.meta.url), "utf8");
const otp = readFileSync(new URL("../src/app/api/customer-auth/otp/route.ts", import.meta.url), "utf8");
const verify = readFileSync(new URL("../src/app/api/customer-auth/verify/route.ts", import.meta.url), "utf8");

test("OTP send success requires an explicit boolean acknowledgment", () => {
  const section = account.split("async function sendCode()")[1]?.split("async function verify()")[0];
  assert.ok(section, "OTP send handler exists");
  assert.match(section, /!response\.ok\|\|data\?\.ok!==true/);
  assert.match(section, /setCodeSent\(true\)/);
  assert.match(otp, /privateJson\(\{ok:true\}\)/);
});

test("OTP verify success requires an explicit acknowledgment and customer identity", () => {
  const section = account.split("async function verify()")[1]?.split("async function claim(")[0];
  assert.ok(section, "OTP verification handler exists");
  assert.match(section, /!response\.ok\|\|data\?\.ok!==true\|\|typeof data\?\.customer\?\.id!=="string"/);
  assert.match(section, /await refresh\(\)/);
  assert.match(verify, /privateJson\(\{ok:true,customer\}\)/);
});
