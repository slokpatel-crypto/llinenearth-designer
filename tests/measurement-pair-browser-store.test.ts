import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {persistMeasurementPair,type MeasurementPairStore} from "../src/lib/measurement-pair-browser-store.ts";
import {MEASUREMENT_STORAGE_KEY as PROFILE} from "../src/lib/measurements.ts";
import {TAILOR_OBSERVATION_STORAGE_KEY as OBS} from "../src/lib/designer/tailor-observations.ts";

function store(seed:Record<string,string>={},fail?:(key:string,value:string)=>void){
  const state=new Map(Object.entries(seed));
  const storage:MeasurementPairStore={
    getItem:key=>state.get(key)??null,
    setItem:(key,value)=>{fail?.(key,value);state.set(key,value);},
    removeItem:key=>{state.delete(key);},
  };
  return {state,storage};
}

test("profile and manual observations save together when storage permits it",()=>{
  const {state,storage}=store({[PROFILE]:"old-p",[OBS]:"old-o"});
  const result=persistMeasurementPair(storage,"new-p","new-o");
  assert.deepEqual(result,{saved:true,rollbackComplete:true});
  assert.equal(state.get(PROFILE),"new-p");
  assert.equal(state.get(OBS),"new-o");
});

test("failed second write restores the previous complete pair",()=>{
  const {state,storage}=store({[PROFILE]:"old-p",[OBS]:"old-o"},(key,value)=>{
    if(key===OBS&&value==="new-o")throw Error("quota");
  });
  assert.deepEqual(persistMeasurementPair(storage,"new-p","new-o"),{saved:false,rollbackComplete:true});
  assert.deepEqual([...state.entries()].sort(),[[PROFILE,"old-p"],[OBS,"old-o"]].sort());
});

test("failed second write removes newly inserted profile if none was previously saved",()=>{
  const {state,storage}=store({},(key,value)=>{
    if(key===OBS&&value==="new-o")throw Error("security");
  });
  assert.deepEqual(persistMeasurementPair(storage,"new-p","new-o"),{saved:false,rollbackComplete:true});
  assert.equal(state.size,0);
});

test("an impossible rollback is surfaced rather than claiming local consistency",()=>{
  const {state,storage}=store({[PROFILE]:"old-p",[OBS]:"old-o"},(key,value)=>{
    if(key===OBS&&value==="new-o")throw Error("quota");
    if(key===PROFILE&&value==="old-p")throw Error("rollback denied");
  });
  assert.deepEqual(persistMeasurementPair(storage,"new-p","new-o"),{saved:false,rollbackComplete:false});
  assert.equal(state.get(PROFILE),"new-p");
});

test("another tab's concurrent edit is never overwritten during rollback",()=>{
  const {state,storage}=store({[PROFILE]:"old-p",[OBS]:"old-o"},(key,value)=>{
    if(key===OBS&&value==="new-o"){state.set(PROFILE,"from-another-tab");throw Error("quota");}
  });
  assert.deepEqual(persistMeasurementPair(storage,"new-p","new-o"),{saved:false,rollbackComplete:false});
  assert.equal(state.get(PROFILE),"from-another-tab");
});

test("read permission failure cannot mutate either saved record",()=>{
  const state=new Map([[PROFILE,"old-p"],[OBS,"old-o"]]);
  const storage:MeasurementPairStore={
    getItem:()=>{throw Error("access denied");},
    setItem:()=>{throw Error("should not write");},
    removeItem:()=>{throw Error("should not remove");},
  };
  assert.deepEqual(persistMeasurementPair(storage,"new-p","new-o"),{saved:false,rollbackComplete:true});
  assert.equal(state.get(PROFILE),"old-p");
});

