import test from "node:test";
import assert from "node:assert/strict";
import { auditHandoffMeasurements } from "../src/lib/designer/handoff-measurements.ts";
import { buildProductionHandoff, buildVerifiedProductionHandoff, verifyProductionHandoff } from "../src/lib/designer/production-handoff.ts";
import { lockGarmentSpec } from "../src/lib/designer/design-lock.ts";
import { buildTailorTechPackHtml, buildVerifiedTailorTechPackHtml, techPackFilename } from "../src/lib/designer/tech-pack.ts";
import type { FinishedTarget } from "../src/lib/designer/fit-construction.ts";
import type { LockedDesignRevision } from "../src/lib/designer/design-lock.ts";

const chest: FinishedTarget = {
  label:"Finished shirt chest",bodyCm:100,easeCm:{min:10,max:14},
  finishedCm:{min:110,max:114},basis:"body_plus_ease",
};
const waist: FinishedTarget = {
  label:"Finished trouser waist",bodyCm:84,easeCm:{min:2,max:4},
  finishedCm:{min:86,max:88},basis:"body_plus_ease",
};
const seat: FinishedTarget = {
  label:"Finished trouser seat",bodyCm:102,easeCm:{min:4,max:6},
  finishedCm:{min:106,max:108},basis:"body_plus_ease",
};

// Synthetic fixture measurements only; never actual model evidence.

const shoulder:FinishedTarget={label:"Shoulder-width anchor",bodyCm:46,finishedCm:{min:46,max:46},basis:"recorded_anchor"};
const sleeve:FinishedTarget={label:"Sleeve-length anchor",bodyCm:62,finishedCm:{min:62,max:62},basis:"recorded_anchor"};
const inseam:FinishedTarget={label:"Inseam anchor",bodyCm:78,finishedCm:{min:78,max:78},basis:"customer_desired"};
const outseam:FinishedTarget={label:"Outseam anchor",bodyCm:104,finishedCm:{min:104,max:104},basis:"customer_desired"};

function createRevision(shirt:FinishedTarget[],trouser:FinishedTarget[],exactCut=true):LockedDesignRevision {
  return {
    version:"linen-earth-design-lock-v1",
    revisionId:"LE-LOCK-20261102-000000000000",
    parentRevisionId:null,
    recipeHash:"a".repeat(64),
    lockedAt:"2026-11-02T10:00:00Z",
    garmentSpec:{
      version:"linen-earth-garment-spec-v1",
      status:"ready_for_tailor_review",
      source:{designerRuleSetVersion:"v3",fitConstructionVersion:"fit-construction-provisional-1",
        fitEaseSource:"provisional_house_defaults",fitEaseTableVersion:"house-v1",
        measurementProfileVersion:1,blockStrategyVersion:null,styleSchemaVersion:exactCut?2:null},
      styleSpec:exactCut?{
        styleSchemaVersion:2,
        shirt:{type:"dress_shirt",collar:"point_standard_collar",collarFinish:"Self-fabric",
          cuff:"open_short_hem_cuff",placket:"standard_visible_placket",pocket:"no_pocket",
          sleeve:"half_sleeve",fit:"regular_classic_fit",length:"shirt_length_regular",
          hem:"curved_shirttail",back:"plain_back",wear:"untucked",button:"corozo"},
        pant:{type:"formal_flat_front",fit:"korean_straight_wide",rise:"mid_rise",
          pleat:"flat_front",waistband:"belt_loops",hem:"plain_hem",break:"no_break"},
        legacy:{collar:"Point Collar",collarFinish:"Self-fabric",cuff:"Barrel Cuff",
          placket:"Standard",shirtFit:"Regular Fit",shirtWear:"Untucked",
          trouser:"Straight",rise:"Mid Rise",waistband:"Belt Loops",break:"No Break",button:"Corozo"},
      }:null,
      bodyProfile:null,context:{occasion:"Smart-Casual",climate:"Hot / humid",intention:"Understated"},
      fabrics:{
        shirt:{id:"shirt-a",name:"Shirt",line:"Linen",source:"catalogue",verifiedMaterialFacts:8},
        trouser:{id:"pant-a",name:"Trouser",line:"Linen",source:"catalogue",verifiedMaterialFacts:8},
      },
      shirt:{fit:"Regular",wear:"Untucked",collar:"Point",collarFinish:"Self-fabric",
        cuff:"Barrel",placket:"Standard",button:"Corozo",finishedTargets:shirt},
      trouser:{shape:"Straight",rise:"Mid Rise",waistband:"Belt Loops",break:"No Break",finishedTargets:trouser},
      creative:null,decision:{designFitScore:70,confidenceScore:70,fitConstructionScore:70,
        brandLanguageScore:null,blockStrategyScore:null},
      blockStrategy:null,constructionChecks:[],unresolved:[],
      readiness:{visualization:"supported_with_current_template",tailoring:"tailor_review_required",materialVerification:"verified"},
      caveats:[],
    },
  };
}

