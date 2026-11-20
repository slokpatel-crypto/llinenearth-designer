import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import type {DesignerFabric} from "../src/lib/designer/engine.ts";
const {load}=createRequire(import.meta.url)("../scripts/designer-test-loader.cjs");
const {draftFromOwnedLockedRevision,validOwnedDesignVaultId}=load("src/lib/designer/customer-resume.ts") as typeof import("../src/lib/designer/customer-resume.ts");
const {DESIGNER_SHIRTS,DESIGNER_PANTS,DESIGNER_REVIEWED_PAIRING,designerStyleForOccasion}=load("src/lib/designer/engine.ts") as typeof import("../src/lib/designer/engine.ts");
const {fromLegacyStyle}=load("src/lib/designer/style-spec-v2.ts") as typeof import("../src/lib/designer/style-spec-v2.ts");
import type {LockedDesignRevision} from "../src/lib/designer/design-lock.ts";

const shirtIds=DESIGNER_SHIRTS.map(f=>f.id);
const pantIds=DESIGNER_PANTS.map(f=>f.id);
const occasion=DESIGNER_REVIEWED_PAIRING.occasion;
const style=designerStyleForOccasion(occasion);

function syntheticOwnedRevision():LockedDesignRevision{
  // Clearly synthetic test data; the production endpoint separately checks
  // SHA-256, expiration, authentication and ownership before returning a row.
  return {
    version:"linen-earth-design-lock-v1",
    revisionId:"LE-LOCK-SYNTHETIC-PARENT",
    parentRevisionId:null,
    recipeHash:"a".repeat(64),
    lockedAt:"2026-11-01T00:00:00.000Z",
    garmentSpec:{
      version:"linen-earth-garment-spec-v1",
      context:{occasion,climate:"Not specified",intention:"Balanced"},
      fabrics:{
        shirt:{id:shirtIds[0],name:"Synthetic shirt"},
        trouser:{id:pantIds[0],name:"Synthetic trouser"},
      },
      styleSpec:fromLegacyStyle(style),
      bodyProfile:null,
      shirt:{
        collar:style.collar,collarFinish:style.collarFinish,
        cuff:style.cuff,placket:style.placket,fit:style.shirtFit,
        wear:style.shirtWear,button:style.button,
      },
      trouser:{
        shape:style.trouser,rise:style.rise,waistband:style.waistband,break:style.break,
      },
    },
  } as unknown as LockedDesignRevision;
}

test("resume uses owner-vault UUID only, not recovery tokens or arbitrary text",()=>{
  assert.equal(validOwnedDesignVaultId("b287e470-0e90-4fd4-b5fb-976eecebd244"),true);
  assert.equal(validOwnedDesignVaultId("lev1.b287e470-0e90-4fd4-b5fb-976eecebd244.secret"),false);
  assert.equal(validOwnedDesignVaultId("../../elsewhere"),false);
  assert.equal(validOwnedDesignVaultId(""),false);
  assert.equal(validOwnedDesignVaultId(null),false);
});

test("saved v2 construction and exact fabric IDs reopen as an editable child draft",()=>{
  const original=syntheticOwnedRevision();
  const result=draftFromOwnedLockedRevision(original,shirtIds,pantIds);
  assert.ok(result);
  assert.equal(result.shirtId,original.garmentSpec.fabrics.shirt.id);
  assert.equal(result.pantId,original.garmentSpec.fabrics.trouser.id);
  assert.equal(result.parentRevisionId,original.revisionId);
  assert.equal(result.styleSpec.styleSchemaVersion,2);
  assert.deepEqual(result.styleSpec,original.garmentSpec.styleSpec);
  result.styleSpec.pant.pleat="not-persisted-into-original";
  assert.notEqual(result.styleSpec.pant.pleat,original.garmentSpec.styleSpec?.pant.pleat);
  assert.equal("measurements" in result,false);
  assert.equal("recoveryToken" in result,false);
});

