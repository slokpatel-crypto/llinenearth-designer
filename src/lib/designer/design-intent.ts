import { DESIGNER_STYLE_CHOICES, type DesignerStyle, type OccasionTier } from "./engine.ts";
import { optionById } from "./options/library.ts";
import { designerFabricBriefText, designerMentionIsNegated } from "./construction-intent.ts";

export type FabricRole = "shirt" | "pant";
export type RoleFabricBrief = { wantedTokens:string[]; avoidTokens:string[]; pattern?:"plain"|"stripe"|"check"|"print"; excludedPatterns?:Array<"plain"|"stripe"|"check"|"print">; material?:"linen"|"cotton"|"blend"|"synthetic"; gsm?:{min?:number;max?:number}; lea?:number };
export type DesignGoal = "summer"|"clean"|"volume"|"texture"|"contrast";
export type DesignerIntent = {
  version:"designer-intent-v1";
  scope:"outfit"|"shirt"|"trouser"|"capsule";
  goals:DesignGoal[];
  roles:Partial<Record<FabricRole,RoleFabricBrief>>;
  directionCount:number;
  capsule:Array<{label:string;occasion:OccasionTier}>;
  notes:string[];
  issues:string[];
};

export const DESIGN_GOALS:Record<DesignGoal,{label:string;why:string;options:Partial<Record<keyof DesignerStyle,string>>}>= {
  summer:{label:"Relaxed summer",why:"Use a relaxed shirt and a restrained open neckline; check the actual roll for comfort and opacity.",options:{collar:"cuban_camp_collar",shirtFit:"relaxed_fit",cuff:"rounded_soft_cuff",trouser:"wide_leg_relaxed_drape",rise:"mid_rise",break:"no_break"}},
  clean:{label:"Clean tailoring",why:"Let a clean front and controlled proportion carry the design instead of adding decorative details.",options:{collar:"spread_collar",placket:"french_placket",shirtFit:"regular_classic_fit",trouser:"formal_flat_front",waistband:"side_adjuster_tabs",shirtWear:"tucked"}},
  volume:{label:"Modern volume",why:"Pair a roomier shirt with a wide trouser; check garment lengths and movement before cutting.",options:{shirtFit:"boxy_oversized",trouser:"wide_leg_relaxed_drape",rise:"high_rise",shirtWear:"tucked",break:"no_break"}},
  texture:{label:"Quiet texture",why:"Keep construction restrained so the selected cloth surface becomes the focal point.",options:{collar:"point_standard_collar",collarFinish:"self_fabric",cuff:"barrel_cuff_1_button",placket:"standard_visible_placket",button:"corozo"}},
  contrast:{label:"One contrast detail",why:"Use a single contrast system at collar and cuffs while keeping the main cloth and silhouette coherent.",options:{collarFinish:"white_contrast_collar_cuffs",collar:"spread_collar",cuff:"barrel_cuff_1_button"}},
};

const colors=/\b(?:navy|blue|sky|white|cream|ivory|beige|sand|khaki|brown|tan|camel|black|charcoal|grey|gray|green|olive|sage|maroon|burgundy|red|pink|purple|lavender|yellow|mustard|orange|rust|light|dark)\b/gi;
const patterns:Array<[NonNullable<RoleFabricBrief["pattern"]>,RegExp]>=[["plain",/\b(?:plain|solid)\b/i],["stripe",/\b(?:stripes?|striped|pinstripes?)\b/i],["check",/\b(?:checks|checked|windowpane|gingham)\b/i],["print",/\b(?:prints?|printed|floral)\b/i]];

/** Garment roles are resolved inside clauses so 'blue shirt with beige trousers'
 * is two hard requests, rather than a colour score for the entire outfit. */