test("consistent centimetre body/ease/finished ranges remain exportable",()=>{
  const report=auditHandoffMeasurements({shirt:[chest,shoulder,sleeve],trouser:[waist,seat,inseam,outseam]});
  assert.deepEqual(report,{errors:[],missing:[]});
  const packet=buildProductionHandoff(createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]),"2026-11-02T11:00:00Z");
  assert.equal(packet.status,"ready_for_tailor_review");
  assert.equal(packet.construction.shirt.finishedTargets[0].finishedCm.min,110);
  assert.equal(packet.production.clothEstimate.shirtMetres,null);
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/>Ease \(cm\)</);
  assert.match(html,/10\.0–14\.0 cm/);
  assert.match(html,/110\.0–114\.0 cm/);
  assert.match(html,/body \+ provisional\/approved ease/);
  assert.match(html,/PENDING HUMAN ACCEPTANCE/);
});

test("sparse body data and absent exact StyleSpec stay review-only, never ready",()=>{
  const packet=buildProductionHandoff(createRevision([chest],[waist],false));
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(s=>s.includes("Finished trouser seat")));
  assert.ok(packet.unresolved.some(s=>s.includes("StyleSpec v2")));
  assert.match(buildTailorTechPackHtml(packet),/Finished trouser seat is not recorded/);
  assert.match(buildTailorTechPackHtml(packet),/review required/);
});

test("an invalid, nonfinite, reversed or mismatched finished target fails closed",()=>{
  const invalid=[
    {...chest,bodyCm:NaN},
    {...chest,finishedCm:{min:114,max:110}},
    {...chest,finishedCm:{min:105,max:109}},
    {...chest,easeCm:{min:14,max:10}},
    {...chest,easeCm:undefined},
    {...chest,basis:"unknown" as FinishedTarget["basis"]},
  ];
  for(const target of invalid){
    const audit=auditHandoffMeasurements({shirt:[target],trouser:[waist,seat]});
    assert.notEqual(audit.errors.length,0,JSON.stringify(target));
    assert.throws(()=>buildProductionHandoff(createRevision([target],[waist,seat])),/Unsafe tailor handoff measurements/);
  }
});

test("duplicate landmarks cannot silently overwrite a cutting instruction",()=>{
  const report=auditHandoffMeasurements({shirt:[chest,{...chest,label:" finished shirt chest "}],trouser:[waist,seat]});
  assert.ok(report.errors.some(s=>s.includes("duplicate")));
});

test("unknown optional landmarks remain reconstructable but block review-ready handoff",()=>{
  const custom:FinishedTarget={
    label:"Custom neck drop",bodyCm:7,finishedCm:{min:7,max:7},basis:"recorded_anchor",
  };
  const knownShirt=[chest,shoulder,sleeve];
  const knownTrouser=[waist,seat,inseam,outseam];
  assert.deepEqual(auditHandoffMeasurements({shirt:knownShirt,trouser:knownTrouser}),{errors:[],missing:[]});
  for (const location of ["shirt","trouser"] as const) {
    const shirt=location==="shirt"?[...knownShirt,custom]:knownShirt;
    const trouser=location==="trouser"?[...knownTrouser,custom]:knownTrouser;
    const audit=auditHandoffMeasurements({shirt,trouser});
    assert.deepEqual(audit.errors,[]);
    assert.ok(audit.missing.some(note=>note.includes("Custom neck drop")
      && note.includes("no recognised landmark definition")),location);
    const packet=buildProductionHandoff(createRevision(shirt,trouser));
    assert.equal(packet.status,"review_required",location);
    assert.ok(packet.unresolved.some(note=>note.includes("Custom neck drop")),location);
    assert.ok((location==="shirt"?packet.construction.shirt:packet.construction.trouser)
      .finishedTargets.some(target=>target.label==="Custom neck drop"));
    const html=buildTailorTechPackHtml(packet);
    assert.match(html,/Custom neck drop/);
    assert.match(html,/review required/);
    assert.match(html,/NO CUTTING AUTHORISATION/);
  }
});

