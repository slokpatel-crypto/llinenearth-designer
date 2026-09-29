import type { VocabId } from "./types.ts";

export const patternFamilies=[
  {id:"solid",label:"Solid / plain",aliases:["plain","solid/plain"]},
  {id:"stripe",label:"Stripe",aliases:["striped","pinstripe","chalk stripe","candy stripe","bengal stripe","hairline stripe"]},
  {id:"check",label:"Check",aliases:["checked","windowpane","gingham","tattersall","glen check","prince of wales","houndstooth","micro check"]},
  {id:"dot",label:"Dot",aliases:["polka dot","pindot","spot"]},
  {id:"botanical",label:"Botanical",aliases:["leaf","botanical print"]},
  {id:"floral",label:"Floral",aliases:["flower","floral print"]},
  {id:"geometric",label:"Geometric",aliases:["geometry","geometric print","chevron"]},
  {id:"paisley",label:"Paisley",aliases:["paisley print"]},
  {id:"abstract",label:"Abstract",aliases:["abstract print"]},
  {id:"melange",label:"Melange / heather",aliases:["heather","marle","marl","mouline","mouliné"]},
  {id:"textured",label:"Textured / tonal",aliases:["tonal texture","surface texture","dobby texture","jacquard texture"]},
  {id:"other",label:"Other",aliases:["unclassified"]},
] as const;
export type PatternFamilyId=VocabId<typeof patternFamilies>;

export const patternStrategies=[
  {id:"single_hero_pattern",label:"Single hero pattern",aliases:["one pattern","single pattern","one hero","hero fabric"]},
  {id:"tonal_low_contrast",label:"Tonal low contrast",aliases:["tonal","low contrast"]},
  {id:"solid_support",label:"Solid support",aliases:["solid","plain","quiet support","restrained support","simple support"]},
  {id:"fine_scale_only",label:"Fine scale only",aliases:["fine","micro","fine scale","micro scale"]},
  {id:"mixed_scale_controlled",label:"Controlled mixed scale",aliases:["mixed scale","different scales"]},
  {id:"no_competing_pattern",label:"No competing pattern",aliases:["avoid another pattern","no second pattern","do not mix patterns"]},
] as const;
export type PatternStrategyId=VocabId<typeof patternStrategies>;

export const patternTerms=[
  ...patternFamilies,
  {id:"pinstripe",label:"Pinstripe",aliases:["pin stripe"]},
  {id:"chalk_stripe",label:"Chalk stripe",aliases:["chalk-stripe"]},
  {id:"windowpane",label:"Windowpane",aliases:["window pane"]},
  {id:"gingham",label:"Gingham",aliases:["gingham check"]},
  {id:"glen_check",label:"Glen check",aliases:["glen plaid"]},
  {id:"prince_of_wales",label:"Prince of Wales",aliases:["prince of wales check"]},
  {id:"houndstooth",label:"Houndstooth",aliases:["dogtooth"]},
  {id:"herringbone",label:"Herringbone",aliases:["herringbone weave"]},
  {id:"birdseye",label:"Birdseye",aliases:["bird's eye","birds eye"]},
] as const;
