import test from "node:test";
import assert from "node:assert/strict";
import { auditHandoffBlockAdjustments, auditHandoffConstructionChecks, auditHandoffCreativeReview, auditHandoffFabricIdentity, auditHandoffHumanNotes, auditHandoffMeasurements, auditHandoffProductionReadiness } from "../src/lib/designer/handoff-measurements.ts";
import { buildProductionHandoff, buildVerifiedProductionHandoff, verifyProductionHandoff } from "../src/lib/designer/production-handoff.ts";
import { lockGarmentSpec } from "../src/lib/designer/design-lock.ts";
import { buildTailorTechPackHtml, buildVerifiedTailorTechPackHtml, techPackFilename } from "../src/lib/designer/tech-pack.ts";
import type { FinishedTarget } from "../src/lib/designer/fit-construction.ts";
import { HOUSE_EASE_TABLE_VERSION } from "../src/lib/designer/house-ease.ts";
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
        fitEaseSource:"provisional_house_defaults",fitEaseTableVersion:HOUSE_EASE_TABLE_VERSION,
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

test("malformed saved recipe containers fail closed before handoff creation",()=>{
  const sample=()=>createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const invalid:Array<[string,(revision:LockedDesignRevision)=>void]>=[
    ["missing recipe",r=>{r.garmentSpec=null as never;}],
    ["scalar recipe",r=>{r.garmentSpec="not a recipe" as never;}],
    ["missing source metadata",r=>{r.garmentSpec.source=null as never;}],
    ["source metadata array",r=>{r.garmentSpec.source=[] as never;}],
    ["missing shirt record",r=>{r.garmentSpec.shirt=null as never;}],
    ["array trouser record",r=>{r.garmentSpec.trouser=[] as never;}],
    ["missing occasion context",r=>{r.garmentSpec.context=null as never;}],
    ["array occasion context",r=>{r.garmentSpec.context=[] as never;}],
    ["unsupported design lock version",r=>{r.version="linen-earth-design-lock-v9" as never;}],
    ["unsupported garment recipe version",r=>{r.garmentSpec.version="linen-earth-garment-spec-v9" as never;}],
  ];
  for(const [label,mutate] of invalid){
    const revision=sample();
    mutate(revision);
    assert.throws(()=>buildProductionHandoff(revision),
      /Unsafe tailor handoff source/,label);
  }
  assert.throws(()=>buildProductionHandoff(null as never),
    /Unsafe tailor handoff source/);
  assert.throws(()=>buildProductionHandoff([] as never),
    /Unsafe tailor handoff source/);
  const good=buildProductionHandoff(sample(),"2026-11-02T11:00:00Z");
  assert.equal(good.construction.context?.occasion,"Smart-Casual");
  assert.equal(good.production.stockReservation.status,"not_requested");
});

test("saved occasion, climate and intention must stay printable for reconstruction",()=>{
  const sample=()=>createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  for(const field of ["occasion","climate","intention"] as const) {
    for(const bad of [null,undefined,""," ",12,[],{}, "too-long".repeat(40), "Hot"+String.fromCharCode(0)+"invalid"]) {
      const revision=sample();
      (revision.garmentSpec.context as unknown as Record<string,unknown>)[field]=bad;
      assert.throws(()=>buildProductionHandoff(revision),
        /Unsafe tailor handoff context/, `${field}: ${String(bad)}`);
    }
  }
  const valid=buildProductionHandoff(sample(),"2026-11-02T11:00:00Z");
  assert.equal(valid.construction.context?.climate,"Hot / humid");
});

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

test("unverified tech packs reject fabricated cloth, stock and quote claims",()=>{
  const sample=()=>buildProductionHandoff(
    createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]),
    "2026-11-02T11:00:00Z",
  );
  const validHtml=buildTailorTechPackHtml(sample());
  assert.match(validHtml,/TAILOR REQUIRED/);
  assert.match(validHtml,/NOT REQUESTED/);
  assert.match(validHtml,/PENDING/);
  assert.match(validHtml,/NO CUTTING AUTHORISATION/);
  type Packet=ReturnType<typeof sample>;
  const tamperings:Array<[string,(packet:Packet)=>void]>=[
    ["missing production",p=>{p.production=null as never;}],
    ["malformed cloth record",p=>{p.production.clothEstimate=[] as never;}],
    ["fabric metre claim",p=>{p.production.clothEstimate.shirtMetres=2.4 as never;}],
    ["trouser metre claim",p=>{p.production.clothEstimate.trouserMetres=1.8 as never;}],
    ["forged cloth basis",p=>{p.production.clothEstimate.basis="supplier_estimate" as never;}],
    ["unreadable cloth note",p=>{p.production.clothEstimate.note=" " as never;}],
    ["invalid stock record",p=>{p.production.stockReservation=null as never;}],
    ["forged reservation ID",p=>{p.production.stockReservation.reservationId="RES-FORGED" as never;}],
    ["claimed reservation",p=>{p.production.stockReservation.status="reserved" as never;}],
    ["invalid quote record",p=>{p.production.quote=[] as never;}],
    ["forged quote amount",p=>{p.production.quote.amount=4000 as never;}],
    ["forged zero quote",p=>{p.production.quote.amount=0 as never;}],
    ["forged currency",p=>{p.production.quote.currency="INR" as never;}],
    ["claimed paid quote",p=>{p.production.quote.status="paid" as never;}],
  ];
  for(const [label,mutate] of tamperings){
    const tampered=sample();
    mutate(tampered);
    assert.throws(()=>buildTailorTechPackHtml(tampered),
      /Unsafe tailor tech pack production fields/,label);
  }
  const missingConstruction=sample();
  missingConstruction.construction.shirt=null as never;
  assert.throws(()=>buildTailorTechPackHtml(missingConstruction),
    /Unsafe tailor tech pack construction/);
  assert.throws(()=>buildTailorTechPackHtml(null as never),
    /Unsafe tailor tech pack packet/);
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