test("tucked shirt requires its own length anchor for handoff and printable readiness",()=>{
  const standardShirt=[chest,shoulder,sleeve];
  const standardTrouser=[waist,seat,inseam,outseam];
  const shirtLength:FinishedTarget={
    label:"Shirt-length anchor",bodyCm:76,finishedCm:{min:76,max:76},basis:"customer_desired",
  };
  assert.deepEqual(
    auditHandoffMeasurements({shirt:standardShirt,trouser:standardTrouser},{shirtWear:"untucked"}),
    {errors:[],missing:[]},
  );
  const missing=auditHandoffMeasurements(
    {shirt:standardShirt,trouser:standardTrouser},{shirtWear:"tucked"},
  );
  assert.deepEqual(missing.errors,[]);
  assert.ok(missing.missing.some(item=>item.includes("Shirt-length anchor")
    && item.includes("tucked construction")));

  const tucked=createRevision(standardShirt,standardTrouser);
  if(!tucked.garmentSpec.styleSpec) throw Error("Synthetic exact cut is absent");
  tucked.garmentSpec.styleSpec.shirt.wear="tucked";
  tucked.garmentSpec.styleSpec.shirt.length="shirt_length_tuck";
  tucked.garmentSpec.shirt.wear="Tucked";
  // Even though this synthetic legacy source claims ready, a tucked pattern
  // with no measured length anchor is only an unsigned review packet.
  const review=buildProductionHandoff(tucked);
  assert.equal(review.status,"review_required");
  assert.ok(review.unresolved.some(item=>item.includes("Shirt-length anchor")));
  const reviewHtml=buildTailorTechPackHtml(review);
  assert.match(reviewHtml,/Shirt-length anchor is not recorded/);
  assert.match(reviewHtml,/NO CUTTING AUTHORISATION/);

  const complete=createRevision([...standardShirt,shirtLength],standardTrouser);
  if(!complete.garmentSpec.styleSpec) throw Error("Synthetic exact cut is absent");
  complete.garmentSpec.styleSpec.shirt.wear="tucked";
  complete.garmentSpec.styleSpec.shirt.length="shirt_length_tuck";
  complete.garmentSpec.shirt.wear="Tucked";
  const packet=buildProductionHandoff(complete);
  assert.equal(packet.status,"ready_for_tailor_review");
  assert.deepEqual(packet.unresolved,[]);
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/Shirt-length anchor/);
  assert.match(html,/NO CUTTING AUTHORISATION/);

  // The legacy unsigned formatter re-audits instead of trusting a stale
  // status claim when a previously recorded length is subsequently removed.
  const stale=structuredClone(packet);
  stale.construction.shirt.finishedTargets=
    stale.construction.shirt.finishedTargets.filter(item=>item.label!=="Shirt-length anchor");
  assert.equal(stale.status,"ready_for_tailor_review");
  const staleHtml=buildTailorTechPackHtml(stale);
  assert.match(staleHtml,/review required/);
  assert.match(staleHtml,/Shirt-length anchor is not recorded/);
});

