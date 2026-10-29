// Exercise the real HTTP boundaries, including both legacy and advisor briefs.
// Uses local catalogue fallback; does not certify live supplier or tailor evidence.
const assert=require('node:assert/strict');
const {load}=require('./designer-test-loader.cjs');
const engine=load('src/lib/designer/engine.ts');

async function verifyDesignerFitContracts(baseURL='http://127.0.0.1:3000') {
  const pair=engine.DESIGNER_REVIEWED_PAIRING;
  const style=engine.designerStyleForOccasion(pair.occasion);
  const context={climate:'Air-conditioned',intention:'Balanced'};
  const measurements={version:1,unit:'in',shirt:{chest:108,waist:84},pants:{seat:102},updatedAt:'2026-10-28T12:00:00+05:30'};
  const observations={version:1,shoulderBalance:'unknown',posture:'balanced',seatBalance:'unknown',mobilityPriority:'standard',updatedAt:measurements.updatedAt};
  const selection={shirtId:pair.shirtId,pantId:pair.pantId,occasion:pair.occasion,style,context};
  const brief={brief:'Business meeting with a tucked shirt',currentShirtId:pair.shirtId,currentPantId:pair.pantId};
  const modes=[
    ['assessment','assess',selection],
    ['search','search',{...selection,scope:'open'}],
    ['legacy brief','brief',brief],
    ['advisor brief','brief',{...brief,brief:'Check fit and movement',currentStyle:style,occasion:pair.occasion,context}],
  ];
  const cases=[
    ['valid centimetre quantities with inch display',{measurements,observations},200],
    ['optional values omitted',{},200],
    ['optional values null',{measurements:null,observations:null},200],
    ['decimal tape input',{measurements:{...measurements,shirt:{chest:'108.5'}}},200],
    ['negative tape',{measurements:{...measurements,shirt:{chest:-5}}},422],
    ['boolean tape',{measurements:{...measurements,shirt:{chest:true}}},422],
    ['array tape',{measurements:{...measurements,shirt:{chest:[108]}}},422],
    ['hex tape',{measurements:{...measurements,shirt:{chest:'0x64'}}},422],
    ['unknown field',{measurements:{...measurements,shirt:{invented:100}}},422],
    ['coerced unit',{measurements:{...measurements,unit:['cm']}},422],
    ['impossible date',{measurements:{...measurements,updatedAt:'2027-02-29T12:00:00Z'}},422],
    ['array profile',{measurements:[]},422],
    ['array shirt',{measurements:{...measurements,shirt:[]}},422],
    ['invalid notes',{observations:{...observations,posture:['balanced']}},422],
    ['false notes',{observations:false},422],
    ['invalid notes date',{observations:{...observations,updatedAt:'2027-02-29T12:00:00Z'}},422],
  ];
  const results=[];
  for(const [mode,route,body] of modes) {
    for(const [label,inputs,status] of cases) {
      // Isolated QA identities prevent unrelated existing suite calls consuming this budget.
      const response=await fetch(`${baseURL}/api/designer/${route}`,{
        method:'POST',headers:{'content-type':'application/json','x-forwarded-for':`192.0.2.${100+Math.floor(results.length/8)}`},
        body:JSON.stringify({...body,...inputs}),
      });
      const data=await response.json();
      assert.equal(response.status,status,`${mode}: ${label}: ${data.error||'unexpected response'}`);
      if(status===422) assert.match(data.error,/measurement|observations/i);
      else if(route==='assess') assert.ok(data.assessment?.garmentSpec);
      else assert.ok(Array.isArray(data.results));
      results.push({mode,label,status:response.status});
    }
  }
  // Protect against clients that omit or understate Content-Length. This is
  // a real streamed HTTP request, not a mocked route-handler assertion.
  const unsafeCases=[
    ['foreign origin',()=>({body:'{}',headers:{origin:'https://outside.example'}}),403],
    ['same-site subdomain',()=>({body:'{}',headers:{'sec-fetch-site':'same-site'}}),403],
    ['non-JSON content',()=>({body:'{}',headers:{'content-type':'text/plain'}}),415],
    ['array JSON',()=>({body:'[]',headers:{}}),400],
    ['malformed JSON',()=>({body:'{"broken":',headers:{}}),400],
    ['oversized chunked JSON',()=>({
      body:new ReadableStream({start(controller){
        const encoder=new TextEncoder();
        controller.enqueue(encoder.encode('{"junk":"'));
        controller.enqueue(encoder.encode('x'.repeat(180_010)+'"}'));
        controller.close();
      }}),
      headers:{},
    }),413],
  ];
  for(const [mode,route] of modes) {
    for(const [label,make,expected] of unsafeCases) {
      const {body,headers}=make();
      const response=await fetch(`${baseURL}/api/designer/${route}`,{
        method:'POST',
        headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.248',...headers},
        body,
        ...(body instanceof ReadableStream?{duplex:'half'}:{}),
      });
      const data=await response.json();
      assert.equal(response.status,expected,`${mode}: ${label}: ${data.error||'unexpected response'}`);
      results.push({mode,label,status:response.status});
    }
  }
  // Supply strings only: arrays used to stringify to valid catalogue IDs,
  // occasions and search scopes; the legacy brief could silently substitute a roll.
  const selectorCases=[
    ['assessment array fabric','assess',{...selection,shirtId:[pair.shirtId]}],
    ['assessment coercible occasion','assess',{...selection,occasion:[pair.occasion]}],
    ['assessment overlength fabric','assess',{...selection,pantId:pair.pantId+'x'.repeat(161)}],
    ['search array fabric','search',{...selection,pantId:[pair.pantId],scope:'open'}],
    ['search array scope','search',{...selection,scope:['open']}],
    ['advisor array fabric','brief',{...brief,brief:'Review shirt fit',currentStyle:style,occasion:pair.occasion,context,currentShirtId:[pair.shirtId]}],
    ['legacy object fabric','brief',{...brief,currentPantId:{id:pair.pantId}}],
    ['legacy non-text prompt','brief',{...brief,brief:{text:'Business meeting'}}],
  ];
  for(const [label,route,body] of selectorCases){
    const response=await fetch(`${baseURL}/api/designer/${route}`,{
      method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.246'},
      body:JSON.stringify(body),
    });
    const data=await response.json();
    assert.equal(response.status,400,`untrusted selector: ${label}: ${data.error||'unexpected response'}`);
    results.push({mode:route,label,status:response.status});
  }
  // A missing fabric must not mask malformed explicit fit evidence. The
  // client must correct the tape reading before any catalogue lookup.
  const invalidFirst=await fetch(`${baseURL}/api/designer/assess`,{
    method:'POST',
    headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.247'},
    body:JSON.stringify({...selection,shirtId:'TITAN-MISSING-FABRIC',measurements:{...measurements,shirt:{chest:-1}}}),
  });
  const invalidData=await invalidFirst.json();
  assert.equal(invalidFirst.status,422,`fit input before catalogue lookup: ${invalidData.error||'unexpected response'}`);
  results.push({mode:'assessment',label:'malformed fit overrides missing catalogue',status:422});
  // The customer-auth POSTs are public and can trigger OTP provider calls.
  // Exercise only rejected requests so CI never sends a real sign-in email.
  const authUnsafe=[
    ['cross-origin',{body:'{}',headers:{origin:'https://outside.example'}},403],
    ['same-site subdomain',{body:'{}',headers:{'sec-fetch-site':'same-site'}},403],
    ['non-JSON',{body:'{}',headers:{'content-type':'text/plain'}},415],
    ['malformed JSON',{body:'{"broken":',headers:{}},400],
    ['array JSON',{body:'[]',headers:{}},400],
    ['oversized chunked JSON',{body:new ReadableStream({start(controller){
      controller.enqueue(new TextEncoder().encode(JSON.stringify({email:'x'.repeat(5_000)})));
      controller.close();
    }}),headers:{}},413],
    ['array email',{body:JSON.stringify({email:['user@example.com'],token:'123456'}),headers:{}},400],
  ];
  for(const [route,extra] of [['otp',[]],['verify',[
    ['array code',{body:JSON.stringify({email:'user@example.com',token:['123456']}),headers:{}},400],
    ['numeric code',{body:JSON.stringify({email:'user@example.com',token:123456}),headers:{}},400],
  ]]]) {
    let caseIndex=0;
    for(const [label,input,expected] of [...authUnsafe,...extra]) {
      const response=await fetch(`${baseURL}/api/customer-auth/${route}`,{
        method:'POST',
        headers:{'content-type':'application/json','x-forwarded-for':`198.51.100.${++caseIndex}`,...input.headers},
        body:input.body,
        ...(input.body instanceof ReadableStream?{duplex:'half'}:{}),
      });
      const data=await response.json();
      assert.equal(response.status,expected,`customer-auth ${route}: ${label}: ${data.error||'unexpected response'}`);
      results.push({mode:`customer-auth ${route}`,label,status:response.status});
    }
  }
  console.log(`PASS ${results.length} actual HTTP fit-input contracts across assessment, search and both brief modes`);
  return results;
}
module.exports={verifyDesignerFitContracts};
if(require.main===module) verifyDesignerFitContracts(process.env.LINEN_BROWSER_QA_URL).catch(error=>{console.error(error);process.exitCode=1;});