test("save and restore both gate React state updates on successful paired browser writes",()=>{
  const source=readFileSync("src/components/MeasurementStudio.tsx","utf8");
  const save=source.slice(source.indexOf("async function saveSecureCopy()"),source.indexOf("async function loadSecureCopy()"));
  const load=source.slice(source.indexOf("async function loadSecureCopy()"),source.indexOf("async function deleteSecureCopy()"));
  assert.match(save,/const localResult=persistMeasurementPair\(/);
  assert.match(save,/if\(localSaved\)\{\s*setProfile\(nextProfile\)/);
  assert.match(load,/const localResult=persistMeasurementPair\(/);
  assert.match(load,/if\(!localResult.saved\)\{/);
  assert.ok(load.indexOf("if(!localResult.saved)")<load.indexOf("setProfile(nextProfile);"));
  assert.match(load,/Secure measurement copy was retrieved, but browser storage failed/);
});

test("primary save and Designer navigation refuse a partially written fit",()=>{
  const source=readFileSync("src/components/MeasurementStudio.tsx","utf8");
  const direct=source.slice(source.indexOf("  function save(){"),source.indexOf("  async function saveSecureCopy()"));
  assert.match(direct,/const localResult=persistMeasurementPair\(/);
  assert.match(direct,/if\(!localResult\.saved\)\{/);
  assert.ok(direct.indexOf("if(!localResult.saved)")<direct.indexOf("setProfile(inchProfile);"));
  assert.match(direct,/return false;/);
  assert.doesNotMatch(direct,/localStorage\.setItem/);
  assert.match(source,/onClick=\{\(event\)=>\{if\(!save\(\)\)event\.preventDefault\(\);\}\}/);
  assert.match(source,/role="alert"/);
  assert.match(source,/previous complete fit remains active/);
  assert.match(source,/browser storage may now be inconsistent/);
});

test("readback detects a concurrent change even if both writes returned successfully",()=>{
  const {state,storage}=store({[PROFILE]:"old-p",[OBS]:"old-o"},(key,value)=>{
    if(key===OBS&&value==="new-o")state.set(PROFILE,"other-tab");
  });
  assert.deepEqual(persistMeasurementPair(storage,"new-p","new-o"),{saved:false,rollbackComplete:false});
  assert.equal(state.get(PROFILE),"other-tab");
  assert.equal(state.get(OBS),"old-o");
});

test("silent lost writes cannot be reported as a complete fit",()=>{
  const {state,storage}=store({[PROFILE]:"old-p",[OBS]:"old-o"});
  const original=storage.setItem;
  storage.setItem=(key,value)=>{if(key!==OBS)original(key,value);};
  assert.deepEqual(persistMeasurementPair(storage,"new-p","new-o"),{saved:false,rollbackComplete:true});
  assert.equal(state.get(PROFILE),"old-p");
  assert.equal(state.get(OBS),"old-o");
});

test("browser denial of the localStorage property is handled before any write",()=>{
  assert.deepEqual(persistMeasurementPair(()=>{throw Error('SecurityError');},'p','o'),{saved:false,rollbackComplete:true});
});

test("vault actions lock synchronous dispatch, edits and token identity until completion",()=>{
  const source=readFileSync('src/components/MeasurementStudio.tsx','utf8');
  for(const name of ['saveSecureCopy','loadSecureCopy','deleteSecureCopy']){
    const action=source.slice(source.indexOf(`  async function ${name}()`));
    const body=action.slice(0,action.indexOf('finally{')+'finally{vaultBusyRef.current=false;setVaultBusy(false);}'.length);
    assert.match(body,/if\(vaultBusyRef.current/);
    assert.ok(body.indexOf('vaultBusyRef.current=true')<body.indexOf('await fetch'));
    assert.match(body,/finally\{vaultBusyRef.current=false;setVaultBusy\(false\);\}/);
  }
  assert.match(source,/function save\(\)\{\s*if\(vaultBusyRef.current\)return false/);
  assert.match(source,/measurementRangeInput" disabled=\{vaultBusy\}/);
  assert.equal((source.match(/<select disabled=\{vaultBusy\}/g)||[]).length,4);
  assert.match(source,/<textarea rows=\{3\} disabled=\{vaultBusy\}/);
  assert.equal((source.match(/\(\)=>localStorage,JSON.stringify/g)||[]).length,3);
});
