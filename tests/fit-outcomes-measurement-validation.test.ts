import test from "node:test";
import assert from "node:assert/strict";
import {fitOutcomeProportionFromMeasurements} from "../src/lib/designer/fit-outcomes.ts";

test("finite in-range centimetre readings populate the intended tailoring learning buckets",()=>{
  assert.deepEqual(
    fitOutcomeProportionFromMeasurements({
      shirt:{chest:105,waist:84},pants:{seat:111,waist:82},
    }),
    {torso:"tapered",seat:"pronounced"},
  );
  assert.deepEqual(fitOutcomeProportionFromMeasurements(null),{torso:"unknown",seat:"unknown"});
});

test("impossible readings never masquerade as real torso or seat proportions",()=>{
  for(const invalid of [Infinity,-Infinity,NaN,-2,0,351,"96",true]){
    assert.equal(
      fitOutcomeProportionFromMeasurements({
        shirt:{chest:invalid as number,waist:83},pants:{seat:invalid as number,waist:79},
      }).torso,"unknown",
    );
    assert.equal(
      fitOutcomeProportionFromMeasurements({
        shirt:{chest:101,waist:invalid as number},pants:{seat:106,waist:invalid as number},
      }).seat,"unknown",
    );
  }
});

test("an invalid garment dimension does not contaminate an independently valid bucket",()=>{
  assert.deepEqual(
    fitOutcomeProportionFromMeasurements({
      shirt:{chest:Infinity,waist:80},
      pants:{waist:82,seat:109},
    }),
    {torso:"unknown",seat:"pronounced"},
  );
});

import {aggregateFitOutcomes,fitOutcomeSignalFor,parseFitOutcome} from "../src/lib/designer/fit-outcomes.ts";

test("unmeasured or corrupt profiles cannot improve a measured customer's fit-learning signal",()=>{
  const event=(id:string,torso:string,seat:string,verdict:string)=>({
    type:"operator_note",source:"operator",payload:{subtype:"designer_fit_outcome",
      recommendationId:id,verdict,occasion:"Formal",shirtFit:"regular",trouser:"straight",torso,seat,areas:[]},
  });
  const book=aggregateFitOutcomes([
    ...Array.from({length:6},(_,i)=>event(`unknown-${i}`,"unknown","unknown","clean_first_fit")),
    event("known-1","straight","balanced","major_alteration"),
    event("known-2","straight","balanced","major_alteration"),
  ]);
  const known=fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"pronounced"}},book);
  assert.equal(known.evidence,2);
  assert.equal(known.score,0);
  const unknown=fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"unknown",seat:"unknown"}},book);
  assert.equal(unknown.evidence,6);
  assert.ok(unknown.score>0);
});

test("unknown seat data cannot boost a customer with a measured seat proportion",()=>{
  const book=aggregateFitOutcomes(Array.from({length:5},(_,i)=>({
    type:"operator_note",source:"operator",payload:{subtype:"designer_fit_outcome",
      recommendationId:`unknown-seat-${i}`,verdict:"clean_first_fit",occasion:"Formal",
      shirtFit:"regular",trouser:"straight",torso:"tapered",seat:"unknown",areas:[]},
  })));
  const signal=fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"straight",seat:"balanced"}},book);
  assert.equal(signal.score,0);
  assert.equal(signal.evidence,0);
});

test("seat-waist readings already requiring tailor review never become confident learning labels",()=>{
  const otherwiseValid={shirt:{chest:102,waist:84},pants:{waist:82,seat:157}};
  assert.deepEqual(fitOutcomeProportionFromMeasurements(otherwiseValid),
    {torso:"tapered",seat:"pronounced"});
  const contradictory={...otherwiseValid,pants:{waist:82,seat:157.01}};
  assert.deepEqual(fitOutcomeProportionFromMeasurements(contradictory),
    {torso:"tapered",seat:"unknown"});
  assert.deepEqual(fitOutcomeProportionFromMeasurements({
    shirt:{chest:103,waist:87},pants:{waist:160,seat:84.99},
  }),{torso:"balanced",seat:"unknown"});
});

