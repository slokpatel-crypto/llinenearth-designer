import type { DesignerBrief } from "@/lib/designer-types";

export type WearFamily = "shirt" | "trouser" | "jacket" | "suit" | "indian";
export type WearType = {
  id: string;
  name: string;
  family: WearFamily;
  subtype: string;
  formality: number;
  structure: "soft" | "medium" | "structured";
  climate: string[];
  occasions: string[];
  bestFabrics: string[];
  avoidFabrics?: string[];
  visual: { collar?: string; lapel?: string; pleats?: number; rise?: string; closure?: string; length?: string; note: string };
};

export type FabricType = {
  id: string;
  name: string;
  aliases: string[];
  composition: string;
  breathability: number;
  drape: number;
  structure: number;
  wrinkleResistance: number;
  formality: number;
  sheen: "matte" | "soft" | "lustrous";
  climates: string[];
  bestGarments: WearFamily[];
  occasions: string[];
  strengths: string[];
  cautions: string[];
};

export const wearTypes: WearType[] = [
  { id:"SH-SPREAD", name:"Spread-Collar Dress Shirt", family:"shirt", subtype:"dress", formality:86, structure:"medium", climate:["mild","warm indoor"], occasions:["business","wedding","formal dinner"], bestFabrics:["cotton-poplin","cotton-twill","linen-cotton"], visual:{collar:"spread",closure:"button front",note:"Clean formal shirt with open collar angle for tailoring."}},
  { id:"SH-CUTAWAY", name:"Cutaway-Collar Dress Shirt", family:"shirt", subtype:"dress", formality:90, structure:"medium", climate:["mild","warm indoor"], occasions:["business formal","wedding","evening"], bestFabrics:["cotton-poplin","cotton-twill"], visual:{collar:"cutaway",closure:"button front",note:"Wide collar opening for a sharper European tailoring language."}},
  { id:"SH-OXFORD", name:"Oxford Button-Down Shirt", family:"shirt", subtype:"smart casual", formality:62, structure:"medium", climate:["mild","warm"], occasions:["office","smart casual","travel"], bestFabrics:["oxford-cotton","cotton-twill"], visual:{collar:"button-down",closure:"button front",note:"Soft structured everyday shirt with a grounded, less formal character."}},
  { id:"SH-CAMP", name:"Camp-Collar Shirt", family:"shirt", subtype:"resort", formality:36, structure:"soft", climate:["hot humid","hot dry"], occasions:["resort","beach","brunch","holiday"], bestFabrics:["linen","linen-cotton","seersucker"], visual:{collar:"camp",closure:"button front",note:"Open-neck relaxed shirt designed for heat and drape."}},
  { id:"SH-BAND", name:"Band-Collar Shirt", family:"shirt", subtype:"contemporary", formality:58, structure:"soft", climate:["hot","mild"], occasions:["festive","smart casual","creative evening"], bestFabrics:["linen","linen-cotton","cotton-poplin"], visual:{collar:"band",closure:"button front",note:"Minimal neckline that bridges Indian and contemporary Western styling."}},
  { id:"SH-POPOVER", name:"Popover Shirt", family:"shirt", subtype:"relaxed tailored", formality:48, structure:"soft", climate:["hot","mild"], occasions:["resort","smart casual","travel"], bestFabrics:["linen","linen-cotton","oxford-cotton"], visual:{collar:"soft spread",closure:"half placket",note:"Relaxed shirt with a partial placket and easy drape."}},
  { id:"SH-KURTA", name:"Tailored Kurta", family:"indian", subtype:"kurta", formality:55, structure:"soft", climate:["hot","mild"], occasions:["festive","day wedding","cultural"], bestFabrics:["linen","cotton-poplin","linen-cotton","silk-blend"], visual:{collar:"band or collarless",closure:"short placket",length:"mid-thigh",note:"Long-line Indian shirt with clean tailored proportions."}},

  { id:"TR-FLAT", name:"Flat-Front Tailored Trouser", family:"trouser", subtype:"classic", formality:78, structure:"medium", climate:["all season"], occasions:["business","wedding","formal dinner"], bestFabrics:["tr-pv","tr-wool","tropical-wool","cotton-twill"], visual:{pleats:0,rise:"mid",closure:"extended or standard",note:"Clean front for dependable formal and business use."}},
  { id:"TR-SINGLE-PLEAT", name:"Single-Pleat Tailored Trouser", family:"trouser", subtype:"tailored", formality:80, structure:"medium", climate:["all season"], occasions:["business","wedding","smart formal"], bestFabrics:["tr-wool","tropical-wool","tr-pv","linen-cotton"], visual:{pleats:1,rise:"mid-high",closure:"extended waistband",note:"Controlled volume with a tailored waist and elegant fall."}},
  { id:"TR-DOUBLE-PLEAT", name:"Double-Pleat High-Rise Trouser", family:"trouser", subtype:"classic tailoring", formality:82, structure:"medium", climate:["mild","warm"], occasions:["wedding","business","evening"], bestFabrics:["tropical-wool","tr-wool","hopsack-wool","linen-cotton"], visual:{pleats:2,rise:"high",closure:"extended waistband",note:"Higher rise and fuller upper leg for a strong tailoring silhouette."}},
  { id:"TR-WIDE", name:"Wide-Leg Trouser", family:"trouser", subtype:"directional", formality:62, structure:"soft", climate:["mild","warm"], occasions:["creative","wedding","smart casual"], bestFabrics:["tropical-wool","linen-cotton","tr-pv"], visual:{pleats:1,rise:"high",note:"Fuller line with deliberate movement and contemporary proportion."}},
  { id:"TR-DRAWSTRING", name:"Tailored Drawstring Trouser", family:"trouser", subtype:"resort", formality:38, structure:"soft", climate:["hot humid","hot dry"], occasions:["resort","beach","travel"], bestFabrics:["linen","linen-cotton","seersucker"], visual:{pleats:0,rise:"mid",closure:"drawstring",note:"Relaxed waist with tailored leg geometry."}},
  { id:"TR-GURKHA", name:"Gurkha Trouser", family:"trouser", subtype:"heritage", formality:64, structure:"medium", climate:["mild","warm"], occasions:["smart casual","creative wedding","resort evening"], bestFabrics:["cotton-twill","linen-cotton","tropical-wool"], visual:{pleats:2,rise:"high",closure:"wrap waistband",note:"Distinctive high waist and side-fastening wrap closure."}},
  { id:"TR-CHINO", name:"Tailored Chino", family:"trouser", subtype:"casual", formality:46, structure:"medium", climate:["warm","mild"], occasions:["smart casual","office casual","travel"], bestFabrics:["cotton-twill","linen-cotton"], visual:{pleats:0,rise:"mid",note:"Cotton-led trouser with cleaner tailoring than a casual chino."}},

  { id:"JK-SB-SOFT", name:"Soft Single-Breasted Blazer", family:"jacket", subtype:"unstructured", formality:72, structure:"soft", climate:["warm","mild"], occasions:["wedding","smart formal","resort evening","business casual"], bestFabrics:["hopsack-wool","tropical-wool","linen","linen-cotton","tr-wool"], visual:{lapel:"notch",closure:"2 button",length:"classic",note:"Light shoulder and reduced internal structure for fluid tailoring."}},
  { id:"JK-SB-STRUCT", name:"Structured Single-Breasted Jacket", family:"jacket", subtype:"formal", formality:86, structure:"structured", climate:["mild","cool"], occasions:["business formal","formal wedding","evening"], bestFabrics:["tr-wool","tropical-wool","wool-flannel"], visual:{lapel:"notch or peak",closure:"2 button",length:"classic",note:"Defined shoulder and chest for a formal architectural silhouette."}},
  { id:"JK-DB", name:"Double-Breasted Blazer", family:"jacket", subtype:"formal statement", formality:88, structure:"structured", climate:["mild","cool"], occasions:["evening","wedding","formal social"], bestFabrics:["tropical-wool","tr-wool","hopsack-wool","wool-flannel"], visual:{lapel:"peak",closure:"6x2",length:"classic",note:"Broader front overlap and peak lapels create a stronger formal presence."}},
  { id:"JK-SAFARI", name:"Safari / Utility Jacket", family:"jacket", subtype:"utility", formality:38, structure:"medium", climate:["warm","mild"], occasions:["travel","smart casual","resort"], bestFabrics:["linen","cotton-twill","linen-cotton"], visual:{collar:"point",closure:"button front",note:"Patch-pocket utility layer with clean tailored proportions."}},
  { id:"JK-OVERSHIRT", name:"Tailored Overshirt", family:"jacket", subtype:"casual layer", formality:34, structure:"soft", climate:["mild","warm"], occasions:["smart casual","travel","resort"], bestFabrics:["linen-cotton","cotton-twill","corduroy"], visual:{collar:"shirt",closure:"button front",note:"Shirt-like outer layer used instead of a conventional blazer."}},

  { id:"SU-2PC-SB", name:"Single-Breasted Two-Piece Suit", family:"suit", subtype:"classic", formality:92, structure:"medium", climate:["all season"], occasions:["business formal","wedding","formal dinner"], bestFabrics:["tropical-wool","tr-wool","tr-pv","wool-flannel"], visual:{lapel:"notch or peak",closure:"2 button",note:"Core matched jacket-and-trouser tailoring system."}},
  { id:"SU-DB", name:"Double-Breasted Suit", family:"suit", subtype:"formal statement", formality:95, structure:"structured", climate:["mild","cool"], occasions:["formal wedding","evening","high formality"], bestFabrics:["tropical-wool","tr-wool","wool-flannel"], visual:{lapel:"peak",closure:"6x2",note:"Strong matched tailoring with a commanding front overlap."}},
  { id:"SU-TUX", name:"Dinner Suit / Tuxedo", family:"suit", subtype:"black tie", formality:100, structure:"structured", climate:["mild","cool indoor"], occasions:["black tie","formal evening","gala"], bestFabrics:["tropical-wool","tr-wool"], avoidFabrics:["linen","seersucker","denim"], visual:{lapel:"satin peak or shawl",closure:"1 button",note:"Evening formalwear with contrast facings and disciplined accessories."}},
  { id:"SU-LINEN", name:"Unstructured Linen Suit", family:"suit", subtype:"summer tailoring", formality:70, structure:"soft", climate:["hot dry","warm"], occasions:["day wedding","resort wedding","summer social"], bestFabrics:["linen","linen-cotton"], visual:{lapel:"notch",closure:"2 button",note:"Breathable warm-weather suit with deliberately softer shape."}},

  { id:"IN-NEHRU", name:"Nehru Jacket / Bandi", family:"indian", subtype:"waistcoat layer", formality:68, structure:"medium", climate:["warm","mild"], occasions:["festive","day wedding","cultural","smart Indian"], bestFabrics:["linen-cotton","cotton-twill","silk-blend","tr-wool"], visual:{collar:"short stand",closure:"button front",length:"hip",note:"Short stand-collar layer worn over kurta or shirt."}},
  { id:"IN-BANDHGALA", name:"Bandhgala / Jodhpuri Jacket", family:"indian", subtype:"formal Indian", formality:94, structure:"structured", climate:["mild","cool indoor"], occasions:["reception","formal wedding","diplomatic","ceremonial"], bestFabrics:["tr-wool","tropical-wool","silk-blend","velvet"], visual:{collar:"closed stand",closure:"full button front",length:"hip to mid-thigh",note:"Formal closed-neck Indian jacket with precise structured tailoring."}},
  { id:"IN-ACHKAN", name:"Achkan", family:"indian", subtype:"long formal Indian", formality:92, structure:"medium", climate:["mild","cool"], occasions:["wedding","ceremonial","festive evening"], bestFabrics:["silk-blend","tr-wool","velvet"], visual:{collar:"stand",closure:"button front",length:"knee or above",note:"Long tailored Indian coat with a straighter, formal line."}},
  { id:"IN-SHERWANI", name:"Sherwani", family:"indian", subtype:"ceremonial", formality:100, structure:"structured", climate:["mild","cool indoor"], occasions:["groom","ceremonial wedding","formal festive"], bestFabrics:["silk-blend","velvet","tr-wool"], visual:{collar:"stand",closure:"button front",length:"knee",note:"Ceremonial long coat where textile richness and structure are central."}},
];

