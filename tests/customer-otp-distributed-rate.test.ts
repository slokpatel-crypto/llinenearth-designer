import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {consumeLocalOtpBudget,otpRateSubjectHash,requireOtpRateAck}
 from "../src/lib/customer-otp-rate-contract.ts";
const one="a dedicated synthetic OTP throttle signing secret";
const two="a different dedicated synthetic OTP throttle secret";
test("distributed OTP subjects are keyed normalized email digests, never stored email strings",()=>{
  const a=otpRateSubjectHash("alice@example.test",one);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.equal(a,otpRateSubjectHash("alice@example.test",one));
  assert.notEqual(a,otpRateSubjectHash("bob@example.test",one));
  assert.notEqual(a,otpRateSubjectHash("alice@example.test",two));
  assert.ok(!a.includes("alice"));
  const verifyDigest=otpRateSubjectHash("alice@example.test",one,"verify");
  assert.match(verifyDigest,/^[a-f0-9]{64}$/);
  assert.notEqual(verifyDigest,a,"OTP send and verify attempts must have isolated budgets");
  assert.equal(verifyDigest,otpRateSubjectHash("alice@example.test",one,"verify"));
  for(const email of ["", "Alice@example.test","alice@example.test ","x".repeat(255)])
    assert.throws(()=>otpRateSubjectHash(email,one),/Invalid OTP/);
  assert.throws(()=>otpRateSubjectHash("alice@example.test","short"),/Invalid OTP/);
});
test("distributed throttle RPC must return literal boolean",()=>{
  assert.equal(requireOtpRateAck(true),true);
  assert.equal(requireOtpRateAck(false),false);
  for(const value of ["true","false",null,0,1,[],{},undefined])
    assert.throws(()=>requireOtpRateAck(value),/Invalid OTP/);
});
test("OTP route requires distributed guard before code dispatch and never logs raw backend failures",()=>{
  const source=readFileSync("src/app/api/customer-auth/otp/route.ts","utf8");
  assert.match(source,/await distributedOtpRateAllowed\(email\)/);
  assert.ok(source.indexOf("await distributedOtpRateAllowed(email)")<
    source.indexOf("await requestCustomerOtp(email)"));
  assert.match(source,/sign-in request failed \(details redacted\)/);
  assert.match(source,/const privateJson=\(body:unknown,status=200\)=>NextResponse\.json/);
  assert.doesNotMatch(source,/return NextResponse\.json\(/,
    "all OTP responses including blocked, invalid and failed must be private no-store");
  const sql=readFileSync("supabase/migrations/20261103_customer_otp_distributed_rate.sql","utf8");
  assert.match(sql,/on conflict\(subject_hash\) do update/);
  assert.match(sql,/least\(customer_otp_rate_windows.attempts\+1,9\)/);
  assert.match(sql,/grant execute on function public.customer_otp_rate_consume\(text\) to service_role/);
  assert.doesNotMatch(sql,/customer_email|access_token|refresh_token/);
  const verify=readFileSync("src/app/api/customer-auth/verify/route.ts","utf8");
  assert.match(verify,/await distributedOtpRateAllowed\(email,"verify"\)/);
  assert.ok(verify.indexOf('await distributedOtpRateAllowed(email,"verify")')<
    verify.indexOf("await verifyCustomerOtp(email,token)"));
  assert.match(verify,/Too many code attempts/);
  assert.match(verify,/Secure code verification is temporarily unavailable/);
});

test("local OTP fallback blocks rotating forwarded IPs for one email in each independent flow",()=>{
  const windows=new Map();
  const subject=otpRateSubjectHash("alice@example.test",one);
  const verifySubject=otpRateSubjectHash("alice@example.test",one,"verify");
  const bob=otpRateSubjectHash("bob@example.test",one);
  const now=Date.parse("2026-11-03T00:00:00Z");
  for(let i=0;i<8;i++)assert.equal(consumeLocalOtpBudget(windows,subject,now+i),true);
  assert.equal(consumeLocalOtpBudget(windows,subject,now+9),false);
  assert.equal(windows.get(subject)?.count,9,"bounded count must not grow indefinitely");
  assert.equal(consumeLocalOtpBudget(windows,verifySubject,now+9),true,
    "code verification has its own per-email budget");
  assert.equal(consumeLocalOtpBudget(windows,bob,now+9),true,
    "unrelated customers have independent budgets");
  assert.equal(consumeLocalOtpBudget(windows,subject,now+600_000),true,
    "ten-minute window must reset");
  assert.equal(consumeLocalOtpBudget(windows,subject,now-1),true,
    "clock rollback must reset, not grant an infinite window");
});
test("local OTP fallback bounds memory and fails closed under subject exhaustion",()=>{
  const windows=new Map();
  const subjects=["a","b","c"].map(email=>otpRateSubjectHash(email+"@example.test",one));
  assert.equal(consumeLocalOtpBudget(windows,subjects[0],1000,8,2),true);
  assert.equal(consumeLocalOtpBudget(windows,subjects[1],1000,8,2),true);
  assert.equal(consumeLocalOtpBudget(windows,subjects[2],1000,8,2),false);
  assert.equal(consumeLocalOtpBudget(windows,subjects[2],601001,8,2),true,
    "expired rate entries must be evicted before new subjects are denied");
  assert.equal(windows.size,1);
  assert.equal([...windows.keys()].some(key=>key.includes("@")),false,
    "local limiter cannot retain email strings");
  for(const subject of ["raw@email","z".repeat(64),""])
    assert.equal(consumeLocalOtpBudget(windows,subject,1_000),false);
});
test("OTP send and verify routes enforce local per-email budget before any provider call",()=>{
  const send=readFileSync("src/app/api/customer-auth/otp/route.ts","utf8");
  const verify=readFileSync("src/app/api/customer-auth/verify/route.ts","utf8");
  assert.ok(send.indexOf("localOtpRateAllowed(email)")>
    send.indexOf("normalizeCustomerEmail(body.email)"));
  assert.ok(send.indexOf("localOtpRateAllowed(email)")<
    send.indexOf("await requestCustomerOtp(email)"));
  assert.ok(verify.indexOf('localOtpRateAllowed(email,"verify")')<
    verify.indexOf("await verifyCustomerOtp(email,token)"));
});
