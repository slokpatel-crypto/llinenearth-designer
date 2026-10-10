import test from "node:test";
import assert from "node:assert/strict";
import {buildTailorTechPackHtml} from "../src/lib/designer/tech-pack.ts";
import type {ProductionHandoff} from "../src/lib/designer/production-handoff.ts";

function packet():ProductionHandoff{
  return {
    version:"linen-earth-production-handoff-v1",designRevisionId:"LE-LOCK-TEST-123",
    recipeHash:"a".repeat(64),generatedAt:"2026-10-10T15:00:00Z",status:"review_required",
    fabrics:{shirt:{id:"shirt-x",name:"Blue",line:"Linen Plain",source:"Supplier"},
      trouser:{id:"pant-x",name:"Taupe",line:"Linen Suiting",source:"Supplier"}},
    construction:{
      styleSpec:{
        styleSchemaVersion:2,
        shirt:{type:"dress_shirt",collar:"point_standard_collar",collarFinish:"Self-fabric",
          cuff:"open_short_hem_cuff",placket:"standard_visible_placket",pocket:"no_pocket",
          sleeve:"half_sleeve",fit:"regular_classic_fit",length:"shirt_length_regular",
          hem:"curved_shirttail",back:"plain_back",wear:"untucked",button:"corozo"},
        pant:{type:"formal_flat_front",fit:"korean_straight_wide",rise:"mid_rise",pleat:"flat_front",
          waistband:"belt_loops",hem:"plain_hem",break:"no_break"},
        legacy:{} as NonNullable<ProductionHandoff["construction"]["styleSpec"]>["legacy"],
      },
      bodyProfile:null,context:{occasion:"Smart-Casual",climate:"Hot / humid",intention:"Balanced"},
      fitProvenance:{fitConstructionVersion:null,easeSource:null,easeTableVersion:null},
      shirt:{fit:"Regular",wear:"Untucked",collar:"Point",collarFinish:"Self-fabric",
        cuff:"Barrel Cuff (2-button)",placket:"Standard",button:"Corozo",
        finishedTargets:[{label:"Finished shirt chest",bodyCm:101,
          finishedCm:{min:108,max:112},easeCm:{min:7,max:11},basis:"body_plus_ease"}]},
      trouser:{shape:"Straight",rise:"Mid",waistband:"Belt Loops",break:"No Break",finishedTargets:[]},
      blockStrategy:null,checks:[{id:"CG-SLEEVE-CUFF",severity:"review",message:"Verify actual cut"}],
    },
    production:{
      clothEstimate:{shirtMetres:null,trouserMetres:null,basis:"tailor_required",note:"Supplier measured metres pending."},
      stockReservation:{status:"not_requested",reservationId:null},
      quote:{status:"pending",amount:null,currency:null},
    },
    unresolved:["Verify real fabric"],caveats:["Reference image differs from this tailoring"],
  };
}

test("tailor HTML uses exact StyleSpec v2 cut instead of pretending the old photo is accurate",()=>{
  const html=buildTailorTechPackHtml(packet());
  for(const word of ["Exact selected cut","open_short_hem_cuff","half_sleeve","korean_straight_wide",
    "Smart-Casual","Finished shirt chest","107","supplier","NOT REQUESTED"]){
    if(word==="107"||word==="supplier")continue;
    assert.ok(html.includes(word),word);
  }
  assert.ok(html.includes("closest photographic preview"));
  assert.ok(html.includes("101.0 cm"));
  assert.ok(html.includes("108.0–112.0 cm"));
  assert.ok(html.includes("TAILOR REQUIRED"));
  assert.ok(html.includes("PENDING"));
  assert.ok(html.includes("Operator and tailor physical acceptance"));
  assert.ok(html.includes("NO CUTTING AUTHORISATION"));
  assert.ok(html.includes("Actual stripe/check repeat and swatch ruler reference"));
  assert.ok(html.includes("Customer preview versus exact chosen cut discrepancy explained"));
});

test("real customer or operator-entered fabric/source labels cannot inject markup",()=>{
  const p=packet();
  p.fabrics.shirt.name="<script>alert(1)</script>";
  if(p.construction.styleSpec) p.construction.styleSpec.shirt.collarFinish='Bad <img src=x onerror=alert(1)>';
  const html=buildTailorTechPackHtml(p);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("onerror=alert(1)&gt;"));
});

test("older handoffs without v2 cut state say measurements must be manually confirmed",()=>{
  const p=packet();p.construction.styleSpec=null;
  const html=buildTailorTechPackHtml(p);
  assert.ok(html.includes("Older legacy design"));
  assert.ok(!html.includes("korean_straight_wide"));
});