export const fabricTypes: FabricType[] = [
  { id:"linen", name:"Linen", aliases:["pure linen","flax"], composition:"Flax fibre", breathability:98, drape:74, structure:48, wrinkleResistance:24, formality:58, sheen:"matte", climates:["hot humid","hot dry","warm"], bestGarments:["shirt","trouser","jacket","suit","indian"], occasions:["resort","day wedding","smart casual","summer festive"], strengths:["Exceptional breathability","Natural texture","Elegant relaxed drape"], cautions:["Creases visibly","Less suited to strict black-tie or highly structured tailoring"] },
  { id:"linen-cotton", name:"Linen–Cotton", aliases:["linen cotton blend"], composition:"Linen + cotton blend", breathability:90, drape:76, structure:58, wrinkleResistance:44, formality:66, sheen:"matte", climates:["hot humid","hot dry","warm"], bestGarments:["shirt","trouser","jacket","suit","indian"], occasions:["day wedding","resort","smart casual","festive"], strengths:["Cool wearing","More stable than pure linen","Versatile for separates"], cautions:["Still develops natural creasing"] },
  { id:"cotton-poplin", name:"Cotton Poplin", aliases:["poplin"], composition:"Cotton plain weave", breathability:84, drape:62, structure:66, wrinkleResistance:46, formality:82, sheen:"matte", climates:["warm","mild"], bestGarments:["shirt","indian"], occasions:["business","wedding","formal day","smart casual"], strengths:["Crisp clean surface","Excellent shirt definition","Breathable"], cautions:["Can crease","Not ideal for tailored jackets without special construction"] },
  { id:"oxford-cotton", name:"Oxford Cotton", aliases:["oxford cloth"], composition:"Cotton basket weave", breathability:78, drape:56, structure:72, wrinkleResistance:52, formality:60, sheen:"matte", climates:["warm","mild"], bestGarments:["shirt"], occasions:["office","smart casual","travel"], strengths:["Durable","Textured","Holds button-down collars well"], cautions:["Too casual for strict evening formalwear"] },
  { id:"cotton-twill", name:"Cotton Twill", aliases:["twill cotton"], composition:"Cotton twill weave", breathability:68, drape:58, structure:78, wrinkleResistance:60, formality:58, sheen:"matte", climates:["warm","mild"], bestGarments:["shirt","trouser","jacket","indian"], occasions:["smart casual","office casual","travel","day festive"], strengths:["Durable","Good shape retention","Useful for trousers and utility tailoring"], cautions:["Heavier variants can feel warm"] },
  { id:"tr-pv", name:"TR / Poly-Viscose Suiting", aliases:["TR","PV","poly rayon","poly viscose","terry rayon"], composition:"Polyester + viscose/rayon", breathability:58, drape:78, structure:82, wrinkleResistance:90, formality:82, sheen:"soft", climates:["mild","air-conditioned","all season"], bestGarments:["trouser","jacket","suit"], occasions:["office","business","formal","uniform","wedding"], strengths:["Excellent crease resistance","Stable tailoring shape","Smooth wool-like drape","Practical value"], cautions:["Usually less breathable and nuanced than fine wool","Blend ratios materially change hand and heat comfort"] },
  { id:"tr-wool", name:"TR-Wool / Poly-Viscose-Wool", aliases:["TRW","poly wool viscose","poly-viscose-wool"], composition:"Polyester + viscose + wool", breathability:68, drape:86, structure:86, wrinkleResistance:86, formality:92, sheen:"soft", climates:["mild","cool","all season"], bestGarments:["trouser","jacket","suit","indian"], occasions:["business formal","wedding","reception","evening","ceremonial"], strengths:["Sharper tailoring than plain TR","Wool improves richness and moisture handling","Polyester improves durability and shape retention"], cautions:["Exact performance depends strongly on wool percentage and weave"] },
  { id:"tropical-wool", name:"Tropical Wool", aliases:["open weave wool","summer wool"], composition:"Lightweight worsted wool", breathability:86, drape:92, structure:82, wrinkleResistance:82, formality:96, sheen:"soft", climates:["warm","mild","hot dry"], bestGarments:["trouser","jacket","suit","indian"], occasions:["business formal","wedding","evening","formal day"], strengths:["Excellent drape","Breathable for tailoring","High formal credibility"], cautions:["Requires good care","Can cost more than blended suiting"] },
  { id:"hopsack-wool", name:"Hopsack Wool", aliases:["hopsack"], composition:"Open basket-weave wool", breathability:84, drape:82, structure:74, wrinkleResistance:78, formality:78, sheen:"matte", climates:["warm","mild"], bestGarments:["jacket","trouser"], occasions:["business casual","wedding","smart formal","travel"], strengths:["Open breathable weave","Excellent blazer texture","Resists looking flat"], cautions:["More blazer/separate oriented than strict matching suit use"] },
  { id:"wool-flannel", name:"Wool Flannel", aliases:["flannel"], composition:"Milled/brushed wool", breathability:58, drape:90, structure:76, wrinkleResistance:80, formality:84, sheen:"matte", climates:["cool","cold"], bestGarments:["trouser","jacket","suit"], occasions:["winter business","evening","formal","heritage tailoring"], strengths:["Luxurious soft drape","Rich depth of colour","Excellent cool-weather tailoring"], cautions:["Too warm for hot/humid conditions"] },
  { id:"seersucker", name:"Cotton Seersucker", aliases:["seersucker"], composition:"Puckered cotton", breathability:94, drape:54, structure:48, wrinkleResistance:74, formality:48, sheen:"matte", climates:["hot humid","hot dry"], bestGarments:["shirt","trouser","jacket","suit"], occasions:["resort","summer wedding","day social"], strengths:["Air circulation from puckered surface","Does not need a perfectly pressed appearance"], cautions:["Too casual for strict formal or evening black tie"] },
  { id:"denim", name:"Denim", aliases:["indigo denim"], composition:"Cotton twill, commonly indigo dyed", breathability:52, drape:42, structure:88, wrinkleResistance:76, formality:24, sheen:"matte", climates:["mild","cool"], bestGarments:["trouser","jacket"], occasions:["casual","travel","creative casual"], strengths:["Durable","Strong structure","Ages characterfully"], cautions:["Not suitable for conventional formal tailoring"] },
  { id:"corduroy", name:"Corduroy", aliases:["cord"], composition:"Cut-pile cotton or blend", breathability:48, drape:54, structure:84, wrinkleResistance:72, formality:44, sheen:"soft", climates:["cool","cold"], bestGarments:["trouser","jacket"], occasions:["smart casual","winter","creative"], strengths:["Tactile depth","Warmth","Works well for separates"], cautions:["Heavy for hot climates","Reads casual/seasonal"] },
  { id:"velvet", name:"Velvet", aliases:["velour tailoring"], composition:"Pile fabric; fibre content varies", breathability:34, drape:86, structure:64, wrinkleResistance:62, formality:94, sheen:"lustrous", climates:["cool","air-conditioned"], bestGarments:["jacket","indian"], occasions:["evening","reception","ceremonial","festive"], strengths:["Strong evening luxury signal","Rich depth under artificial light"], cautions:["Heat retention","Best used selectively rather than as an all-purpose fabric"] },
  { id:"silk-blend", name:"Silk Blend", aliases:["silk wool","silk viscose","raw silk blend"], composition:"Silk blended with wool, viscose, cotton or synthetics", breathability:64, drape:88, structure:70, wrinkleResistance:58, formality:94, sheen:"lustrous", climates:["mild","air-conditioned"], bestGarments:["jacket","suit","indian"], occasions:["wedding","reception","festive","ceremonial"], strengths:["Refined lustre","Excellent drape","High occasion value"], cautions:["Can show shine strongly","Blend composition must be checked before recommending climate use"] },
];

