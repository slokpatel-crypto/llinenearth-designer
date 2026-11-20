import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("customer account refresh invalidates stale owner responses before rendering",()=>{
 const source=readFileSync("src/app/account/page.tsx","utf8");
 assert.match(source,/const refreshEpoch=useRef\(0\)/);
 assert.match(source,/const epoch=\+\+refreshEpoch\.current/);
 assert.equal(source.split("if(epoch!==refreshEpoch.current)return").length-1,3,
   "check initial session, owned reads and final session confirmation separately");
 const ownerGuard=source.indexOf("loadedOwnerId.current!==(next?.id??null)");
 const clear=source.indexOf("setShares([]);setShareListUnavailable(false);setDesigns([])",ownerGuard);

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

test("owned-share loading errors remain visible rather than pretending no shares exist",()=>{
 const source=readFileSync("src/app/account/page.tsx","utf8");
 assert.match(source,/setShareListUnavailable\(Boolean\(s\.unavailable\)\|\|!Array\.isArray\(s\.shares\)\)/);
 assert.match(source,/r\.ok\?r\.json\(\):Promise\.reject/);
 assert.match(source,/Your existing links may still be active/);
 assert.match(source,/Retry share list/);
 assert.match(source,/shareListUnavailable\?</);
});

test("failed session rechecks fail closed and clear all old owner credentials",()=>{
 const source=readFileSync("src/app/account/page.tsx","utf8");
 const refresh=source.slice(source.indexOf("const refresh=useCallback"),source.indexOf("useEffect(()=>"));
 const ownerSwitch=refresh.slice(refresh.indexOf("if(loadedOwnerId.current"),refresh.indexOf("setCustomer(next)"));
 assert.match(refresh,/r\.ok\?r\.json\(\):Promise\.reject/);
 assert.match(refresh,/\.catch\(\(\)=>\(\{customer:null,unavailable:true\}\)\)/);
 assert.match(refresh,/setSessionUnavailable\(unavailable\)/);
 assert.match(ownerSwitch,/setShares\(\[\]\)/);
 assert.match(ownerSwitch,/setDesigns\(\[\]\)/);
 assert.match(ownerSwitch,/setProfiles\(\[\]\)/);
 assert.match(ownerSwitch,/setOrders\(\[\]\)/);
 assert.match(ownerSwitch,/setOutcomeDrafts\(\{\}\)/);
 for(const clear of [
   'setClaimDesign("")','setClaimMeasurement("")','setEmail("")',
   'setCode("")','setCodeSent(false)',
 ])assert.ok(ownerSwitch.includes(clear),"owner transition must scrub "+clear);
 assert.match(source,/Account session could not be verified\. Previously loaded private details have been hidden/);
 assert.match(source,/Retry account session/);
});

test("account-owned results require a second same-owner session confirmation before rendering",()=>{
 const src=readFileSync("src/app/account/page.tsx","utf8");
 const refresh=src.slice(src.indexOf("const refresh=useCallback"),src.indexOf("useEffect(()=>"));
 const initial=refresh.indexOf('const session=await fetch("/api/customer-auth/session"');
 const owned=refresh.indexOf("const owned=await Promise.all");
 const recheck=refresh.indexOf('const confirmed=owned?await fetch("/api/customer-auth/session"');
 const publish=refresh.indexOf("setDesigns(Array.isArray(d.designs)?d.designs:[])");
 assert.ok(initial>=0&&owned>initial&&recheck>owned&&publish>recheck,
   "two signed session reads must bracket the private reads");
 const guard=refresh.indexOf("confirmed.customer.id!==next.id",recheck);
 const hide=refresh.indexOf("setCustomer(null);setSessionUnavailable(true)",guard);
 assert.ok(guard>recheck&&hide>guard&&hide<publish,
   "identity mismatch must clear the page before publishing any owned results");
 for(const endpoint of ["Owned design lookup unavailable","Owned profile lookup unavailable",
   "Owned production lookup unavailable"]){
   assert.ok(refresh.includes(endpoint),
     "failed backend HTTP responses must never be treated as empty owned history: "+endpoint);
 }
 assert.match(refresh,/!Array\.isArray\(owned\[0\]\?\.designs\)/);
 assert.match(refresh,/!Array\.isArray\(owned\[2\]\?\.outcomes\)/);
});