test("learning cutoff and human measurement-consistency review share one threshold",async()=>{
  const {SEAT_WAIST_REVIEW_DELTA_CM,reviewMeasurementConsistency}=await import(
    "../src/lib/designer/measurement-consistency.ts");
  assert.equal(SEAT_WAIST_REVIEW_DELTA_CM,75);
  const profile={version:1 as const,unit:"cm" as const,
    shirt:{chest:105,waist:85},pants:{waist:80,seat:155.001},updatedAt:"2026-10-18"};
  assert(reviewMeasurementConsistency(profile).some((issue)=>issue.id==="MEASURE-SEAT-WAIST"));
  assert.equal(fitOutcomeProportionFromMeasurements(profile).seat,"unknown");
  const within={...profile,pants:{waist:80,seat:155}};
  assert(!reviewMeasurementConsistency(within).some((issue)=>issue.id==="MEASURE-SEAT-WAIST"));
  assert.equal(fitOutcomeProportionFromMeasurements(within).seat,"pronounced");
});

test("corrupt persisted fitting counters and mismatched recommendation keys cannot fabricate confidence",()=>{
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const key=["Formal","regular","straight","tapered","balanced"].join("::");
  const book={
    version:"designer-fit-outcomes-v1" as const,totalReviews:6,usableBuckets:1,
    buckets:[{key,occasion:"Formal" as const,shirtFit:"regular",trouser:"straight",
      torso:"tapered",seat:"balanced",clean:6,minor:0,major:0,total:6}],
  };
  assert.ok(fitOutcomeSignalFor(input,book).score>0);
  for(const forged of [
    {...book,buckets:[{...book.buckets[0],total:5}]},
    {...book,buckets:[{...book.buckets[0],clean:Infinity}]},
    {...book,buckets:[{...book.buckets[0],major:-2}]},
    {...book,buckets:[{...book.buckets[0],clean:"6" as unknown as number}]},
    {...book,buckets:[{...book.buckets[0],key:key+"-forged"}]},
    {...book,buckets:[{...book.buckets[0],total:7,clean:7}]},
  ]){
    const signal=fitOutcomeSignalFor(input,forged);
    assert.equal(signal.score,0,"Invalid persisted data must not generate a tailoring bonus");
    assert.equal(signal.evidence,0);
  }
  assert.equal(fitOutcomeSignalFor(input,{...book,totalReviews:NaN}).score,0);
  assert.equal(fitOutcomeSignalFor(input,{...book,buckets:null as unknown as typeof book.buckets}).score,0);
});

test("individually plausible but globally duplicated fitting groups cannot double-count reviews",()=>{
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const first={key:"Formal::regular::straight::tapered::balanced",
    occasion:"Formal" as const,shirtFit:"regular",trouser:"straight",
    torso:"tapered",seat:"balanced",clean:3,minor:0,major:0,total:3};
  const second={...first,key:"Formal::regular::straight::balanced::balanced",torso:"balanced"};
  const book={version:"designer-fit-outcomes-v1" as const,totalReviews:5,
    usableBuckets:2,buckets:[first,second]};
  const incomplete=fitOutcomeSignalFor(input,{...book,buckets:[first],totalReviews:5,usableBuckets:1});
  assert.equal(incomplete.score,0);
  assert.equal(incomplete.evidence,0);
  assert.match(incomplete.summary,/revalidation/i);
  const overcounted=fitOutcomeSignalFor(input,book);
  assert.equal(overcounted.score,0);
  assert.equal(overcounted.evidence,0);
  assert.match(overcounted.summary,/revalidation/i);

  const doubled=fitOutcomeSignalFor(input,{...book,totalReviews:6,buckets:[first,{...first}]});
  assert.equal(doubled.score,0);
  assert.equal(doubled.evidence,0);
  assert.match(doubled.summary,/revalidation/i);
});

test("legitimate distinct fitting groups may use fewer than total recorded reviews",()=>{
  const book=aggregateFitOutcomes([
    ...Array.from({length:4},(_,i)=>({type:"operator_note",source:"operator",
      payload:{subtype:"designer_fit_outcome",recommendationId:`tailor-${i}`,
        verdict:"clean_first_fit",occasion:"Formal",shirtFit:"regular",trouser:"straight",
        torso:"tapered",seat:"balanced",areas:[]}})),
    {type:"operator_note",source:"operator",payload:{subtype:"designer_fit_outcome",
      recommendationId:"other",verdict:"major_alteration",occasion:"Casual",
      shirtFit:"slim",trouser:"wide",torso:"straight",seat:"balanced",areas:[]}},
  ]);
  const signal=fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}},book);
  assert.equal(signal.evidence,4);
  assert.ok(signal.score>0);
});

