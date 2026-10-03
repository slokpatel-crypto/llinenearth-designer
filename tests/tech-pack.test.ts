import test from "node:test";
import assert from "node:assert/strict";
import { buildTailorTechPackHtml, techPackFilename } from "../src/lib/designer/tech-pack.ts";
import type { ProductionHandoff } from "../src/lib/designer/production-handoff.ts";

const handoff:ProductionHandoff={
  version:"linen-earth-production-handoff-v1",
  designRevisionId:"LE-LOCK-20261001-ABCDEF123456",
  recipeHash:"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  generatedAt:"2026-10-01T09:40:00.000Z",
  status:"review_required",
  fabrics:{
    shirt:{id:"shirt-1",name:"Sky <Blue>",line:"Linen Plain 60 Lea",source:"catalogue"},
    trouser:{id:"pant-1",name:"Beige",line:"Linen Suiting",source:"catalogue"},
  },
  construction:{
    fitProvenance:{fitConstructionVersion:null,easeSource:null,easeTableVersion:null},
    shirt:{
      fit:"Regular / Classic Fit",
      wear:"Tucked",
      collar:"Spread Collar",
      collarFinish:"Self-fabric",
      cuff:"Barrel Cuff (2-button)",
      placket:"Standard (visible stitch)",
      button:"Mother-of-Pearl",
      finishedTargets:[{
        label:"Finished shirt chest",bodyCm:100,easeCm:{min:10,max:14},
        finishedCm:{min:110,max:114},basis:"body_plus_ease",
      }],
    },
    trouser:{
      shape:"Pleated Trouser",
      rise:"Mid Rise",
      waistband:"Side-Adjuster Tabs",
      break:"Slight Break",
      finishedTargets:[],
    },
    blockStrategy:null,
    checks:[{id:"FIT-DATA",severity:"review",message:"Tailor review required."}],
  },
  production:{
    clothEstimate:{shirtMetres:null,trouserMetres:null,basis:"tailor_required",note:"Do not guess meterage."},
    stockReservation:{status:"not_requested",reservationId:null},
    quote:{status:"pending",amount:null,currency:null},
  },
  unresolved:["Confirm physical cloth."],
  caveats:["This is not a cutting pattern."],
};

test("tech pack keeps unverified production values blank instead of inventing numbers",()=>{
  const html=buildTailorTechPackHtml(handoff);
  assert.match(html,/TAILOR REQUIRED/);
  assert.match(html,/PENDING/);
  assert.doesNotMatch(html,/shirt metres<\/th><td>\d/);
});

test("tech pack includes exact revision traceability and finished targets",()=>{
  const html=buildTailorTechPackHtml(handoff);
  assert.match(html,/LE-LOCK-20261001-ABCDEF123456/);
  assert.match(html,/110\.0–114\.0 cm/);
  assert.match(html,/ABCDEF1234567890/);
});

test("tech pack escapes catalogue strings before embedding HTML",()=>{
  const html=buildTailorTechPackHtml(handoff);
  assert.match(html,/Sky &lt;Blue&gt;/);
  assert.doesNotMatch(html,/Sky <Blue>/);
});

test("tech pack filename is deterministic",()=>{
  assert.equal(techPackFilename(handoff),"linen-earth-tech-pack-le-lock-20261001-abcdef123456.html");
});
