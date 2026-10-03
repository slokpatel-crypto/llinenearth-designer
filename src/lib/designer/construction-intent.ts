import { DESIGNER_STYLE_CHOICES, type DesignerStyle } from "./engine.ts";
import { optionById } from "./options/library.ts";

type StyleKey=keyof DesignerStyle;
type Mention={key:StyleKey;value:string;start:number;end:number};
export type DesignerConstructionIntent={
  patch:Partial<DesignerStyle>;
  excluded:Partial<Record<StyleKey,string[]>>;
  issues:string[];
};

// Aliases resolve existing option IDs; the shared library owns the labels.
const aliases:Array<[StyleKey,string,RegExp]>=[
  ["collar","spread_collar",/\bspread(?: collar)?\b/g],
  ["collar","cutaway_collar",/\bcutaway(?: collar)?\b/g],
  ["collar","point_standard_collar",/\bpoint(?: standard)? collar\b/g],
  ["collar","button_down_collar",/\bbutton down(?: collar)?\b/g],
  ["collar","mandarin_band_collar",/\b(?:mandarin|band)(?: collar)?\b/g],
  ["collar","club_collar",/\bclub collar\b/g],
  ["collar","tab_collar",/\btab collar\b/g],
  ["collar","pin_collar",/\bpin collar\b/g],
  ["collar","cuban_camp_collar",/\b(?:cuban|camp)(?: collar)?\b/g],
  ["collar","soft_button_down",/\bsoft button down(?: collar)?\b/g],
  ["cuff","french_double_cuff",/\b(?:french|double) cuffs?\b/g],
  ["cuff","barrel_cuff_2_button",/\b(?:two|2) button(?: barrel)? cuffs?\b/g],
  ["cuff","barrel_cuff_1_button",/\b(?:(?:one|1) button|barrel) cuffs?\b/g],
  ["cuff","convertible_cuff",/\bconvertible cuffs?\b/g],
  ["cuff","rounded_soft_cuff",/\b(?:rounded|soft) cuffs?\b/g],
  ["cuff","cocktail_cuff",/\bcocktail cuffs?\b/g],
  ["cuff","angled_barrel_cuff",/\bangled(?: barrel)? cuffs?\b/g],
  ["cuff","open_short_hem_cuff",/\bopen short sleeve hem\b/g],
  ["placket","standard_visible_placket",/\b(?:standard|visible)(?: stitch)? placket\b/g],
  ["placket","hidden_fly_front",/\b(?:hidden|fly front) placket\b|\bhide (?:the |my )?placket\b/g],
  ["placket","french_placket",/\bfrench placket\b/g],
  ["placket","covered_placket",/\bcovered placket\b/g],
  ["shirtFit","slim_fit",/\bslim(?: fit)?\b/g],
  ["shirtFit","regular_classic_fit",/\b(?:regular|classic)(?: fit)?\b/g],
  ["shirtFit","relaxed_fit",/\brelaxed(?: fit)?\b/g],
  ["shirtFit","boxy_oversized",/\b(?:boxy|oversized)(?: fit)?\b/g],
  ["shirtFit","athletic_taper",/\bathletic(?: taper)?(?: fit)?\b/g],
  ["trouser","formal_flat_front",/\bflat front\b/g],
  ["trouser","pleated_trouser",/\bpleat(?:ed|s)?(?: trousers?)?\b/g],
  ["trouser","cropped_ankle",/\b(?:cropped|ankle length) trousers?\b/g],
  ["trouser","cargo_trouser",/\bcargo(?: trousers?| pants)?\b/g],
  ["trouser","jean_cut_suiting",/\bjean cut(?: trousers?)?\b/g],
  ["trouser","jodhpuri_churidar",/\b(?:jodhpuri|churidar)(?: style)?(?: trousers?)?\b/g],
  ["trouser","wide_leg_relaxed_drape",/\bwide leg\b|\brelaxed (?:trousers?|pants)\b|\b(?:trousers?|pants)(?: fit)?(?: (?:is|to be))? relaxed\b/g],
  ["rise","low_rise",/\blow rise\b/g],
  ["rise","mid_rise",/\b(?:mid|medium) rise\b/g],
  ["rise","high_rise",/\bhigh rise\b/g],
  ["rise","extra_high_rise",/\bextra high rise\b/g],
  ["waistband","plain_clean_front",/\b(?:plain|clean) (?:front |)waistband\b/g],
  ["waistband","belt_loops",/\bbelt loops?\b/g],
  ["waistband","side_adjuster_tabs",/\bside adjusters?(?: tabs?)?\b/g],
  ["waistband","drawstring_elastic",/\b(?:drawstring|elastic)(?: waistband)?\b/g],
  ["waistband","extended_tab",/\bextended (?:waistband )?tab\b/g],
  ["waistband","belt_loops_with_belt",/\bbelt loops? (?:with|and) (?:a )?belt\b/g],
  ["waistband","adjuster_tabs_no_belt",/\b(?:side )?adjuster tabs? (?:with )?no belt\b/g],
  ["break","no_break",/\bno break\b/g],
  ["break","slight_break",/\bslight break\b/g],
  ["break","full_break",/\bfull break\b/g],
  ["break","cropped_above_ankle",/\b(?:cropped|above ankle) (?:break|hem)\b/g],
  ["break","stacked_break",/\bstacked break\b/g],
  ["button","mother_of_pearl",/\b(?:mother of pearl|pearl|mop)(?: buttons?)?\b/g],
  ["button","corozo",/\b(?:corozo|vegetable ivory)(?: buttons?)?\b/g],
  ["button","horn",/\bhorn(?: buttons?)?\b/g],
  ["button","plastic_resin",/\b(?:plastic|resin)(?: buttons?)?\b/g],
  ["button","metal_contrast",/\b(?:metal|contrast) buttons?\b/g],
];