test("fit evidence is fail-closed when any stored bucket or aggregate summary is inconsistent",()=>{
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const first={key:"Formal::regular::straight::tapered::balanced",
    occasion:"Formal" as const,shirtFit:"regular",trouser:"straight",
    torso:"tapered",seat:"balanced",clean:3,minor:0,major:0,total:3};
  const other={...first,key:"Casual::regular::straight::straight::balanced",
    occasion:"Casual" as const,torso:"straight",total:1,clean:1};
  const book={version:"designer-fit-outcomes-v1" as const,totalReviews:4,
    usableBuckets:1,buckets:[first,other]};
  assert.equal(fitOutcomeSignalFor(input,book).evidence,3);
  const badBooks=[
    {...book,buckets:[first,{...other,clean:Infinity}]},
    {...book,buckets:[first,{...other,key:"mismatched-key"}]},
    {...book,buckets:[first,null as unknown as typeof first]},
    {...book,usableBuckets:2},
    {...book,usableBuckets:-1},
    {...book,version:"unknown-version" as typeof book.version},
  ];
  for(const corrupt of badBooks){
    const signal=fitOutcomeSignalFor(input,corrupt);
    assert.equal(signal.score,0,"Cannot recommend tailoring from a partially corrupt book");
    assert.equal(signal.evidence,0,"Cannot cite unverified aggregate evidence");
  }
});


test("operator fitting events must have genuine bounded strings, never JSON-to-string coercion",()=>{
  const event={type:"operator_note",source:"operator",payload:{
    subtype:"designer_fit_outcome",recommendationId:"fitting-01",
    verdict:"clean_first_fit",occasion:"Formal",shirtFit:"regular",
    trouser:"straight",torso:"tapered",seat:"balanced",areas:[],
  }};
  assert.equal(parseFitOutcome(event)?.recommendationId,"fitting-01");
  for(const field of ["subtype","recommendationId","verdict","occasion","shirtFit","trouser","torso","seat"] as const){
    const value=event.payload[field];
    assert.equal(parseFitOutcome({...event,payload:{...event.payload,[field]:[value]}}),null,
      `${field}: a JSON array must not coerce into a valid operator review`);
  }
  assert.equal(parseFitOutcome({...event,payload:{...event.payload,recommendationId:1234}}),null);
  assert.equal(parseFitOutcome({...event,payload:{...event.payload,recommendationId:"x".repeat(161)}}),null);
  assert.equal(parseFitOutcome({...event,payload:{...event.payload,shirtFit:"x".repeat(121)}}),null);
  assert.equal(parseFitOutcome({...event,payload:{...event.payload,shirtFit:"regular::wide"}}),null);
  assert.equal(parseFitOutcome({...event,payload:{...event.payload,trouser:"straight::tapered"}}),null);
});

test("sparse stored books cannot claim review evidence until all metadata passes integrity checks",()=>{
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const first={key:"Formal::regular::straight::tapered::balanced",
    occasion:"Formal" as const,shirtFit:"regular",trouser:"straight",
    torso:"tapered",seat:"balanced",clean:2,minor:0,major:0,total:2};
  const book={version:"designer-fit-outcomes-v1" as const,totalReviews:2,
    usableBuckets:0,buckets:[first]};
  const valid=fitOutcomeSignalFor(input,book);
  assert.equal(valid.score,0);
  assert.equal(valid.evidence,2);
  for(const corrupt of [
    {...book,buckets:[{...first,clean:5}]},
    {...book,buckets:[{...first,key:"corrupted"}]},
    {...book,buckets:[{...first,shirtFit:"reg::ular",
      key:"Formal::reg::ular::straight::tapered::balanced"}]},
    {...book,buckets:[first,{...first}]},
    {...book,usableBuckets:1},
  ]){
    const signal=fitOutcomeSignalFor(input,corrupt);
    assert.equal(signal.score,0);
    assert.equal(signal.evidence,0,"unverified sparse counts are not evidence");
    assert.match(signal.summary,/revalidation/i);
  }
});


