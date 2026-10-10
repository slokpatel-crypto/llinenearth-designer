import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  DESIGNER_PANTS,DESIGNER_SHIRTS,type DesignerFabric,
} from "../src/lib/designer/engine.ts";
import {
  SHIRT_FABRIC_FAMILIES,TROUSER_FABRIC_TONES,
  discoverFabrics,fabricEvidence,fabricFamily,
  fabricFilterCounts,fabricMatchesSearch,
} from "../src/lib/designer/fabric-discovery.ts";

test("Deep Engine searches all actual catalogue shirt/trouser swatches without making up stock",()=>{
  const shirts=discoverFabrics(DESIGNER_SHIRTS,"shirt","All");
  const pants=discoverFabrics(DESIGNER_PANTS,"trouser","All");
  assert.equal(shirts.length,DESIGNER_SHIRTS.length);
  assert.equal(pants.length,DESIGNER_PANTS.length);
  assert.ok(shirts.length>=30,"real shirting catalogue remains searchable");
  assert.ok(pants.length>=10,"real suiting catalogue remains searchable");
  assert.equal(new Set(shirts.map(item=>item.id)).size,shirts.length);
  assert.equal(new Set(pants.map(item=>item.id)).size,pants.length);
  assert.ok(shirts.every(item=>item.allowedGarments.includes("shirt")));
  assert.ok(pants.every(item=>item.allowedGarments.includes("pant")));
});

test("all shirt collection chips represent real catalogue lines with no overlaps",()=>{
  const counts=fabricFilterCounts(DESIGNER_SHIRTS,"shirt");
  const exact=SHIRT_FABRIC_FAMILIES.filter(item=>item!=="All");
  assert.equal(counts.All,DESIGNER_SHIRTS.length);
  assert.equal(exact.reduce((sum,kind)=>sum+counts[kind],0),counts.All);
  for(const family of exact){
    const matches=discoverFabrics(DESIGNER_SHIRTS,"shirt",family);
    assert.equal(matches.length,counts[family]);
    assert.ok(matches.every(item=>fabricFamily(item)===family));
  }
  const formal=DESIGNER_SHIRTS.find(item=>item.line.toLowerCase().includes("formal shirting"));
  const blend=DESIGNER_SHIRTS.find(item=>item.line.toLowerCase().includes("blend"));
  const printed=DESIGNER_SHIRTS.find(item=>item.line.toLowerCase().includes("linen print"));
  assert.ok(formal&&blend&&printed);
  assert.equal(fabricFamily(formal),"Formal");
  assert.equal(fabricFamily(blend),"Blend");
  assert.equal(fabricFamily(printed),"Print");
});

test("multiword fabric search uses actual metadata, accents and catalogue provenance",()=>{
  const sky=DESIGNER_SHIRTS.find(item=>item.id==="linen-plain-60-sky-blue");
  assert.ok(sky);
  assert.equal(fabricMatchesSearch(sky," SKY   blue "),true);
  assert.equal(fabricMatchesSearch(sky,"60 lea sky"),true);
  assert.equal(fabricMatchesSearch(sky,"linen plain"),true);
  assert.equal(fabricMatchesSearch(sky,"no such sku"),false);
  assert.equal(fabricMatchesSearch(sky,""),true);
  assert.ok(discoverFabrics(DESIGNER_SHIRTS,"shirt","Plain","SKY blue")
    .some(item=>item.id===sky.id));
  assert.equal(discoverFabrics(DESIGNER_SHIRTS,"shirt","Print","SKY blue").length,0);
  assert.deepEqual(discoverFabrics(DESIGNER_SHIRTS,"trouser","All"),[],
    "the garment filter never advertises a shirting swatch as pants");
});

test("trouser tone chips never invent a missing colour classification",()=>{
  const counts=fabricFilterCounts(DESIGNER_PANTS,"trouser");
  assert.equal(counts.All,DESIGNER_PANTS.length);
  for(const tone of TROUSER_FABRIC_TONES.filter(item=>item!=="All")){
    const matched=discoverFabrics(DESIGNER_PANTS,"trouser",tone);
    assert.equal(matched.length,counts[tone]);
    assert.ok(matched.every(item=>item.tone===tone));
  }
  const unclassified={...DESIGNER_PANTS[0],tone:null} as DesignerFabric;
  assert.deepEqual(discoverFabrics([unclassified],"trouser","Medium"),[],
    "unknown tone must not silently default to medium");
  assert.equal(discoverFabrics([unclassified],"trouser","All").length,1);
});

test("stock and fabric measurements remain unverified until real evidence exists",()=>{
  const sky=DESIGNER_SHIRTS.find(item=>item.id==="linen-plain-60-sky-blue");
  assert.ok(sky);
  const truth=fabricEvidence(sky);
  assert.equal(truth.stock,"Confirm stock");
  assert.equal(truth.scale,"Scale not measured");
  assert.equal(truth.colour,"Colour is a screen estimate");
  assert.equal(truth.weight,"Weight not measured");
  const verified=fabricEvidence({
    ...sky,availabilityVerified:true,patternScaleVerified:true,
    colorVerified:true,weightGsm:145,
  });
  assert.equal(verified.stock,"Stock checked");
  assert.equal(verified.scale,"Pattern scale measured");
  assert.equal(verified.colour,"Colour checked");
  assert.equal(verified.weight,"145 GSM (catalogue)");
});

test("filters and text search never change a locked outfit implicitly",()=>{
  const component=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.ok(component.includes('const [shirtSearch,setShirtSearch]=useState("")'));
  assert.ok(component.includes('const [pantSearch,setPantSearch]=useState("")'));
  assert.ok(component.includes('type="search" value={shirtSearch}'));
  assert.ok(component.includes('type="search" value={pantSearch}'));
  assert.ok(component.includes("visibleShirts.slice(0,FIRST_FABRIC_CHOICES)"));
  assert.ok(component.includes("visiblePants.slice(0,FIRST_FABRIC_CHOICES)"));
  for(const garment of ["shirt","trouser"]){
    const first=component.indexOf(`aria-label="Filter ${garment} fabrics"`);
    assert.ok(first>=0);
    const section=component.slice(first,component.indexOf("</div>",first));
    assert.ok(!section.includes("setShirtId("));
    assert.ok(!section.includes("setPantId("));
    assert.ok(!section.includes("setRecommendation(null)"),
      "filter chips should not discard a user's already assessed recipe");
  }
  assert.ok(component.includes("selectedShirtOutsideFilter&&shirt"));
  assert.ok(component.includes("selectedPantOutsideFilter&&pant"));
  assert.ok(component.includes("Your selected shirt cloth stays unchanged"));
  assert.ok(component.includes("Your selected trouser cloth stays unchanged"));
  assert.ok(component.includes("role=\"status\""));
  assert.ok(component.includes("fabricEvidence(shirt)"));
  assert.ok(component.includes("fabricEvidence(pant)"));
});
