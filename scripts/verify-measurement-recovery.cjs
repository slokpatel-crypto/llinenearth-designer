// Synthetic browser failures only. No real measurements or vault writes.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createRequire}=require('node:module');
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error('Set LINEN_BROWSER_QA_RUNTIME');
const {chromium}=createRequire(path.join(runtime,'package.json'))('playwright');
const base=process.env.LINEN_BROWSER_QA_URL||'http://127.0.0.1:3000';
const output=path.resolve('artifacts/preview-lifecycle/measurement-recovery');
const PROFILE='linen-earth-measurements-v1',OBS='linen-earth-tailor-observations-v1';
const profile={version:1,unit:'in',shirt:{neck:40,chest:100},pants:{waist:84},updatedAt:'2026-10-27T00:00:00Z'};
const observations={version:1,shoulderBalance:'unknown',posture:'forward',seatBalance:'unknown',mobilityPriority:'standard',updatedAt:profile.updatedAt};
const summary={backend:'synthetic fixtures; no remote writes',physicalAcceptance:false,viewports:[],errors:[]};
async function complete(page,value){
  await page.evaluate(value=>{
    const request=window.__measurementRequests.find(r=>!r.completed);
    if(!request)throw Error('No pending measurement request');
    request.completed=true;
    request.resolve(new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}}));
  },value);
  await page.waitForFunction(()=>!document.querySelector('.measurementVault textarea').disabled);
}
async function verify(browser,width){
  const context=await browser.newContext({viewport:{width,height:1000}});
  const page=await context.newPage();
  page.on('pageerror',error=>summary.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')summary.errors.push(message.text());});
  await context.route('**/api/**',route=>route.fulfill({status:200,json:{}}));
  await page.addInitScript(()=>{
    const fetch=window.fetch.bind(window);
    window.__measurementRequests=[];
    window.fetch=(input,options={})=>{
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.pathname!=='/api/measurements/vault')return fetch(input,options);
      return new Promise(resolve=>window.__measurementRequests.push({body:JSON.parse(options.body),resolve,completed:false}));
    };
  });
  await page.goto(base+'/measurements',{waitUntil:'networkidle'});
  await page.locator('.brandIntro').waitFor({state:'hidden'});
  await page.locator('.measurementVault summary').click();
  const token=page.locator('.measurementVault textarea');
  await token.fill('synthetic-token-A');
  // Two same-tick clicks exercise the ref guard before React renders disabled.
  await page.getByRole('button',{name:'Load token',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.waitForFunction(()=>window.__measurementRequests.length===1);
  assert.equal(await token.isDisabled(),true);
  assert.equal(await page.locator('.measurementRangeInput').isDisabled(),true);
  assert.equal(await page.locator('.measureSave').isDisabled(),true);
  assert.equal(await page.locator('.tailorObservationGrid select:disabled').count(),4);
  assert.equal(await page.locator('.measureDesignerLink').getAttribute('aria-disabled'),'true');
  await page.locator('.measureDesignerLink').evaluate(link=>link.click());
  assert.equal(new URL(page.url()).pathname,'/measurements');
  await complete(page,{profile,observations,expiresAt:'2026-11-27T00:00:00Z'});
  assert.match(await page.locator('.measurementVaultMessage').innerText(),/loaded onto this device/);
  assert.equal(await page.getByLabel(/Posture balance/).inputValue(),'forward');
  const before=await page.evaluate(({PROFILE,OBS})=>[localStorage.getItem(PROFILE),localStorage.getItem(OBS)],{PROFILE,OBS});
  assert.equal(JSON.parse(before[0]).shirt.chest,100);
  // A failed second write must restore the first and block navigation.
  await page.evaluate(OBS=>{
    const original=Storage.prototype.setItem;
    window.__restoreMeasurementWrites=()=>{Storage.prototype.setItem=original;};
    Storage.prototype.setItem=function(key,value){if(key===OBS)throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,key,value);};
  },OBS);
  await page.locator('.measurementRangeInput').evaluate(input=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'16');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('.measureDesignerLink').click();
  assert.equal(new URL(page.url()).pathname,'/measurements');
  assert.match(await page.locator('.measureSaveError').innerText(),/not saved/);
  assert.deepEqual(await page.evaluate(({PROFILE,OBS})=>[localStorage.getItem(PROFILE),localStorage.getItem(OBS)],{PROFILE,OBS}),before);
  await page.evaluate(()=>window.__restoreMeasurementWrites());
  // Remote success survives denial of the localStorage getter itself.
  await page.getByRole('button',{name:'Save secure copy',exact:true}).click();
  await page.waitForFunction(()=>window.__measurementRequests.length===2);
  await page.evaluate(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(window,'localStorage');
    window.__restoreMeasurementStorage=()=>Object.defineProperty(window,'localStorage',descriptor);
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Synthetic blocked storage','SecurityError');}});
  });
  await complete(page,{recoveryToken:'synthetic-token-B',expiresInDays:30,ownershipWarning:'Account link was not confirmed.'});
  assert.equal(await token.inputValue(),'synthetic-token-B');
  assert.match(await page.locator('.measurementVaultMessage').innerText(),/secure|server/i);
  assert.match(await page.locator('.measurementVaultMessage').innerText(),/browser|locally/i);
  assert.match(await page.locator('.measurementVaultMessage').innerText(),/Account link was not confirmed/);
  await page.evaluate(()=>window.__restoreMeasurementStorage());
  assert.equal(await page.locator('.measureSave').innerText(),'Save measurements');
  // Delete remains bound to the original token until response settlement.
  await page.getByRole('button',{name:'Delete secure copy',exact:true}).click();
  await page.waitForFunction(()=>window.__measurementRequests.length===3);
  assert.equal(await token.isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.__measurementRequests[2].body.recoveryToken),'synthetic-token-B');
  await complete(page,{deleted:true});
  assert.equal(await token.inputValue(),'');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'measurement overflow at '+width);
  await page.screenshot({path:path.join(output,'measurements-'+width+'.png'),fullPage:true});
  summary.viewports.push({width,duplicateDispatchBlocked:true,editsLocked:true,partialWriteRolledBack:true,serverTokenPreserved:true,deleteTokenBound:true});
  await context.close();
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,768,1440])await verify(browser,width);
    assert.deepEqual(summary.errors,[]);
    console.log('Measurement recovery verified at 390, 768 and 1440px with synthetic failures.');
  }finally{
    await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
    await browser.close();
  }
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
