import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireOwnedDesignVaultRows} from "../src/lib/designer/design-vault-owned-list.ts";

const hash="ab".repeat(32);
const revision={version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261101190000-ABABABABABAB",recipeHash:hash,
  garmentSpec:{version:"linen-earth-garment-spec-v1"}};
const valid={vault_id:"b287e470-0e90-4fd4-b5fb-976eecebd244",
  revision_id:revision.revisionId,recipe_hash:hash,payload:revision,
  created_at:"2026-11-01T19:00:00Z",expires_at:"2027-01-01T00:00:00Z"};

test("owned vault list accepts at most SQL's 100 valid rows with consistent metadata",()=>{
  assert.deepEqual(requireOwnedDesignVaultRows([]),[]);
  assert.deepEqual(requireOwnedDesignVaultRows([valid]),[valid]);
  assert.equal(requireOwnedDesignVaultRows(Array.from({length:100},()=>({...valid}))).length,100);
  assert.throws(()=>requireOwnedDesignVaultRows(Array.from({length:101},()=>valid)),
    /Invalid owned design vault list/);
});

test("malformed owner lists fail closed rather than claim missing or valid designs",()=>{
  for(const rows of [undefined,null,{},false,true,"[]",7,
    [null],[undefined],[true],["invalid"],[[]],[{}],
    [{...valid,vault_id:"invalid"}],
    [{...valid,revision_id:"not-a-locked-revision"}],
    [{...valid,recipe_hash:"bad"}],
    [{...valid,payload:[]}],
    [{...valid,payload:null}],
    [{...valid,payload:{...revision,version:"other"}}],
    [{...valid,payload:{...revision,revisionId:"LE-LOCK-20261101190000-OTHER"}}],
    [{...valid,payload:{...revision,recipeHash:"cd".repeat(32)}}],
    [{...valid,created_at:"not-date"}],
    [{...valid,expires_at:null}],
    [{...valid,expires_at:""}],
  ]) assert.throws(()=>requireOwnedDesignVaultRows(rows),/Invalid owned|Inconsistent owned/,
    JSON.stringify(rows));
});

test("saved-design list validates SQL metadata before canonical locked-recipe hash",()=>{
  const route=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  const list=route.split('if(action==="listOwned"){')[1]?.split('if(action==="loadOwned"){')[0]??"";
  assert.match(list,/rpc<unknown>\("designer_locked_revision_vault_list_owned"/);
  assert.match(list,/requireOwnedDesignVaultRows\(responseRows\)/);
  assert.ok(list.indexOf("requireOwnedDesignVaultRows")<list.indexOf("verifyLockedDesignRevision"));
  assert.doesNotMatch(list,/rpc<Array<\{/);
  assert.match(list,/return jsonNoStore\(\{designs,customer:\{email:customer\.email\}\}\)/);
});