test("corrupt operator event shapes cannot crash fitting aggregation or forge scored reviews",()=>{
  const valid={type:"operator_note",source:"operator",payload:{
    subtype:"designer_fit_outcome",recommendationId:"valid-01",
    verdict:"clean_first_fit",occasion:"Formal",shirtFit:"regular",
    trouser:"straight",torso:"tapered",seat:"balanced",
  }};
  const corrupt=[
    null,undefined,42,"operator_note",[],{...valid,payload:null},
    {...valid,payload:[]},{...valid,payload:"designer_fit_outcome"},
    {...valid,payload:{...valid.payload,areas:"shirt_sleeve"}},
    {...valid,payload:{...valid.payload,areas:["shirt_sleeve","shirt_sleeve"]}},
    {...valid,payload:{...valid.payload,areas:["shirt_sleeve","not_a_fit_area"]}},
    {...valid,payload:{...valid.payload,areas:Array(11).fill("shirt_sleeve")}},
    {...valid,payload:{...valid.payload,areas:[["shirt_sleeve"]]}},
  ];
  for(const event of corrupt){
    assert.equal(parseFitOutcome(event as never),null,
      "Malformed JSON event and area data must not be silently corrected into a review");
  }
  assert.deepEqual(parseFitOutcome(valid)?.areas,[]);
  assert.deepEqual(parseFitOutcome({...valid,payload:{...valid.payload,
    areas:["shirt_sleeve","trouser_length"]}})?.areas,["shirt_sleeve","trouser_length"]);
  const onlyValid=aggregateFitOutcomes([...corrupt,valid] as never[]);
  assert.equal(onlyValid.totalReviews,1);
});

test("oversized persisted tailoring style strings fail aggregate integrity preflight",()=>{
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const good={key:"Formal::regular::straight::tapered::balanced",
    occasion:"Formal" as const,shirtFit:"regular",trouser:"straight",
    torso:"tapered",seat:"balanced",clean:3,minor:0,major:0,total:3};
  const book={version:"designer-fit-outcomes-v1" as const,totalReviews:6,
    usableBuckets:2,buckets:[good,{
      ...good,shirtFit:"x".repeat(121),key:"Formal::"+"x".repeat(121)+"::straight::tapered::balanced",
    }]};
  const signal=fitOutcomeSignalFor(input,book);
  assert.equal(signal.score,0);
  assert.equal(signal.evidence,0);
  assert.match(signal.summary,/revalidation/i);
});

test("separator-injected candidate cannot impersonate a real reviewed cut-family bucket",()=>{
  const bucket={key:"Formal::regular::straight::tapered::balanced",
    occasion:"Formal" as const,shirtFit:"regular",trouser:"straight",
    torso:"tapered",seat:"balanced",clean:3,minor:0,major:0,total:3};
  const book={version:"designer-fit-outcomes-v1" as const,totalReviews:3,
    usableBuckets:1,buckets:[bucket]};
  const genuine={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  assert.equal(fitOutcomeSignalFor(genuine,book).evidence,3);
  const forged={occasion:"Formal" as const,
    style:{shirtFit:"regular::straight",trouser:"tapered"},
    proportion:{torso:"balanced",seat:""}};
  // Two different malformed candidates serialize to the same ambiguous
  // key. Neither must be considered a validated style or body-proportion.
  const alternate={occasion:"Formal" as const,
    style:{shirtFit:"regular",trouser:"straight::tapered"},
    proportion:{torso:"balanced",seat:""}};
  assert.equal(["Formal",forged.style.shirtFit,forged.style.trouser,
    forged.proportion.torso,forged.proportion.seat].join("::"),
    ["Formal",alternate.style.shirtFit,alternate.style.trouser,
      alternate.proportion.torso,alternate.proportion.seat].join("::"));
  for(const malformed of [
    forged,alternate,
    {...genuine,style:{...genuine.style,shirtFit:" regular"}},
    {...genuine,style:{...genuine.style,trouser:"straight "}},
    {...genuine,style:{...genuine.style,trouser:"x".repeat(121)}},
    {...genuine,proportion:{...genuine.proportion,seat:"invented"}},
    null,
  ]){
    const signal=fitOutcomeSignalFor(malformed as Parameters<typeof fitOutcomeSignalFor>[0],book);
    assert.equal(signal.score,0);
    assert.equal(signal.evidence,0);
    assert.match(signal.summary,/revalidation/i);
  }
});

test("canonical operator IDs and style labels cannot be merged by whitespace normalization",()=>{
  const event={type:"operator_note",source:"operator",payload:{
    subtype:"designer_fit_outcome",recommendationId:"fitting-01",
    verdict:"clean_first_fit",occasion:"Formal",shirtFit:"regular",
    trouser:"straight",torso:"tapered",seat:"balanced",areas:[],
  }};
  assert.ok(parseFitOutcome(event));
  for(const field of ["recommendationId","shirtFit","trouser"] as const){
    for(const changed of [" "+event.payload[field],event.payload[field]+" "]){
      assert.equal(parseFitOutcome({...event,payload:{...event.payload,[field]:changed}}),null,
        `${field} must retain canonical identity; silent trimming aliases records`);
    }
  }
  const valid=Array.from({length:3},(_,i)=>({...event,
    payload:{...event.payload,recommendationId:`fitting-${i}`}}));
  const invalid={...event,payload:{...event.payload,recommendationId:" fitting-0 "}};
  const book=aggregateFitOutcomes([...valid,invalid]);
  assert.equal(book.totalReviews,3);
  assert.equal(fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}},book).evidence,3);
});

