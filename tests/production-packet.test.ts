import test from "node:test";
import assert from "node:assert/strict";
import { buildProductionPacket } from "../src/lib/designer/production-packet.ts";
import type { LockedDesignRevision } from "../src/lib/designer/design-lock.ts";

const revision={
  version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261001-PACKET000001",
  parentRevisionId:null,
  recipeHash:"a".repeat(64),
  lockedAt:"2026-10-01T10:00:00.000Z",
  garmentSpec:{
    version:"linen-earth-garment-spec-v1",
    status:"ready_for_tailor_review",
    source:{designerRuleSetVersion:"v",fitConstructionVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:null},
    styleSpec:null,
    bodyProfile:null,
    context:{occasion:"Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{
      shirt:{id:"shirt-1",name:"White Linen",line:"Linen Plain",source:"catalogue",verifiedMaterialFacts:1},
      trouser:{id:"pant-1",name:"Navy Linen",line:"Linen Suiting",source:"catalogue",verifiedMaterialFacts:1},
    },
    shirt:{fit:"Regular",wear:"Tucked",collar:"Spread Collar",collarFinish:"Self-fabric",cuff:"Barrel",placket:"Standard",button:"MOP",finishedTargets:[]},
    trouser:{shape:"Flat Front",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break",finishedTargets:[]},
    creative:null,
    decision:{designFitScore:80,confidenceScore:75,fitConstructionScore:null,brandLanguageScore:null,blockStrategyScore:null},
    blockStrategy:null,
    constructionChecks:[],
    unresolved:[],
    readiness:{visualization:"supported_with_current_template",tailoring:"tailor_review_required",materialVerification:"verification_required"},
    caveats:[],
  },
} satisfies LockedDesignRevision;

test("production packet preserves exact locked recipe traceability",()=>{
  const packet=buildProductionPacket({
    revision,
    quote:{quoteId:"q1",currency:"INR",total:5000,status:"accepted",createdAt:"2026-10-01T10:01:00.000Z"},
    order:{orderId:"o1",status:"cutting",createdAt:"2026-10-01T10:02:00.000Z"},
  });
  assert.equal(packet.revisionId,revision.revisionId);
  assert.equal(packet.recipeHash,revision.recipeHash);
  assert.equal(packet.handoff.designRevisionId,revision.revisionId);
  assert.equal(packet.traceability.packetBuiltFromLockedRevision,true);
  assert.equal(packet.traceability.noDesignDataReEntry,false);
  assert.equal(packet.traceability.deliveryAuditRequired,true);
  assert.match(packet.traceability.note,/verified separately after real delivery/i);
  assert.equal(packet.traceability.quoteAccepted,true);
});

test("production packet does not invent missing quote or order records",()=>{
  const packet=buildProductionPacket({revision});
  assert.equal(packet.quote,null);
  assert.equal(packet.order,null);
  assert.equal(packet.traceability.quoteAttached,false);
  assert.equal(packet.traceability.orderAttached,false);
});
