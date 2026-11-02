import test from "node:test";
import assert from "node:assert/strict";
import {createStockUncertainJournal} from "../src/lib/designer/stock-uncertain-journal.ts";

function memoryStorage(){
  const data=new Map<string,string>();
  return {
    getItem(key:string){return data.get(key)??null;},
    setItem(key:string,value:string){data.set(key,value);},
    removeItem(key:string){data.delete(key);},
    data,
  };
}
test("pending write persists across a reload and unlocks only after reconciliation",()=>{
  const store=memoryStorage();
  const first=createStockUncertainJournal(()=>store);
  assert.equal(first.isBlocked(),false);
  first.markPending();
  assert.equal(first.isBlocked(),true);
  const reload=createStockUncertainJournal(()=>store);
  assert.equal(reload.isBlocked(),true,"reload must not reenable physical stock buttons");
  assert.throws(()=>reload.markPending(),/No new stock movement was sent/);
  assert.equal(reload.clearPending(),true);
  assert.equal(createStockUncertainJournal(()=>store).isBlocked(),false);
});
test("unexpected or unreadable journal state is always considered an unresolved write",()=>{
  const store=memoryStorage();
  store.setItem("linen-earth:stock-uncertain-pending:v1","unexpected");
  const journal=createStockUncertainJournal(()=>store);
  assert.equal(journal.isBlocked(),true);
  assert.throws(()=>journal.markPending(),/No new stock movement was sent/);
  const denied=createStockUncertainJournal(()=>{throw Error("SecurityError");});
  assert.equal(denied.isBlocked(),true);
  assert.equal(denied.clearPending(),false);
  assert.throws(()=>denied.markPending(),/No new stock movement was sent/);
});
test("pending marker write must be verified before privileged POST is allowed",()=>{
  const ignored={
    getItem(){return null;},
    setItem(){},removeItem(){},
  };
  const journal=createStockUncertainJournal(()=>ignored);
  assert.throws(()=>journal.markPending(),/No new stock movement was sent/);
  const readonly={
    getItem(){return null;},
    setItem(){throw Error("QuotaExceededError");},
    removeItem(){},
  };
  assert.throws(()=>createStockUncertainJournal(()=>readonly).markPending(),
    /No new stock movement was sent/);
});
test("failed delete cannot unlock an unresolved stock write",()=>{
  const store={
    getItem(){return "pending";},
    setItem(){},
    removeItem(){throw Error("SecurityError");},
  };
  const journal=createStockUncertainJournal(()=>store);
  assert.equal(journal.isBlocked(),true);
  assert.equal(journal.clearPending(),false);
  assert.equal(journal.isBlocked(),true);
});
