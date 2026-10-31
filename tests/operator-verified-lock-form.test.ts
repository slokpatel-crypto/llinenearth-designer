import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const path="src/app/operator/production/ProductionClient.tsx";
test("M131 operator quote/order recipe identity is loaded and read-only, not typed or guessed",()=>{
  const source=readFileSync(path,"utf8");
  for(const field of ["quote.revisionId","quote.recipeHash","order.revisionId","order.recipeHash"]){
    const escaped=field.replace(".","\\.");
    assert.match(source,new RegExp("value=\\{"+escaped+"\\} readOnly aria-readonly="));
    assert.doesNotMatch(source,new RegExp("value=\\{"+escaped+"\\} onChange="),
      "No editable locked identity field: "+field);
  }
  assert.match(source,/setLoadedRevision\(null\);/);
  assert.match(source,/setQuote\(\(current\)=>\(\{\.\.\.current,revisionId:"",recipeHash:""\}\)\);/);
  assert.match(source,/setOrder\(\(current\)=>\(\{\.\.\.current,revisionId:"",recipeHash:"",quoteId:""\}\)\);/);
  assert.match(source,/if\(!response\.ok\|\|!data\?\.revision\|\|!await verifyLockedDesignRevision\(data\.revision\)\)/);
  assert.match(source,/setLoadedRevision\(revision\)/);
});

test("M131 quote and order POST identities come from verified revision and require an exact match",()=>{
  const source=readFileSync(path,"utf8");
  assert.match(source,/const lockedQuoteMatches=Boolean\(loadedRevision\)&&quote\.revisionId===loadedRevision\?\.revisionId/);
  assert.match(source,/sameProductionRecipeHash\(quote\.recipeHash,loadedRevision\?\.recipeHash\)/);
  assert.match(source,/const lockedOrderMatches=Boolean\(loadedRevision\)&&order\.revisionId===loadedRevision\?\.revisionId/);
  assert.match(source,/sameProductionRecipeHash\(order\.recipeHash,loadedRevision\?\.recipeHash\)/);
  assert.match(source,/const canQuote=lockedQuoteMatches&&quoteItems\.length>0/);
  assert.match(source,/disabled=\{busy\|\|!configured\|\|requiresWriteReview\|\|!lockedOrderMatches\}/);
  assert.match(source,/action:"create_quote",revisionId:loadedRevision\?\.revisionId,recipeHash:loadedRevision\?\.recipeHash/);
  assert.match(source,/action:"create_order",\.\.\.order,revisionId:loadedRevision\?\.revisionId,recipeHash:loadedRevision\?\.recipeHash/);
  assert.doesNotMatch(source,/action:"create_quote",revisionId:quote\.revisionId,recipeHash:quote\.recipeHash/);
  assert.doesNotMatch(source,/action:"create_order",\.\.\.order,recoveryToken:/);
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(route,/loadVerifiedLockedRevision\(recoveryToken\)/);
  assert.match(route,/revision\.revisionId!==revisionId\|\|revision\.recipeHash\.toLowerCase\(\)!==recipeHash/);
  const sql=readFileSync("supabase/migrations/20261001_production_quotes_orders.sql","utf8");
  assert.match(sql,/quote does not match locked design/);
});

test("M131 verified identities retain independent editable quote prices and real SQL locked-field protection",()=>{
  const source=readFileSync(path,"utf8");
  assert.match(source,/value=\{quote\.currency\} maxLength=\{3\} onChange=/);
  assert.match(source,/value=\{quote\.adjustment\} onChange=/);
  assert.match(source,/value=\{quote\.line1Amount\} onChange=/);
  const migration=readFileSync("supabase/migrations/20261119_locked_production_identity_immutable.sql","utf8");
  assert.match(migration,/new\.recipe_hash is distinct from old\.recipe_hash/);
  assert.match(migration,/new\.line_items is distinct from old\.line_items/);
  assert.match(migration,/new\.quote_id is distinct from old\.quote_id/);
});