test("calibration upper bound also applies at the final handoff and printable boundaries",()=>{
  // The calibration-table normalizer rejects ease above 80 cm. This is a
  // software provenance limit, not a suggested physical garment allowance.
  const unsupported:FinishedTarget={
    ...chest,
    easeCm:{min:81,max:82},finishedCm:{min:181,max:182},
  };
  const atLimit:FinishedTarget={
    ...chest,
    easeCm:{min:79,max:80},finishedCm:{min:179,max:180},
  };
  const trouser=[waist,seat,inseam,outseam];
  const complete=[chest,shoulder,sleeve];
  assert.deepEqual(auditHandoffMeasurements({shirt:complete,trouser}),{errors:[],missing:[]});
  const audit=auditHandoffMeasurements({shirt:[unsupported,shoulder,sleeve],trouser});
  assert.ok(audit.errors.some(message=>message.includes("ease range is invalid")));
  assert.throws(()=>buildProductionHandoff(
    createRevision([unsupported,shoulder,sleeve],trouser),
  ),/Unsafe tailor handoff measurements/);
  const unverified=buildProductionHandoff(createRevision(complete,trouser));
  unverified.construction.shirt.finishedTargets[0]=unsupported;
  assert.throws(()=>buildTailorTechPackHtml(unverified),/Unsafe tailor tech pack measurements/);

  // The exact documented boundary remains a valid range for data-integrity
  // checks; it does not confer any form of human fit or cutting signoff.
  assert.deepEqual(
    auditHandoffMeasurements({shirt:[atLimit,shoulder,sleeve],trouser}),
    {errors:[],missing:[]},
  );
});

