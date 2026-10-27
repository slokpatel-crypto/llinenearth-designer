import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPreviewRequestScope } from "../src/lib/designer/preview-request-scope.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("local preview callbacks only belong to an enabled committed owner", () => {
  const previous = createPreviewRequestScope();
  assert.equal(previous.isEnabled(), false);
  previous.activate();
  assert.equal(previous.isEnabled(), true);
  previous.invalidate();
  const replacement = createPreviewRequestScope();
  replacement.activate();
  assert.equal(previous.isEnabled(), false);
  assert.equal(replacement.isEnabled(), true);
  assert.equal(previous.begin(), null);
  replacement.invalidate();
  assert.equal(replacement.isEnabled(), false);
});

test("a changed design discards a delayed generation before cache or QA dispatch", async () => {
  const scope = createPreviewRequestScope();
  scope.activate();
  const request = scope.begin()!;
  const response = deferred<string>();
  const events: string[] = [];
  const render = (async () => {
    const image = await response.promise;
    if (!request.isCurrent()) return;
    events.push(`cache:${image}`, `inspect:${image}`, `display:${image}`);
  })();
  scope.invalidate();
  response.resolve("old-shirt");
  await render;
  assert.equal(request.signal.aborted, true);
  assert.deepEqual(events, []);
});

test("late QA cannot approve or hold the replacement design", async () => {
  for (const status of ["pass", "review"] as const) {
    const scope = createPreviewRequestScope();
    scope.activate();
    const request = scope.begin()!;
    const response = deferred<typeof status>();
    let displayed = "new-instant-preview";
    const inspect = (async () => {
      const check = await response.promise;
      if (request.isCurrent()) displayed = check === "pass" ? "old-photoreal" : "old-review";
    })();
    scope.invalidate();
    response.resolve(status);
    await inspect;
    assert.equal(displayed, "new-instant-preview");
  }
});

test("returning to the same design still requires a fresh request lifecycle", () => {
  const oldSelection = createPreviewRequestScope();
  oldSelection.activate();
  const oldRequest = oldSelection.begin()!;
  oldSelection.invalidate();
  const returnedSelection = createPreviewRequestScope();
  returnedSelection.activate();
  const freshRequest = returnedSelection.begin()!;
  assert.equal(oldRequest.isCurrent(), false);
  assert.equal(freshRequest.isCurrent(), true);
});

test("two immediate generation clicks dispatch only one active chain", () => {
  const scope = createPreviewRequestScope();
  scope.activate();
  const first = scope.begin()!;
  assert.equal(scope.begin(), null);
  assert.equal(first.isCurrent(), true);
  first.finish();
  assert.equal(first.isCurrent(), false);
  assert.ok(scope.begin());
});

test("cleanup aborts work and stale finally cannot unlock a remounted request", () => {
  const scope = createPreviewRequestScope();
  assert.equal(scope.begin(), null);
  scope.activate();
  const previous = scope.begin()!;
  scope.invalidate();
  assert.equal(scope.begin(), null);
  scope.activate();
  const current = scope.begin()!;
  previous.finish();
  assert.equal(previous.signal.aborted, true);
  assert.equal(previous.isCurrent(), false);
  assert.equal(current.isCurrent(), true);
  assert.equal(scope.begin(), null);
});

test("stale catalogue alternatives cannot replace a newer selection or unlock its request",async()=>{
  const scope=createPreviewRequestScope();
  scope.activate();
  const old=scope.begin()!;
  const oldReply=deferred<string[]>();
  const displayed:string[]=[];
  const oldWork=(async()=>{
    const alternatives=await oldReply.promise;
    if(old.isCurrent()) displayed.push(...alternatives);
    old.finish();
  })();
  scope.invalidate();
  scope.activate();
  const current=scope.begin()!;
  oldReply.resolve(["old-shirt","old-pant"]);
  await oldWork;
  assert.deepEqual(displayed,[]);
  assert.equal(old.signal.aborted,true);
  assert.equal(current.isCurrent(),true);
  assert.equal(scope.begin(),null);
  current.finish();
  assert.ok(scope.begin());
});

test("Designer alternative-search wiring aborts and ignores stale responses",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(source,/const searchIdentity=JSON\.stringify\(\[assessmentIdentity,searchScope\]\)/);
  assert.match(source,/const scope=searchRequestScopeRef\.current;\s*scope\.invalidate\(\);\s*scope\.activate\(\)/);
  const block=source.slice(source.indexOf("  async function runAdvancedSearch()"),source.indexOf("  async function requestCreativeDirections("));
  assert.match(block,/const request=searchRequestScopeRef\.current\.begin\(\)/);
  assert.match(block,/signal:request\.signal/);
  assert.match(block,/if\(!request\.isCurrent\(\)\) return;/);
  assert.match(block,/if\(request\.isCurrent\(\)\) setSearchLoading\(false\);\s*request\.finish\(\)/);
});
