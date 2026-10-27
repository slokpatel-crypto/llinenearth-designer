import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {activateCustomerMeasurementProfile,saveCustomerMeasurementProfile,removeCustomerMeasurementProfile,CUSTOMER_MEASUREMENTS_KEY,type CustomerMeasurementProfile} from '../src/lib/customer-measurements.ts';
import {MEASUREMENT_STORAGE_KEY as PROFILE} from '../src/lib/measurements.ts';
import {TAILOR_OBSERVATION_STORAGE_KEY as OBS,emptyTailorObservationProfile} from '../src/lib/designer/tailor-observations.ts';
import {ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY as LINK} from '../src/lib/customer-measurement-active-link.ts';

const customer:CustomerMeasurementProfile={id:'CMP-B',name:'Customer B',unit:'in',measurements:{chest:100,waist:85,shoulder:45,sleeveLength:62},updatedAt:'2026-10-27T06:00:00Z'};
function browser(t:TestContext,fail?:(key:string,value:string|null)=>void){
  const state=new Map<string,string>([[PROFILE,'previous-fit'],[OBS,JSON.stringify({...emptyTailorObservationProfile(),posture:'forward'})],[LINK,'previous-link'],[CUSTOMER_MEASUREMENTS_KEY,JSON.stringify([{...customer,id:'CMP-A',name:'Customer A'}])]]);
  const storage={getItem:(key:string)=>state.get(key)??null,setItem:(key:string,value:string)=>{fail?.(key,value);state.set(key,value);},removeItem:(key:string)=>{fail?.(key,null);state.delete(key);}};
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{crypto:globalThis.crypto}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  t.after(()=>{
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else Reflect.deleteProperty(globalThis,'window');
    if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else Reflect.deleteProperty(globalThis,'localStorage');
  });
  return state;
}

test('switching customer resets unrecorded posture instead of inheriting previous evidence',t=>{
  const state=browser(t);
  activateCustomerMeasurementProfile(customer);
  const fit=JSON.parse(state.get(PROFILE)!);
  const observation=JSON.parse(state.get(OBS)!);
  assert.equal(fit.shirt.chest,100); // values remain centimetres even when display unit is inches
  assert.equal(fit.unit,'in');
  assert.equal(observation.posture,'unknown');
  assert.equal(observation.shoulderBalance,'unknown');
  assert.equal(observation.seatBalance,'unknown');
  assert.equal(observation.updatedAt,fit.updatedAt);
  assert.equal(JSON.parse(state.get(LINK)!).profileId,'CMP-B');
});

test('failed observation reset restores prior customer identity and measurements',t=>{
  const state=browser(t,(key,value)=>{if(key===OBS&&value?.includes('"posture":"unknown"'))throw Error('quota');});
  const previous=[...state];
  assert.throws(()=>activateCustomerMeasurementProfile(customer),/previous browser records were restored/);
  assert.deepEqual([...state],previous);
});

test('save and activation failure do not leave a newly saved customer behind',t=>{
  const state=browser(t,(key,value)=>{if(key===PROFILE&&value!=='previous-fit')throw Error('quota');});
  const previous=[...state];
  assert.throws(()=>saveCustomerMeasurementProfile(customer));
  assert.deepEqual([...state],previous);
});

test('failed active deletion restores saved customer and active snapshot',t=>{
  let deny=false;
  const state=browser(t,(key,value)=>{if(deny&&key===LINK&&value===null)throw Error('denied');});
  saveCustomerMeasurementProfile(customer);
  const previous=new Map(state);
  deny=true;
  assert.throws(()=>removeCustomerMeasurementProfile(customer.id));
  assert.deepEqual(state,previous);
});

test('invalid programmatic customer activation or save cannot modify storage',t=>{
  const state=browser(t);const previous=new Map(state);
  const invalid={...customer,measurements:{chest:NaN}};
  assert.throws(()=>activateCustomerMeasurementProfile(invalid),/Invalid/);
  assert.throws(()=>saveCustomerMeasurementProfile(invalid),/Invalid/);
  assert.deepEqual(state,previous);
});

test('successful save persists the same customer that becomes active',t=>{
  const state=browser(t);
  const saved=saveCustomerMeasurementProfile(customer);
  assert.equal(JSON.parse(state.get(CUSTOMER_MEASUREMENTS_KEY)!)[0].id,saved.id);
  assert.equal(JSON.parse(state.get(LINK)!).profileId,saved.id);
  removeCustomerMeasurementProfile(saved.id);
  assert.equal(state.has(PROFILE),false);
  assert.equal(state.has(LINK),false);
  assert.equal(JSON.parse(state.get(CUSTOMER_MEASUREMENTS_KEY)!).some((p:CustomerMeasurementProfile)=>p.id===saved.id),false);
});

for(const corrupted of ['not-json','null','{}','']){
  test(`unreadable saved history cannot be overwritten by save or delete: ${corrupted}`,t=>{
    const state=browser(t);state.set(CUSTOMER_MEASUREMENTS_KEY,corrupted);
    const previous=new Map(state);
    assert.throws(()=>saveCustomerMeasurementProfile(customer));
    assert.throws(()=>removeCustomerMeasurementProfile(customer.id));
    assert.deepEqual(state,previous);
  });
}