function norm(value: string) { return value.trim().toLowerCase(); }
function includesAny(value: string, terms: string[]) { const n = norm(value); return terms.some((term) => n.includes(norm(term))); }

export function resolveFabric(value: string): FabricType | undefined {
  const n = norm(value);
  return fabricTypes.find((fabric) => n.includes(norm(fabric.name)) || fabric.aliases.some((alias) => n.includes(norm(alias)) || norm(alias).includes(n)));
}

export function fabricNameFromBrief(brief: DesignerBrief) {
  return brief.fabric.materialOverride || brief.fabric.profile.observations.find((x) => x.label === "Likely material family")?.value || "Unknown fabric";
}

export type FabricJudgement = {
  resolvedFabric?: FabricType;
  garmentRole: WearFamily;
  occasionFit: number;
  climateFit: number;
  roleFit: number;
  overall: number;
  verdict: "excellent" | "strong" | "conditional" | "avoid";
  bestOutfitType: string;
  recommendedRoles: WearFamily[];
  avoidedRoles: WearFamily[];
  reasons: string[];
};

function climateScore(fabric: FabricType, brief: DesignerBrief) {
  const text = `${brief.context.environment} ${brief.context.venue}`.toLowerCase();
  const hot = includesAny(text,["hot","humid","beach","outdoor","garden"]);
  const cold = includesAny(text,["cold","winter","cool"]);
  if (hot) return Math.round((fabric.breathability * .75) + ((100 - fabric.structure) * .25));
  if (cold) return Math.round((100 - fabric.breathability) * .35 + fabric.structure * .65);
  return Math.round((fabric.breathability + fabric.drape + fabric.structure) / 3);
}

