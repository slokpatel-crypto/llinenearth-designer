import test from "node:test";
import assert from "node:assert/strict";
import { resolveFabricBaseVariants, snapshotFabricPhysicalClaim } from "../src/lib/fabric-base-variants.ts";

const shaA="a".repeat(64),shaB="b".repeat(64);
const ivory={variantId:"ivory",lotId:"roll-11",colorFamily:"white_family",patternFamily:"solid",photoId:"ivory-img",photoSha256:shaA};
const stripe={variantId:"stripe",lotId:"roll-12",colorFamily:"blue_family",patternFamily:"stripe",photoId:"stripe-img",photoSha256:shaB};
const source={sourceType:"supplier_document",reference:"batch E 2026 140",checkedBy:"Owner Inspector",evidenceDate:"2026-11-02"};
const lab={sourceType:"lab_report",reference:"lab report E 2026 140",checkedBy:"Lab Inspector",evidenceDate:"2026-11-02"};
const base={claimId:"base-gsm",baseId:"linen-60-base",field:"gsm",value:160,resolution:1,origin:"supplier_declared",source,
  scope:{kind:"base",covers:[{variantId:"ivory",lotId:"roll-11"},{variantId:"stripe",lotId:"roll-12"}]}};
const approval=(claim:unknown)=>({claimId:(claim as {claimId:string}).claimId,
  snapshot:snapshotFabricPhysicalClaim(claim),status:"approved",reviewedBy:"Independent Reviewer"});
// Test-only stub representing an external, trusted review ledger; never use
// this permissive fixture stub to authorize live supplier or customer data.
const trustedFixtureReviewer=(review:{reviewedBy:string})=>
  review.reviewedBy==="Independent Reviewer";
const run=(claims:unknown[],approvals:unknown[],variants:unknown[]=[ivory,stripe])=>
  resolveFabricBaseVariants({baseId:"linen-60-base",variants,claims,approvals,
    verifyApproval:trustedFixtureReviewer});

test("one reviewed base fabric can cover two explicit lots while identities remain separate",()=>{
  const r=run([base],[approval(base)]);
  assert.equal(r.variants.length,2);
  assert.equal(r.variants[0].physical.gsm.value,160);
  assert.equal(r.variants[1].physical.gsm.value,160);
  assert.equal(r.variants[0].physical.gsm.origin,"supplier_declared");
  assert.equal(r.variants[0].physical.widthMm.value,null);
  assert.notEqual(r.variants[0].identity.photoSha256,r.variants[1].identity.photoSha256);
  assert.notEqual(r.variants[0].identity.lotId,r.variants[1].identity.lotId);
  assert.notEqual(r.variants[0].identity.colorFamily,r.variants[1].identity.colorFamily);
  assert.notEqual(r.variants[0].identity.patternFamily,r.variants[1].identity.patternFamily);
});

test("a new fabric lot, unlisted variant or unapproved scope cannot inherit claims",()=>{
  assert.equal(run([base],[approval(base)],[ivory,{...stripe,lotId:"roll-13"}]).variants[1].physical.gsm.value,null);
  assert.equal(run([base],[approval(base)],[{...stripe,variantId:"other"}]).variants[0].physical.gsm.value,null);
  assert.equal(run([base],[]).variants[0].physical.gsm.value,null);
});

test("an approval for one base fabric cannot be replayed against a second base identity",()=>{
  const copied={...base,baseId:"other-fabric-base"};
  assert.notEqual(snapshotFabricPhysicalClaim(copied),snapshotFabricPhysicalClaim(base));
  assert.equal(run([copied],[approval(copied)]).variants[0].physical.gsm.value,null);
  assert.equal(run([copied],[approval(copied)]).variants[1].physical.gsm.value,null);
  assert.equal(run([copied],[approval(copied)]).issues.some(x=>x.includes("foreign-base")),true);
  const altered={...base,baseId:"linen-60-base"};
  assert.equal(run([altered],[approval(copied)]).variants[0].physical.gsm.value,null);
});

test("approval is invalid after changing value, supplier receipt or covered lots",()=>{
  for(const changed of [
    {...base,value:170},
    {...base,source:{...source,reference:"another batch"}},
    {...base,scope:{kind:"base",covers:[{variantId:"ivory",lotId:"roll-11"}]}},
  ]){
    const result=run([changed],[approval(base)]);
    assert.equal(result.variants[0].physical.gsm.value,null);
    assert.equal(result.variants[0].physical.gsm.approval,"stale");
  }
});

