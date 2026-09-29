import {
  DESIGNER_STYLE_CHOICES,
  designerStyleForOccasion,
  type DesignerClimate,
  type DesignerContext,
  type DesignerIntention,
  type DesignerStyle,
  type OccasionTier,
} from "@/lib/designer/engine";
import type { DesignerSearchPreference, DesignerSearchTier } from "@/lib/designer/search";

export type ParsedDesignerBrief = {
  original:string;
  occasion:OccasionTier;
  context:DesignerContext;
  style:DesignerStyle;
  preference:DesignerSearchPreference;
  interpretation:string[];
};

function includesAny(text:string,words:string[]) {
  return words.some((word)=>text.includes(word));
}

function pick<K extends keyof DesignerStyle>(key:K,matcher:RegExp,fallback:DesignerStyle[K]):DesignerStyle[K] {
  return (DESIGNER_STYLE_CHOICES[key].find((value)=>matcher.test(value)) || fallback) as DesignerStyle[K];
}

function occasionFrom(text:string):OccasionTier {
  if(includesAny(text,["black tie","gala","formal dinner","board meeting","boardroom","ceremony","very formal"])) return "Formal";
  if(includesAny(text,["business","meeting","office","work","client","presentation","interview","wedding","reception","engagement","festive","function"])) return "Semi-Formal";
  if(includesAny(text,["date","dinner","party","cocktail","brunch","smart casual","smart-casual","event","travel","holiday","resort"])) return "Smart-Casual";
  if(includesAny(text,["casual","weekend","everyday","coffee","outing"])) return "Casual";
  return "Smart-Casual";
}

function climateFrom(text:string):DesignerClimate {
  if(includesAny(text,["hot","humid","summer","outdoor","mumbai","goa","coastal","tropical"])) return "Hot / humid";
  if(includesAny(text,["winter","cold","cool weather","hill station"])) return "Cool";
  if(includesAny(text,["air-conditioned","air conditioned"," ac ","indoor office","conference room"])) return "Air-conditioned";
  return "Not specified";
}

function intentionFrom(text:string):DesignerIntention {
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

function applyExplicitStyle(text:string,style:DesignerStyle) {
  const next={...style};
  if(/\buntucked\b/i.test(text)) next.shirtWear="Untucked";
  if(/\btucked\b/i.test(text)) next.shirtWear="Tucked";

  if(/\brelaxed\b/i.test(text)) next.shirtFit=pick("shirtFit",/relaxed/i,next.shirtFit);
  if(/\bslim\b/i.test(text)) next.shirtFit=pick("shirtFit",/slim/i,next.shirtFit);
  if(/\bclassic\b|\bregular\b/i.test(text)) next.shirtFit=pick("shirtFit",/regular|classic/i,next.shirtFit);

  if(/\bcutaway\b/i.test(text)) next.collar=pick("collar",/cutaway/i,next.collar);
  else if(/\bspread collar\b|\bspread\b/i.test(text)) next.collar=pick("collar",/spread/i,next.collar);
  else if(/\bbutton[- ]?down\b/i.test(text)) next.collar=pick("collar",/button[- ]?down/i,next.collar);
  else if(/\bpoint collar\b/i.test(text)) next.collar=pick("collar",/point/i,next.collar);

  if(/\bfrench cuff\b|\bdouble cuff\b/i.test(text)) next.cuff=pick("cuff",/french|double/i,next.cuff);
  else if(/\btwo[- ]?button cuff\b|\b2[- ]?button cuff\b/i.test(text)) next.cuff=pick("cuff",/2-button|2 button/i,next.cuff);
  else if(/\bbarrel cuff\b/i.test(text)) next.cuff=pick("cuff",/barrel/i,next.cuff);

  if(/\bpleat(?:ed|s)? trouser/i.test(text)) next.trouser=pick("trouser",/pleated/i,next.trouser);
  else if(/\bflat[- ]?front\b/i.test(text)) next.trouser=pick("trouser",/flat[- ]?front|formal.*flat/i,next.trouser);
  else if(/\bwide[- ]?leg\b|\brelaxed trouser/i.test(text)) next.trouser=pick("trouser",/wide|relaxed drape/i,next.trouser);
  else if(/\bcropped\b|\bankle[- ]?length\b/i.test(text)) next.trouser=pick("trouser",/cropped|ankle/i,next.trouser);

  if(/\bhigh rise\b/i.test(text)) next.rise=pick("rise",/high rise/i,next.rise);
  else if(/\blow rise\b/i.test(text)) next.rise=pick("rise",/low rise/i,next.rise);
  else if(/\bmid rise\b/i.test(text)) next.rise=pick("rise",/mid rise/i,next.rise);

  if(/\bside[- ]?adjuster/i.test(text)) next.waistband=pick("waistband",/side[- ]?adjuster/i,next.waistband);
  else if(/\bbelt loops?\b/i.test(text)) next.waistband=pick("waistband",/belt loops/i,next.waistband);

  if(/\bno break\b/i.test(text)) next.break=pick("break",/no break/i,next.break);
  else if(/\bslight break\b/i.test(text)) next.break=pick("break",/slight break/i,next.break);
  else if(/\bfull break\b/i.test(text)) next.break=pick("break",/full break/i,next.break);

  return next;
}

function patternPreference(text:string):DesignerSearchPreference["preferredPattern"] {
  if(/\bplain\b|\bsolid\b/i.test(text)) return "plain";
  if(/\bstripe|striped|pinstripe/i.test(text)) return "stripe";
  if(/\bcheck|checked|windowpane|gingham/i.test(text)) return "check";
  if(/\bprint|printed|floral|geometric/i.test(text)) return "print";
  return undefined;
}

function preferredTier(intention:DesignerIntention):DesignerSearchTier {
  return intention==="Understated" ? "Safe" : intention==="Expressive" ? "Statement" : "Elevated";
}

export function parseDesignerBrief(raw:string):ParsedDesignerBrief {
  const original=raw.replace(/\s+/g," ").trim().slice(0,500);
  const text=" "+original.toLowerCase()+" ";
  const occasion=occasionFrom(text);
  const climate=climateFrom(text);
  const intention=intentionFrom(text);
  const style=applyExplicitStyle(original,designerStyleForOccasion(occasion));
  const colors=colorPreferences(original);
  const pattern=patternPreference(original);
  const preference:DesignerSearchPreference={
    wantedTokens:colors.wanted,
    avoidTokens:colors.avoid,
    preferredPattern:pattern,
    preferredTier:preferredTier(intention),
  };

  const interpretation=[
    occasion+" occasion",
    intention==="Expressive" ? "more distinctive direction" : intention==="Understated" ? "quiet, restrained direction" : "balanced premium direction",
    climate==="Not specified" ? "climate kept flexible" : climate.toLowerCase(),
    ...(colors.wanted.length ? ["colour pull: "+colors.wanted.join(", ")] : []),
    ...(colors.avoid.length ? ["avoid: "+colors.avoid.join(", ")] : []),
    ...(pattern ? [pattern+" fabric preference"] : []),
    ...(style.shirtWear!==designerStyleForOccasion(occasion).shirtWear ? [style.shirtWear.toLowerCase()+" shirt"] : []),
  ];

  return {original,occasion,context:{climate,intention},style,preference,interpretation};
}
