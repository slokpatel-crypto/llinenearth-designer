import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {productionWriteReviewSummary} from "../src/lib/designer/production-review-summary.ts";

test("uncertain-write review captures immutable instruction but no recovery secrets",()=>{
  const secret="DO-NOT-RENDER-RECOVERY-TOKEN";
  const input={
    action:"create_quote",revisionId:"REVISION-LOCKED-987654",recipeHash:"a".repeat(64),
    currency:"INR",adjustment:-0.25,note:" Hem to 26 inches ",
    lineItems:[{label:" Fabric ",amount:1200.1},{label:"Sewing",amount:350}],
    recoveryToken:secret,sessionCookie:secret,customerPhone:secret,unexpectedKey:secret,
  };
  const review=productionWriteReviewSummary(input);
  assert.equal(review.action,"create_quote");
  assert.equal(review.revisionId,input.revisionId);
  assert.equal(review.currency,"INR");
  assert.equal(review.note,"Hem to 26 inches");
  assert.deepEqual(review.lineItems,[{label:"Fabric",amount:1200.1},{label:"Sewing",amount:350}]);
  assert.equal(review.adjustment,-0.25);
  const serialized=JSON.stringify(review);
  assert.doesNotMatch(serialized,/DO-NOT-RENDER-RECOVERY-TOKEN|recoveryToken|customerPhone|sessionCookie/);
  assert.equal(Object.hasOwn(review,"recoveryToken"),false);
  input.lineItems[0].label="Changed after sending";
  assert.equal(review.lineItems[0].label,"Fabric","Do not reuse a mutable form input object for review");
});

test("review summary clamps arbitrary untrusted fields and malformed lines",()=>{
  const review=productionWriteReviewSummary({
    action:"unknown-operation",revisionId:"r".repeat(300),recipeHash:"b".repeat(300),
    note:"n".repeat(1200),quoteId:"q".repeat(80),orderId:"o".repeat(80),
    status:"s".repeat(60),currency:"INREXTRA",
    adjustment:Infinity,
    lineItems:[{label:"Valid",amount:1},{label:"Bad",amount:NaN},
      {label:{attack:true},amount:999},{label:"negative",amount:-1},
      ...Array.from({length:40},(_,i)=>({label:"extra "+i,amount:i}))],
  });
  assert.equal(review.action,"unknown");
  assert.equal(review.revisionId.length,220);
  assert.equal(review.recipeHash.length,64);
  assert.equal(review.note.length,1000);
  assert.equal(review.quoteId.length,36);
  assert.equal(review.orderId.length,36);
  assert.equal(review.status.length,32);
  assert.equal(review.currency.length,3);
  assert.equal(review.adjustment,null);
  assert.equal(review.lineItems.length,27,"Source is capped to the first 30 items");
  assert.equal(review.lineItems[0].label,"Valid");
});

test("review page must show submission alongside saved quote and order evidence",()=>{
  const source=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=source.split("async function post(")[1]?.split("function confirmReviewedProductionHistory(")[0]||"";
  assert.match(source,/const \[pendingWriteReview,setPendingWriteReview\]=useState<ProductionWriteReviewSummary\|null>\(null\)/);
  assert.match(post,/const attempt=productionWriteReviewSummary\(body\);/);
  assert.match(post,/if\(!certainPrewriteRejection\)\{\s*setPendingWriteReview\(attempt\);\s*setRequiresWriteReview\(true\);/);
  assert.match(post,/if\(confirmed\)\{[^]*?\}else\{[^]*?setPendingWriteReview\(attempt\);\s*setRequiresWriteReview\(true\);/);
  assert.match(source,/setPendingWriteReview\(null\);/);
  assert.match(source,/UNCONFIRMED SUBMISSION/);
  assert.match(source,/pendingWriteReview\.lineItems\.map/);
  assert.match(source,/pendingWriteReview\.note/);
  assert.match(source,/Saved quote lines/);
  assert.match(source,/item\.line_items\.map/);
  assert.match(source,/item\.subtotal/);
  assert.match(source,/item\.adjustment/);
  assert.match(source,/Saved note: \{item.note\|\|"\(empty\)"\}/);
  assert.match(source,/Linked quote: \{item.quote_id\|\|"\(none\)"\}/);
  assert.match(source,/Missing records on this limited page do not prove a failed write/);
  const helper=readFileSync("src/lib/designer/production-review-summary.ts","utf8");
  assert.doesNotMatch(helper,/request\.recoveryToken|request\.sessionCookie|JSON\.stringify\(request\)/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*pendingWriteReview|sessionStorage\.setItem\([^\n]*pendingWriteReview/);
});