test("untrusted approval JSON cannot certify material facts without independent review authority",()=>{
  const input={baseId:"linen-60-base",variants:[ivory,stripe],
    claims:[base],approvals:[approval(base)]};
  const missing=resolveFabricBaseVariants(input);
  assert.equal(missing.variants[0].physical.gsm.value,null);
  assert.equal(missing.variants[0].physical.gsm.approval,"untrusted");
  assert.ok(missing.variants[0].issues.some(x=>x.includes("independently authenticated")));
  assert.equal(missing.variants[1].physical.gsm.value,null);
  const denied=resolveFabricBaseVariants({...input,verifyApproval:()=>false});
  assert.equal(denied.variants[0].physical.gsm.value,null);
  const thrown=resolveFabricBaseVariants({...input,verifyApproval:()=>{throw new Error("ledger offline");}});
  assert.equal(thrown.variants[0].physical.gsm.value,null);
  const forgedAsync=resolveFabricBaseVariants({...input,verifyApproval:()=>Promise.resolve(true) as never});
  assert.equal(forgedAsync.variants[0].physical.gsm.value,null);
  assert.equal(resolveFabricBaseVariants({...input,verifyApproval:trustedFixtureReviewer})
    .variants[0].physical.gsm.value,160);
});

test("malformed approvals, rejected review, forged precision and estimated facts never certify physical claims",()=>{
  for(const claimsAndReviews of [
    [[base],[]],
    [[base],[{...approval(base),status:"rejected"}]],
    [[base],[{...approval(base),reviewedBy:["Reviewer"]}]],
    [[base],[{...approval(base),snapshot:"forged"}]],
    [[base],[{...approval(base),extra:"forged"}]],
    [[{...base,origin:"estimated",source:undefined}],[]],
    [[{...base,origin:"unknown",value:null,resolution:undefined,source:undefined}],[]],
  ]){
    const r=run(claimsAndReviews[0] as unknown[],claimsAndReviews[1] as unknown[]);
    assert.equal(r.variants[0].physical.gsm.value,null);
    assert.equal(r.variants[0].physical.gsm.usable,false);
  }
  for(const invalid of [
    {...base,value:160.123},
    {...base,value:"160"},
    {...base,resolution:.001},
    {...base,source:{...source,reference:" ".repeat(221)+"receipt"}},
    {...base,source:{...source,sourceType:["supplier_document"]}},
    {...base,origin:"measured"},
  ]){
    assert.equal(snapshotFabricPhysicalClaim(invalid),null);
    assert.ok(run([invalid],[]).issues.some(x=>x.includes("invalid")));
  }
});

test("per-lot pending and contradictory measurements block fallback to shared base",()=>{
  const own={...base,claimId:"own-gsm",value:170,origin:"measured",source:lab,
    scope:{kind:"variant",variantId:"ivory",lotId:"roll-11"}};
  assert.equal(run([base,own],[approval(base)]).variants[0].physical.gsm.value,null);
  const r=run([base,own],[approval(base),approval(own)]);
  assert.equal(r.variants[0].physical.gsm.value,null);
  assert.ok(r.variants[0].issues.some(x=>x.includes("conflicting")));
  assert.equal(r.variants[1].physical.gsm.value,160);
});

test("typed composition, weave and yarn counts need separate supported claims",()=>{
  const c={...base,claimId:"composition",field:"composition",resolution:undefined,
    value:[{fiber:"linen",percent:60},{fiber:"cotton",percent:40}]};
  const y={...base,claimId:"yarn",field:"yarnCount",resolution:undefined,
    value:{system:"lea",count:60,resolution:1}};
  const w={...base,claimId:"weave",field:"weave",resolution:undefined,value:"plain"};
  const r=run([c,y,w],[approval(c),approval(y),approval(w)]);
  assert.deepEqual(r.variants[0].physical.composition.value,c.value);
  assert.deepEqual(r.variants[1].physical.yarnCount.value,y.value);
  assert.equal(r.variants[0].physical.weave.value,"plain");
  for(const invalid of [
    {...c,value:[{fiber:"linen",percent:60},{fiber:"cotton",percent:39}]},
    {...c,value:[{fiber:"linen",percent:50},{fiber:"linen",percent:50}]},
    {...y,value:{system:"lea",count:60.123,resolution:1}},
    {...w,value:"visual plain-looking"},
  ])assert.equal(snapshotFabricPhysicalClaim(invalid),null);
});

