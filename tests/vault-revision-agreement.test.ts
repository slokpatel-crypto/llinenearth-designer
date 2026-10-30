import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import type {LockedDesignRevision} from "../src/lib/designer/design-lock.ts";
import {sameLockedVaultRevision} from "../src/lib/designer/vault-revision-agreement.ts";

// The helper compares lineage after the caller independently verifies each
// lock's recipe hash. These minimal fixtures test the agreement boundary only.
const original={
  version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261030100000-AAAAAAAAAAAA-1234567890ABCDEF",
  recipeHash:"a".repeat(64),
  parentRevisionId:null,
  lockedAt:"2026-10-30T10:00:00.000Z",
} as LockedDesignRevision;

test("owner read accepts an independently reconstructed identical lock lineage",()=>{
  assert.equal(sameLockedVaultRevision(original,{...original}),true);
});

test("same recipe and revision ID cannot hide a changed parent or lock instant",()=>{
  for(const altered of [
    {...original,parentRevisionId:"LE-LOCK-20261029100000-BBBBBBBBBBBB"},
    {...original,lockedAt:"2026-10-30T10:00:00.001Z"},
    {...original,revisionId:"LE-LOCK-20261030100000-AAAAAAAAAAAA-0000000000000000"},
    {...original,recipeHash:"b".repeat(64)},
    {...original,version:"other"},
  ]){
    assert.equal(sameLockedVaultRevision(original,altered as LockedDesignRevision),false);
  }
});

test("design store and claim verify the recovered lock before comparing immutable lineage",()=>{
  const source=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  assert.match(source,/import \{ sameLockedVaultRevision \} from "@\/lib\/designer\/vault-revision-agreement"/);
  const store=source.slice(source.indexOf('if(action==="store")'),source.indexOf('if(action==="listOwned")'));
  const storeRead=store.indexOf('"designer_locked_revision_vault_get_owned"');
  const storeIntegrity=store.indexOf("verifyLockedDesignRevision(ownedRevision)",storeRead);
  const storeAgreement=store.indexOf("sameLockedVaultRevision(revision,ownedRevision)",storeIntegrity);
  const storeConfirmed=store.indexOf('accountOwned:linkStatus==="linked"',storeAgreement);
  assert.ok(storeRead>=0&&storeIntegrity>storeRead&&storeAgreement>storeIntegrity&&storeConfirmed>storeAgreement);
  const claim=source.slice(source.indexOf('if(action==="claim")'),source.indexOf('if(action==="load")'));
  const tokenIntegrity=claim.indexOf("verifyLockedDesignRevision(revision)");
  const mutation=claim.indexOf('"designer_locked_revision_vault_set_owner"',tokenIntegrity);
  const ownerRead=claim.indexOf('"designer_locked_revision_vault_get_owned"',mutation);
  const ownedIntegrity=claim.indexOf("verifyLockedDesignRevision(ownedRevision)",ownerRead);
  const agreement=claim.indexOf("sameLockedVaultRevision(revision,ownedRevision)",ownedIntegrity);
  const success=claim.indexOf("return jsonNoStore({claimed})",agreement);
  assert.ok(tokenIntegrity>=0&&mutation>tokenIntegrity&&ownerRead>mutation
    &&ownedIntegrity>ownerRead&&agreement>ownedIntegrity&&success>agreement);
});
