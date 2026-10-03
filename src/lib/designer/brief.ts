import {
  designerStyleForOccasion,
  type DesignerClimate,
  type DesignerContext,
  type DesignerIntention,
  type DesignerStyle,
  type OccasionTier,
} from "@/lib/designer/engine";
import type { DesignerSearchPreference, DesignerSearchTier } from "@/lib/designer/search";
import { designerFabricBriefText, designerMentionIsNegated, parseDesignerConstructionIntent } from "./construction-intent.ts";

export type ParsedDesignerBrief = {
  original:string;
  occasion:OccasionTier;
  context:DesignerContext;
  style:DesignerStyle;
  preference:DesignerSearchPreference;
  interpretation:string[];
};

function includesAny(text:string,words:string[]) {
  return words.some((word)=>new RegExp("\\b"+word.trim().split(" ").join("\\s+")+"\\b","i").test(text));
}

function occasionFrom(text:string):OccasionTier {
  const normalized=text.toLowerCase().replace(/[–—]/g,"-");
  // Resolve compound phrases before their component words so "semi-formal"
  // never collapses into Formal and "smart casual" never collapses into Casual.
  if(/\bsmart[-\s]?casual\b|\bbusiness[-\s]?casual\b/.test(normalized)) return "Smart-Casual";
  if(/\bsemi[-\s]?formal\b/.test(normalized)) return "Semi-Formal";
  if(/\bblack[-\s]?tie\b|\bgala\b|\bformal\b|\bboardroom\b|\bceremony\b/.test(normalized)) return "Formal";
  if(includesAny(normalized,["business","meeting","office","work","client","presentation","interview","wedding","reception","engagement","festive","function"])) return "Semi-Formal";
  if(includesAny(normalized,["date","dinner","party","cocktail","brunch","event","travel","holiday","resort"])) return "Smart-Casual";
  if(/\bcasual\b|\bweekend\b|\beveryday\b|\bcoffee\b|\bouting\b/.test(normalized)) return "Casual";
  return "Smart-Casual";
}

function climateFrom(text:string):DesignerClimate {
  if(includesAny(text,["hot","humid","summer","outdoor","mumbai","goa","coastal","tropical"])) return "Hot / humid";
  if(includesAny(text,["winter","cold","cool weather","hill station"])) return "Cool";
  if(includesAny(text,["air-conditioned","air conditioned"," ac ","indoor office","conference room"])) return "Air-conditioned";
  return "Not specified";
}

function intentionFrom(text:string):DesignerIntention {
  if(/\b(?:not|no|avoid)(?: too)? (?:bold|statement|expressive)\b|\bnot flashy\b/i.test(text)) return "Understated";
  if(includesAny(text,["bold","statement","stand out","standout","not boring","creative","different","distinctive","fashion forward","fashion-forward","memorable"])) return "Expressive";
  if(includesAny(text,["quiet","understated","minimal","subtle","simple","conservative","low key","low-key"])) return "Understated";
  return "Balanced";
}

const COLOR_TERMS=[
  "navy","blue","sky","white","cream","ivory","beige","sand","khaki","brown","tan","camel",
  "black","charcoal","grey","gray","green","olive","sage","maroon","burgundy","red","pink",
  "purple","lavender","yellow","mustard","orange","rust","earthy","neutral","pastel","light","dark",
];

function colorPreferences(text:string) {
  const wanted:string[]=[];
  const avoid:string[]=[];
  const lower=text.toLowerCase();
  for(const color of COLOR_TERMS) {
    const avoidPattern=new RegExp("(?:no|avoid|without|not)\\s+(?:too\\s+)?"+color,"i");
    if(avoidPattern.test(lower)) avoid.push(color);
    else if(new RegExp("\\b"+color+"\\b","i").test(lower)) wanted.push(color);
  }
  return {wanted:[...new Set(wanted)],avoid:[...new Set(avoid)]};
}

export function applyExplicitStyle(text:string,style:DesignerStyle) {
  return {...style,...parseDesignerConstructionIntent(text).patch};
}

