import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
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

test("Designer share UI retains private cancellation capability away from public URLs",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(source,/shareRevocation/);
  assert.match(source,/revokeLastSharedDesignLink/);
  assert.match(source,/action:"revoke",token:shareRevocation.token/);
  assert.match(source,/Copy private cancellation code/);
  assert.match(source,/Revoke last public share link/);
  assert.match(source,/`\/share\/\$\{result.token\}`/);
  assert.doesNotMatch(source,/`\/share\/\$\{result.token\}[^\n]*revokeKey/);
});

test("public signed-share bearer paths have no-referrer, noindex and no-store headers",()=>{
 const source=readFileSync("next.config.ts","utf8");
 const page=readFileSync("src/app/share/[token]/page.tsx","utf8");
 assert.ok(source.includes('source:"/share/:path*"'));
 assert.match(source,/Referrer-Policy",value:"no-referrer"/);
 assert.match(source,/Cache-Control",value:"private, no-store, max-age=0"/);
 assert.match(source,/X-Robots-Tag",value:"noindex, nofollow, noarchive"/);
 assert.match(page,/referrer:"no-referrer"/);
});

test("customer account shares can be revoked across devices without retaining issuer key",()=>{
 const source=readFileSync("src/app/account/page.tsx","utf8");
 const route=readFileSync("src/app/api/designer/share/route.ts","utf8");
 const sql=readFileSync("supabase/migrations/20261103_design_share_revocation.sql","utf8");
 assert.match(source,/action:"listOwned"/);
 assert.match(source,/action:"revokeOwned",tokenHash/);
 assert.match(source,/My public design shares/);
 assert.match(route,/customer=await getCustomerIdentity\(request\)/);
 assert.match(route,/listOwnedShareRevocations\(customer.id\)/);
 assert.match(route,/revokeOwnedShare\(tokenHash,customer.id\)/);
 assert.match(sql,/where s.owner_user_id=p_owner_user_id/);
 assert.match(sql,/token_hash=p_token_hash and owner_user_id=p_owner_user_id/);
 assert.doesNotMatch(sql,/share_bearer|plaintext_token|revoke_key_plaintext/);
});