test("noncanonical stored bucket labels fail entire fitting-book integrity check",()=>{
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const good={key:"Formal::regular::straight::tapered::balanced",
    occasion:"Formal" as const,shirtFit:"regular",trouser:"straight",
    torso:"tapered",seat:"balanced",clean:3,minor:0,major:0,total:3};
  for(const field of ["shirtFit","trouser"] as const){
    for(const changed of [" "+good[field],good[field]+" "]){
      const corrupted={...good,[field]:changed};
      const book={version:"designer-fit-outcomes-v1" as const,totalReviews:6,
        usableBuckets:2,buckets:[good,{...corrupted,
          key:[corrupted.occasion,corrupted.shirtFit,corrupted.trouser,
            corrupted.torso,corrupted.seat].join("::")}]};
      const result=fitOutcomeSignalFor(input,book);
      assert.equal(result.score,0);
      assert.equal(result.evidence,0);
      assert.match(result.summary,/revalidation/i);
    }
  }
});

test("persisted first-fit summaries reconcile every reviewed outcome, not only favorable buckets",()=>{
  const event=(id:string,verdict:string,occasion:string)=>({
    type:"operator_note",source:"operator",payload:{
      subtype:"designer_fit_outcome",recommendationId:id,verdict,occasion,
      shirtFit:"regular",trouser:"straight",torso:"tapered",seat:"balanced",areas:[],
    },
  });
  const book=aggregateFitOutcomes([
    ...Array.from({length:3},(_,i)=>event(`clean-${i}`,"clean_first_fit","Formal")),
    event("different-occasion","major_alteration","Casual"),
  ]);
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  assert.equal(book.totalReviews,4);
  assert.equal(book.buckets.reduce((sum,b)=>sum+b.total,0),4);
  assert.equal(fitOutcomeSignalFor(input,book).evidence,3);
  for(const incomplete of [
    {...book,buckets:book.buckets.filter(b=>b.occasion==="Formal")},
    {...book,totalReviews:5},
    {...book,totalReviews:3},
    {...book,buckets:[] as typeof book.buckets,usableBuckets:0},
  ]){
    const result=fitOutcomeSignalFor(input,incomplete);
    assert.equal(result.score,0,"Incomplete or contradictory totals cannot recommend a cut");
    assert.equal(result.evidence,0,"Unrepresented fittings cannot count as validated evidence");
    assert.match(result.summary,/revalidation/i);
  }
});