test("cross-field circumference discrepancies stay review-only without relying on upstream checks",()=>{
  const neck:FinishedTarget={
    label:"Finished collar circumference",bodyCm:105,
    easeCm:{min:2,max:4},finishedCm:{min:107,max:109},basis:"body_plus_ease",
  };
  const oversizedSeat:FinishedTarget={
    ...seat,bodyCm:180,finishedCm:{min:184,max:186},
  };
  const standardShirt=[chest,shoulder,sleeve];
  const standardTrouser=[waist,seat,inseam,outseam];

  // Good synthetic data remains eligible for software-only tailor review.
  assert.deepEqual(auditHandoffMeasurements({
    shirt:standardShirt,trouser:standardTrouser,
  }),{errors:[],missing:[]});

  const cases=[
    {
      shirt:[...standardShirt,neck],
      trouser:standardTrouser,
      fragment:"neck circumference is not smaller than chest",
    },
    {
      shirt:standardShirt,
      trouser:[waist,oversizedSeat,inseam,outseam],
      fragment:"waist and seat differ by over 75 cm",
    },
  ];
  for(const {shirt,trouser,fragment} of cases){
    const audit=auditHandoffMeasurements({shirt,trouser});
    assert.deepEqual(audit.errors,[]);
    assert.ok(audit.missing.some(s=>s.includes(fragment)),fragment);
    const revision=createRevision(shirt,trouser);
    // A source status or previous check set is not physical evidence.
    assert.deepEqual(revision.garmentSpec.constructionChecks,[]);
    const packet=buildProductionHandoff(revision);
    assert.equal(packet.status,"review_required");
    assert.ok(packet.unresolved.some(s=>s.includes(fragment)));
    const html=buildTailorTechPackHtml(packet);
    assert.match(html,/review required/);
    assert.match(html,/NO CUTTING AUTHORISATION/);
  }

  const complete=buildProductionHandoff(createRevision(standardShirt,standardTrouser));
  const stale=structuredClone(complete);
  stale.construction.shirt.finishedTargets.push(neck);
  assert.equal(stale.status,"ready_for_tailor_review");
  assert.match(buildTailorTechPackHtml(stale),/review required/);
  assert.match(buildTailorTechPackHtml(stale),/neck circumference is not smaller than chest/);
});

test("the printable sheet independently rejects tampered target ranges",()=>{
  const packet=buildProductionHandoff(createRevision([chest],[waist,seat]));
  packet.construction.shirt.finishedTargets[0].finishedCm.min=1;
  assert.throws(()=>buildTailorTechPackHtml(packet),/Unsafe tailor tech pack measurements/);
});

test("a legacy handoff claiming ready cannot print misleading ready status",()=>{
  const packet=buildProductionHandoff(createRevision([chest],[waist,seat],false));
  packet.status="ready_for_tailor_review";
  assert.match(buildTailorTechPackHtml(packet),/review required/);
});

test("direct trouser anchors are not silently converted into different lengths or fabricated ease",()=>{
  const inseam:FinishedTarget={label:"Inseam anchor",bodyCm:76.0,finishedCm:{min:76,max:76},basis:"customer_desired"};
  assert.deepEqual(auditHandoffMeasurements({shirt:[chest],trouser:[waist,seat,inseam]}).errors,[]);
  const changed={...inseam,finishedCm:{min:73,max:75}};
  const fabricated={...inseam,easeCm:{min:0,max:2},finishedCm:{min:76,max:78}};
  for(const target of [changed,fabricated]){
    const report=auditHandoffMeasurements({shirt:[chest],trouser:[waist,seat,target]});
    assert.ok(report.errors.some(s=>s.includes("anchor") || s.includes("ease")));
    assert.throws(()=>buildProductionHandoff(createRevision([chest],[waist,seat,target])),/Unsafe tailor handoff measurements/);
  }
});

test("unknown advanced cut ID is never passed off as an exact reconstructable tailor instruction",()=>{
  const revision=createRevision([chest],[waist,seat]);
  if(!revision.garmentSpec.styleSpec) throw Error("Missing advanced spec");
  revision.garmentSpec.styleSpec.shirt.cuff="nonexistent_cut_option";
  assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff construction/);
  const packet=buildProductionHandoff(createRevision([chest],[waist,seat]));
  if(!packet.construction.styleSpec) throw Error("Missing packet advanced spec");
  packet.construction.styleSpec.pant.fit="nonexistent_shape";
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/INVALID VERSIONED CONSTRUCTION/);
  assert.match(html,/nonexistent_shape/);
  assert.match(html,/review required/);
  assert.match(html,/NO CUTTING AUTHORISATION/);
});

test("printable tech pack preserves locked ease source and complete block instructions",()=>{
  const revision=createRevision([chest],[waist,seat]);
  revision.garmentSpec.blockStrategy={
    shirtBlock:"shaped-shirt",trouserBlock:"clean-upper-block",
    torsoShape:"tapered",seatShape:"balanced",
    adjustments:[{id:"BLOCK-SHOULDER-SLOPING",garment:"shirt",area:"shoulder slope / armhole",
      severity:"review",message:"Verify shoulder slope at fitting."}],
  };
  const packet=buildProductionHandoff(revision);
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/Ease provenance/);
  assert.match(html,/provisional_house_defaults/);
  assert.match(html,/house-v1/);
  assert.match(html,/BLOCK-SHOULDER-SLOPING/);
  assert.match(html,/Verify shoulder slope at fitting/);
  assert.match(html,/NOT REQUESTED/);
  assert.match(html,/Seam allowances for shirt and trouser pattern pieces approved/);
  assert.match(html,/Shrinkage and finished-garment tolerances signed/);
  assert.match(html,/Body landmarks, centimetre units and conversion checked/);
  assert.match(html,/PENDING HUMAN ACCEPTANCE/);
});

