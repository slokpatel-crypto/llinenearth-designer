import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperatorLockedSelection} from "../src/lib/designer/operator-locked-selection.ts";
import {selectVaultReadRow} from "../src/lib/vault-read-integrity.ts";

const good={
  revisionId:"LE-LOCK-20261028183000-ABCDEF123456-A1B2C3D4E5F6A7B8",
  recipeHash:"A".repeat(64),
  recoveryToken:"lev1.some-private-token-that-will-be-verified-on-the-server",
  note:"Approved only for a quote review",
  quoteId:"",
};

test("operator quote/order fields preserve literal locked lineage without silent truncation",()=>{
  assert.deepEqual(parseOperatorLockedSelection(good),{
    revisionId:good.revisionId,recipeHash:"a".repeat(64),recoveryToken:good.recoveryToken,
    note:good.note,quoteId:null,
  });
  assert.equal(parseOperatorLockedSelection({...good,note:null})?.note,"");
  assert.equal(parseOperatorLockedSelection({...good,quoteId:" 123e4567-e89b-42d3-a456-426614174000 "})?.quoteId,
    "123e4567-e89b-42d3-a456-426614174000");
});

test("operator creation rejects coerced, malformed or silently truncated identities and notes",()=>{
  for(const field of ["revisionId","recipeHash","recoveryToken","note","quoteId"] as const){
    const value=good[field];
    for(const malformed of [[value],{value},true,11]){
      assert.equal(parseOperatorLockedSelection({...good,[field]:malformed}),null,field);
    }
  }
  for(const payload of [
    {...good,revisionId:"x"},
    {...good,revisionId:"x".repeat(181)},
    {...good,recipeHash:"f".repeat(63)},
    {...good,recipeHash:"g".repeat(64)},
    {...good,recoveryToken:""},
    {...good,recoveryToken:"x".repeat(4097)},
    {...good,note:"x".repeat(1001)},
    {...good,quoteId:"x".repeat(181)},
  ])assert.equal(parseOperatorLockedSelection(payload),null);
});

test("production recovery must return exactly one unexpired row, not arbitrary first record",()=>{
  const row={expires_at:"2026-12-01T00:00:00Z",payload:{revisionId:good.revisionId}};
  const now=Date.parse("2026-10-28T18:30:00Z");
  assert.deepEqual(selectVaultReadRow([row],now),row);
  assert.equal(selectVaultReadRow([row,row],now),null);
  assert.equal(selectVaultReadRow([],now),null);
  assert.equal(selectVaultReadRow({rows:[row]},now),null);
  assert.equal(selectVaultReadRow([{...row,expires_at:"2026-01-01T00:00:00Z"}],now),null);
});

test("operator quote and order use the same vault-row and immutable-revision validation",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(source,/const row=selectVaultReadRow\(rows\)/);
  assert.match(source,/verifyLockedDesignRevision\(revision\)/);
  assert.match(source,/parseDesignVaultRecoveryToken\(recoveryToken\)/);
  assert.match(source,/const identity=parseOperatorLockedSelection\(body\)/);
  assert.match(source,/const \{revisionId,recipeHash,recoveryToken,note\}=identity/);
  assert.match(source,/const \{revisionId,recipeHash,recoveryToken,note,quoteId\}=identity/);
  assert.doesNotMatch(source,/const revision=rows\[0\]\?\.payload/);
  assert.doesNotMatch(source,/String\(body\.revisionId\|\|""\)/);
  assert.doesNotMatch(source,/String\(body\.recoveryToken\|\|""\)/);
});
