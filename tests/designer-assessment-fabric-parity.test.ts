import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DesignerFabric } from "../src/lib/designer/engine.ts";
import type { DesignerAssessmentResponse } from "../src/lib/designer/assessment-types.ts";
import { assessmentMatchesSelectedFabricRevisions } from "../src/lib/designer/assessment-fabric-parity.ts";

const shirt={id:"shirt-a",image:"/fabrics/blue.webp",source:"operator",
  confirmedAvailableMetres:12,weightGsm:180} as DesignerFabric;
const pant={id:"pant-a",image:"/fabrics/beige.webp",source:"operator",
  confirmedAvailableMetres:14,weightGsm:220} as DesignerFabric;
const response=(a:DesignerFabric,b:DesignerFabric)=>({
  recommendation:{shirt:a,pant:b},
}) as unknown as Pick<DesignerAssessmentResponse,"recommendation">;

test("same catalogue evidence survives async assessment even with fresh object instances",()=>{
  assert.equal(assessmentMatchesSelectedFabricRevisions(response({...shirt},{...pant}),shirt,pant),true);
});

test("same-ID stock, photo and physical calibration revisions revoke stale server assessments",()=>{
  const changed=[
    response({...shirt,image:"/fabrics/revised.webp"},pant),
    response({...shirt,confirmedAvailableMetres:3},pant),
    response({...shirt,weightGsm:200},pant),
    response(shirt,{...pant,source:"supplier-revised"}),
    response(shirt,{...pant,physicsProfile:{version:"linen-earth-fabric-physics-v1",fabricId:"pant-a",
      gsm:{value:220,evidence:"reviewed"}}} as DesignerFabric),
  ];
  for(const revision of changed)assert.equal(
    assessmentMatchesSelectedFabricRevisions(revision,shirt,pant),false);
});

test("missing or corrupt fabric revision receipts cannot match by ID alone",()=>{
  assert.equal(assessmentMatchesSelectedFabricRevisions(null,shirt,pant),false);
  assert.equal(assessmentMatchesSelectedFabricRevisions(response(shirt,pant),null,pant),false);
  assert.equal(assessmentMatchesSelectedFabricRevisions(response(shirt,pant),shirt,null),false);
  assert.equal(assessmentMatchesSelectedFabricRevisions(response({...shirt,id:""},pant),shirt,pant),false);
  assert.equal(assessmentMatchesSelectedFabricRevisions(response({...shirt,weightGsm:NaN},pant),shirt,pant),false);
});

test("live Designer checks the server fabric receipt before applying assessment state",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  const request=source.slice(source.indexOf("async function requestLookAssessment"),source.indexOf("function applyServerAssessment"));
  assert.match(request,/assessmentMatchesSelectedFabricRevisions\(data\.assessment,selectedShirt,selectedPant\)/);
  assert.match(request,/Fabric evidence changed during assessment/);
  assert.ok(request.indexOf("assessmentMatchesSelectedFabricRevisions")<request.indexOf("return data.assessment"));
});
