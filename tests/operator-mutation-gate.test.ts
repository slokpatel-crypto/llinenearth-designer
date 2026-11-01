import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createOperatorMutationGate} from "../src/lib/designer/operator-mutation-gate.ts";

test("synchronous operator gate never admits two overlapping submits",()=>{
  const gate=createOperatorMutationGate();
  assert.equal(gate.enter(),true);
  assert.equal(gate.enter(),false,"double click cannot enter before React renders disabled state");
  assert.equal(gate.enter(),false);
  gate.exit();
  assert.equal(gate.enter(),true,"new action allowed after prior request resolves");
  gate.exit();
});

test("operator gate is per-client and releases after rejected or failed operation",async()=>{
  const a=createOperatorMutationGate(), b=createOperatorMutationGate();
  assert.equal(a.enter(),true);
  assert.equal(b.enter(),true);
  const fail=async()=>{
    try{throw new Error("synthetic network timeout");}
    finally{a.exit();}
  };
  await assert.rejects(fail(),/synthetic network timeout/);
  assert.equal(a.enter(),true);
  assert.equal(a.enter(),false);
  a.exit();b.exit();
});

test("Production Desk holds one immediate gate across write and locked-vault loads",()=>{
  const source=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=source.split("  async function post(")[1]?.split("  async function loadLockedDesign(")[0]??"";
  const vault=source.split("  async function loadLockedDesign(")[1]?.split("  function download(")[0]??"";
  assert.match(source,/useRef\(createOperatorMutationGate\(\)\)/);
  assert.match(post,/!mutationGate\.current\.enter\(\)/);
  assert.match(vault,/!mutationGate\.current\.enter\(\)/);
  assert.match(post,/finally\{mutationGate\.current\.exit\(\);setBusy\(false\);\}/);
  assert.match(vault,/finally\{mutationGate\.current\.exit\(\);setBusy\(false\);\}/);
  assert.ok(post.indexOf("mutationGate.current.enter()")<post.indexOf('fetch("/api/operator/production"'));
  assert.ok(vault.indexOf("mutationGate.current.enter()")<vault.indexOf('fetch("/api/designer/vault"'));
});
