import styleVariants from "./garment-viewer-style-variants.json";

type VariantId={id:string};

function ids(items:ReadonlyArray<VariantId>){return items.map((item)=>item.id);}

export function requiredGarmentViewerStyleMaterials(){
  const shirtFits=ids(styleVariants.shirtFits);
  const sleeves=ids(styleVariants.sleeves);
  const collars=ids(styleVariants.collars);
  const collarConstruction=ids(styleVariants.collarConstruction);
  const cuffs=ids(styleVariants.cuffs);
  const cuffConstruction=ids(styleVariants.cuffConstruction);
  const plackets=ids(styleVariants.plackets);
  const pockets=ids(styleVariants.pockets);
  const yokes=ids(styleVariants.yokes);
  const shirtBacks=ids(styleVariants.shirtBacks);
  const shirtHems=ids(styleVariants.shirtHems);
  const trouserFits=ids(styleVariants.trouserFits);
  const rises=ids(styleVariants.rises);
  const pleats=ids(styleVariants.pleats);
  const waistbands=ids(styleVariants.waistbands);
  const breaks=ids(styleVariants.breaks);
  const trouserHems=ids(styleVariants.trouserHems);
  const trouserPockets=ids(styleVariants.trouserPockets);

  const names:string[]=[];

  for(const fit of shirtFits.filter((id)=>id!=="regular")){
    names.push(`ShirtTorsoVariant__${fit}`,`ShirtSleeveLVariant__${fit}`,`ShirtSleeveRVariant__${fit}`);
  }
  for(const fit of shirtFits){
    for(const sleeve of sleeves.filter((id)=>id!=="full")){
      names.push(`ShirtSleeveLLength__${fit}__${sleeve}`,`ShirtSleeveRLength__${fit}__${sleeve}`);
    }
    names.push(`ShirtRollBandVariant__${fit}`,`ShirtHemVariant__${fit}`);
    for(const back of shirtBacks.filter((id)=>id!=="plain")) names.push(`ShirtTorsoBackVariant__${fit}__${back}`);
    for(const rise of rises){
      names.push(`ShirtTorsoTuckedVariant__${fit}__${rise}`);
      for(const back of shirtBacks.filter((id)=>id!=="plain")) names.push(`ShirtTorsoTuckedBackVariant__${fit}__${rise}__${back}`);
    }
    for(const sleeve of sleeves.filter((id)=>["half","three_quarter"].includes(id))) names.push(`ShirtSleeveFinishVariant__${fit}__${sleeve}`);
  }

  for(const collar of collars){
    for(const construction of collarConstruction){
      names.push(`ShirtCollarVariant__${collar}__${construction}`);
      if(!["camp","one_piece","mandarin"].includes(collar)) names.push(`ShirtNeckGasketVariant__${collar}__${construction}`);
    }
  }
  for(const cuff of cuffs) for(const construction of cuffConstruction) names.push(`ShirtCuffVariant__${cuff}__${construction}`);
  for(const placket of plackets.filter((id)=>id!=="french")) names.push(`ShirtPlacketVariant__${placket}`);
  for(const pocket of pockets.filter((id)=>id!=="none")) names.push(`ShirtPocketVariant__${pocket}`);
  for(const yoke of yokes) names.push(`ShirtYokeVariant__${yoke}`);
  for(const back of shirtBacks.filter((id)=>id!=="plain")) names.push(`ShirtBackVariant__${back}`);
  for(const hem of shirtHems) names.push(`ShirtHemShapeVariant__${hem}`);

  for(const fit of trouserFits.filter((id)=>id!=="straight")){
    names.push(`TrouserLegLVariant__${fit}`,`TrouserLegRVariant__${fit}`);
  }
  for(const fit of trouserFits){
    for(const breakStyle of breaks.filter((id)=>id!=="slight")){
      names.push(`TrouserLegLBreakVariant__${fit}__${breakStyle}`,`TrouserLegRBreakVariant__${fit}__${breakStyle}`);
    }
    for(const breakStyle of breaks){
      for(const hem of trouserHems.filter((id)=>id!=="plain")) names.push(`TrouserHemVariant__${fit}__${breakStyle}__${hem}`);
    }
  }
  for(const rise of rises){
    if(rise!=="mid") names.push(`TrouserWaistVariant__${rise}`);
    names.push(`TrouserCoreDetailVariant__${rise}`);
    for(const pleat of pleats.filter((id)=>id!=="flat")){
      names.push(`TrouserWaistPleatVariant__${rise}__${pleat}`,`TrouserPleatVariant__${rise}__${pleat}`);
    }
    for(const waistband of waistbands.filter((id)=>id!=="clean")) names.push(`TrouserWaistbandVariant__${rise}__${waistband}`);
    for(const pocket of trouserPockets) names.push(`TrouserPocketVariant__${rise}__${pocket}`);
  }
  for(const breakStyle of breaks.filter((id)=>id!=="slight")) names.push(`TrouserBreakVariant__${breakStyle}`);
  names.push("TrouserCreaseVariant__front");

  for(const placket of plackets.filter((id)=>id!=="hidden")) names.push(`ButtonAccentVariant__shirt_placket__${placket}`);
  for(const collar of collars.filter((id)=>["button_down","tab"].includes(id))) names.push(`ButtonAccentVariant__shirt_collar__${collar}`);
  for(const cuff of cuffs){
    names.push(
      `ButtonAccentVariant__shirt_${["french","rounded_french","soft_french"].includes(cuff)?"cufflink":"cuff"}__${cuff}`
    );
  }
  for(const rise of rises) names.push(`ButtonAccentVariant__trouser_rise__${rise}`);

  return [...new Set(names)].sort();
}

export const REQUIRED_GARMENT_VIEWER_STYLE_MATERIALS=requiredGarmentViewerStyleMaterials();

export function garmentViewerStyleMaterialCoverage(materialNames:ReadonlyArray<string>){
  const present=new Set(materialNames.map((name)=>String(name||"").trim()).filter(Boolean));
  const missing=REQUIRED_GARMENT_VIEWER_STYLE_MATERIALS.filter((name)=>!present.has(name));
  return {
    required:REQUIRED_GARMENT_VIEWER_STYLE_MATERIALS.length,
    present:REQUIRED_GARMENT_VIEWER_STYLE_MATERIALS.length-missing.length,
    missing,
    ready:missing.length===0,
  };
}
