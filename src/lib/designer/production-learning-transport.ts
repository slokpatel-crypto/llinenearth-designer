import {PRODUCTION_LEARNING_CONTEXT_VERSION} from "./production-learning-context.ts";

function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new Error("Invalid production learning context object.");
  return value as Record<string,unknown>;
}
function stringField(value:unknown,max=200):string{
  if(typeof value!=="string"||value.length>max)
    throw new Error("Invalid production learning context string.");
  return value;
}
function nullableString(value:unknown,max=200):string|null{
  return value===null?null:stringField(value,max);
}
/** Transport nested immutable tailoring context without forwarding arbitrary
 * extra SQL or user-supplied metadata. Full original ledger + recipe lineage
 * must be verified BEFORE this projection, and result verified afterward.
 * Do not derive a real physical fit or supplier certification from this data. */
export function safeProductionLearningContexts(rows:unknown){
  if(!Array.isArray(rows)||rows.length>500)
    throw new Error("Invalid production learning context ledger.");
  return rows.map(value=>{
    const raw=record(value);
    const ctx=record(raw.context);
    if(ctx.version!==PRODUCTION_LEARNING_CONTEXT_VERSION)
      throw new Error("Unexpected production learning context version.");
    const source=record(ctx.source);
    const occasion=record(ctx.context);
    const fabrics=record(ctx.fabrics);
    const shirt=record(ctx.shirt);
    const trouser=record(ctx.trouser);
    if(source.styleSchemaVersion!==null&&source.styleSchemaVersion!==2)
      throw new Error("Invalid production learning style schema.");
    let creative:null|Record<string,unknown>=null;
    if(ctx.creative!==null){
      const c=record(ctx.creative);
      if(!Array.isArray(c.treatmentIds)||c.treatmentIds.length>40)
        throw new Error("Invalid production learning treatments.");
      creative={
        conceptId:stringField(c.conceptId),
        explorationClass:stringField(c.explorationClass),
        treatmentIds:c.treatmentIds.map((id:unknown)=>stringField(id,160)),
        patternId:nullableString(c.patternId),
      };
    }
    return {
      order_id:stringField(raw.order_id,80),
      revision_id:stringField(raw.revision_id,220),
      recipe_hash:stringField(raw.recipe_hash,64),
      created_at:stringField(raw.created_at,80),
      context:{
        version:PRODUCTION_LEARNING_CONTEXT_VERSION,
        revisionId:stringField(ctx.revisionId,220),
        recipeHash:stringField(ctx.recipeHash,64),
        source:{
          designerRuleSetVersion:stringField(source.designerRuleSetVersion),
          fitConstructionVersion:nullableString(source.fitConstructionVersion),
          styleSchemaVersion:source.styleSchemaVersion,
        },
        context:{
          occasion:stringField(occasion.occasion),
          climate:stringField(occasion.climate),
          intention:stringField(occasion.intention),
        },
        fabrics:{
          shirtId:stringField(fabrics.shirtId),
          trouserId:stringField(fabrics.trouserId),
        },
        shirt:{
          fit:stringField(shirt.fit),wear:stringField(shirt.wear),
          collar:stringField(shirt.collar),collarFinish:stringField(shirt.collarFinish),
          cuff:stringField(shirt.cuff),placket:stringField(shirt.placket),
          button:stringField(shirt.button),
        },
        trouser:{
          shape:stringField(trouser.shape),rise:stringField(trouser.rise),
          waistband:stringField(trouser.waistband),break:stringField(trouser.break),
        },
        creative,
      },
    };
  });
}
