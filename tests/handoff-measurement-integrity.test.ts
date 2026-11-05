import test from "node:test";
import assert from "node:assert/strict";
import { auditHandoffMeasurements } from "../src/lib/designer/handoff-measurements.ts";
import { buildProductionHandoff } from "../src/lib/designer/production-handoff.ts";
import { buildTailorTechPackHtml } from "../src/lib/designer/tech-pack.ts";
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

  const noMeasurementVersion=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  noMeasurementVersion.garmentSpec.source.measurementProfileVersion=null;
  const packet=buildProductionHandoff(noMeasurementVersion);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(x=>x.includes("versioned measurement profile")));
  assert.match(buildTailorTechPackHtml(packet),/versioned measurement profile is not recorded/);
});
