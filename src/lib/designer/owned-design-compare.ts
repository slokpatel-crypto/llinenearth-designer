import type { LockedDesignRevision } from "./design-lock.ts";
import { optionById } from "./options/library.ts";
import { validateStyleSpecV2 } from "./style-spec-v2.ts";

export type SavedDesignDifference={
  key:string;
  label:string;
  previous:string;
  selected:string;
};

export type SavedDesignComparison={
  previousRevisionId:string;
  selectedRevisionId:string;
  relationship:"direct-child"|"reverse-child"|"same-revision"|"unrelated";
  constructionCoverage:"exact-v2"|"legacy-only";
  differences:SavedDesignDifference[];
};

function bounded(value:unknown):string {
  if(typeof value!=="string") return "Not recorded";
  const clean=value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060\u2066-\u2069\ufeff]/g," ")
    .replace(/\s+/g," ").trim();
  return Array.from(clean).slice(0,90).join("")||"Not recorded";
}

function validRevision(r:LockedDesignRevision):boolean {
  if(!r||r.version!=="linen-earth-design-lock-v1"||
     r.garmentSpec?.version!=="linen-earth-garment-spec-v1"||
     typeof r.revisionId!=="string"||!r.revisionId||
     typeof r.recipeHash!=="string"||!r.recipeHash) return false;
  const v2=r.garmentSpec.styleSpec;
  return v2===null||v2===undefined||validateStyleSpecV2(v2);
}

function identityLabel(id:unknown,name:unknown):string {
  // The stored ID controls comparison; saved names are only display labels.
  return bounded(name)+" · ID "+bounded(id);
}

function showChoice(id:string) {
  const option=optionById(id);
  return option?bounded(option.label):bounded(id);
}

/**
 * Deterministic, read-only difference between two already owner-loaded,
 * independently SHA-256-verified revisions. Callers must NOT use this as a
 * proof of inventory, measurement accuracy, physical fit or tailoring.
 * Never projects measurements, body profile, creative notes or production data.
 */
export function compareOwnedLockedDesigns(
  previous:LockedDesignRevision,
  selected:LockedDesignRevision,
):SavedDesignComparison {
  if(!validRevision(previous)||!validRevision(selected))
    throw new Error("Unsupported saved revision; comparison was not prepared.");
  if(previous.revisionId===selected.revisionId && previous.recipeHash!==selected.recipeHash)
    throw new Error("Conflicting saved revision identities.");

  const a=previous.garmentSpec,b=selected.garmentSpec;
  const differences:SavedDesignDifference[]=[];
  const push=(key:string,label:string,left:unknown,right:unknown,format:(v:string)=>string=bounded)=>{
    if(left===right) return;
    differences.push({key,label,previous:format(String(left??"")),selected:format(String(right??""))});
  };
  const fabric=(key:string,label:string,left:typeof a.fabrics.shirt,right:typeof b.fabrics.shirt)=>{
    if(left.id===right.id) return;
    differences.push({key,label,previous:identityLabel(left.id,left.name),selected:identityLabel(right.id,right.name)});
  };
  fabric("shirt.fabric","Shirt fabric",a.fabrics.shirt,b.fabrics.shirt);
  fabric("pant.fabric","Trouser fabric",a.fabrics.trouser,b.fabrics.trouser);
  push("occasion","Occasion",a.context.occasion,b.context.occasion);
  push("climate","Climate preference",a.context.climate,b.context.climate);
  push("intention","Styling intention",a.context.intention,b.context.intention);

  const av=a.styleSpec,bv=b.styleSpec;
  const bothV2=Boolean(av&&bv);
  if(bothV2 && av && bv){
    for(const [group,fields] of [
      ["shirt",[
        ["type","Shirt type"],["collar","Shirt collar"],["collarFinish","Collar finish"],
        ["cuff","Shirt cuff"],["placket","Shirt placket"],["pocket","Shirt pocket"],
        ["sleeve","Sleeve"],["fit","Shirt fit"],["length","Shirt length"],
        ["hem","Shirt hem"],["back","Shirt back"],["wear","Shirt wear"],["button","Buttons"],
      ]],
      ["pant",[
        ["type","Trouser type"],["fit","Trouser fit"],["rise","Trouser rise"],
        ["pleat","Trouser pleats"],["waistband","Waistband"],["hem","Trouser hem"],
        ["break","Trouser break"],
      ]],
    ] as const){
      for(const [key,label] of fields){
        const left=av[group][key],right=bv[group][key];
        push(group+"."+key,label,left,right,key==="collarFinish"||key==="wear"?bounded:showChoice);
      }
    }
  }else{
    // Older locked recipes have no advanced StyleSpec. Compare only choices
    // actually recorded in both specifications, not invented default cuts.
    for(const [key,label] of [
      ["fit","Shirt fit"],["wear","Shirt wear"],["collar","Shirt collar"],
      ["collarFinish","Collar finish"],["cuff","Shirt cuff"],["placket","Shirt placket"],
      ["button","Buttons"],
    ] as const) push("shirt."+key,label,a.shirt[key],b.shirt[key]);
    for(const [key,label] of [
      ["shape","Trouser shape"],["rise","Trouser rise"],
      ["waistband","Waistband"],["break","Trouser break"],
    ] as const) push("pant."+key,label,a.trouser[key],b.trouser[key]);
  }

  const relationship=previous.revisionId===selected.revisionId
    ?"same-revision"
    :selected.parentRevisionId===previous.revisionId
      ?"direct-child"
      :previous.parentRevisionId===selected.revisionId
        ?"reverse-child"
        :"unrelated";
  return {
    previousRevisionId:previous.revisionId,
    selectedRevisionId:selected.revisionId,
    relationship,
    constructionCoverage:bothV2?"exact-v2":"legacy-only",
    differences,
  };
}
