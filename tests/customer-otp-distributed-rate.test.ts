import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {otpRateSubjectHash,requireOtpRateAck} from "../src/lib/customer-otp-rate-contract.ts";
const one="a dedicated synthetic OTP throttle signing secret";
const two="a different dedicated synthetic OTP throttle secret";
test("distributed OTP subjects are keyed normalized email digests, never stored email strings",()=>{
  const a=otpRateSubjectHash("alice@example.test",one);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.equal(a,otpRateSubjectHash("alice@example.test",one));
  assert.notEqual(a,otpRateSubjectHash("bob@example.test",one));
  assert.notEqual(a,otpRateSubjectHash("alice@example.test",two));
  assert.ok(!a.includes("alice"));
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
  const sql=readFileSync("supabase/migrations/20261103_customer_otp_distributed_rate.sql","utf8");
  assert.match(sql,/on conflict\(subject_hash\) do update/);
  assert.match(sql,/least\(customer_otp_rate_windows.attempts\+1,9\)/);
  assert.match(sql,/grant execute on function public.customer_otp_rate_consume\(text\) to service_role/);
  assert.doesNotMatch(sql,/customer_email|access_token|refresh_token/);
});