function roleBriefs(raw:string) {
  const roles:DesignerIntent["roles"]={};
  const text=designerFabricBriefText(raw).toLowerCase();
  const clauses=text.split(/[.;,!?]|\b(?:and|with|paired with|plus)\b/);
  for(const clause of clauses) {
    const nouns=[...clause.matchAll(/\b(shirts?|shirting|trousers?|pants?)\b/g)];
    if(!nouns.length) continue;
    const resolve=(index:number)=>nouns.map(n=>({role:n[1].startsWith("shirt")?"shirt" as const:"pant" as const,distance:Math.abs(n.index!-index)})).sort((a,b)=>a.distance-b.distance)[0].role;
    const get=(role:FabricRole)=>roles[role] ||= {wantedTokens:[],avoidTokens:[]};
    for(const match of clause.matchAll(colors)) {
      const before=clause.slice(0,match.index!);
      if(/\b(?:collar|cuffs?|buttons?|placket)\b/.test(before.slice(-28))) continue;
      const role=resolve(match.index!),target=get(role),token=match[0]==="gray"?"grey":match[0];
      const bucket=designerMentionIsNegated(clause,match.index!)?target.avoidTokens:target.wantedTokens;
      if(!bucket.includes(token)) bucket.push(token);
    }
    for(const [pattern,matcher] of patterns) {
      const match=clause.match(matcher);
      if(match) {
        const target=get(resolve(match.index!));
        if(designerMentionIsNegated(clause,match.index!)) (target.excludedPatterns ||= []).push(pattern);
        else target.pattern=pattern;
      }
    }
    const material=clause.match(/\b(linen|cotton|blend|synthetic)\b/);
    if(material && !designerMentionIsNegated(clause,material.index!)) get(resolve(material.index!)).material=material[1] as RoleFabricBrief["material"];
    const range=clause.match(/\b(?:between\s+)?(\d{2,3})\s*(?:to|-|–)\s*(\d{2,3})\s*gsm\b/);
    const single=clause.match(/\b(under|below|over|above|at least|up to|exactly)?\s*(\d{2,3})\s*gsm\b/);
    if(range) get(resolve(range.index!)).gsm={min:Number(range[1]),max:Number(range[2])};
    else if(single) {
      const value=Number(single[2]),word=single[1];
      get(resolve(single.index!)).gsm=word==="under"||word==="below"?{max:value-.001}:word==="up to"?{max:value}:word==="over"||word==="above"?{min:value+.001}:word==="at least"?{min:value}:{min:value,max:value};
    }
    const lea=clause.match(/\b(\d{1,3})\s*lea\b/);
    if(lea) get(resolve(lea.index!)).lea=Number(lea[1]);
  }
  return roles;
}

export function unscopedFabricBriefText(raw:string) {
  return designerFabricBriefText(raw).split(/[.;,!?]|\b(?:and|with|paired with|plus)\b/i).filter(clause=>! /\b(?:shirts?|shirting|trousers?|pants?)\b/i.test(clause)).join(". ");
}