export function explicitDesignerStylePatch(text:string):Partial<DesignerStyle> {
  return parseDesignerConstructionIntent(text).patch;
}

function patternPreferences(text:string) {
  const excludedPatterns:NonNullable<DesignerSearchPreference["excludedPatterns"]>=[];
  let preferredPattern:DesignerSearchPreference["preferredPattern"];
  const patterns:Array<[NonNullable<DesignerSearchPreference["preferredPattern"]>,RegExp]>=[
    ["plain",/\b(?:plain|solid)s?\b/gi],["stripe",/\b(?:stripes?|striped|pinstripes?)\b/gi],
    ["check",/\b(?:checks?|checked|windowpane|gingham)\b/gi],["print",/\b(?:prints?|printed|floral|geometric)\b/gi],
  ];
  for(const [pattern,matcher] of patterns) for(const match of text.matchAll(matcher)) {
    if(pattern==="check" && /^check$/i.test(match[0]) && !designerMentionIsNegated(text,match.index!) && !/^\s+(?:cloth|fabric|pattern|shirt|trouser)/i.test(text.slice(match.index!+match[0].length))) continue;
    if(designerMentionIsNegated(text,match.index!)) {if(!excludedPatterns.includes(pattern)) excludedPatterns.push(pattern);}
    else preferredPattern ||= pattern;
  }
  return {preferredPattern,excludedPatterns};
}

function preferredTier(intention:DesignerIntention):DesignerSearchTier {
  return intention==="Understated" ? "Safe" : intention==="Expressive" ? "Statement" : "Elevated";
}

export function parseDesignerBrief(raw:string,base?:{occasion:OccasionTier;context:DesignerContext;style:DesignerStyle}):ParsedDesignerBrief {
  const original=raw.replace(/\s+/g," ").trim().slice(0,500);
  const text=" "+original.toLowerCase()+" ";
  const occasionText=text.replace(/\b(?:less|too|not|no)\s+formal\b|\btoo\s+casual\b/g," ");
  const occasion=/\b(casual|formal|business|meeting|office|work|client|presentation|interview|wedding|reception|engagement|festive|function|date|dinner|party|cocktail|brunch|event|travel|holiday|resort|weekend|everyday|coffee|outing|black[- ]tie|gala|boardroom|ceremony)\b/.test(occasionText) ? occasionFrom(occasionText) : base?.occasion || occasionFrom(occasionText);
  const readClimate=climateFrom(text), readIntention=intentionFrom(text);
  const climate=readClimate==="Not specified" ? base?.context.climate || readClimate : readClimate;
  const intention=readIntention==="Balanced" && !/\bbalanced\b/.test(text) ? base?.context.intention || readIntention : readIntention;
  const style=applyExplicitStyle(original,base?.style || designerStyleForOccasion(occasion));
  const colors=colorPreferences(designerFabricBriefText(original));
  const {preferredPattern:pattern,excludedPatterns}=patternPreferences(original);
  const preference:DesignerSearchPreference={
    wantedTokens:colors.wanted,
    avoidTokens:colors.avoid,
    preferredPattern:pattern,
    ...(excludedPatterns.length?{excludedPatterns}:{}),
    preferredTier:preferredTier(intention),
    strictOccasionFit:true,
  };

  const interpretation=[
    occasion+" occasion",
    intention==="Expressive" ? "more distinctive direction" : intention==="Understated" ? "quiet, restrained direction" : "balanced premium direction",
    climate==="Not specified" ? "climate kept flexible" : climate.toLowerCase(),
    ...(colors.wanted.length ? ["colour pull: "+colors.wanted.join(", ")] : []),
    ...(colors.avoid.length ? ["avoid: "+colors.avoid.join(", ")] : []),
    ...(pattern ? [pattern+" fabric preference"] : []),
    ...(excludedPatterns.length ? ["exclude fabric patterns: "+excludedPatterns.join(", ")] : []),
    ...(style.shirtWear!==designerStyleForOccasion(occasion).shirtWear ? [style.shirtWear.toLowerCase()+" shirt"] : []),
  ];

  return {original,occasion,context:{climate,intention},style,preference,interpretation};
}
