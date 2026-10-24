import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validStoredSavedDesigns} from "../src/lib/saved-design-storage-integrity.ts";

const valid={
  id:"SD-customer-1",title:"Tailored shirt",savedAt:"2026-10-24T12:00:00.000Z",
  brief:{
    context:{occasion:"Business",venue:"Office",time:"Day",environment:"Mild",
      formality:"Formal",impression:"Classic",fit:"Regular",aesthetic:"Minimal"},
    fabric:{profile:{palette:["#ffffff"],observations:[{label:"Dominant color",value:"White",confidence:1}]}}
  },
  version:{
    id:"DV-001",specHash:"LE-B68FCA",candidate:{
      aesthetic:"Modern Classic",concept:"Understated tailoring",
      garments:{shirt:"Dress shirt",trouser:"Pleated",layer:"None",footwear:"Loafers"},
      palette:["#ffffff"]
    }
  },
  renderSet:{
    modelId:"LE-MODEL-M01",renders:[{view:"front",src:"data:image/svg+xml,test"}],
    spec:{fabric:{material:"Linen"}}
  }
};

test("browser saved-design storage returns only complete renderable handoff-safe designs",()=>{
  const stored=[
    null,false,{}, {...valid,id:""}, {...valid,version:null},
    {...valid,brief:{context:null}},
    {...valid,version:{...valid.version,candidate:{...valid.version.candidate,garments:null}}},
    {...valid,version:{...valid.version,candidate:{...valid.version.candidate,palette:{"0":"red"}}}},
    {...valid,brief:{...valid.brief,fabric:{profile:{observations:null,palette:[]}}}},
    {...valid,renderSet:{...valid.renderSet,renders:[null]}},
    {...valid,renderSet:{...valid.renderSet,spec:{fabric:null}}},
    valid
  ];
  const oldState=JSON.stringify(stored);
  assert.deepEqual(validStoredSavedDesigns(stored),[valid]);
  assert.equal(JSON.stringify(stored),oldState);
  assert.deepEqual(validStoredSavedDesigns(null),[]);
  assert.deepEqual(validStoredSavedDesigns({id:"SD"}),[]);
});

test("valid legacy designs with absent optional hash survive unchanged in stored order",()=>{
  const legacy={...valid,id:"SD-legacy",version:{...valid.version,specHash:undefined}};
  const other={...valid,id:"SD-next"};
  assert.deepEqual(validStoredSavedDesigns([legacy,other]),[legacy,other]);
});

test("old oversized browser arrays obey existing 24 card limit",()=>{
  const many=Array.from({length:28},(_,i)=>({...valid,id:`SD-${i}`}));
  assert.deepEqual(validStoredSavedDesigns(many).map((x)=>x.id),many.slice(0,24).map((x)=>x.id));
});

test("saved-design writer and reader both use validated local storage",()=>{
  const source=readFileSync("src/lib/saved-designs.ts","utf8");
  assert.match(source,/validStoredSavedDesigns<SavedDesign>\(parsed\)/);
  assert.match(source,/const existing = listSavedDesigns\(\)/);
  assert.doesNotMatch(source,/return Array\.isArray\(parsed\) \? parsed : \[\]/);
});