test("incomplete mandatory length landmarks never imply tailor review readiness",()=>{
  const report=auditHandoffMeasurements({shirt:[chest],trouser:[waist,seat]});
  assert.deepEqual(report.errors,[]);
  for(const label of ["Shoulder-width anchor","Sleeve-length anchor","Inseam anchor","Outseam anchor"])
    assert.ok(report.missing.some(note=>note.includes(label)),label);
  const packet=buildProductionHandoff(createRevision([chest],[waist,seat]));
  assert.equal(packet.status,"review_required");
  assert.equal(packet.construction.shirt.finishedTargets.length,1);
  assert.equal(packet.construction.trouser.finishedTargets.length,2);
  assert.match(buildTailorTechPackHtml(packet),/Outseam anchor is not recorded/);
});

test("contradictory trouser seam order and rise fail closed in both outputs",()=>{
  const badOutseam:FinishedTarget={...outseam,bodyCm:75,finishedCm:{min:75,max:75}};
  const frontRise:FinishedTarget={label:"Front-rise anchor",bodyCm:106,finishedCm:{min:106,max:106},basis:"recorded_anchor"};
  const cases=[
    {trouser:[waist,seat,inseam,badOutseam],fragment:"outseam must be longer"},
    {trouser:[waist,seat,inseam,outseam,frontRise],fragment:"front rise must be shorter"},
  ];
  for(const item of cases){
    const report=auditHandoffMeasurements({shirt:[chest,shoulder,sleeve],trouser:item.trouser});
    assert.ok(report.errors.some(x=>x.includes(item.fragment)),item.fragment);
    assert.throws(()=>buildProductionHandoff(createRevision([chest,shoulder,sleeve],item.trouser)),/Unsafe tailor handoff measurements/);
    const packet=buildProductionHandoff(createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]));
    packet.construction.trouser.finishedTargets=item.trouser;
    assert.throws(()=>buildTailorTechPackHtml(packet),/Unsafe tailor tech pack measurements/);
  }
});

test("locked construction version and measurement provenance must agree with exported choices",()=>{
  const mismatch=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  mismatch.garmentSpec.source.styleSchemaVersion=null;
  assert.throws(()=>buildProductionHandoff(mismatch),/option schema provenance/);

  const legacyClaim=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam],false);
  legacyClaim.garmentSpec.source.styleSchemaVersion=2;
  assert.throws(()=>buildProductionHandoff(legacyClaim),/option schema provenance/);

  const historicLegacy=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam],false);
  (historicLegacy.garmentSpec.source as unknown as Record<string,unknown>).styleSchemaVersion=undefined;
  const legacyPacket=buildProductionHandoff(historicLegacy);
  assert.equal(legacyPacket.status,"review_required");
  assert.ok(legacyPacket.unresolved.some(x=>x.includes("StyleSpec v2")));

  const noMeasurementVersion=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  noMeasurementVersion.garmentSpec.source.measurementProfileVersion=null;
  const packet=buildProductionHandoff(noMeasurementVersion);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(x=>x.includes("versioned measurement profile")));
  assert.match(buildTailorTechPackHtml(packet),/versioned measurement profile is not recorded/);
});

test("required circumference targets cannot masquerade as direct anchors without ease",()=>{
  const cases=[
    {shirt:[{...chest,basis:"recorded_anchor" as const,easeCm:undefined,finishedCm:{min:100,max:100}}],trouser:[waist,seat]},
    {shirt:[chest],trouser:[{...waist,basis:"recorded_anchor" as const,easeCm:undefined,finishedCm:{min:84,max:84}},seat]},
    {shirt:[chest],trouser:[waist,{...seat,basis:"customer_desired" as const,easeCm:undefined,finishedCm:{min:102,max:102}}]},
  ];
  for(const entry of cases){
    const result=auditHandoffMeasurements(entry);
    assert.match(result.errors.join(" "),/must retain body_plus_ease basis/);
    assert.throws(()=>buildProductionHandoff(createRevision(entry.shirt,entry.trouser)),/Unsafe tailor handoff measurements/);
  }
});