test("malformed duplicates cannot vanish and leave a valid approved claim ID unchallenged",()=>{
  const malformed={...base,value:"160"};
  const otherBase={...base,baseId:"unrelated-base"};
  for(const pair of [[base,malformed],[malformed,base],[base,otherBase],[otherBase,base]]){
    const result=run(pair,[approval(base)]);
    for(const v of result.variants){
      assert.equal(v.physical.gsm.value,null);
      assert.ok(v.issues.some(issue=>issue.includes("duplicate claim ID")));
    }
  }
});

test("reviewed composition and yarn-count projections cannot mutate after approval",()=>{
  const composition={...base,claimId:"reviewed-composition",field:"composition",resolution:undefined,
    value:[{fiber:"linen",percent:60},{fiber:"cotton",percent:40}]};
  const yarn={...base,claimId:"reviewed-yarn",field:"yarnCount",resolution:undefined,
    value:{system:"lea",count:60,resolution:1}};
  const result=run([composition,yarn],[approval(composition),approval(yarn)]);
  const fabric=result.variants[0];
  const fibers=fabric.physical.composition.value as {fiber:string;percent:number}[];
  const thread=fabric.physical.yarnCount.value as {system:string;count:number;resolution:number};
  assert.deepEqual(fibers,[{fiber:"linen",percent:60},{fiber:"cotton",percent:40}]);
  assert.equal(thread.count,60);
  assert.notStrictEqual(fibers,composition.value);
  assert.notStrictEqual(fibers[0],composition.value[0]);
  assert.notStrictEqual(thread,yarn.value);
  composition.value[0].percent=100;
  yarn.value.count=40;
  assert.equal(fibers[0].percent,60);
  assert.equal(thread.count,60);
  assert.equal(Object.isFrozen(fibers),true);
  assert.equal(Object.isFrozen(fibers[0]),true);
  assert.equal(Object.isFrozen(thread),true);
  assert.equal(Object.isFrozen(fabric.physical),true);
  assert.equal(Object.isFrozen(fabric.physical.composition),true);
  assert.equal(Object.isFrozen(fabric.identity),true);
  assert.equal(Object.isFrozen(result.variants),true);
});

test("pixel-to-mm axes require correct photo hash, original dimensions and compatible repeat",()=>{
  const repeat={claimId:"repeat-x",baseId:"linen-60-base",field:"repeatXmm",value:10,resolution:.1,origin:"measured",source:lab,
    scope:{kind:"variant",variantId:"stripe",lotId:"roll-12"},
    calibration:{photoSha256:shaB,widthPx:800,heightPx:900,axis:"x",repeatPx:80,pixelsPerMm:8}};
  const unbound={...repeat,baseId:undefined};
  assert.equal(snapshotFabricPhysicalClaim(unbound),null,
    "unscoped image calibration is not an approved physical specification");
  assert.equal(run([unbound],[approval(unbound)]).variants[1].physical.repeatXmm.value,null);
  const r=run([repeat],[approval(repeat)]);
  assert.equal(r.variants[1].physical.repeatXmm.value,10);
  assert.equal(r.variants[1].calibratedAxes.x,8);
  assert.equal(r.variants[1].calibratedAxes.y,null);
  assert.equal(run([repeat],[approval(repeat)],[{...stripe,photoSha256:shaA}])
    .variants[0].physical.repeatXmm.value,null);
  for(const invalid of [
    {...repeat,calibration:{...repeat.calibration,widthPx:399}},
    {...repeat,calibration:{...repeat.calibration,axis:"y"}},
    {...repeat,calibration:{...repeat.calibration,repeatPx:180}},
    {...repeat,calibration:{...repeat.calibration,pixelsPerMm:0}},
    {...repeat,calibration:{...repeat.calibration,repeatPx:"80"}},
  ])assert.equal(snapshotFabricPhysicalClaim(invalid),null);
});

test("malformed or duplicate identities and competing approvals fail closed",()=>{
  assert.equal(run([base,base],[approval(base)]).variants[0].physical.gsm.value,null);
  assert.equal(run([base],[approval(base),approval(base)]).variants[0].physical.gsm.value,null);
  assert.equal(run([base],[approval(base)],[ivory,ivory]).variants.length,0);
  assert.equal(run([base],[approval(base)],[{...ivory,colorFamily:["white_family"]}]).variants.length,0);
  assert.equal(run([base],[approval(base)],[{...ivory,patternFamily:"pinstripe"}]).variants.length,0);
  assert.equal(run([base],[approval(base)],[{...ivory,photoSha256:"bad"}]).variants.length,0);
});