test("legacy locked recipes without v2 StyleSpec continue without replacing the canonical option vocabulary",()=>{
  const original=syntheticOwnedRevision();
  original.garmentSpec.styleSpec=null;
  const result=draftFromOwnedLockedRevision(original,shirtIds,pantIds);
  assert.ok(result);
  assert.equal(result.style.collar,style.collar);
  assert.equal(result.style.trouser,style.trouser);
  assert.equal(result.styleSpec.styleSchemaVersion,2);
  assert.equal(result.parentRevisionId,original.revisionId);
});

test("unknown fabrics, future cut versions, invalid contexts and legacy labels fail closed",()=>{
  const original=syntheticOwnedRevision();
  assert.equal(draftFromOwnedLockedRevision(original,[],pantIds),null);
  assert.equal(draftFromOwnedLockedRevision(original,shirtIds,[]),null);
  original.garmentSpec.styleSpec={...fromLegacyStyle(style),styleSchemaVersion:3} as never;
  assert.equal(draftFromOwnedLockedRevision(original,shirtIds,pantIds),null);
  original.garmentSpec.styleSpec=null;
  original.garmentSpec.shirt.collar="Invented collar";
  assert.equal(draftFromOwnedLockedRevision(original,shirtIds,pantIds),null);
  original.garmentSpec.shirt.collar=style.collar;
  original.garmentSpec.context.occasion="Unverified occasion" as never;
  assert.equal(draftFromOwnedLockedRevision(original,shirtIds,pantIds),null);
});

test("account continuation fetches owner-only revision and new locks retain parent identity",()=>{
  const account=readFileSync("src/app/account/page.tsx","utf8");
  const studio=readFileSync("src/components/DesignerModule.tsx","utf8");
  const api=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  assert.match(account,/resumeVault=/);
  assert.match(account,/action:"loadOwned"/);
  assert.match(studio,/action:"loadOwned",vaultId/);
  assert.match(studio,/verifyLockedDesignRevision\(data.revision\)/);
  assert.match(studio,/setLastLockedRevisionId\(resumed.parentRevisionId\)/);
  assert.match(studio,/parentRevisionId:lastLockedRevisionId/);
  assert.match(api,/if\(action==="loadOwned"\)/);
  assert.match(api,/p_owner_user_id:customer.id/);
  assert.doesNotMatch(account,/resumeVault=.*recoveryToken/);
});


test("a successful vault write is never mislabeled as account-owned without an owner acknowledgment",()=>{
  const studio=readFileSync("src/components/DesignerModule.tsx","utf8");
  const api=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  assert.match(api,/return jsonNoStore\(\{[\s\S]*?accountOwned,[\s\S]*?customer:/);
  assert.match(studio,/const accountOwned=result\.accountOwned===true/);
  assert.match(studio,/setVaultAccountOwned\(accountOwned\)/);
  assert.match(studio,/not linked to your account yet/);
  assert.match(studio,/Sign in to My Account and link this recovery token/);
  assert.match(studio,/Reassess this saved look/);
});


test("starting a fresh unrelated design severs owned-design ancestry",()=>{
  const studio=readFileSync("src/components/DesignerModule.tsx","utf8");
  const reset=studio.split("function resetDraft() {")[1]?.split("async function runAdvancedSearch()")[0]||"";
  assert.ok(reset,"the existing Studio reset control must remain available");
  assert.match(reset,/setLastLockedRevisionId\(null\)/);
  assert.match(reset,/setResumeStatus\("idle"\)/);
});


test("private vault listing carries bounded recorded revision parent without a new database write",()=>{
  const api=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  const account=readFileSync("src/app/account/page.tsx","utf8");
  const ownerList=api.split('if(action==="listOwned"){')[1]?.split('if(action==="loadOwned"){')[0]||"";
  assert.ok(ownerList);
  assert.match(ownerList,/p_owner_user_id:customer.id/);
  assert.match(ownerList,/verifyLockedDesignRevision\(revision\)/);
  assert.match(ownerList,/parentRevisionId:typeof revision.parentRevisionId==="string"/);
  assert.match(ownerList,/revision.parentRevisionId.length<=220/);
  assert.match(account,/Continues recorded revision \{item.parentRevisionId\}/);
});