function occasionScore(fabric: FabricType, brief: DesignerBrief) {
  const text = `${brief.context.occasion} ${brief.context.formality} ${brief.context.time}`.toLowerCase();
  const blackTie = includesAny(text,["black tie","gala"]);
  const formal = blackTie || includesAny(text,["formal","business","reception","ceremonial"]);
  const resort = includesAny(text,["resort","beach","holiday"]);
  const festive = includesAny(text,["festive","wedding"]);
  if (blackTie) return Math.round(fabric.formality * 1.0);
  if (formal) return Math.round(fabric.formality * .8 + fabric.structure * .2);
  if (resort) return Math.round(fabric.breathability * .65 + (100 - fabric.structure) * .35);
  if (festive) return Math.round(fabric.formality * .5 + fabric.drape * .35 + (fabric.sheen === "lustrous" ? 15 : 8));
  return Math.round((fabric.formality + fabric.drape + fabric.breathability) / 3);
}

function preferredRole(fabric: FabricType, brief: DesignerBrief): WearFamily {
  const formal = includesAny(`${brief.context.formality} ${brief.context.occasion}`,["formal","business","reception","ceremonial"]);
  const resort = includesAny(`${brief.context.venue} ${brief.context.occasion}`,["beach","resort"]);
  if (resort && fabric.bestGarments.includes("shirt")) return "shirt";
  if (formal && fabric.bestGarments.includes("suit")) return "suit";
  if (fabric.bestGarments.includes("jacket") && fabric.formality >= 75) return "jacket";
  if (fabric.bestGarments.includes("trouser")) return "trouser";
  return fabric.bestGarments[0] || "shirt";
}