test("a sparse book with phantom review metadata cannot cite nonexistent fitting evidence",()=>{
  const input={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const event={type:"operator_note",source:"operator",payload:{
    subtype:"designer_fit_outcome",recommendationId:"single-01",
    verdict:"clean_first_fit",occasion:"Formal",shirtFit:"regular",
    trouser:"straight",torso:"tapered",seat:"balanced",areas:[],
  }};
  const real=aggregateFitOutcomes([event]);
  assert.equal(fitOutcomeSignalFor(input,real).evidence,1);
  const phantom={...real,totalReviews:2};
  const result=fitOutcomeSignalFor(input,phantom);
  assert.equal(result.score,0);
  assert.equal(result.evidence,0);
  assert.match(result.summary,/revalidation/i);
});

test("corrupted saved measurement sections warn instead of crashing or silently passing",async()=>{
  const {reviewMeasurementConsistency}=await import("../src/lib/designer/measurement-consistency.ts");
  assert.deepEqual(reviewMeasurementConsistency(null),[]);
  for(const input of [
    42,[],{}, {shirt:null,pants:{}},{shirt:{},pants:null},
    {shirt:[],pants:{}},{shirt:{},pants:[]},
  ]){
    const issues=reviewMeasurementConsistency(input as never);
    assert.equal(issues.length,1);
    assert.equal(issues[0].id,"MEASURE-INVALID");
    assert.equal(issues[0].severity,"warning");
  }
});

test("only finite centimetre numbers generate comparative garment-measurement claims",async()=>{
  const {reviewMeasurementConsistency}=await import("../src/lib/designer/measurement-consistency.ts");
  const baseline={version:1 as const,unit:"cm" as const,updatedAt:"2026-10-19",
    shirt:{chest:105,neck:41,waist:85},
    pants:{waist:81,seat:107,inseam:77,outseam:104,frontRise:30},
  };
  assert.deepEqual(reviewMeasurementConsistency(baseline),[]);
  const numericContradiction={...baseline,shirt:{...baseline.shirt,neck:106},
    pants:{...baseline.pants,inseam:106,frontRise:105,seat:160}};
  const ids=reviewMeasurementConsistency(numericContradiction).map(issue=>issue.id);
  for(const id of ["MEASURE-NECK-CHEST","MEASURE-SEAM-ORDER","MEASURE-RISE-ORDER","MEASURE-SEAT-WAIST"])
    assert(ids.includes(id));
  const corrupted={...baseline,
    shirt:{...baseline.shirt,neck:"106" as unknown as number},
    pants:{...baseline.pants,inseam:"106" as unknown as number,
      frontRise:"105" as unknown as number,seat:"160" as unknown as number},
  };
  const issues=reviewMeasurementConsistency(corrupted);
  assert(issues.some(issue=>issue.id==="MEASURE-INVALID"));
  for(const id of ["MEASURE-NECK-CHEST","MEASURE-SEAM-ORDER","MEASURE-RISE-ORDER","MEASURE-SEAT-WAIST"])
    assert(!issues.some(issue=>issue.id===id),
      `${id} cannot be inferred by coercing corrupted centimetre strings`);
});

test("malformed replacement of an existing fitting cannot resurrect a favorable old review",()=>{
  const makeReview=(id:string)=>({type:"operator_note",source:"operator",payload:{
    subtype:"designer_fit_outcome",recommendationId:id,
    verdict:"clean_first_fit",occasion:"Formal",shirtFit:"regular",
    trouser:"straight",torso:"tapered",seat:"balanced",areas:[],
  }});
  const initial=[makeReview("cut-01"),makeReview("cut-02"),makeReview("cut-03")];
  const query={occasion:"Formal" as const,style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"balanced"}};
  const before=aggregateFitOutcomes(initial);
  assert.equal(before.totalReviews,3);
  assert.ok(fitOutcomeSignalFor(query,before).score>0);
  const rejectedEdit={...makeReview("cut-01"),payload:{
    ...makeReview("cut-01").payload,areas:["invalid_new_fit_area"],
  }};
  assert.equal(parseFitOutcome(rejectedEdit),null);
  const revoked=aggregateFitOutcomes([...initial,rejectedEdit]);
  assert.equal(revoked.totalReviews,2,"last operator write for the same ID must supersede the earlier fitting");
  assert.equal(fitOutcomeSignalFor(query,revoked).score,0);
  // Older operator logs normalize their subtype labels. An invalid edit in
  // that legacy shape still supersedes the earlier favorable evidence.
  const legacyEdit={...rejectedEdit,payload:{...rejectedEdit.payload,
    subtype:" designer_fit_outcome "}};
  assert.equal(parseFitOutcome(legacyEdit),null);
  const legacyRevoked=aggregateFitOutcomes([...initial,legacyEdit]);
  assert.equal(legacyRevoked.totalReviews,2);
  assert.equal(fitOutcomeSignalFor(query,legacyRevoked).score,0);
  const restored=aggregateFitOutcomes([...initial,rejectedEdit,makeReview("cut-01")]);
  assert.equal(restored.totalReviews,3);
  assert.ok(fitOutcomeSignalFor(query,restored).score>0);
});

test("unrelated and unidentifiable invalid events cannot erase other fitting reviews",()=>{
  const genuine={type:"operator_note",source:"operator",payload:{
    subtype:"designer_fit_outcome",recommendationId:"cut-01",
    verdict:"clean_first_fit",occasion:"Formal",shirtFit:"regular",
    trouser:"straight",torso:"tapered",seat:"balanced",areas:[],
  }};
  const unrelated={...genuine,payload:{...genuine.payload,
    subtype:"not_a_fitting_review",areas:["unrecognized"]}};
  const ambiguousId={...genuine,payload:{...genuine.payload,
    recommendationId:" cut-01 ",areas:["unrecognized"]}};
  const nonOperator={...genuine,source:"customer",
    payload:{...genuine.payload,areas:["unrecognized"]}};
  const book=aggregateFitOutcomes([genuine,unrelated,ambiguousId,nonOperator]);
  assert.equal(book.totalReviews,1);
  assert.equal(book.buckets[0].clean,1);
});
