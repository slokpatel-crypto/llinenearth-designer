import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireOwnedDesignVaultRows,requireSingleDesignVaultRow} from "../src/lib/designer/design-vault-row.ts";

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

 
const ownedId="b287e470-0e90-4fd4-b5fb-976eecebd244";
const ownedHash="f".repeat(64);
const ownedRevision="LE-LOCK-20261101180000-FFFFFFFFFFFF";
const ownedRow={
  vault_id:ownedId,revision_id:ownedRevision,recipe_hash:ownedHash,
  payload:{version:"linen-earth-design-lock-v1",revisionId:ownedRevision,recipeHash:ownedHash},
  created_at:"2026-11-01T18:00:00Z",expires_at:"2027-01-01T00:00:00Z",
};
test("owned design list requires a complete, identity-consistent SQL envelope",()=>{
  assert.deepEqual(requireOwnedDesignVaultRows([]),[]);
  assert.deepEqual(requireOwnedDesignVaultRows([ownedRow]),[ownedRow]);
  const uppercase={...ownedRow,vault_id:ownedId.toUpperCase()};
  assert.equal(requireOwnedDesignVaultRows([uppercase])[0].vault_id,ownedId);
  const hundred=Array.from({length:100},(_,i)=>({
    ...ownedRow,vault_id:ownedId.slice(0,-12)+i.toString(16).padStart(12,"0"),
  }));
  assert.equal(requireOwnedDesignVaultRows(hundred).length,100);
});
test("owned list rejects invalid 200 envelopes, duplicate IDs and false metadata",()=>{
  const badRows=[
    {...ownedRow,vault_id:"not-uuid"},
    {...ownedRow,vault_id:ownedId+" "},
    {...ownedRow,revision_id:"OTHER"},
    {...ownedRow,recipe_hash:"0".repeat(64)},
    {...ownedRow,payload:{...ownedRow.payload,revisionId:"OTHER"}},
    {...ownedRow,payload:{...ownedRow.payload,recipeHash:"0".repeat(64)}},
    {...ownedRow,payload:{...ownedRow.payload,version:"other"}},
    {...ownedRow,payload:null},
    {...ownedRow,payload:[]},
    {...ownedRow,created_at:"invalid"},
    {...ownedRow,expires_at:"invalid"},
    {...ownedRow,expires_at:ownedRow.created_at},
  ];
  for(const value of [null,{},true,"[]",1,[null],[false],[[]],badRows,
    [ownedRow,ownedRow],[ownedRow,{...ownedRow,vault_id:ownedId.toUpperCase()}],
    ...badRows.map(row=>[row]),
    Array.from({length:101},(_,i)=>({...ownedRow,vault_id:ownedId.slice(0,-12)+i.toString(16).padStart(12,"0")})),
  ]) assert.throws(()=>requireOwnedDesignVaultRows(value),/owned design vault list/i);
});
test("owned list validates every row and never silently omits tampered revisions",()=>{
  const src=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  const list=src.split('if(action==="listOwned"){')[1]?.split('if(action==="loadOwned"){')[0]??"";
  assert.match(list,/requireOwnedDesignVaultRows\(await rpc<unknown>\(/);
  assert.match(list,/if\(!await verifyLockedDesignRevision\(revision\)\)/);
  assert.match(list,/throw new Error\("Invalid owned design vault revision integrity\."\)/);
  assert.doesNotMatch(list,/if\(row\.payload&&await verifyLockedDesignRevision/);
});