export function judgeFabricForBrief(brief: DesignerBrief, requestedRole?: WearFamily): FabricJudgement {
  const raw = fabricNameFromBrief(brief);
  const fabric = resolveFabric(raw) || resolveFabric(raw.replace(/ fabric/gi,""));
  if (!fabric) {
    return { garmentRole: requestedRole || "shirt", occasionFit:65, climateFit:65, roleFit:60, overall:63, verdict:"conditional", bestOutfitType:"Fabric-led custom separates", recommendedRoles:["shirt","trouser"], avoidedRoles:[], reasons:["Fabric family is not confidently classified yet.","Confirm fibre composition and weight before final construction decisions."] };
  }
  const role = requestedRole || preferredRole(fabric, brief);
  const roleFit = fabric.bestGarments.includes(role) ? 94 : 42;
  const occasionFit = occasionScore(fabric, brief);
  const climateFit = climateScore(fabric, brief);
  const overall = Math.round(roleFit * .4 + occasionFit * .34 + climateFit * .26);
  const verdict = overall >= 88 ? "excellent" : overall >= 76 ? "strong" : overall >= 58 ? "conditional" : "avoid";
  const avoidedRoles = (["shirt","trouser","jacket","suit","indian"] as WearFamily[]).filter((x) => !fabric.bestGarments.includes(x));
  const bestOutfitType = role === "suit" ? "Matched tailored suit" : role === "jacket" ? "Jacket-led separates" : role === "trouser" ? "Trouser-led separates" : role === "indian" ? "Indian formal / festive ensemble" : "Shirt-led outfit";
  return {
    resolvedFabric:fabric, garmentRole:role, occasionFit, climateFit, roleFit, overall, verdict, bestOutfitType,
    recommendedRoles:[...fabric.bestGarments], avoidedRoles,
    reasons:[
      `${fabric.name} scores ${overall}/100 for this brief when used as the ${role}.`,
      occasionFit >= 80 ? "Its formality and drape are credible for the occasion." : "The occasion requires careful styling so the fabric does not read too casual or too formal.",
      climateFit >= 80 ? "Its heat/structure profile suits the expected environment." : "Climate comfort is a constraint; construction and lining should be adjusted.",
      fabric.cautions[0] || "Confirm final weight and finish before cutting."
    ]
  };
}

export function bestWearForFabric(fabricId: string, occasionText: string) {
  const fabric = fabricTypes.find((x) => x.id === fabricId);
  if (!fabric) return [];
  const occ = norm(occasionText);
  return wearTypes
    .filter((wear) => fabric.bestGarments.includes(wear.family))
    .map((wear) => ({ wear, score: Math.round((wear.bestFabrics.includes(fabric.id) ? 55 : 30) + (wear.occasions.some((x) => occ.includes(norm(x)) || norm(x).includes(occ)) ? 30 : 12) + Math.min(15, fabric.formality / 7)) }))
    .sort((a,b) => b.score - a.score);
}