function normalize(text:string) {
  return text.toLowerCase().replace(/[()/+·–—-]/g," ").replace(/\s+/g," ").trim();
}

/** Construction colours/material names are not a request for new body cloth. */
export function designerFabricBriefText(text:string) {
  return text.replace(/\bwhite(?: contrast)?(?: collar(?:\s*(?:\+|and|with)\s*(?:white )?cuffs?)?| cuffs?)\b/gi," ")
    .replace(/\b(?:corozo\s*\(?vegetable ivory\)?|vegetable ivory(?: buttons?)?)\b/gi," ");
}

/** Negation carries through a coordinated list, ending at a new positive clause. */
export function designerMentionIsNegated(text:string,start:number) {
  const before=text.slice(0,start).split(/[.;!?]|\b(?:but|instead|with|use|choose|wear|make|keep|and (?:a|an|the|my))\b/i).at(-1) || "";
  return /\b(?:no|not|avoid|without|don't|do not)\b/i.test(before);
}

function nearestGarment(text:string,start:number,end:number):"shirt"|"trouser"|null {
  const left=text.slice(0,start).search(/[^.;,]*$/),right=text.slice(end).search(/[.;,]/);
  const from=Math.max(left,start-32),to=right<0?Math.min(text.length,end+32):Math.min(end+right,end+32);
  const found=[...text.slice(from,to).matchAll(/\b(shirts?|trousers?|pants)\b/g)].map((match)=>({
    role:match[1].startsWith("shirt")?"shirt" as const:"trouser" as const,
    distance:Math.min(Math.abs(from+match.index!-start),Math.abs(from+match.index!-end)),
  })).sort((a,b)=>a.distance-b.distance);
  return found[0]?.role || null;
}

export function parseDesignerConstructionIntent(raw:string):DesignerConstructionIntent {
  const text=normalize(raw),mentions:Mention[]=[],issues:string[]=[];
  const add=(key:StyleKey,value:string,matcher:RegExp)=>{
    for(const match of text.matchAll(new RegExp(matcher.source,"g"))) {
      const start=match.index!,end=start+match[0].length;
      // A trouser fit adjective must never change the shirt cut.
      if(key==="shirtFit" && nearestGarment(text,start,end)==="trouser") continue;
      if(key==="trouser" && nearestGarment(text,start,end)==="shirt" && /pleat/.test(match[0])) continue;
      mentions.push({key,value,start,end});
    }
  };
  for(const [key,values] of Object.entries(DESIGNER_STYLE_CHOICES) as Array<[StyleKey,readonly string[]]>) {
    for(const value of values) add(key,value,new RegExp("\\b"+normalize(value).split(" ").join("\\s+")+"\\b"));
  }
  for(const [key,id,matcher] of aliases) {
    const option=optionById(id);
    if(option && DESIGNER_STYLE_CHOICES[key].includes(option.label)) add(key,option.label,matcher);
  }
  const whiteSet=DESIGNER_STYLE_CHOICES.collarFinish.find((value)=>value.includes("+ cuffs"));
  if(whiteSet) add("collarFinish",whiteSet,/\bwhite (?:contrast )?collar(?: and| with)? (?:white )?cuffs\b|\bwhite (?:contrast )?cuffs\b/g);
  // Prefer a specific enclosing phrase over a shorter alias, e.g. soft
  // button-down, extra-high rise or two-button barrel cuff.
  const specific=mentions.filter((mention)=>!mentions.some((other)=>other.key===mention.key && other.start<=mention.start && other.end>=mention.end && other.end-other.start>mention.end-mention.start));
  const patch:Partial<DesignerStyle>={},excluded:DesignerConstructionIntent["excluded"]={};
  let previous:Mention|undefined,previousNegated=false;
  const positive=new Map<StyleKey,Mention>();
  for(const mention of specific.sort((a,b)=>a.start-b.start || a.end-b.end)) {
    const direct=/\b(?:no|not|avoid|without|don't|do not)\s+(?:(?:a|an|the|my|too|using|use)\s+)*$/.test(text.slice(Math.max(0,mention.start-60),mention.start));
    const coordinated:boolean=Boolean(previousNegated && previous && /^(?:\s*(?:and|or|nor|,)\s*(?:(?:a|an|the|my)\s+)?)$/.test(text.slice(previous.end,mention.start)));
    const negated:boolean=direct || coordinated;
    if(negated) {
      const values=excluded[mention.key] ||= [];
      if(!values.includes(mention.value)) values.push(mention.value);
    } else {
      const earlier=positive.get(mention.key);
      if(earlier && earlier.value!==mention.value && !/\b(instead|rather|actually|switch|replace|change|then)\b/.test(text.slice(earlier.end,mention.start))) issues.push("Choose one "+mention.key+" option: "+earlier.value+" or "+mention.value+".");
      positive.set(mention.key,mention);patch[mention.key]=mention.value;
    }
    previous=mention;previousNegated=negated;
  }
  const alternatives:Array<[StyleKey,string,string]>=[
    ["shirtFit","slim_fit","regular_classic_fit"],["cuff","french_double_cuff","barrel_cuff_1_button"],["trouser","pleated_trouser","formal_flat_front"],
    ["shirtWear","tucked","untucked"],["shirtWear","untucked","tucked"],
  ];
  for(const [key,rejected,replacement] of alternatives) {
    const source=optionById(rejected),target=optionById(replacement);
    if(!patch[key] && source && target && excluded[key]?.includes(source.label) && !excluded[key]?.includes(target.label)) patch[key]=target.label;
  }
  for(const [key,value] of Object.entries(patch) as Array<[StyleKey,string]>) {
    if(excluded[key]?.includes(value)) {
      delete patch[key];
      issues.push("Choose one "+key+" instruction: "+value+" is both requested and excluded.");
    }
  }
  for(const match of text.matchAll(/\b(?:slim|tapered)(?: fit)? (?:trousers?|pants)\b|\b(?:trousers?|pants)(?: fit)?(?: (?:is|to be))? (?:slim|tapered)\b/g)) {
    if(!designerMentionIsNegated(text,match.index!)) issues.push("A separate slim or tapered trouser fit is not editable in this question flow yet. Choose a supported trouser shape; your shirt fit is preserved.");
  }
  return {patch,excluded,issues:[...new Set(issues)]};
}
