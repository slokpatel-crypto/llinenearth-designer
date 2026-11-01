import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireSingleDesignVaultRow} from "../src/lib/designer/design-vault-row.ts";

const expires_at="2027-01-01T00:00:00Z";
const payload={version:"linen-earth-design-lock-v1",recipeHash:"f".repeat(64)};
test("SQL single design-vault lookup supports only zero or one valid row",()=>{
  assert.equal(requireSingleDesignVaultRow([]),null);
  assert.deepEqual(requireSingleDesignVaultRow([{payload,expires_at}]),{payload,expires_at});
  assert.deepEqual(requireSingleDesignVaultRow([{payload,expires_at:"2027-01-01T00:00:00+00:00"}])?.payload,payload);
});
test("malformed HTTP 200 vault envelopes never look like missing or valid designs",()=>{
  for(const invalid of [
    null,undefined,{},true,false,"[]",1,
    [null],[undefined],[true],[false],[0],["bad"],[[]],
    [{payload,expires_at},{payload,expires_at}],
    [{}],[{payload:null,expires_at}],[{payload:"bad",expires_at}],
    [{payload:[],expires_at}],[{payload,expires_at:null}],
    [{payload,expires_at:0}],[{payload,expires_at:"bad date"}],
    [{payload,expires_at:""}],
  ]) assert.throws(()=>requireSingleDesignVaultRow(invalid),
    /Invalid design vault lookup/,JSON.stringify(invalid));
});
test("claim, token recovery and owned recovery must validate row envelopes before accessing designs",()=>{
  const src=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  assert.equal((src.match(/requireSingleDesignVaultRow\(rows\)/g)||[]).length,3);
  assert.equal((src.match(/rpc<unknown>\("designer_locked_revision_vault_get"/g)||[]).length,2);
  assert.match(src,/rpc<unknown>\(\s*"designer_locked_revision_vault_get_owned"/);
  assert.doesNotMatch(src,/const row=rows\[0\]/);
  assert.doesNotMatch(src,/const revision=rows\[0\]\?\.payload/);
  assert.match(src,/if\(!row\) return jsonNoStore\(\{error:"Design not found or recovery token expired\."\},\{status:404\}\)/);
});