export function compileDesignerIntent(raw:string):DesignerIntent {
  const text=raw.toLowerCase().replace(/[–—-]/g," "),goals:DesignGoal[]=[];
  const goalMatchers:Array<[DesignGoal,RegExp]>=[
    ["summer",/\b(?:resort|beach|relaxed summer|summer dinner|holiday)\b/],
    ["clean",/\b(?:clean tailoring|clean front|minimal tailoring|sharp tailoring|streamlined)\b/],
    ["volume",/\b(?:modern volume|korean|roomy silhouette|oversized silhouette|wide silhouette)\b/],
    ["texture",/\b(?:quiet texture|texture led|let (?:the )?(?:cloth|fabric|texture) (?:lead|stand out)|keep (?:the )?texture visible)\b/],
    ["contrast",/\b(?:contrast detail|contrast collar|white collar|white cuffs)\b/],
  ];
  for(const [goal,matcher] of goalMatchers) {const m=text.match(matcher);if(m && !designerMentionIsNegated(text,m.index!)) goals.push(goal);}
  const scope:DesignerIntent["scope"]= /\b(?:capsule|wardrobe|collection|three occasions|3 occasions)\b/.test(text)?"capsule"
    : /\b(?:shirt only|only (?:the |my )?shirt|design (?:a |the |my )?shirt\b|create (?:a |the |my )?shirt\b)/.test(text) && !/\b(?:design|create).*\boutfit\b/.test(text)?"shirt"
    : /\b(?:(?:trouser|pant)s? only|only (?:the |my )?(?:trouser|pant)s?|design (?:a |the |my )?(?:trouser|pant)s?\b|create (?:a |the |my )?(?:trouser|pant)s?\b)/.test(text)?"trouser":"outfit";
  const countMatch=text.match(/\b(one|two|three|four|five|\d+)(?:\s+[a-z]+){0,6}\s+(?:directions?|looks?|outfits?|options?)\b/);
  const requested=countMatch?({one:1,two:2,three:3,four:4,five:5}[countMatch[1]] || Number(countMatch[1])):3;
  const directionCount=Math.max(1,Math.min(3,requested)),notes:string[]=[],issues:string[]=[];
  if(requested>3) notes.push("This workspace presents three reviewed directions at a time; ask for the next set after choosing or judging these.");
  const capsule:DesignerIntent["capsule"]=[];
  if(scope==="capsule") {
    const slots:Array<[string,OccasionTier,RegExp]>=[["Office","Semi-Formal",/\b(?:office|work|business|meeting)\b/],["Dinner","Smart-Casual",/\b(?:dinner|date|party)\b/],["Weekend","Casual",/\b(?:weekend|casual|coffee)\b/],["Formal event","Formal",/\b(?:formal event|gala|ceremony)\b/]];
    for(const [label,occasion,matcher] of slots) if(matcher.test(text)) capsule.push({label,occasion});
    if(!capsule.length) capsule.push({label:"Office",occasion:"Semi-Formal"},{label:"Dinner",occasion:"Smart-Casual"},{label:"Weekend",occasion:"Casual"});
    if(capsule.length>3) notes.push("The first three requested occasions are shown; the remaining occasion needs a separate set.");
    capsule.splice(3);
  }
  if(/\b(?:exact copy|identical to|copy (?:this|that|the) (?:photo|image))\b/.test(text)) issues.push("Describe the reference's visible collar, cut and cloth. An exact copy needs supported construction and an approved fabric reference.");
  return {version:"designer-intent-v1",scope,goals,roles:roleBriefs(raw),directionCount,capsule,notes,issues};
}

export function designGoalPatch(intent:DesignerIntent,occasion:OccasionTier):Partial<DesignerStyle> {
  const patch:Partial<DesignerStyle>={};
  for(const goal of intent.goals) for(const [key,id] of Object.entries(DESIGN_GOALS[goal].options)) {
    const label=optionById(id)?.label || (key==="collarFinish"?DESIGNER_STYLE_CHOICES.collarFinish.find(value=>id==="self_fabric"?!/white/i.test(value):/white/i.test(value)):undefined);
    if(label && DESIGNER_STYLE_CHOICES[key as keyof DesignerStyle].includes(label)) patch[key as keyof DesignerStyle]=label;
  }
  // Open camp collars are an exploratory casual treatment, not a formal default.
  if(occasion==="Formal" || occasion==="Semi-Formal") {
    if(intent.goals.includes("summer") && patch.collar===optionById("cuban_camp_collar")?.label) delete patch.collar;
  }
  return patch;
}

export function scopeStyleLocks(scope:DesignerIntent["scope"],style:DesignerStyle):Partial<DesignerStyle> {
  const shirtKeys:Array<keyof DesignerStyle>=["collar","collarFinish","cuff","placket","shirtFit","shirtWear","button"];
  const pantKeys:Array<keyof DesignerStyle>=["trouser","rise","waistband","break"];
  const keys=scope==="shirt"?pantKeys:scope==="trouser"?shirtKeys:[];
  return Object.fromEntries(keys.map(key=>[key,style[key]]));
}

export function completeDesignConstruction(patch:Partial<DesignerStyle>,base:DesignerStyle):Partial<DesignerStyle> {
  const result={...patch};
  if(patch.trouser===optionById("cropped_ankle")?.label && !patch.break) result.break=optionById("cropped_above_ankle")!.label;
  if(patch.cuff===optionById("french_double_cuff")?.label && !patch.collar && !["spread_collar","cutaway_collar"].some(id=>optionById(id)?.label===base.collar)) result.collar=optionById("spread_collar")!.label;
  if(patch.collar && !["spread_collar","cutaway_collar"].some(id=>optionById(id)?.label===patch.collar) && !patch.cuff && base.cuff===optionById("french_double_cuff")?.label) result.cuff=optionById("barrel_cuff_1_button")!.label;
  return result;
}
