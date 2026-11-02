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