test("a known landmark cannot be reassigned to the wrong garment",()=>{
  const report=auditHandoffMeasurements({
    shirt:[chest,{label:"Inseam anchor",bodyCm:76,finishedCm:{min:76,max:76},basis:"customer_desired"}],
    trouser:[waist,seat],
  });
  assert.match(report.errors.join(" "),/trouser landmark/);
});

test("fit/ease version and source mismatch fails closed in handoff and print",()=>{
  const revision=createRevision([chest],[waist,seat]);
  revision.garmentSpec.source.fitConstructionVersion="fit-construction-calibrated-2";
  assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff fit provenance/);

  const packet=buildProductionHandoff(createRevision([chest],[waist,seat]));
  packet.construction.fitProvenance.easeSource="approved_house_calibration";
  assert.throws(()=>buildTailorTechPackHtml(packet),/Unsafe tailor tech pack fit provenance/);
});

test("missing fit provenance remains review-only and cannot impersonate an approved ease table",()=>{
  const revision=createRevision([chest],[waist,seat]);
  revision.garmentSpec.source.fitConstructionVersion=null;
  revision.garmentSpec.source.fitEaseSource=null;
  revision.garmentSpec.source.fitEaseTableVersion=null;
  const packet=buildProductionHandoff(revision);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(item=>item.includes("Fit/ease source")));
  assert.match(buildTailorTechPackHtml(packet),/Fit\/ease source and calibration version are not recorded/);

  revision.garmentSpec.source.fitConstructionVersion="fit-construction-provisional-1";
  assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff fit provenance/);
});

test("locked StyleSpec v2 option contract must match the declared schema version",()=>{
  const revision=createRevision([chest],[waist,seat]);
  revision.garmentSpec.source.styleSchemaVersion=null;
  assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff construction/);

  const legacy=createRevision([chest],[waist,seat],false);
  legacy.garmentSpec.source.styleSchemaVersion=2;
  assert.throws(()=>buildProductionHandoff(legacy),/Unsafe tailor handoff construction/);
});

test("provisional ease, sample dimensions and physical cutting approval remain separate",()=>{
  const packet=buildProductionHandoff(createRevision([chest],[waist,seat]));
  assert.ok(packet.caveats.some(value=>value.includes("provisional house defaults")));
  assert.ok(packet.caveats.some(value=>value.includes("No verified physical model/body measurements")));
  assert.match(buildTailorTechPackHtml(packet),/NO CUTTING AUTHORISATION/);
});

test("cryptographically locked synthetic design exports a reconstructable unsigned tech pack",async()=>{
  const fixture=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const locked=await lockGarmentSpec(fixture.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const handoff=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(handoff,locked),true);
  const html=await buildVerifiedTailorTechPackHtml(handoff,locked);
  assert.match(html,/NO CUTTING AUTHORISATION/);
  assert.ok(html.includes(locked.revisionId));
  assert.ok(html.includes(locked.recipeHash.slice(0,16).toUpperCase()));
  assert.ok(html.includes("Finished shirt chest"));
  assert.ok(html.includes("Inseam anchor"));
});

