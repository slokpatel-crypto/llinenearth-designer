import test from "node:test";
import assert from "node:assert/strict";
import {buildProductionLearningContext} from "../src/lib/designer/production-learning-context.ts";

test("production learning context preserves garment choices without body or measurement data",()=>{
  const revision:any={
    revisionId:"LE-LOCK-20261001-ABCDEF123456",
    recipeHash:"a".repeat(64),
    garmentSpec:{
      source:{designerRuleSetVersion:"rules-v1",fitConstructionVersion:"fit-v1",styleSchemaVersion:2},
      context:{occasion:"Formal",climate:"warm",intention:"sharp"},
      fabrics:{shirt:{id:"S1"},trouser:{id:"T1"}},
      shirt:{fit:"Tailored",wear:"Tucked",collar:"Spread",collarFinish:"Clean",cuff:"Barrel",placket:"French",button:"Pearl",finishedTargets:[{bodyCm:100}]},
      trouser:{shape:"Straight",rise:"Mid",waistband:"Extended",break:"No break",finishedTargets:[{bodyCm:84}]},
      bodyProfile:{heightCm:178},
      blockStrategy:{torsoShape:"tapered",seatShape:"balanced"},
      creative:null,
    },
  };
  const context=buildProductionLearningContext(revision);
  assert.equal(context.revisionId,revision.revisionId);
  assert.equal(context.shirt.collar,"Spread");
  assert.equal(context.trouser.shape,"Straight");
  assert.equal(JSON.stringify(context).includes("bodyCm"),false);
  assert.equal(JSON.stringify(context).includes("heightCm"),false);
  assert.equal("bodyProfile" in (context as any),false);
  assert.equal("blockStrategy" in (context as any),false);
});
