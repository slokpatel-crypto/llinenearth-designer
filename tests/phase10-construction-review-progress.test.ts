import test from "node:test";
import assert from "node:assert/strict";

function completion(approved:number,rejected:number,total:number){
  return total?Math.round((approved+rejected)/total*100):0;
}

test("construction review completion counts both approve and reject decisions",()=>{
  assert.equal(completion(6,4,10),100);
  assert.equal(completion(5,2,10),70);
  assert.equal(completion(0,0,0),0);
});
