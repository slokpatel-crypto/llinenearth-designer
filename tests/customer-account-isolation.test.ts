import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("customer account refresh invalidates stale owner responses before rendering",()=>{
 const source=readFileSync("src/app/account/page.tsx","utf8");
 assert.match(source,/const refreshEpoch=useRef\(0\)/);
 assert.match(source,/const epoch=\+\+refreshEpoch\.current/);
 assert.equal(source.split("if(epoch!==refreshEpoch.current)return").length-1,2,
   "check session fetch and all owned vault/share responses separately");
 const clear=source.indexOf("setShares([]);setDesigns([]);setProfiles([])");
 const ownerGuard=source.indexOf("loadedOwnerId.current!==(next?.id??null)");
 assert.ok(ownerGuard>=0&&clear>ownerGuard,
   "clear previous owner state before displaying the new account");
 const assign=source.indexOf("setDesigns(Array.isArray(d.designs)?d.designs:[])");
 const tailCheck=source.lastIndexOf("if(epoch!==refreshEpoch.current)return",assign);
 assert.ok(tailCheck>clear&&tailCheck<assign,
   "never accept stale Alice design data after Bob refresh has started");
});

test("successful logout invalidates pending account fetches and immediately clears PII",()=>{
 const source=readFileSync("src/app/account/page.tsx","utf8");
 const logout=source.slice(source.indexOf("async function logout()"),source.indexOf("async function revokeOwnedShareLink"));
 assert.ok(logout.indexOf("if(!response.ok)")>=0);
 const confirmed=logout.indexOf('setMessage("Signed out.")');
 const invalidate=logout.indexOf("refreshEpoch.current+=1");
 assert.ok(invalidate>logout.indexOf("if(!response.ok)")&&invalidate<confirmed,
   "invalidate only after successful logout and before sign-out confirmation");
 for(const stmt of ["loadedOwnerId.current=null","setCustomer(null)","setShares([])",
   "setDesigns([])","setProfiles([])","setQuotes([])","setOrders([])",
   "setOrderEvents([])","setOutcomes([])","setOutcomeDrafts({})",
   'setClaimDesign("")','setClaimMeasurement("")','setEmail("")','setCode("")']){
   assert.ok(logout.indexOf(stmt)>=0&&logout.indexOf(stmt)<confirmed,
     "must immediately clear private state: "+stmt);
 }
 assert.ok(!logout.includes("await refresh()"),
   "a failed post-logout network read must not be required to clear private data");
});
