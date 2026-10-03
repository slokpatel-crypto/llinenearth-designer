import test from "node:test";
import assert from "node:assert/strict";
import { buildProductionHandoff } from "../src/lib/designer/production-handoff.ts";
import type { LockedDesignRevision } from "../src/lib/designer/design-lock.ts";

const revision={
  version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261001090000-ABCDEF123456",
  parentRevisionId:null,
  recipeHash:"a".repeat(64),
  lockedAt:"2026-10-01T09:00:00.000Z",
  garmentSpec:{
    version:"linen-earth-garment-spec-v1",
    status:"draft",
    source:{designerRuleSetVersion:"v",fitConstructionVersion:null,fitEaseSource:null,fitEaseTableVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:null},
    styleSpec:null,bodyProfile:null,
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{
      shirt:{id:"s1",name:"Sky Blue",line:"Linen Plain",source:"catalogue",verifiedMaterialFacts:1},
      trouser:{id:"p1",name:"Beige",line:"Linen Suiting",source:"catalogue",verifiedMaterialFacts:1},
    },
    shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",cuff:"Barrel",placket:"Standard",button:"Corozo",finishedTargets:[]},
    trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break",finishedTargets:[]},
    creative:null,
    decision:{designFitScore:80,confidenceScore:70,fitConstructionScore:null,brandLanguageScore:null,blockStrategyScore:null},
    blockStrategy:null,
    constructionChecks:[],
    unresolved:["Verify cloth"],
    readiness:{visualization:"supported_with_current_template",tailoring:"insufficient_measurements",materialVerification:"verification_required"},
    caveats:["Tailor review required"],
  },
} satisfies LockedDesignRevision;

test("production handoff traces the immutable locked revision",()=>{
  const handoff=buildProductionHandoff(revision,"2026-10-01T10:00:00.000Z");
  assert.equal(handoff.designRevisionId,revision.revisionId);
  assert.equal(handoff.recipeHash,revision.recipeHash);
  assert.equal(handoff.fabrics.shirt.id,"s1");
  assert.equal(handoff.status,"review_required");
});

test("production handoff never invents cloth metres, stock or price",()=>{
  const handoff=buildProductionHandoff(revision,"2026-10-01T10:00:00.000Z");
  assert.equal(handoff.production.clothEstimate.shirtMetres,null);
  assert.equal(handoff.production.clothEstimate.trouserMetres,null);
  assert.equal(handoff.production.stockReservation.status,"not_requested");
  assert.equal(handoff.production.quote.amount,null);
});