test("negative ease is rejected consistently with the existing house ease contract",()=>{
  const wrong={
    ...chest,
    easeCm:{min:-3,max:2},
    finishedCm:{min:97,max:102},
  };
  const audit=auditHandoffMeasurements({
    shirt:[wrong,shoulder,sleeve],
    trouser:[waist,seat,inseam,outseam],
  });
  assert.ok(audit.errors.some(item=>item.includes("ease range is invalid")));
  assert.throws(()=>buildProductionHandoff(createRevision(
    [wrong,shoulder,sleeve],[waist,seat,inseam,outseam],
  )),/Unsafe tailor handoff measurements/);

  const clean=buildProductionHandoff(createRevision(
    [chest,shoulder,sleeve],[waist,seat,inseam,outseam],
  ));
  const tampered=structuredClone(clean);
  tampered.construction.shirt.finishedTargets[0]=wrong;
  assert.throws(()=>buildTailorTechPackHtml(tampered),/Unsafe tailor tech pack measurements/);
  assert.equal(buildProductionHandoff(createRevision(
    [chest,shoulder,sleeve],[waist,seat,inseam,outseam],
  )).status,"ready_for_tailor_review");
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

test("French double cuffs require a wrist-based finished cuff circumference",async()=>{
  const shirtTargets=[chest,shoulder,sleeve];
  const trouserTargets=[waist,seat,inseam,outseam];
  const wrist:FinishedTarget={
    label:"Finished cuff circumference",
    bodyCm:18,easeCm:{min:2.5,max:3.5},
    finishedCm:{min:20.5,max:21.5},basis:"body_plus_ease",
  };
  assert.deepEqual(auditHandoffMeasurements({
    shirt:shirtTargets,trouser:trouserTargets,
  },{shirtCuff:"open_short_hem_cuff"}),{errors:[],missing:[]});

  const makeFrench=(targets:FinishedTarget[])=>{
    const revision=createRevision(targets,trouserTargets);
    if(!revision.garmentSpec.styleSpec) throw Error("Missing synthetic exact cut");
    revision.garmentSpec.styleSpec.shirt.cuff="french_double_cuff";
    revision.garmentSpec.styleSpec.shirt.sleeve="full_sleeve";
    revision.garmentSpec.styleSpec.legacy.cuff="French / Double Cuff";
    revision.garmentSpec.shirt.cuff="French / Double Cuff";
    return revision;
  };
  const audit=auditHandoffMeasurements({
    shirt:shirtTargets,trouser:trouserTargets,
  },{shirtCuff:"french_double_cuff"});
  assert.deepEqual(audit.errors,[]);
  assert.ok(audit.missing.some(note=>note.includes("Finished cuff circumference")
    && note.includes("French/double cuff")));

  const missing=buildProductionHandoff(makeFrench(shirtTargets));
  assert.equal(missing.status,"review_required");
  assert.ok(missing.unresolved.some(note=>note.includes("Finished cuff circumference")));
  assert.match(buildTailorTechPackHtml(missing),/Finished cuff circumference is not recorded/);

  const completeRevision=makeFrench([...shirtTargets,wrist]);
  const complete=buildProductionHandoff(completeRevision);
  assert.equal(complete.status,"ready_for_tailor_review");
  assert.deepEqual(complete.unresolved,[]);
  assert.ok(complete.construction.shirt.finishedTargets.some(
    target=>target.label==="Finished cuff circumference",
  ));

  const stale=structuredClone(complete);
  stale.construction.shirt.finishedTargets=stale.construction.shirt.finishedTargets.filter(
    target=>target.label!=="Finished cuff circumference",
  );
  const staleHtml=buildTailorTechPackHtml(stale);
  assert.match(staleHtml,/Finished cuff circumference is not recorded/);
  assert.match(staleHtml,/review required/);
  assert.match(staleHtml,/NO CUTTING AUTHORISATION/);

  const legacy=createRevision(shirtTargets,trouserTargets,false);
  legacy.garmentSpec.shirt.cuff="French / Double Cuff";
  const historical=buildProductionHandoff(legacy);
  assert.equal(historical.status,"review_required");
  assert.ok(historical.unresolved.some(note=>note.includes("Finished cuff circumference")));

  const locked=await lockGarmentSpec(makeFrench(shirtTargets).garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(verified.status,"review_required");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  const html=await buildVerifiedTailorTechPackHtml(verified,locked);
  assert.match(html,/Finished cuff circumference is not recorded/);
  assert.match(html,/NO CUTTING AUTHORISATION/);
});

test("high and extra-high trouser rises require a recorded front-rise anchor",()=>{
  const standardShirt=[chest,shoulder,sleeve];
  const standardTrouser=[waist,seat,inseam,outseam];
  const frontRise:FinishedTarget={
    label:"Front-rise anchor",bodyCm:28,finishedCm:{min:28,max:28},basis:"recorded_anchor",
  };

  assert.deepEqual(auditHandoffMeasurements(
    {shirt:standardShirt,trouser:standardTrouser},{trouserRise:"mid_rise"},
  ),{errors:[],missing:[]});
  for(const rise of ["high_rise","extra_high_rise"]){
    const missing=auditHandoffMeasurements(
      {shirt:standardShirt,trouser:standardTrouser},{trouserRise:rise},
    );
    assert.deepEqual(missing.errors,[]);
    assert.ok(missing.missing.some(note=>note.includes("Front-rise anchor")
      && note.includes("high-rise construction")),rise);

    const revision=createRevision(standardShirt,standardTrouser);
    if(!revision.garmentSpec.styleSpec) throw Error("Missing synthetic exact cut");
    revision.garmentSpec.styleSpec.pant.rise=rise;
    revision.garmentSpec.trouser.rise="High Rise";
    const packet=buildProductionHandoff(revision);
    assert.equal(packet.status,"review_required",rise);
    assert.ok(packet.unresolved.some(note=>note.includes("Front-rise anchor")),rise);
    const html=buildTailorTechPackHtml(packet);
    assert.match(html,/Front-rise anchor is not recorded/);
    assert.match(html,/NO CUTTING AUTHORISATION/);

    const complete=createRevision(standardShirt,[...standardTrouser,frontRise]);
    if(!complete.garmentSpec.styleSpec) throw Error("Missing synthetic exact cut");
    complete.garmentSpec.styleSpec.pant.rise=rise;
    complete.garmentSpec.trouser.rise="High Rise";
    const done=buildProductionHandoff(complete);
    assert.equal(done.status,"ready_for_tailor_review",rise);
    assert.deepEqual(done.unresolved,[]);
    assert.ok(done.construction.trouser.finishedTargets.some(t=>t.label==="Front-rise anchor"));
    const stale=structuredClone(done);
    stale.construction.trouser.finishedTargets=stale.construction.trouser.finishedTargets
      .filter(t=>t.label!=="Front-rise anchor");
    assert.match(buildTailorTechPackHtml(stale),/Front-rise anchor is not recorded/);
    assert.match(buildTailorTechPackHtml(stale),/review required/);
  }

  const legacy=createRevision(standardShirt,standardTrouser,false);
  legacy.garmentSpec.trouser.rise="High Rise";
  const legacyPacket=buildProductionHandoff(legacy);
  assert.equal(legacyPacket.status,"review_required");
  assert.ok(legacyPacket.unresolved.some(note=>note.includes("Front-rise anchor")));
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

test("malformed nested StyleSpec options fail safely at handoff and remain review-only in preview",()=>{
  // Stored or imported objects can be damaged even when their declared schema
  // version looks correct. No missing nested part can become a cutting choice.
  const malformed:unknown[]=[
    {styleSchemaVersion:2,shirt:null,pant:{},legacy:{}},
    {styleSchemaVersion:2,shirt:{wear:"tucked"},pant:null,legacy:{}},
    "",
    false,
  ];
  for(const bad of malformed){
    const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
    revision.garmentSpec.styleSpec=bad as typeof revision.garmentSpec.styleSpec;
    assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff construction/);

    const packet=buildProductionHandoff(createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]));
    packet.construction.styleSpec=bad as typeof packet.construction.styleSpec;
    const html=buildTailorTechPackHtml(packet);
    assert.match(html,/INVALID VERSIONED CONSTRUCTION/);
    assert.match(html,/review required/);
    assert.match(html,/NO CUTTING AUTHORISATION/);
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

test("closed pattern-block identifiers are checked before handoff or printing",async()=>{
  const makeBlock=()=>{
    const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
    revision.garmentSpec.source.blockStrategyVersion="block-strategy-provisional-1";
    revision.garmentSpec.blockStrategy={
      shirtBlock:"balanced-shirt",trouserBlock:"clean-upper-block",
      torsoShape:"balanced",seatShape:"balanced",adjustments:[],
    };
    return revision;
  };
  const valid=makeBlock();
  assert.equal(buildProductionHandoff(valid).status,"ready_for_tailor_review");
  const unknown=makeBlock();
  if(!unknown.garmentSpec.blockStrategy) throw Error("Missing synthetic block");
  unknown.garmentSpec.blockStrategy.shirtBlock="unknown";
  const review=buildProductionHandoff(unknown);
  assert.equal(review.status,"review_required");
  assert.ok(review.unresolved.some(note=>note.includes("shirtBlock is unknown")));
  assert.match(buildTailorTechPackHtml(review),/shirtBlock is unknown/);
  assert.match(buildTailorTechPackHtml(review),/NO CUTTING AUTHORISATION/);

  for(const field of ["shirtBlock","trouserBlock","torsoShape","seatShape"] as const){
    const malformed=makeBlock();
    if(!malformed.garmentSpec.blockStrategy) throw Error("Missing synthetic block");
    malformed.garmentSpec.blockStrategy[field]="nonexistent-block" as never;
    assert.ok(auditHandoffBlockAdjustments(malformed.garmentSpec.blockStrategy).errors
      .some(error=>error.includes(field)));
    assert.throws(()=>buildProductionHandoff(malformed),/Unsafe tailor handoff block adjustments/);

    const stale=buildProductionHandoff(makeBlock());
    if(!stale.construction.blockStrategy) throw Error("Missing exported block");
    stale.construction.blockStrategy[field]="nonexistent-block" as never;
    assert.throws(()=>buildTailorTechPackHtml(stale),/Unsafe tailor tech pack block adjustments/);
  }

  const locked=await lockGarmentSpec(unknown.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(verified.status,"review_required");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  assert.match(await buildVerifiedTailorTechPackHtml(verified,locked),/shirtBlock is unknown/);
});

test("open pattern-block adjustments never silently become ready or approved cutting instructions",async()=>{
  const make=(severity:"info"|"review"|"warning")=>{
    const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
    revision.garmentSpec.source.blockStrategyVersion="block-strategy-provisional-1";
    revision.garmentSpec.blockStrategy={
      shirtBlock:"shaped-shirt",trouserBlock:"clean-upper-block",
      torsoShape:"balanced",seatShape:"balanced",
      adjustments:[{id:"BLOCK-SYNTHETIC-FIT",garment:"shirt",area:"shoulder/armhole",
        severity,message:"Verify shoulder balance on physical sample."}],
    };
    return revision;
  };

  const info=buildProductionHandoff(make("info"));
  assert.equal(info.status,"ready_for_tailor_review");
  assert.deepEqual(info.unresolved,[]);
  for(const severity of ["review","warning"] as const){
    const revision=make(severity);
    const packet=buildProductionHandoff(revision);
    assert.equal(packet.status,"review_required",severity);
    assert.ok(packet.unresolved.some(x=>x.includes("BLOCK-SYNTHETIC-FIT")
      && x.includes("Verify shoulder balance")),severity);
    const html=buildTailorTechPackHtml(packet);
    assert.match(html,/BLOCK-SYNTHETIC-FIT/);
    assert.match(html,/Verify shoulder balance on physical sample/);
    assert.match(html,/NO CUTTING AUTHORISATION/);
  }
  const stale=structuredClone(info);
  if(!stale.construction.blockStrategy) throw Error("Missing sample block strategy");
  stale.construction.blockStrategy.adjustments[0].severity="review";
  const legacyHtml=buildTailorTechPackHtml(stale);
  assert.match(legacyHtml,/Block adjustment BLOCK-SYNTHETIC-FIT/);
  assert.match(legacyHtml,/review required/);

  const unknown=make("info");
  if(!unknown.garmentSpec.blockStrategy) throw Error("Missing sample block strategy");
  unknown.garmentSpec.blockStrategy.adjustments[0].severity="critical" as "info";
  assert.ok(auditHandoffBlockAdjustments(unknown.garmentSpec.blockStrategy).errors.length);
  assert.throws(()=>buildProductionHandoff(unknown),/Unsafe tailor handoff block adjustments/);
  const corrupted=structuredClone(info);
  if(!corrupted.construction.blockStrategy) throw Error("Missing sample block strategy");
  corrupted.construction.blockStrategy.adjustments=null as unknown as typeof corrupted.construction.blockStrategy.adjustments;
  assert.throws(()=>buildTailorTechPackHtml(corrupted),/Unsafe tailor tech pack block adjustments/);

  const locked=await lockGarmentSpec(make("review").garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const packet=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(packet.status,"review_required");
  assert.equal(await verifyProductionHandoff(packet,locked),true);
  const verifiedHtml=await buildVerifiedTailorTechPackHtml(packet,locked);
  assert.match(verifiedHtml,/BLOCK-SYNTHETIC-FIT/);
  assert.match(verifiedHtml,/review required/);
  assert.match(verifiedHtml,/NO CUTTING AUTHORISATION/);
});

test("locked block provenance cannot contradict its pattern strategy",async()=>{
  const shirt=[chest,shoulder,sleeve];
  const trouser=[waist,seat,inseam,outseam];
  const sample=createRevision(shirt,trouser);
  sample.garmentSpec.blockStrategy={
    shirtBlock:"balanced-shirt",trouserBlock:"clean-upper-block",
    torsoShape:"balanced",seatShape:"balanced",adjustments:[],
  };
  // Old source records may carry a block without a version. Preserve all
  // recorded construction details while withholding review-ready status.
  const legacySource=structuredClone(sample);
  const legacy=buildProductionHandoff(legacySource);
  assert.equal(legacy.status,"review_required");
  assert.ok(legacy.unresolved.some(note=>note.includes("source version is not recorded")));
  assert.equal(legacy.construction.blockStrategy?.shirtBlock,"balanced-shirt");
  assert.match(buildTailorTechPackHtml(legacy),/source version is not recorded/);
  assert.match(buildTailorTechPackHtml(legacy),/NO CUTTING AUTHORISATION/);

  sample.garmentSpec.source.blockStrategyVersion="block-strategy-provisional-1";
  const current=buildProductionHandoff(sample);
  assert.equal(current.status,"ready_for_tailor_review");
  assert.deepEqual(current.unresolved,[]);

  const missing=structuredClone(sample);
  missing.garmentSpec.blockStrategy=null;
  assert.throws(()=>buildProductionHandoff(missing),/Unsafe tailor handoff block provenance/);
  const unsupported=structuredClone(sample);
  unsupported.garmentSpec.source.blockStrategyVersion="made-up-version" as
    typeof unsupported.garmentSpec.source.blockStrategyVersion;
  assert.throws(()=>buildProductionHandoff(unsupported),/Unsafe tailor handoff block provenance/);

  const unsigned=await lockGarmentSpec(legacySource.garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const packet=await buildVerifiedProductionHandoff(unsigned,"2026-11-05T11:01:00.000Z");
  assert.equal(packet.status,"review_required");
  assert.equal(await verifyProductionHandoff(packet,unsigned),true);
  assert.match(await buildVerifiedTailorTechPackHtml(packet,unsigned),/source version is not recorded/);
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
  assert.ok(html.includes(HOUSE_EASE_TABLE_VERSION));
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

test("unexpected provisional ease table versions remain reconstructable but block review readiness",async()=>{
  const baseline=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const current=buildProductionHandoff(baseline);
  assert.equal(current.status,"ready_for_tailor_review");
  assert.equal(current.construction.fitProvenance.easeTableVersion,HOUSE_EASE_TABLE_VERSION);

  const legacy=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  legacy.garmentSpec.source.fitEaseTableVersion="legacy-unverified-house-v0";
  const packet=buildProductionHandoff(legacy);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(note=>note.includes("does not match")
    && note.includes(HOUSE_EASE_TABLE_VERSION)));
  assert.equal(packet.construction.fitProvenance.easeTableVersion,"legacy-unverified-house-v0");
  const preview=buildTailorTechPackHtml(packet);
  assert.match(preview,/legacy-unverified-house-v0/);
  assert.match(preview,/review required/);
  assert.match(preview,/NO CUTTING AUTHORISATION/);

  const tampered=structuredClone(current);
  tampered.construction.fitProvenance.easeTableVersion="legacy-unverified-house-v0";
  const staleHtml=buildTailorTechPackHtml(tampered);
  assert.match(staleHtml,/review required/);
  assert.match(staleHtml,/legacy-unverified-house-v0/);

  const locked=await lockGarmentSpec(legacy.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const signed=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(signed.status,"review_required");
  assert.equal(await verifyProductionHandoff(signed,locked),true);
  const verifiedHtml=await buildVerifiedTailorTechPackHtml(signed,locked);
  assert.match(verifiedHtml,/legacy-unverified-house-v0/);
  assert.match(verifiedHtml,/review required/);
  assert.match(verifiedHtml,/NO CUTTING AUTHORISATION/);
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

test("verified handoff rejects substituted lock identity even when the garment hash still matches",async()=>{
  const synthetic=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const locked=await lockGarmentSpec(synthetic.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const issuedAt="2026-11-05T11:01:00.000Z";
  const packet=await buildVerifiedProductionHandoff(locked,issuedAt);
  assert.equal(await verifyProductionHandoff(packet,locked),true);
  assert.match(await buildVerifiedTailorTechPackHtml(packet,locked),/NO CUTTING AUTHORISATION/);

  const changes=[
    (revision:LockedDesignRevision)=>{ revision.revisionId=revision.revisionId+"-REPLACED"; },
    (revision:LockedDesignRevision)=>{ revision.lockedAt="2026-11-05T11:00:01.000Z"; },
    (revision:LockedDesignRevision)=>{ revision.lockedAt="2026-11-05T11:00:00Z"; },
  ];
  for(const change of changes){
    const forged=structuredClone(locked);
    change(forged);
    // Even though garmentSpec still hashes to the exact same SHA256,
    // the tampered lock metadata no longer matches lockGarmentSpec output.
    await assert.rejects(buildVerifiedProductionHandoff(forged,issuedAt),/canonical locked revision/);
    assert.equal(await verifyProductionHandoff(packet,forged),false);
    await assert.rejects(buildVerifiedTailorTechPackHtml(packet,forged),/Unsafe tailor tech pack export/);
  }
  // This check is only internal structural integrity, not proof that
  // lockedAt or the parent revision ID has an external signed timestamp.
});

test("unverified review preview never claims lock-verified tailor readiness",async()=>{
  const fixture=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const rawPacket=buildProductionHandoff(fixture);
  assert.equal(rawPacket.status,"ready_for_tailor_review");
  const preview=buildTailorTechPackHtml(rawPacket);
  assert.match(preview,/<div class="badge">review required<\/div>/);
  assert.match(preview,/UNVERIFIED PACKET PREVIEW — lock not checked/);
  assert.doesNotMatch(preview,/<div class="badge">ready for tailor review<\/div>/);
  assert.match(preview,/NO CUTTING AUTHORISATION/);

  const locked=await lockGarmentSpec(fixture.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const verifiedPacket=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(verifiedPacket,locked),true);
  const verifiedHtml=await buildVerifiedTailorTechPackHtml(verifiedPacket,locked);
  assert.match(verifiedHtml,/<div class="badge">ready for tailor review<\/div>/);
  assert.match(verifiedHtml,/LOCKED RECIPE VERIFIED — no physical cutting approval/);
  assert.match(verifiedHtml,/NO CUTTING AUTHORISATION/);

  // Neither a packet that claims ready nor an otherwise valid recipe can
  // force a trusted badge through the unsigned formatter.
  const unverified=structuredClone(verifiedPacket);
  assert.match(buildTailorTechPackHtml(unverified),/<div class="badge">review required<\/div>/);
});

test("verified exports fail closed on malformed stored handoffs and source locks",async()=>{
  const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const locked=await lockGarmentSpec(revision.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const packet=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(packet,locked),true);
  const html=await buildVerifiedTailorTechPackHtml(packet,locked);
  // A reconstructable, unchanged source produces byte-identical exports.
  assert.equal(await buildVerifiedTailorTechPackHtml(packet,locked),html);
  assert.match(html,/NO CUTTING AUTHORISATION/);

  const damagedPackets=[
    null,undefined,{},[],{generatedAt:"2026-11-05T11:01:00.000Z"},
    {...packet,generatedAt:null},
    {...packet,construction:null},
    {...packet,unresolved:null},
  ];
  for(const damaged of damagedPackets){
    const candidate=damaged as unknown as typeof packet;
    assert.equal(await verifyProductionHandoff(candidate,locked),false);
    await assert.rejects(
      buildVerifiedTailorTechPackHtml(candidate,locked),
      /Unsafe tailor tech pack export/,
    );
  }

  const damagedLocks=[
    null,undefined,{},[],{...locked,garmentSpec:null},
    {...locked,recipeHash:null},{...locked,lockedAt:null},
  ];
  for(const damaged of damagedLocks){
    const candidate=damaged as unknown as typeof locked;
    assert.equal(await verifyProductionHandoff(packet,candidate),false);
    await assert.rejects(
      buildVerifiedTailorTechPackHtml(packet,candidate),
      /Unsafe tailor tech pack export/,
    );
  }
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

test("unresolved decisions and caveats must remain bounded human-readable note arrays",async()=>{
  const make=()=>createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  assert.deepEqual(auditHandoffHumanNotes([],"unresolved"),{errors:[],missing:[]});
  assert.deepEqual(auditHandoffHumanNotes(["Human sample verification pending."],"caveats"),
    {errors:[],missing:[]});
  const original=buildProductionHandoff(make());
  assert.equal(original.status,"ready_for_tailor_review");
  assert.deepEqual(original.unresolved,[]);
  assert.match(buildTailorTechPackHtml(original),/NO CUTTING AUTHORISATION/);

  const malformed:unknown[]=[null,undefined,"unreviewed",{},[null],[""],
    ["  "],["valid",12],["x".repeat(4001)],["bad"+String.fromCharCode(0)+"text"]];
  for(const value of malformed){
    assert.ok(auditHandoffHumanNotes(value,"unresolved").errors.length);
    assert.ok(auditHandoffHumanNotes(value,"caveats").errors.length);
    for(const field of ["unresolved","caveats"] as const){
      const revision=make();
      (revision.garmentSpec as unknown as Record<string,unknown>)[field]=value;
      assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff review notes/);

      const stale=structuredClone(original);
      (stale as unknown as Record<string,unknown>)[field]=value;
      assert.throws(()=>buildTailorTechPackHtml(stale),/Unsafe tailor tech pack review notes/);
    }
  }
  const revision=make();
  revision.garmentSpec.unresolved=["Customer confirmation of hem construction is still pending."];
  revision.garmentSpec.caveats=["Physical sample and pattern signoff are outstanding."];
  const packet=buildProductionHandoff(revision);
  assert.equal(packet.status,"review_required");
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/Customer confirmation of hem construction is still pending/);
  assert.match(html,/Physical sample and pattern signoff are outstanding/);

  const locked=await lockGarmentSpec(revision.garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  assert.equal(verified.status,"review_required");
  const verifiedHtml=await buildVerifiedTailorTechPackHtml(verified,locked);
  assert.match(verifiedHtml,/Customer confirmation of hem construction is still pending/);
  assert.match(verifiedHtml,/NO CUTTING AUTHORISATION/);
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

test("malformed construction checks cannot hide behind a ready status or verified lock",async()=>{
  const shirt=[chest,shoulder,sleeve];
  const trousers=[waist,seat,inseam,outseam];
  const info={id:"SYNTHETIC-INFO",severity:"info" as const,message:"No open issue in this synthetic case."};
  assert.deepEqual(auditHandoffConstructionChecks([info]),{errors:[],missing:[]});
  const good=createRevision(shirt,trousers);
  good.garmentSpec.constructionChecks=[info];
  assert.equal(buildProductionHandoff(good).status,"ready_for_tailor_review");

  for(const bad of [
    {id:"SYNTHETIC-UNKNOWN",severity:"critical",message:"Must not be ignored."},
    {id:" ",severity:"info",message:"Missing check identity."},
    {id:"SYNTHETIC-BLANK",severity:"review",message:" "},
    null,
  ]){
    const typedBad=bad as unknown as typeof good.garmentSpec.constructionChecks[number];
    const malformed=createRevision(shirt,trousers);
    malformed.garmentSpec.constructionChecks=[typedBad];
    assert.ok(auditHandoffConstructionChecks([bad]).errors.length>0);
    assert.throws(()=>buildProductionHandoff(malformed),/Unsafe tailor handoff construction checks/);
    const packet=buildProductionHandoff(createRevision(shirt,trousers));
    packet.construction.checks=[typedBad];
    assert.throws(()=>buildTailorTechPackHtml(packet),/Unsafe tailor tech pack construction checks/);
  }
  const absent=createRevision(shirt,trousers);
  absent.garmentSpec.constructionChecks=null as unknown as typeof absent.garmentSpec.constructionChecks;
  assert.throws(()=>buildProductionHandoff(absent),/Unsafe tailor handoff construction checks/);

  // The signed recipe hash alone cannot turn an unknown check severity into
  // an acceptable manufacturing instruction or trusted printable export.
  const malicious=createRevision(shirt,trousers);
  malicious.garmentSpec.constructionChecks=[{
    id:"SYNTHETIC-UNKNOWN",severity:"critical" as "info",message:"Escalate to the tailor.",
  }];
  const locked=await lockGarmentSpec(malicious.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  await assert.rejects(
    buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z"),
    /Unsafe tailor handoff construction checks/,
  );
});

test("fabric identity and internal material coverage cannot silently claim a ready handoff",async()=>{
  const make=()=>createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const base=make();
  assert.deepEqual(auditHandoffFabricIdentity(base.garmentSpec.fabrics),{errors:[],missing:[]});
  const original=buildProductionHandoff(base);
  assert.equal(original.status,"ready_for_tailor_review");

  for(const garment of ["shirt","trouser"] as const) {
    for(const field of ["id","name"] as const) {
      for(const value of [null,0,"  ",undefined]) {
        const revision=make();
        (revision.garmentSpec.fabrics[garment] as unknown as Record<string,unknown>)[field]=value;
        assert.ok(auditHandoffFabricIdentity(revision.garmentSpec.fabrics).errors.length);
        assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff fabric identity/);
        const stale=structuredClone(original);
        (stale.fabrics[garment] as unknown as Record<string,unknown>)[field]=value;
        assert.throws(()=>buildTailorTechPackHtml(stale),/Unsafe tailor tech pack fabric identity/);
      }
    }
    for(const field of ["line","source"] as const){
      const revision=make();
      (revision.garmentSpec.fabrics[garment] as unknown as Record<string,unknown>)[field]="";
      const packet=buildProductionHandoff(revision);
      assert.equal(packet.status,"review_required");
      assert.ok(packet.unresolved.some(note=>note.includes(`${garment}: fabric ${field} is not recorded`)));
      const html=buildTailorTechPackHtml(packet);
      assert.match(html,/fabric (?:line|source) is not recorded/);
      assert.match(html,/NO CUTTING AUTHORISATION/);
      const stale=structuredClone(original);
      (stale.fabrics[garment] as unknown as Record<string,unknown>)[field]="";
      assert.match(buildTailorTechPackHtml(stale),/review required/);
    }
    for(const facts of [null,-1,9,3.2,NaN,"8"]) {
      const revision=make();
      (revision.garmentSpec.fabrics[garment] as unknown as Record<string,unknown>)
        .verifiedMaterialFacts=facts;
      assert.throws(()=>buildProductionHandoff(revision),/Unsafe tailor handoff fabric identity/);
    }
  }

  const incomplete=make();
  incomplete.garmentSpec.fabrics.shirt.verifiedMaterialFacts=7;
  incomplete.garmentSpec.readiness.materialVerification="verified"; // stale assertion
  const packet=buildProductionHandoff(incomplete);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(note=>note.includes("only 7 of 8 expected facts")));
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/only 7 of 8 expected facts/);
  const lock=await lockGarmentSpec(incomplete.garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const verified=await buildVerifiedProductionHandoff(lock,"2026-11-05T11:01:00.000Z");
  assert.equal(verified.status,"review_required");
  assert.equal(await verifyProductionHandoff(verified,lock),true);
  assert.match(await buildVerifiedTailorTechPackHtml(verified,lock),/only 7 of 8 expected facts/);
});

test("source tailoring and material readiness must use recognised states",async()=>{
  const complete=()=>createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const baseline=complete();
  assert.deepEqual(auditHandoffProductionReadiness(baseline.garmentSpec.readiness),
    {errors:[],missing:[]});
  assert.equal(buildProductionHandoff(baseline).status,"ready_for_tailor_review");

  const insufficient=complete();
  insufficient.garmentSpec.readiness.tailoring="insufficient_measurements";
  const incompletePacket=buildProductionHandoff(insufficient);
  assert.equal(incompletePacket.status,"review_required");
  assert.ok(incompletePacket.unresolved.some(n=>n.includes("insufficient measurements")));
  assert.match(buildTailorTechPackHtml(incompletePacket),/insufficient measurements/);

  const materialPending=complete();
  materialPending.garmentSpec.readiness.materialVerification="verification_required";
  const pendingPacket=buildProductionHandoff(materialPending);
  assert.equal(pendingPacket.status,"review_required");
  assert.ok(pendingPacket.unresolved.some(n=>n.includes("material source requires verification")));
  assert.match(buildTailorTechPackHtml(pendingPacket),/material source requires verification/);

  const missingFields=complete();
  missingFields.garmentSpec.readiness.tailoring=undefined as unknown as "tailor_review_required";
  missingFields.garmentSpec.readiness.materialVerification=undefined as unknown as "verified";
  const historical=buildProductionHandoff(missingFields);
  assert.equal(historical.status,"review_required");
  assert.ok(historical.unresolved.some(n=>n.includes("tailoring readiness is not recorded")));
  assert.ok(historical.unresolved.some(n=>n.includes("material verification readiness is not recorded")));

  const missingAll=complete();
  missingAll.garmentSpec.readiness=null as unknown as typeof missingAll.garmentSpec.readiness;
  const missingPacket=buildProductionHandoff(missingAll);
  assert.equal(missingPacket.status,"review_required");
  assert.ok(missingPacket.unresolved.some(n=>n.includes("tailoring and material readiness states are not recorded")));

  const malformed=complete();
  malformed.garmentSpec.readiness="ready" as unknown as typeof malformed.garmentSpec.readiness;
  assert.throws(()=>buildProductionHandoff(malformed),/Unsafe tailor handoff readiness/);

  for(const field of ["tailoring","materialVerification"] as const){
    const forged=complete();
    (forged.garmentSpec.readiness as unknown as Record<string,unknown>)[field]="made-up-approved";
    assert.throws(()=>buildProductionHandoff(forged),/Unsafe tailor handoff readiness/);
  }

  const locked=await lockGarmentSpec(materialPending.garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  assert.equal(verified.status,"review_required");
  assert.match(await buildVerifiedTailorTechPackHtml(verified,locked),
    /material source requires verification/);
});

test("locked visualization readiness cannot falsely elevate tailor review status",async()=>{
  const build=()=>createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  const baseline=buildProductionHandoff(build());
  assert.equal(baseline.status,"ready_for_tailor_review");
  assert.deepEqual(baseline.unresolved,[]);

  const needsReview=build();
  needsReview.garmentSpec.status="ready_for_tailor_review"; // deliberately stale
  needsReview.garmentSpec.readiness.visualization="visual_review_required";
  const packet=buildProductionHandoff(needsReview);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(note=>note.includes("requires visual review")
    && note.includes("exact selected garment construction")));
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/Locked design still requires visual review/);
  assert.match(html,/NO CUTTING AUTHORISATION/);

  // Historically incomplete readiness is reconstructable, never ready.
  const missing=build();
  (missing.garmentSpec.readiness as {visualization?:string}).visualization=undefined;
  const older=buildProductionHandoff(missing);
  assert.equal(older.status,"review_required");
  assert.ok(older.unresolved.some(note=>note.includes("visualization readiness is not recorded")));

  const invalid=build();
  invalid.garmentSpec.readiness.visualization="fabricated_visual_state" as "visual_review_required";
  assert.throws(()=>buildProductionHandoff(invalid),/Unsafe tailor handoff visualization readiness/);

  const locked=await lockGarmentSpec(needsReview.garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  assert.equal(verified.status,"review_required");
  const verifiedHtml=await buildVerifiedTailorTechPackHtml(verified,locked);
  assert.match(verifiedHtml,/Locked design still requires visual review/);
  assert.match(verifiedHtml,/NO CUTTING AUTHORISATION/);
});

test("malformed creative treatments and craft panels fail closed before printable export",async()=>{
  const make=()=>{
    const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
    revision.garmentSpec.creative={
      conceptId:"SYNTHETIC-PRINT-REVIEW",
      name:"Synthetic creative garment",
      thesis:"Synthetic layout only; no measured proof",
      explorationClass:"balanced",iteration:1,researchUtilization:0,
      treatments:[{
        id:"SYNTHETIC-TREATMENT",zone:"cuff",label:"Pattern test",
        instruction:"Sample the decorative cuff finish.",
        visualPurpose:"Sample visual contrast",intensity:10,buildability:"atelier",
      }],
      pattern:null,research:[],
      visualReview:{
        status:"pass",heroVisibility:0,boundaryIntegrity:0,protectedChange:0,
        evidenceAvailable:true,semanticAvailable:true,semanticStatus:"pass",
      },
      craft:{
        version:"synthetic-proposed-sample",checks:[],panels:[{
          zone:"cuff",fabric:{id:"SYNTHETIC-LOT",name:"Synthetic fabric",source:"test only"},
        }],decoration:null,
      },
    } as unknown as NonNullable<typeof revision.garmentSpec.creative>;
    return revision;
  };
  const normal=make();
  const packet=buildProductionHandoff(normal);
  assert.equal(packet.status,"review_required");
  assert.ok(packet.unresolved.some(s=>s.includes("independent pattern-maker")));
  const html=buildTailorTechPackHtml(packet);
  assert.match(html,/Synthetic creative garment/);
  assert.match(html,/Sample the decorative cuff finish/);
  assert.match(html,/SYNTHETIC-LOT/);
  assert.match(html,/NO CUTTING AUTHORISATION/);

  const invalid:(readonly [string,(c:Record<string,unknown>)=>void])[]=[
    ["no treatments",(c)=>{c.treatments=null;}],
    ["scalar treatments",(c)=>{c.treatments="not an array";}],
    ["null treatment",(c)=>{c.treatments=[null];}],
    ["incomplete treatment",(c)=>{c.treatments=[{zone:"cuff"}];}],
    ["no craft panels",(c)=>{(c.craft as Record<string,unknown>).panels=null;}],
    ["null craft panel",(c)=>{(c.craft as Record<string,unknown>).panels=[null];}],
    ["missing craft fabric",(c)=>{(c.craft as Record<string,unknown>).panels=[{zone:"cuff",fabric:null}];}],
    ["missing fabric source",(c)=>{(c.craft as Record<string,unknown>).panels=[{zone:"cuff",fabric:{id:"x",name:"Sample"}}];}],
    ["missing craft version",(c)=>{(c.craft as Record<string,unknown>).version=null;}],
    ["missing name",(c)=>{c.name=null;}],
    ["missing thesis",(c)=>{c.thesis=0;}],
  ];
  for(const [label,corrupt] of invalid){
    const source=make();
    corrupt(source.garmentSpec.creative as unknown as Record<string,unknown>);
    assert.ok(auditHandoffCreativeReview(source.garmentSpec.creative).errors.length,label);
    assert.throws(()=>buildProductionHandoff(source),/Unsafe tailor handoff creative review/,label);

    const altered=structuredClone(packet);
    corrupt(altered.construction.creative as unknown as Record<string,unknown>);
    assert.throws(()=>buildTailorTechPackHtml(altered),/Unsafe tailor tech pack creative review/,label);
  }

  const locked=await lockGarmentSpec(normal.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  const trusted=await buildVerifiedTailorTechPackHtml(verified,locked);
  assert.match(trusted,/SYNTHETIC-LOT/);
  assert.match(trusted,/NO CUTTING AUTHORISATION/);

  const malformedSource=make();
  if(!malformedSource.garmentSpec.creative?.craft) throw Error("Missing synthetic craft");
  malformedSource.garmentSpec.creative.craft.panels=null as unknown as typeof malformedSource.garmentSpec.creative.craft.panels;
  const badLock=await lockGarmentSpec(malformedSource.garmentSpec,{lockedAt:"2026-11-05T11:00:00.000Z"});
  await assert.rejects(
    buildVerifiedProductionHandoff(badLock,"2026-11-05T11:01:00.000Z"),
    /Unsafe tailor handoff creative review/,
  );
});

test("creative visual QA and physical craft decisions cannot bypass tailor handoff review",async()=>{
  const make=(reviewStatus:"pass"|"review"|null, evidence=true, semantic:"pass"|"review"="pass")=>{
    const revision=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
    revision.garmentSpec.creative={
      conceptId:"SYNTHETIC-CREATIVE-REVIEW",
      name:"Synthetic creative review only",
      thesis:"No real garment or photographic evidence",
      explorationClass:"balanced",
      iteration:1,
      researchUtilization:0,
      treatments:[],
      pattern:null,
      research:[],
      visualReview:reviewStatus===null?null:{
        status:reviewStatus,heroVisibility:0,boundaryIntegrity:0,
        protectedChange:0,evidenceAvailable:evidence,
        semanticAvailable:true,semanticStatus:semantic,
      },
    } as NonNullable<typeof revision.garmentSpec.creative>;
    return revision;
  };
  const noCreative=createRevision([chest,shoulder,sleeve],[waist,seat,inseam,outseam]);
  assert.deepEqual(auditHandoffCreativeReview(noCreative.garmentSpec.creative),{errors:[],missing:[]});
  assert.equal(buildProductionHandoff(noCreative).status,"ready_for_tailor_review");

  const internallyCoherent=make("pass");
  // The "pass" fields are synthetic assertions in the recipe, not a
  // physical fitting certificate or independent photo provenance.
  assert.deepEqual(auditHandoffCreativeReview(internallyCoherent.garmentSpec.creative),{errors:[],missing:[]});
  assert.equal(buildProductionHandoff(internallyCoherent).status,"ready_for_tailor_review");

  for(const variant of [
    make(null),make("review"),make("pass",false),make("pass",true,"review"),
  ]) {
    variant.garmentSpec.unresolved=[]; // simulate missing upstream warnings
    const result=buildProductionHandoff(variant);
    assert.equal(result.status,"review_required");
    assert.ok(result.unresolved.some(item=>item.includes("Creative")));
    const html=buildTailorTechPackHtml(result);
    assert.match(html,/Unresolved before production/);
    assert.match(html,/Creative/);
    assert.match(html,/NO CUTTING AUTHORISATION/);
  }

  const craft=make("pass");
  if(!craft.garmentSpec.creative) throw Error("Missing synthetic concept");
  craft.garmentSpec.creative.craft={
    version:"synthetic-craft-not-approved",checks:[],panels:[],decoration:{},
  } as unknown as NonNullable<typeof craft.garmentSpec.creative.craft>;
  const craftPacket=buildProductionHandoff(craft);
  assert.equal(craftPacket.status,"review_required");
  assert.ok(craftPacket.unresolved.some(item=>item.includes("independent pattern-maker")));
  assert.match(buildTailorTechPackHtml(craftPacket),/independent pattern-maker/);

  const tampered=buildProductionHandoff(make("pass"));
  if(!tampered.construction.creative) throw Error("Missing printed creative");
  tampered.construction.creative.visualReview=null;
  assert.match(buildTailorTechPackHtml(tampered),/no recorded passing visual review/);
  assert.match(buildTailorTechPackHtml(tampered),/review required/);

  const invalid=make("pass");
  if(!invalid.garmentSpec.creative) throw Error("Missing invalid concept");
  invalid.garmentSpec.creative.visualReview={
    status:"fabricated" as "pass",heroVisibility:0,boundaryIntegrity:0,
    protectedChange:0,evidenceAvailable:true,semanticAvailable:true,semanticStatus:"pass",
  };
  assert.throws(()=>buildProductionHandoff(invalid),/Unsafe tailor handoff creative review/);

  const signed=make(null);
  const locked=await lockGarmentSpec(signed.garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  assert.equal(verified.status,"review_required");
  const verifiedHtml=await buildVerifiedTailorTechPackHtml(verified,locked);
  assert.match(verifiedHtml,/no recorded passing visual review/);
  assert.match(verifiedHtml,/NO CUTTING AUTHORISATION/);
});

test("open construction findings are explicit unresolved instructions in every tech-pack path",async()=>{
  const shirt=[chest,shoulder,sleeve];
  const trouser=[waist,seat,inseam,outseam];
  const info=createRevision(shirt,trouser);
  info.garmentSpec.constructionChecks=[{
    id:"SYNTHETIC-FIT-INFO",severity:"info",
    message:"No outstanding work for the synthetic test.",
  }];
  const infoPacket=buildProductionHandoff(info);
  assert.equal(infoPacket.status,"ready_for_tailor_review");
  assert.deepEqual(infoPacket.unresolved,[]);

  for (const severity of ["review","warning"] as const) {
    const revision=createRevision(shirt,trouser);
    revision.garmentSpec.constructionChecks=[{
      id:"SYNTHETIC-REVIEW-GATE",severity,
      message:"Confirm armhole and shoulder block with the tailor.",
    }];
    // Simulate missing upstream unresolved list even when a blocking check
    // remains in the exact locked recipe.
    revision.garmentSpec.unresolved=[];
    const packet=buildProductionHandoff(revision);
    assert.equal(packet.status,"review_required",severity);
    assert.ok(packet.unresolved.some(x=>x.includes("SYNTHETIC-REVIEW-GATE")
      && x.includes("Confirm armhole and shoulder block")),severity);
    const html=buildTailorTechPackHtml(packet);
    assert.match(html,/Unresolved before production/);
    assert.match(html,/Construction check SYNTHETIC-REVIEW-GATE/);
    assert.match(html,/NO CUTTING AUTHORISATION/);
  }

  const stale=structuredClone(infoPacket);
  stale.construction.checks=[{
    id:"STALE-CHECK",severity:"warning",
    message:"Review trouser balance before production.",
  }];
  const staleHtml=buildTailorTechPackHtml(stale);
  assert.match(staleHtml,/Construction check STALE-CHECK/);
  assert.match(staleHtml,/Review trouser balance before production/);
  assert.match(staleHtml,/review required/);

  const forgedSource=createRevision(shirt,trouser);
  forgedSource.garmentSpec.constructionChecks=[{
    id:"SIGNED-REVIEW",severity:"review",
    message:"Confirm the physical sleeve pitch at fitting.",
  }];
  const locked=await lockGarmentSpec(forgedSource.garmentSpec,{
    lockedAt:"2026-11-05T11:00:00.000Z",
  });
  const verified=await buildVerifiedProductionHandoff(locked,"2026-11-05T11:01:00.000Z");
  assert.equal(await verifyProductionHandoff(verified,locked),true);
  assert.equal(verified.status,"review_required");
  assert.ok(verified.unresolved.some(x=>x.includes("SIGNED-REVIEW")));
  const verifiedHtml=await buildVerifiedTailorTechPackHtml(verified,locked);
  assert.match(verifiedHtml,/Construction check SIGNED-REVIEW/);
  assert.match(verifiedHtml,/NO CUTTING AUTHORISATION/);
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