test("verified tech-pack export rejects subtle valid-looking edits and forged source revision",async()=>{
  const fixture=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const locked=await lockGarmentSpec(fixture.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const packet=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  const cases=[
    (p:typeof packet)=>{p.fabrics.shirt.name="Forged fabric";},
    (p:typeof packet)=>{p.construction.shirt.collar="Forged construction";},
    (p:typeof packet)=>{p.construction.shirt.finishedTargets[0].label="Fabricated chest";},
    (p:typeof packet)=>{p.construction.fitProvenance.easeTableVersion="fabricated-version";},
    (p:typeof packet)=>{p.status="review_required";},
    (p:typeof packet)=>{p.generatedAt="2026-11-04T00:00:00.000Z";},
  ];
  for(const tamper of cases) {
    const forged=structuredClone(packet);
    tamper(forged);
    assert.equal(await verifyProductionHandoff(forged,locked),false);
    await assert.rejects(buildVerifiedTailorTechPackHtml(forged,locked),/Unsafe tailor tech pack export/);
  }
  const forgedRevision=structuredClone(locked);
  forgedRevision.garmentSpec.shirt.fit="Fabricated fit";
  await assert.rejects(buildVerifiedTailorTechPackHtml(packet,forgedRevision),/Unsafe tailor tech pack export/);
});

test("verified export rejects pre-lock timestamps but never calls generation time a signed fact",async()=>{
  const fixture=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const locked=await lockGarmentSpec(fixture.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  await assert.rejects(
    buildVerifiedProductionHandoff(locked,"2026-11-05T10:59:59.000Z"),
    /cannot be generated before/,
  );
  const packet=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  const before=structuredClone(packet);
  before.generatedAt="2026-11-05T10:59:59.000Z";
  assert.equal(await verifyProductionHandoff(before,locked),false);
  await assert.rejects(buildVerifiedTailorTechPackHtml(before,locked),/Unsafe tailor tech pack export/);
  // No signature covers generatedAt. Chronological consistency is not timestamp
  // authenticity; verified export asserts locked recipe integrity only.
  const later=structuredClone(packet);
  later.generatedAt="2026-11-05T11:02:00.000Z";
  assert.equal(await verifyProductionHandoff(later,locked),true);
});

test("internally consistent approved ease label remains review-only without external approval evidence",()=>{
  const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  revision.garmentSpec.source.fitConstructionVersion="fit-construction-calibrated-2";
  revision.garmentSpec.source.fitEaseSource="approved_house_calibration";
  revision.garmentSpec.source.fitEaseTableVersion="supplier-claimed-calibration-v2";
  // A valid-looking locked provenance tuple is NOT a retrieved tailor approval.
  const packet=buildProductionHandoff(revision);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(note=>note.includes("not authenticated by the locked recipe")));
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/Claimed approved house ease calibration is not authenticated/);
  assert.match(html,/review required/);
  assert.match(html,/NO CUTTING AUTHORISATION/);
});

test("tech-pack download filename is deterministic and rejects traversal or ambiguous revision IDs",()=>{
  const packet=buildProductionHandoff(createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]));
  assert.equal(techPackFilename(packet),"linen-earth-tech-pack-le-lock-20261102-000000000000.html");
  for(const id of [
    "", " ", "../other", "a/../other", "folder/lock", "C:\\temp",
    "A%2fB", "A.B", "A\nB", "A\u0000B", "A\u202eB", "x".repeat(121),
  ]) {
    const forged={...packet,designRevisionId:id};
    assert.throws(()=>techPackFilename(forged),/Unsafe tailor tech pack filename/);
  }
});

test("unresolved locked design decisions cannot claim tailor-review readiness",()=>{
  const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  revision.garmentSpec.unresolved=["Customer must approve the exact waistband construction."];
  assert.equal(revision.garmentSpec.status,"ready_for_tailor_review");
  const packet=buildProductionHandoff(revision);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.includes("Customer must approve the exact waistband construction."));
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/review required/);
  assert.match(html,/Customer must approve the exact waistband construction/);
  assert.match(html,/NO CUTTING AUTHORISATION/);
});

test("open construction checks fail closed even when the source incorrectly claims ready",()=>{
  for(const severity of ["review","warning"] as const){
    const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
    revision.garmentSpec.constructionChecks=[{
      id:"SYNTHETIC-CONSTRUCTION-ISSUE",
      severity,
      message:"Inspect the garment block before tailoring.",
    }];
    const packet=buildProductionHandoff(revision);
    assert.equal(packet.status,"review_required",severity);
    assert.match(buildTailorTechPackHtml(packet),/review required/);
  }
});

test("the legacy printable formatter never displays ready after unresolved-note or check tampering",()=>{
  const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const original=buildProductionHandoff(revision);
  assert.equal(original.status,"ready_for_tailor_review");

  const withNote=structuredClone(original);
  withNote.unresolved.push("Tailor must inspect a new unresolved customer fit decision.");
  assert.match(buildTailorTechPackHtml(withNote),/review required/);
  assert.match(buildTailorTechPackHtml(withNote),/new unresolved customer fit decision/);

  const withReview=structuredClone(original);
  withReview.construction.checks.push({
    id:"SYNTHETIC-REVIEW",
    severity:"review",
    message:"Physical balance correction remains open.",
  });
  assert.match(buildTailorTechPackHtml(withReview),/review required/);
  assert.match(buildTailorTechPackHtml(withReview),/NO CUTTING AUTHORISATION/);
});
