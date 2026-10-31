import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isCertainProductionPrewriteRejection} from "../src/lib/designer/production-post-retry.ts";

test("only explicit pre-RPC rejection statuses permit a definite no-write message",()=>{
  for(const code of [400,401,403,413,429]){
    assert.equal(isCertainProductionPrewriteRejection(code),true,String(code));
  }
  for(const code of [undefined,null,0,200,201,202,204,301,404,408,409,422,425,499,500,502,503,504,
    "400",false,{},[],NaN,Infinity]){
    assert.equal(isCertainProductionPrewriteRejection(code),false,
      "Unknown or ambiguous response must not imply that SQL did not commit: "+String(code));
  }
});

test("production POST never displays generic retryable failure after ambiguous network or receipt error",()=>{
  const file=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=file.split("async function post(")[1]?.split("async function loadLockedDesign(")[0]||"";
  assert.match(file,/import \{isCertainProductionPrewriteRejection\}/);
  assert.match(post,/let certainPrewriteRejection=false;/);
  assert.match(post,/certainPrewriteRejection=isCertainProductionPrewriteRejection\(response.status\)/);
  assert.match(post,/if\(!validProductionDeskMutationReceipt\(body.action,data\)\) throw new Error/);
  assert.match(post,/const confirmed=await load\(\{action:body.action,body,receipt:data\}\)/);
  const failure=post.split("}catch(error){")[1]?.split("finally{")[0]||"";
  const reload=failure.indexOf("const refreshed=await load();");
  const explicit=failure.indexOf("if(certainPrewriteRejection){");
  const ambiguous=failure.indexOf("}else{");
  assert.ok(reload>=0&&explicit>reload&&ambiguous>explicit,
    "Refresh must happen before any final error message, and ambiguous writes need separate messaging");
  assert.match(failure,/may already have been saved/g);
  assert.match(failure,/Inspect the refreshed quote\/order records before retrying/);
  assert.match(failure,/Do not retry until the production ledger can be inspected/);
  assert.doesNotMatch(failure,/setMessage\(error instanceof Error\?error.message:"Production operation failed\."\)/,
    "A thrown network error or invalid receipt must not invite blind duplicate retries");
  assert.ok(post.indexOf("if(confirmed)setMessage(success);")<post.indexOf("}catch(error){"),
    "Success remains gated on the exact independently verified readback");
  assert.match(post,/finally\{actionInFlight.current=false;setBusy\(false\);\}/);
});

test("an uncertain write keeps every production mutation disabled until verified human review",()=>{
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=client.split("async function post(")[1]?.split("function confirmReviewedProductionHistory(")[0]||"";
  const review=client.split("function confirmReviewedProductionHistory(")[1]?.split("async function loadLockedDesign(")[0]||"";
  assert.match(client,/const \[requiresWriteReview,setRequiresWriteReview\]=useState\(false\)/);
  assert.match(post,/if\(!configured\|\|requiresWriteReview\) return;/);
  const claim=post.indexOf("actionInFlight.current=true;");
  const pause=post.indexOf("if(!certainPrewriteRejection){");
  const snapshot=post.indexOf("setPendingWriteReview(attempt);",pause);
  const hold=post.indexOf("setRequiresWriteReview(true);",snapshot);
  const refresh=post.indexOf("const refreshed=await load();");
  const unlock=post.indexOf("finally{actionInFlight.current=false;setBusy(false);}");
  assert.ok(claim>=0&&pause>claim&&snapshot>pause&&hold>snapshot&&refresh>hold&&unlock>refresh,
    "Ambiguous failure must capture the submitted instruction and acquire the hold before refreshing");
  assert.doesNotMatch(post,/setRequiresWriteReview\(false\)/,
    "A normal or apparently healthy GET cannot automatically clear the human review hold");
  assert.match(post,/if\(confirmed\)setMessage\(success\);\s*else\{\s*\/\/[^]*?setRequiresWriteReview\(true\);/,
    "Even a valid success receipt with unconfirmed fresh history must leave the review hold active");
  assert.match(post,/its exact record could not be confirmed/);
  assert.match(review,/if\(!requiresWriteReview\|\|!configured\|\|busy\|\|actionInFlight.current\)return;/);
  assert.match(review,/setRequiresWriteReview\(false\)/);
  assert.match(review,/may still exist outside the visible ledger/);
  assert.match(client,/role="alert" aria-label="Production write review required"/);
  assert.match(client,/onClick=\{\(\)=>void load\(\)\}>Refresh production history/);
  assert.match(client,/disabled=\{!configured\|\|busy\|\|actionInFlight.current\} onClick=\{confirmReviewedProductionHistory\}/);
  assert.equal((client.match(/disabled=\{busy\|\|!configured\|\|requiresWriteReview\} onClick=\{\(\)=>void post\(\{action:"quote_status"/g)||[]).length,3);
  assert.match(client,/disabled=\{busy\|\|!configured\|\|requiresWriteReview\|\|!canQuote\}/);
  assert.match(client,/disabled=\{busy\|\|!configured\|\|requiresWriteReview\|\|!loadedRevision/);
  assert.match(client,/\{nextStatuses\.length>0&&<select disabled=\{busy\|\|!configured\|\|requiresWriteReview\}/);
});
