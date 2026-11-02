import test from "node:test";
import assert from "node:assert/strict";
import {
  createShareRevocationKey,shareBearerDigest,shareRevocationKeyDigest,
  requireShareRevocationBoolean
} from "../src/lib/designer/design-share-revocation-contract.ts";
test("independent share cancellation capability is a 256-bit secret, not a public bearer",()=>{
 const a=createShareRevocationKey(),b=createShareRevocationKey();
 assert.match(a,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a,b);
 const digest=shareRevocationKeyDigest(a);
 assert.match(digest,/^[a-f0-9]{64}$/);assert.notEqual(digest,a);
 assert.notEqual(digest,shareRevocationKeyDigest(b));
 assert.throws(()=>shareRevocationKeyDigest("not-a-key"),/Invalid/);
 assert.throws(()=>shareRevocationKeyDigest(a+"A"),/Invalid/);
});
test("public signed-share token hashing is bounded and isolated from revoke secret",()=>{
 const token="v1."+"a".repeat(100)+".signature";
 assert.match(shareBearerDigest(token),/^[a-f0-9]{64}$/);
 assert.equal(shareBearerDigest(token),shareBearerDigest(token));
 assert.throws(()=>shareBearerDigest("x".repeat(65537)),/Invalid/);
 assert.throws(()=>shareBearerDigest("not-a-signed-link"),/Invalid/);
});
test("share revocation RPC responses fail closed unless native boolean",()=>{
 assert.equal(requireShareRevocationBoolean(true),true);
 assert.equal(requireShareRevocationBoolean(false),false);
 for(const value of ["false","true",null,{},[true],0,1])
   assert.throws(()=>requireShareRevocationBoolean(value),/Malformed/);
});
