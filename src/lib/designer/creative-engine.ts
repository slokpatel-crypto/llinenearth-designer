import type { MeasurementProfile } from "@/lib/measurements";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";
import {
  DESIGNER_STYLE_CHOICES,
  evaluateDesignerCombo,
  type DesignerContext,
  type DesignerFabric,
  type DesignerRecommendation,
  type DesignerStyle,
  type DesignerStyleOverrides,
  type OccasionTier,
} from "@/lib/designer/engine";
import { assessFitConstruction } from "@/lib/designer/fit-construction";
import { evaluateLinenEarthBrandLanguage } from "@/lib/designer/brand-language";
import { creativeLearningSignalFor, type CreativeFeedbackReason, type CreativeLearningBook, type CreativeLearningSignal } from "@/lib/designer/creative-learning";
import type { CreativeResearchLibrary, CreativeResearchSignal } from "@/lib/designer/creative-research";

export type CreativeZone =
  | "collar" | "cuff" | "placket" | "shirt-body" | "pocket"
  | "waistband" | "pleat" | "trouser-leg";

export type CreativeTreatment = {
  id:string;
  zone:CreativeZone;
  label:string;
  instruction:string;
  visualPurpose:string;
  intensity:number;
  buildability:"supported"|"atelier"|"experimental";
};

export type CreativePattern = {
  id:string;
  name:string;
  family:"stripe"|"geometric"|"border"|"tonal"|"placement";
  layout:string;
  scale:"micro"|"fine"|"medium";
  coverage:number;
  palette:string[];
  placement:string;
  note:string;
};

export type CreativeCriticId = "aesthetic"|"originality"|"brand"|"menswear"|"construction";

export type CreativeCriticRead = {
  id:CreativeCriticId;
  label:string;
  score:number;
  verdict:"strong"|"review"|"weak";
  rationale:string[];
  facets?:Array<{label:string;score:number}>;
};

export type CreativeResearchTrace = {
  id:string;
  sourceTitle:string;
  sourceUrl:string;
  extractedPrinciple:string;
  transformedInto:string;
};

export type CreativeDirection = {
  craft?:import("@/lib/designer/creative-spec").CreativeCraftSpec;
  id:string;
  name:string;
  thesis:string;
  baseStyle:DesignerStyle;
  recommendation:DesignerRecommendation;
  treatments:CreativeTreatment[];
  pattern?:CreativePattern;
  critics:CreativeCriticRead[];
  overall:number;
  certainty:number;
  risk:"low"|"moderate"|"high";
  research:CreativeResearchTrace[];
  iteration:number;
  refinement:string[];
  visualSummary:string[];
  learning:CreativeLearningSignal;
  researchUtilization:number;
  explorationClass:"balanced"|"research-led"|"frontier";
  constraintMode:CreativeFreedom;
};

export type CreativeFreedom = "guided"|"exploratory"|"maximum";
export type ResearchMutationOperator = "transfer"|"amplify"|"subtract"|"counterpoint"|"scale-shift";

export type CreativeLabInput = {
  shirt:DesignerFabric;
  pant:DesignerFabric;
  occasion:OccasionTier;
  style:DesignerStyle;
  context:DesignerContext;
  measurements?:MeasurementProfile|null;
  observations?:TailorObservationProfile|null;
  creativeLearning?:CreativeLearningBook|null;
  creativeResearch?:CreativeResearchLibrary|null;
  researchFreedom?:CreativeFreedom;
  limit?:number;
};

type Seed = {
  id:string;
  name:string;
  thesis:string;
  principle:CreativeResearchTrace;
  extraPrinciples?:CreativeResearchTrace[];
  patch?:DesignerStyleOverrides;
  treatments:(input:CreativeLabInput)=>CreativeTreatment[];
  pattern?:(input:CreativeLabInput)=>CreativePattern|undefined;
};

const RESEARCH = {
  wrongness:{
    id:"wrongness-tailoring-2026",
    sourceTitle:"Hed Mayner Fall 2026 Menswear",
    sourceUrl:"https://www.vogue.com/fashion-shows/fall-2026-menswear/hed-mayner",
    extractedPrinciple:"Tailoring can become visually compelling when one expected relationship to the body is intentionally made 'wrong' while the garment remains coherent.",
    transformedInto:"Permit deliberate proportion or construction dislocation—forward sleeve attitude, shifted body volume, displaced seams—without automatically correcting it back to conventional tailoring.",
  },
  tactileDimension:{
    id:"tactile-dimensionality-2026",
    sourceTitle:"Kith Fall 2026 Menswear",
    sourceUrl:"https://www.vogue.com/fashion-shows/fall-2026-menswear/kith",
    extractedPrinciple:"Texture, patina and dimensionality can carry novelty even when silhouette and colour stay controlled.",
    transformedInto:"Let surface depth, edge hardware, stitched relief or tonal material contrast become the main design move instead of always changing cut.",
  },
  quietWild:{
    id:"quiet-wild-balance-2026",
    sourceTitle:"Feng Chen Wang Fall 2026 Menswear",
    sourceUrl:"https://www.vogue.com/fashion-shows/fall-2026-menswear/feng-chen-wang",
    extractedPrinciple:"A tailored look can hold opposing forces—quiet structure and expressive disruption—when each is given a clear role.",
    transformedInto:"Build one disciplined tailoring anchor and one intentionally extreme counter-system rather than averaging both into a safe middle.",
  },
  bodyReframe:{
    id:"formless-form-2026",
    sourceTitle:"IM Men Fall 2026 Menswear",
    sourceUrl:"https://www.vogue.com/fashion-shows/fall-2026-menswear/im-men",
    extractedPrinciple:"Drape, oversized volume and unconventional fastening can redefine masculine elegance without relying on traditional fitted form.",
    transformedInto:"Explore volume and fastening as independent design systems; allow a garment to create a new body outline rather than merely follow the torso.",
  },
  craftDeviation:{
    id:"craft-deviation-2026",
    sourceTitle:"McQueen × Huntsman tailoring collaboration",
    sourceUrl:"https://www.vogue.com/article/inside-mcqueens-savile-row-reunion-with-huntsman",
    extractedPrinciple:"High-level tailoring can deliberately depart from established construction methods when the visual concept requires a precise new silhouette.",
    transformedInto:"Treat traditional tailoring technique as a toolkit, not a fixed boundary: preserve workmanship while permitting changed sleeve, pocket or coat geometry.",
  },
  dynamicDrapeGeometry:{
    id:"dynamic-drape-pattern-geometry",
    sourceTitle:"Unified nonlinear dynamic model for dress dynamic drape and optimization of template structure design",
    sourceUrl:"https://www.sciencedirect.com/science/article/pii/S0010448526000448",
    extractedPrinciple:"Pattern geometry can materially change dynamic drape behavior even when the fabric itself is unchanged; the 2026 study demonstrates this on skirts.",
    transformedInto:"Treat pattern geometry as a visual-motion variable. Translate the principle cautiously into menswear trousers and shirts, then validate on real menswear samples rather than assuming the skirt result transfers directly.",
  },
  seamDrape:{
    id:"seam-position-drape",
    sourceTitle:"Fabric and garment drape",
    sourceUrl:"https://www.sciencedirect.com/topics/engineering/fabric-drape",
    extractedPrinciple:"Seams, seam position and construction interact with fabric mechanics and can change the way a garment drapes.",
    transformedInto:"Use seam placement as part of silhouette design: move or reshape a seam to intentionally redirect folds, shadow and hanging behavior rather than treating seams only as assembly lines.",
  },
  expertFitAttention:{
    id:"expert-fit-attention-zones",
    sourceTitle:"Visual analysis of apparel fit by experts and novices using eye tracking",
    sourceUrl:"https://www.tandfonline.com/doi/full/10.1080/17569370.2020.1781375",
    extractedPrinciple:"Experienced apparel evaluators distribute attention across fit-critical zones such as collar, waist, side seam, dart and armhole instead of judging the garment from one focal detail.",
    transformedInto:"When reviewing a concept, inspect both the hero detail and neighboring structural zones so a dramatic cuff, collar or pattern does not hide a poor overall relationship.",
  },
  divergent:{
    id:"divergent-design-thinking",
    sourceTitle:"The cognitive process of creative design: A perspective of divergent thinking",
    sourceUrl:"https://www.sciencedirect.com/science/article/pii/S1871187123000366",
    extractedPrinciple:"Creative design benefits from deliberate divergent exploration before converging on a small set of candidates.",
    transformedInto:"Expand the design space aggressively first, then let critics narrow it later instead of filtering unusual ideas too early.",
  },
  antiFixation:{
    id:"design-fixation-examples",
    sourceTitle:"Fixation or inspiration? A meta-analytic review of examples in design",
    sourceUrl:"https://www.sciencedirect.com/science/article/pii/S0142694X15000290",
    extractedPrinciple:"Examples can improve novelty and quality but can also narrow the range of idea categories explored.",
    transformedInto:"Use references as principles, then deliberately generate at least one design that changes category, zone or mechanism so the engine does not merely imitate the example.",
  },
  coevolution:{
    id:"creative-design-coevolving-spaces",
    sourceTitle:"Creativity and fixation in the real world",
    sourceUrl:"https://www.sciencedirect.com/science/article/pii/S0142694X19300481",
    extractedPrinciple:"Creative projects can evolve through multiple design spaces at different levels of detail rather than one linear solution path.",
    transformedInto:"Explore surface, proportion, construction and silhouette as separate spaces, then recombine promising moves across them.",
  },
  maya:{
    id:"maya-apparel-typicality-novelty",
    sourceTitle:"The MAYA principle as applied to apparel products",
    sourceUrl:"https://doi.org/10.1108/JFMM-09-2018-0116",
    extractedPrinciple:"Apparel preference balances familiarity and novelty differently by garment category; shirts can support novelty more readily than pants and jackets.",
    transformedInto:"Push original details more freely on shirts, while keeping trouser architecture recognizably tailored unless the entire silhouette is intentionally statement-led.",
  },
  constrainedCreativity:{
    id:"constraints-creative-patternmaking",
    sourceTitle:"Introducing restrictions to achieve unlimited creativity in the fashion design process",
    sourceUrl:"https://doi.org/10.31274/itaa.17920",
    extractedPrinciple:"Deliberate constraints can create productive creative search instead of simply reducing options.",
    transformedInto:"Lock one familiar garment code, then force invention into a different zone so the idea has tension without becoming random.",
  },
  designGrammar:{
    id:"garment-design-visual-grammar",
    sourceTitle:"Garment design: visual design elements and principles",
    sourceUrl:"https://www.sciencedirect.com/topics/engineering/garment-design",
    extractedPrinciple:"Garment appearance emerges from interacting line, texture, silhouette, proportion, balance, emphasis, rhythm and harmony rather than any one detail.",
    transformedInto:"Critique concepts as compositions: one focal point, controlled rhythm, proportional relationships and a coherent silhouette.",
  },
  stripeSpacing:{
    id:"stripe-spacing-perception",
    sourceTitle:"The influence of striped clothing on visual body perception",
    sourceUrl:"https://journals.sagepub.com/doi/10.1177/20416695261441454",
    extractedPrinciple:"Stripe spacing changes visual body perception; line direction alone is not enough to predict the effect.",
    transformedInto:"Treat stripe spacing and interruption rhythm as design variables, not just horizontal-versus-vertical labels.",
  },
  complexity:{
    id:"novelty-complexity-balance",
    sourceTitle:"Too new or too complex? Apparel design evaluation",
    sourceUrl:"https://doi.org/10.1108/JFMM-10-2016-0092",
    extractedPrinciple:"Novelty and complexity interact; pushing both to the maximum can reduce aesthetic response.",
    transformedInto:"When a concept is highly novel, quiet at least one secondary design system instead of stacking novelty everywhere.",
  },
  engineeredPrint:{
    id:"engineered-print-3d-2d",
    sourceTitle:"A new design concept: 3D to 2D textile pattern design for garments",
    sourceUrl:"https://www.sciencedirect.com/science/article/pii/S0010448517300313",
    extractedPrinciple:"Surface graphics can be designed on the three-dimensional garment first and then resolved back to pattern pieces for seam continuity.",
    transformedInto:"Generate motifs around garment geometry and protected zones rather than treating the fabric as an infinite flat repeat.",
  },
  proportionSystem:{
    id:"harmonic-proportion-tailoring",
    sourceTitle:"Brunello Cucinelli Spring 2026 Menswear",
    sourceUrl:"https://www.vogue.com/fashion-shows/spring-2026-menswear/brunello-cucinelli",
    extractedPrinciple:"When lower-body volume expands, related upper-body details can change scale so the whole silhouette remains proportionally coherent.",
    transformedInto:"Let collar breadth, cuff depth and trouser volume respond to each other as one proportion system.",
  },
  constructionShift:{
    id:"construction-axis-shift",
    sourceTitle:"Hed Mayner Fall 2026 Menswear",
    sourceUrl:"https://www.vogue.com/fashion-shows/fall-2026-menswear/hed-mayner",
    extractedPrinciple:"A familiar tailored garment can feel new when one construction axis is deliberately displaced.",
    transformedInto:"Experiment with one shifted seam, pocket, sleeve or fastening axis while keeping the rest of the garment disciplined.",
  },
  foldArchitecture:{
    id:"fold-architecture",
    sourceTitle:"Setchu Spring 2026 Menswear",
    sourceUrl:"https://www.vogue.com/fashion-shows/spring-2026-menswear/setchu",
    extractedPrinciple:"Fold logic can become the architecture of a tailored garment rather than surface decoration.",
    transformedInto:"Use one controlled fold or crease system as a structural signature in plackets, pockets or panels.",
  },
  visualAttention:{
    id:"visual-attention-interaction",
    sourceTitle:"Interaction of clothing design factors and visual attention",
    sourceUrl:"https://doi.org/10.1108/JFMM-10-2021-0269",
    extractedPrinciple:"Clothing features attract attention through their interaction and contrast, not only their isolated intensity.",
    transformedInto:"Place contrast to create a deliberate path for the eye and suppress competing focal points.",
  },
  framing:{
    id:"archive-framing",
    sourceTitle:"Fashioning Masculinities",
    sourceUrl:"https://www.vam.ac.uk/articles/about-the-fashioning-masculinities-exhibition",
    extractedPrinciple:"Menswear identity can be shifted by changing familiar codes rather than replacing the whole garment.",
    transformedInto:"Concentrate contrast or shape at one framing zone such as collar or cuff, then keep the body quieter.",
  },
  colour:{
    id:"colour-context",
    sourceTitle:"In the Pink: colour in menswear",
    sourceUrl:"https://www.vam.ac.uk/articles/in-the-pink-colour-in-menswear",
    extractedPrinciple:"Colour meaning changes across time and context; menswear colour does not have to follow one permanent convention.",
    transformedInto:"Use controlled colour placement as a design device rather than treating colour only as a matching exercise.",
  },
  movement:{
    id:"movement-volume",
    sourceTitle:"Homme Plisse Spring/Summer 2025",
    sourceUrl:"https://eu.isseymiyake.com/blogs/news/17671",
    extractedPrinciple:"Volume and movement can be part of a garment's visual identity.",
    transformedInto:"Create rhythm through proportion, pleat placement and line direction while preserving a readable silhouette.",
  },
  event:{
    id:"event-narrative",
    sourceTitle:"Wedding Season costume design",
    sourceUrl:"https://www.netflix.com/tudum/articles/wedding-season-outfits-indian-dresses",
    extractedPrinciple:"A look can carry a visual idea across an event through repeated but subtle colour cues.",
    transformedInto:"Repeat one detail in two separated zones so the outfit feels composed rather than decorated at random.",
  },
} satisfies Record<string,CreativeResearchTrace>;

function clamp(value:number){return Math.max(0,Math.min(100,value));}
function round(value:number){return Math.round(clamp(value)*10)/10;}
function verdict(score:number):CreativeCriticRead["verdict"]{return score>=80?"strong":score>=63?"review":"weak";}
function txt(value:string){return value.toLowerCase();}
function has(list:string[],pattern:RegExp){return list.some((value)=>pattern.test(value));}

function choice<K extends keyof DesignerStyle>(key:K,pattern:RegExp,fallback:DesignerStyle[K]):DesignerStyle[K] {
  return (DESIGNER_STYLE_CHOICES[key].find((item)=>pattern.test(item)) || fallback) as DesignerStyle[K];
}

function safePatch(input:CreativeLabInput,patch?:DesignerStyleOverrides):DesignerStyle {
  const out={...input.style};
  for(const [rawKey,value] of Object.entries(patch||{})) {
    const key=rawKey as keyof DesignerStyle;
    if(typeof value==="string" && DESIGNER_STYLE_CHOICES[key]?.includes(value)) out[key]=value;
  }
  return out;
}

function palette(input:CreativeLabInput,accent="#F4F0E8") {
  return [input.shirt.hex || "#D8D2C8",accent,input.pant.hex || "#2A3140"];
}

function treatment(
  id:string,zone:CreativeZone,label:string,instruction:string,visualPurpose:string,
  intensity:number,buildability:CreativeTreatment["buildability"]="atelier",
):CreativeTreatment {
  return {id,zone,label,instruction,visualPurpose,intensity,buildability};
}

function researchSeed(signal:CreativeResearchSignal):Seed {
  const patternFamily = signal.patternFamily === "none" ? undefined : signal.patternFamily;
  return {
    id:`research-${signal.id}`,
    name:signal.title,
    thesis:signal.transformedIdea,
    principle:{
      id:signal.id,
      sourceTitle:signal.title,
      sourceUrl:signal.sourceUrl,
      extractedPrinciple:signal.principle,
      transformedInto:signal.transformedIdea,
    },
    treatments:()=>[
      treatment(
        `research-${signal.id}-primary`,
        signal.zone,
        signal.treatmentLabel,
        signal.treatmentInstruction,
        signal.visualPurpose,
        signal.intensity,
        signal.buildability,
      ),
      ...(signal.secondaryZone ? [treatment(
        `research-${signal.id}-echo`,
        signal.secondaryZone,
        `${signal.treatmentLabel} echo`,
        `Echo the primary idea at ${signal.secondaryZone} at lower intensity; do not create a second competing focal point.`,
        "Build visual rhythm without duplicating the full treatment.",
        Math.max(12,Math.round(signal.intensity*.42)),
        signal.buildability==="experimental"?"atelier":signal.buildability,
      )] : []),
    ],
    pattern:patternFamily ? (input)=>({
      id:`research-pattern-${signal.id}`,
      name:signal.patternName || signal.title,
      family:patternFamily,
      layout:signal.patternLayout || signal.transformedIdea,
      scale:signal.patternScale || "fine",
      coverage:Math.max(0,Math.min(60,signal.patternCoverage ?? 24)),
      palette:palette(input,"#F1ECE4"),
      placement:signal.patternPlacement || `Concentrate around ${signal.zone}; preserve a quiet field elsewhere.`,
      note:`Research-derived design hypothesis from ${signal.sourceUrl}. Sample and visually review before production.`,
    }) : undefined,
  };
}

function researchTrace(signal:CreativeResearchSignal):CreativeResearchTrace {
  return {
    id:signal.id,
    sourceTitle:signal.title,
    sourceUrl:signal.sourceUrl,
    extractedPrinciple:signal.principle,
    transformedInto:signal.transformedIdea,
  };
}

const CREATIVE_ZONES:CreativeZone[]=["collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"];

function shiftedZone(zone:CreativeZone,offset:number):CreativeZone {
  const index=CREATIVE_ZONES.indexOf(zone);
  return CREATIVE_ZONES[(index+offset+CREATIVE_ZONES.length)%CREATIVE_ZONES.length] || zone;
}

function researchMutationSeed(signal:CreativeResearchSignal,operator:ResearchMutationOperator,index:number):Seed {
  const trace=researchTrace(signal);
  const family=signal.patternFamily==="none"?undefined:signal.patternFamily;
  const destination=operator==="transfer" ? shiftedZone(signal.zone,3) : signal.zone;
  const counterZone=shiftedZone(signal.zone,5);
  const intensity=operator==="amplify" ? Math.min(100,Math.round(signal.intensity*1.42))
    : operator==="subtract" ? Math.max(12,Math.round(signal.intensity*.55))
      : operator==="scale-shift" ? Math.min(100,Math.round(signal.intensity*1.18))
        : Math.min(100,Math.max(30,signal.intensity));
  const operationInstruction=operator==="transfer"
    ? `Transfer the source mechanism from ${signal.zone} into ${destination}; preserve the principle, not the original appearance.`
    : operator==="amplify"
      ? "Exaggerate the source principle until its geometry or placement becomes the primary visual signature."
      : operator==="subtract"
        ? "Remove secondary decoration and express the source principle through the smallest possible number of lines, planes or zones."
        : operator==="counterpoint"
          ? `Keep the source move at ${signal.zone}, then create a quieter opposing response at ${counterZone} rather than a literal repeat.`
          : "Change the scale relationship of the source move dramatically while preserving its logic and location.";
  const visualPurpose=operator==="transfer"
    ? "Tests whether the research mechanism survives when moved into a new garment function."
    : operator==="amplify"
      ? "Finds the strongest version of the research idea before later convergence."
      : operator==="subtract"
        ? "Tests whether the idea becomes more sophisticated when almost everything non-essential is removed."
        : operator==="counterpoint"
          ? "Creates tension between two zones instead of simple repetition."
          : "Tests proportion as a variable rather than treating the source scale as fixed.";

  return {
    id:`mutation-${operator}-${signal.id}-${index}`,
    name:`${signal.title} / ${operator.replace("-"," ")}`,
    thesis:`${signal.transformedIdea} Mutation: ${operationInstruction}`,
    principle:trace,
    treatments:()=>[
      treatment(
        `mutation-${operator}-${signal.id}`,
        destination,
        `${signal.treatmentLabel} / ${operator}`,
        `${operationInstruction} Base mechanism: ${signal.treatmentInstruction}`,
        visualPurpose,
        intensity,
        operator==="amplify"||operator==="transfer"||operator==="scale-shift" ? "experimental" : signal.buildability,
      ),
      ...(operator==="counterpoint" ? [treatment(
        `mutation-counter-${signal.id}`,
        counterZone,
        "Counterpoint response",
        `Use a restrained response at ${counterZone}; invert emphasis, spacing or edge direction without copying the primary move.`,
        "Builds visual dialogue between two different garment zones.",
        Math.max(18,Math.round(signal.intensity*.48)),
        "atelier",
      )] : []),
    ],
    pattern:family ? (input)=>({
      id:`mutation-pattern-${operator}-${signal.id}`,
      name:`${signal.patternName || signal.title} / ${operator}`,
      family,
      layout:operator==="scale-shift"
        ? `Re-scale the motif progressively instead of holding one repeat size. ${signal.patternLayout || signal.transformedIdea}`
        : operator==="subtract"
          ? `Reduce the motif to its essential marks with much more negative space. ${signal.patternLayout || signal.transformedIdea}`
          : signal.patternLayout || signal.transformedIdea,
      scale:operator==="amplify" ? "medium" : operator==="subtract" ? "micro" : signal.patternScale || "fine",
      coverage:operator==="amplify" ? Math.min(60,(signal.patternCoverage ?? 24)+18)
        : operator==="subtract" ? Math.max(7,Math.round((signal.patternCoverage ?? 24)*.48))
          : Math.max(8,Math.min(58,signal.patternCoverage ?? 24)),
      palette:palette(input,"#EFE9E1"),
      placement:operator==="transfer"
        ? `Move pattern emphasis toward ${destination}; protect ${signal.zone} as a quieter reference zone.`
        : signal.patternPlacement || `Use the pattern where it strengthens the ${destination} concept and preserve negative space elsewhere.`,
      note:`Research mutation (${operator}) derived from ${signal.sourceUrl}; this is a transformed hypothesis, not a reproduction of the source.`,
    }) : undefined,
  };
}

function diverseResearchSignals(signals:CreativeResearchSignal[],limit:number) {
  const selected:CreativeResearchSignal[]=[];
  const selectedIds=new Set<string>();
  const groups=new Map<string,CreativeResearchSignal[]>();
  for(const signal of signals) {
    const key=[signal.sourceType,signal.zone,signal.patternFamily,signal.buildability].join("|");
    const group=groups.get(key) || [];
    group.push(signal);
    groups.set(key,group);
  }
  for(const group of groups.values()) {
    const signal=group[0];
    if(signal && !selectedIds.has(signal.id)) {
      selected.push(signal);
      selectedIds.add(signal.id);
      if(selected.length>=limit) return selected;
    }
  }
  for(const signal of signals) {
    if(selectedIds.has(signal.id)) continue;
    selected.push(signal);
    selectedIds.add(signal.id);
    if(selected.length>=limit) break;
  }
  return selected;
}

function researchDistance(a:CreativeResearchSignal,b:CreativeResearchSignal) {
  return (a.zone!==b.zone?4:0)
    +(a.patternFamily!==b.patternFamily?3:0)
    +(a.sourceType!==b.sourceType?2:0)
    +(a.buildability!==b.buildability?1:0)
    +(Boolean(a.secondaryZone)!==Boolean(b.secondaryZone)?1:0);
}

function distantPartner(signal:CreativeResearchSignal,signals:CreativeResearchSignal[]) {
  return [...signals]
    .filter((candidate)=>candidate.id!==signal.id)
    .sort((a,b)=>researchDistance(signal,b)-researchDistance(signal,a) || a.id.localeCompare(b.id))[0];
}

function researchMutationSeeds(signals:CreativeResearchSignal[],limit:number):Seed[] {
  const operators:ResearchMutationOperator[]=["transfer","amplify","subtract","counterpoint","scale-shift"];
  const seeds:Seed[]=[];
  for(let i=0;i<Math.min(limit,signals.length);i+=1) {
    const signal=signals[i];
    if(!signal) continue;
    for(const operator of operators) seeds.push(researchMutationSeed(signal,operator,i));
  }
  return seeds;
}

function hybridResearchSeed(a:CreativeResearchSignal,b:CreativeResearchSignal,index:number):Seed {
  const aPattern=a.patternFamily==="none"?undefined:a.patternFamily;
  const bPattern=b.patternFamily==="none"?undefined:b.patternFamily;
  const chosenPattern=aPattern ? a : bPattern ? b : undefined;
  const family=chosenPattern?.patternFamily==="none"?undefined:chosenPattern?.patternFamily;
  return {
    id:`hybrid-${a.id}-${b.id}-${index}`,
    name:`${a.title} × ${b.title}`,
    thesis:`Cross-pollinate two research principles: ${a.transformedIdea} Then use ${b.transformedIdea.toLowerCase()} as the counter-move.`,
    principle:researchTrace(a),
    extraPrinciples:[researchTrace(b)],
    treatments:()=>[
      treatment(
        `hybrid-${a.id}-primary`,
        a.zone,
        a.treatmentLabel,
        a.treatmentInstruction,
        a.visualPurpose,
        Math.min(100,Math.max(45,a.intensity)),
        a.buildability,
      ),
      treatment(
        `hybrid-${b.id}-counter`,
        b.zone===a.zone ? (b.secondaryZone || (a.zone==="cuff"?"shirt-body":"cuff")) : b.zone,
        b.treatmentLabel,
        b.treatmentInstruction,
        b.visualPurpose,
        Math.min(92,Math.max(36,Math.round(b.intensity*.84))),
        b.buildability,
      ),
    ],
    pattern:chosenPattern && family ? (input)=>({
      id:`hybrid-pattern-${a.id}-${b.id}`,
      name:chosenPattern.patternName || `${chosenPattern.title} field`,
      family,
      layout:chosenPattern.patternLayout || chosenPattern.transformedIdea,
      scale:chosenPattern.patternScale || "fine",
      coverage:Math.max(8,Math.min(52,chosenPattern.patternCoverage ?? 26)),
      palette:palette(input,"#EFE9E1"),
      placement:chosenPattern.patternPlacement || `Use the pattern only where it supports the ${chosenPattern.zone} idea; keep the second research move visually separate.`,
      note:`Hybrid research concept derived from ${a.sourceUrl} and ${b.sourceUrl}; it must be visually reviewed as a new synthesis, not treated as a copied look.`,
    }) : undefined,
  };
}


function frontierCrossZoneSeed(seed:Seed,index:number):Seed {
  const zoneCycle:CreativeZone[]=["collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"];
  const sourceZone=zoneCycle[index%zoneCycle.length];
  const targetZone=zoneCycle[(index*3+5)%zoneCycle.length];
  return {
    ...seed,
    id:`frontier-${seed.id}-${index}`,
    name:`${seed.name} / Frontier Transfer`,
    thesis:`Push the source principle into a new design mechanism and zone before critique: ${seed.thesis}`,
    treatments:(input)=>{
      const original=seed.treatments(input);
      const primary=original[0];
      const secondary=original[1];
      return [
        treatment(
          `frontier-${seed.id}-primary`,
          targetZone,
          `${primary?.label || seed.name} transfer`,
          `${primary?.instruction || seed.thesis} Reinterpret the mechanism in the ${targetZone} zone rather than preserving the original location.`,
          `${primary?.visualPurpose || seed.thesis} The purpose is retained while the physical expression changes category.`,
          Math.min(100,Math.max(72,(primary?.intensity || 62)+14)),
          "experimental",
        ),
        ...(secondary ? [treatment(
          `frontier-${seed.id}-counter`,
          sourceZone===targetZone?"shirt-body":sourceZone,
          `${secondary.label} counterpoint`,
          `${secondary.instruction} Treat this only as a counterpoint; it may contradict normal house restraint if the composition remains visually legible.`,
          secondary.visualPurpose,
          Math.min(96,Math.max(48,secondary.intensity+10)),
          "experimental",
        )] : []),
      ];
    },
  };
}

const SEEDS:Seed[]=[
  {
    id:"intentional-wrongness",
    name:"Intentional Wrongness",
    thesis:"Make one tailoring relationship deliberately 'wrong' enough to feel new, while keeping the rest exact.",
    principle:RESEARCH.wrongness,
    treatments:()=>[
      treatment("wrong-sleeve-attitude","shirt-body","Forward sleeve attitude","Shift the apparent sleeve pitch and shoulder-to-sleeve flow slightly forward rather than following the expected vertical fall.","Changes the body's perceived stance without adding decoration.",88,"experimental"),
      treatment("stable-neck-frame","collar","Stable neck frame","Keep the collar highly controlled and recognisable.","Creates a precise reference point against the displaced sleeve/body relationship.",16,"supported"),
    ],
  },
  {
    id:"tactile-relief",
    name:"Tactile Relief",
    thesis:"Create visual richness through depth and texture rather than another colour or print.",
    principle:RESEARCH.tactileDimension,
    treatments:()=>[
      treatment("raised-cuff-relief","cuff","Raised cuff relief","Build a narrow stitched, corded or layered relief line near the cuff edge so light creates a physical shadow.","Adds dimensionality that changes with lighting and movement.",66,"atelier"),
      treatment("tonal-placket-relief","placket","Tonal placket relief","Echo the relief more subtly along part of the placket with no colour contrast.","Creates a tactile rhythm without turning the garment graphic.",34,"atelier"),
    ],
  },
  {
    id:"quiet-wild",
    name:"Quiet × Wild",
    thesis:"Hold one side of the design very disciplined and let one other system become intentionally extreme.",
    principle:RESEARCH.quietWild,
    treatments:()=>[
      treatment("quiet-tailored-anchor","collar","Quiet tailored anchor","Keep collar, centre front and shoulder line clean and exact.","Provides a conventional visual anchor.",12,"supported"),
      treatment("wild-cuff-plane","cuff","Wild cuff plane","Extend, split, fold or layer the cuff geometry beyond normal proportions as the single expressive counter-system.","Creates deliberate tension instead of safe compromise.",94,"experimental"),
    ],
  },
  {
    id:"new-body-outline",
    name:"New Body Outline",
    thesis:"Let volume redraw the body rather than treating fit as the only valid silhouette.",
    principle:RESEARCH.bodyReframe,
    patch:{shirtFit:"Relaxed Fit",trouser:"Wide-leg / Relaxed Drape Trouser"},
    treatments:()=>[
      treatment("floating-side-volume","shirt-body","Floating side volume","Add controlled side-body volume or drape that separates from the torso before returning near the hem.","Creates a silhouette independent of the body's exact outline.",82,"experimental"),
      treatment("unusual-fastening-axis","placket","Alternative fastening axis","Shift or partially offset the fastening path so it participates in the new volume structure.","Makes fastening part of silhouette architecture.",71,"experimental"),
    ],
  },
  {
    id:"craft-deviation",
    name:"Craft Deviation",
    thesis:"Use precise tailoring skill to execute geometry that traditional tailoring would normally avoid.",
    principle:RESEARCH.craftDeviation,
    treatments:()=>[
      treatment("curved-sleeve-geometry","shirt-body","Curved sleeve geometry","Engineer a visibly curved sleeve path or rotated sleeve relationship while preserving a clean armhole finish.","Uses craftsmanship to support a new silhouette instead of forcing the idea back to a standard sleeve.",84,"experimental"),
      treatment("high-pocket-shift","pocket","High pocket shift","Raise or curve the pocket position enough to alter the upper-body proportion.","Rebalances the visual centre of gravity.",62,"experimental"),
    ],
  },
  {
    id:"motion-geometry",
    name:"Motion Geometry",
    thesis:"Design trouser movement through pattern geometry instead of relying only on softer fabric.",
    principle:RESEARCH.dynamicDrapeGeometry,
    treatments:()=>[
      treatment("motion-leg-profile","trouser-leg","Motion leg profile","Change lower-leg volume and the longitudinal pattern profile so folds open and close more visibly during movement; preserve a clean standing silhouette as the reference state.","Makes movement itself part of the visual design language.",74,"experimental"),
      treatment("motion-pleat-release","pleat","Directed pleat release","Use the pleat as a controlled release point for movement rather than a decorative crease.","Connects front architecture to dynamic drape.",53,"atelier"),
    ],
  },
  {
    id:"seam-sculpt",
    name:"Seam Sculpt",
    thesis:"Move a seam to redirect shadow and fold behavior, then let the cloth reveal the construction.",
    principle:RESEARCH.seamDrape,
    treatments:()=>[
      treatment("seam-sculpt-line","trouser-leg","Sculpting seam","Shift a conventional trouser seam or introduce one controlled panel seam so the line guides where folds and shadows develop.","Uses construction to shape visual drape rather than merely assembling panels.",68,"experimental"),
      treatment("seam-sculpt-upper","waistband","Quiet upper anchor","Keep waistband treatment restrained so the new seam remains the lower-body architectural idea.","Maintains a stable anchor above the moving seam line.",16,"supported"),
    ],
  },
  {
    id:"divergent-zone-jump",
    name:"Zone Jump",
    thesis:"Move the source idea into a different garment zone so research becomes transformation rather than imitation.",
    principle:RESEARCH.antiFixation,
    treatments:()=>[
      treatment("zone-jump-collar","collar","Transferred geometry","Borrow the logic of an edge, interruption or proportion idea but express it in collar geometry instead of the source location.","Breaks direct copying while preserving the underlying visual principle.",72,"experimental"),
      treatment("zone-jump-trouser","waistband","Remote echo","Translate only a small fragment of the same logic into the waistband or side-adjuster area.","Creates a cross-garment relationship without repeating the same detail literally.",35,"atelier"),
    ],
  },
  {
    id:"multi-space-recombination",
    name:"Multi-Space Recombination",
    thesis:"Combine one surface idea, one proportion move and one construction shift, then let the critic decide which should dominate.",
    principle:RESEARCH.coevolution,
    treatments:()=>[
      treatment("recombine-proportion","cuff","Proportion move","Change cuff depth or edge scale enough to alter the sleeve ending visibly.","Opens the proportion design space.",68,"experimental"),
      treatment("recombine-construction","pocket","Construction move","Shift pocket geometry or seam direction independently from the cuff idea.","Opens a second design space without assuming the two ideas must match.",58,"experimental"),
      treatment("recombine-quiet-axis","placket","Quiet axis","Keep the placket visually quiet to provide one stable reference.","Prevents multi-space exploration from collapsing into visual noise.",15,"supported"),
    ],
    pattern:(input)=>({
      id:"multi-space-surface",name:"Interrupted Field",family:"placement",
      layout:"Sparse line fragments increase around one outer body zone and disappear near the centre front.",
      scale:"fine",coverage:26,palette:palette(input,"#EFE9E1"),placement:"Outer shirt body only; preserve centre front and collar as negative space.",
      note:"Surface, proportion and construction are explored independently before final convergence.",
    }),
  },
  {
    id:"divergent-first",
    name:"Divergent First",
    thesis:"Generate a deliberately unfamiliar visual mechanism before asking whether it belongs in the final garment.",
    principle:RESEARCH.divergent,
    treatments:()=>[
      treatment("divergent-fold-cuff","cuff","Folded cuff architecture","Use an asymmetric fold or stepped edge to create a new cuff silhouette rather than decorating a standard cuff.","Tests a new visual mechanism instead of another colour variation.",82,"experimental"),
      treatment("divergent-side-line","shirt-body","Side-body line","Introduce one off-centre line or panel that changes with movement.","Creates a second spatial cue without repeating the cuff geometry.",52,"experimental"),
    ],
  },
  {
    id:"locked-code",
    name:"Locked Code",
    thesis:"Keep one menswear convention untouched and force the new idea to happen somewhere else.",
    principle:RESEARCH.constrainedCreativity,
    treatments:()=>[
      treatment("locked-centre-front","placket","Locked centre front","Keep the centre-front placket conventional and visually quiet; do not use it as the novelty zone.","Creates a familiar anchor that makes a new secondary detail easier to read.",12,"supported"),
      treatment("invented-cuff-plane","cuff","Invented cuff plane","Change cuff depth or edge geometry while preserving the familiar shirt body and centre front.","Concentrates invention in one controlled location rather than randomizing the whole shirt.",64,"experimental"),
    ],
  },
  {
    id:"maya-shirt",
    name:"Familiar / New",
    thesis:"Pair a recognisable tailored shirt structure with one clearly new visual code.",
    principle:RESEARCH.maya,
    treatments:()=>[
      treatment("familiar-collar-anchor","collar","Familiar collar anchor","Keep the collar within a recognisable point/spread family so the face frame remains legible.","Provides typicality as a stable anchor.",18,"supported"),
      treatment("novel-cuff-detail","cuff","Novel cuff detail","Introduce a new cuff proportion, border or layered edge as the primary novelty.","Places greater novelty in a shirt detail where the category can support it.",60,"atelier"),
    ],
  },
  {
    id:"graduated-stripe",
    name:"Graduated Stripe",
    thesis:"Use spacing changes to alter rhythm and apparent proportion instead of using a generic repeated stripe.",
    principle:RESEARCH.stripeSpacing,
    treatments:()=>[
      treatment("graduated-stripe-field","shirt-body","Graduated stripe field","Keep stripe width fine while gradually opening the spacing toward the outer body; reset symmetrically around the centre front.","Creates controlled width and rhythm through spacing rather than loud colour.",46),
    ],
    pattern:(input)=>({
      id:"graduated-stripe-pattern",name:"Graduated Rail",family:"stripe",
      layout:"Fine vertical rails whose spacing slowly increases from centre front toward the side seams; no abrupt scale jumps.",
      scale:"fine",coverage:36,palette:palette(input,"#EFE9E0"),placement:"Shirt body with collar and cuffs quieter than the body field.",
      note:"Spacing logic is informed by stripe-perception research; final optical effect must be judged on a full-scale sample.",
    }),
  },
  {
    id:"seam-continuity",
    name:"Seam Continuity",
    thesis:"Design the motif around the three-dimensional shirt so the graphic appears to travel across panel boundaries.",
    principle:RESEARCH.engineeredPrint,
    treatments:()=>[
      treatment("seam-continuity","shirt-body","Seam-aware motif","Place one directional motif so it appears to continue from front body toward side/back rather than restarting at each panel.","Makes the pattern belong to the garment architecture.",58,"atelier"),
    ],
    pattern:(input)=>({
      id:"seam-continuity-pattern",name:"Continuous Field",family:"placement",
      layout:"A sparse diagonal-to-vertical motif changes direction near the side body so visual flow can continue across sewn panels.",
      scale:"fine",coverage:31,palette:palette(input,"#ECE6DD"),placement:"Engineered across body panels; keep collar, placket and cuff mostly clear.",
      note:"Must be mapped to actual pattern pieces before printing; generic tiling is not acceptable for this concept.",
    }),
  },
  {
    id:"proportion-echo",
    name:"Proportion Echo",
    thesis:"Treat collar breadth, cuff depth and trouser volume as one connected proportion system.",
    principle:RESEARCH.proportionSystem,
    patch:{trouser:"Wide-leg / Relaxed Drape Trouser"},
    treatments:()=>[
      treatment("broader-collar-balance","collar","Broader collar balance","Increase visible collar breadth modestly when the trouser silhouette becomes substantially wider; keep point length controlled.","Prevents a wide lower silhouette from visually overpowering the face frame.",55,"atelier"),
      treatment("cuff-scale-balance","cuff","Scaled cuff","Increase cuff depth slightly, but below the collar's visual importance.","Repeats the scale shift without turning the sleeve end into a competing statement.",34,"atelier"),
    ],
  },
  {
    id:"shifted-axis",
    name:"Shifted Axis",
    thesis:"Make one familiar tailored element intentionally off-axis while leaving the rest disciplined.",
    principle:RESEARCH.constructionShift,
    treatments:()=>[
      treatment("shifted-front-pocket","pocket","Shifted pocket axis","Rotate or offset one pocket opening by a small controlled amount; keep the opposite side conventional or absent.","Introduces tension through construction rather than extra decoration.",66,"experimental"),
      treatment("quiet-placket-axis","placket","Stable centre line","Keep the placket visually calm and straight.","Gives the eye a stable reference so the shifted detail reads as intentional.",16,"supported"),
    ],
  },
  {
    id:"fold-architecture",
    name:"Fold Architecture",
    thesis:"Use a fold as construction, not ornament.",
    principle:RESEARCH.foldArchitecture,
    treatments:()=>[
      treatment("folded-placket","placket","Folded placket plane","Build one controlled fold beside or within the placket so light creates a second narrow plane without adding another colour.","Creates depth through garment geometry.",61,"experimental"),
      treatment("fold-pocket-echo","pocket","Fold echo","Repeat only a smaller fold logic at the pocket opening.","Makes the construction language coherent.",28,"atelier"),
    ],
  },
  {
    id:"white-frame",
    name:"White Frame",
    thesis:"Turn the cuff into the focal point and echo it once near the face.",
    principle:RESEARCH.framing,
    patch:{collarFinish:"White contrast collar + cuffs"},
    treatments:()=>[
      treatment("extended-white-cuff","cuff","Extended white cuff","Use a clean white cuff with visibly greater depth than a standard barrel cuff; keep the edge square and quiet.","Creates a deliberate bright frame around the hands.",72),
      treatment("quiet-collar-echo","collar","Quiet collar echo","Use only a narrow white reveal at the collar edge or inner stand rather than a fully dominant white collar.","Repeats the cuff idea without making the shirt look costume-like.",38),
    ],
  },
  {
    id:"broken-rail",
    name:"Broken Rail",
    thesis:"Create a new vertical rhythm that visually lengthens the shirt without becoming a conventional stripe.",
    principle:RESEARCH.colour,
    treatments:()=>[
      treatment("quiet-placket","placket","Quiet placket","Reduce visible placket contrast so the generated line pattern becomes the main vertical architecture.","Protects one clear focal system.",30,"supported"),
    ],
    pattern:(input)=>({
      id:"broken-rail-pattern",name:"Broken Rail",family:"stripe",
      layout:"Two fine vertical rails with short staggered interruptions; repeat spacing changes gradually toward the hem.",
      scale:"fine",coverage:34,palette:palette(input,"#F2EEE6"),
      placement:"Shirt body only; keep collar and cuff mostly clear.",
      note:"An engineered line concept, not a stock fabric claim. It must be sampled before production.",
    }),
  },
  {
    id:"cuff-border",
    name:"Cuff Border Rhythm",
    thesis:"Keep the body nearly plain and move the pattern to the garment edge.",
    principle:RESEARCH.event,
    treatments:()=>[
      treatment("border-cuff","cuff","Engineered cuff border","Run a narrow repeating line motif parallel to the cuff edge with generous empty space around it.","Makes the cuff special without covering the shirt.",58),
      treatment("border-pocket-echo","pocket","Pocket echo","Repeat only one fragment of the cuff motif at the pocket opening.","Creates visual rhythm across separated zones.",26),
    ],
    pattern:(input)=>({
      id:"edge-code",name:"Edge Code",family:"border",layout:"Fine broken geometry arranged as a narrow border, with a longer pause after every third unit.",
      scale:"micro",coverage:16,palette:palette(input,"#ECE6DC"),placement:"Cuff edge plus a very small pocket echo.",
      note:"Placement pattern generated as a design proposal; print/weave method is intentionally undecided.",
    }),
  },
  {
    id:"tonal-shadow",
    name:"Tonal Shadow",
    thesis:"Build depth using almost-the-same colour instead of obvious contrast.",
    principle:RESEARCH.colour,
    treatments:(input)=>[
      treatment("tonal-panel","shirt-body","Tonal shadow panel",`Add a narrow tonal panel 8-12% darker than the selected ${input.shirt.name} direction, running from shoulder toward the side seam.`,"Adds depth that appears only as the wearer moves.",46),
      treatment("self-cuff","cuff","Quiet cuff","Keep the cuff self-coloured and simple so the panel remains the idea.","Prevents competing accents.",18,"supported"),
    ],
    pattern:(input)=>({
      id:"tonal-shadow-field",name:"Shadow Weft",family:"tonal",
      layout:"An ultra-low-contrast field built from elongated tonal marks that become slightly denser toward one side-body panel; no hard border and no obvious all-over repeat.",
      scale:"micro",coverage:22,palette:[input.shirt.hex || "#D8D2C8","#C9C3BA","#E7E2DA"],
      placement:"Shirt body only, concentrated beside the tonal panel; collar, placket and cuff stay nearly plain.",
      note:"Designed to read first as fabric depth and only later as pattern. Sample under directional light before production.",
    }),
  },
  {
    id:"offset-grid",
    name:"Offset Grid",
    thesis:"Use a geometric repeat with deliberate missing intersections so it feels drawn, not generic.",
    principle:RESEARCH.framing,
    treatments:()=>[
      treatment("clear-collar","collar","Clear collar field","Keep the collar free of the main repeat.","Creates a clean frame around the face.",24,"supported"),
    ],
    pattern:(input)=>({
      id:"offset-grid-pattern",name:"Offset Grid",family:"geometric",
      layout:"Fine rectangular grid; every second column shifts half a module and selected intersections disappear.",
      scale:"fine",coverage:42,palette:palette(input,"#EEE9E0"),placement:"Shirt body with a clean collar and restrained cuff.",
      note:"Original repeat logic generated by the Designer Lab; sample at actual scale before judging.",
    }),
  },
  {
    id:"double-rhythm",
    name:"Double Rhythm",
    thesis:"Repeat one line at the collar and trouser waist so the outfit reads as one composition.",
    principle:RESEARCH.event,
    treatments:()=>[
      treatment("collar-line","collar","Collar line","Add one narrow contrast line inside the collar edge rather than a full contrast panel.","Gives the upper body a precise focal edge.",32),
      treatment("waist-line","waistband","Waistband echo","Repeat the same line very narrowly inside the waistband or side-adjuster detail.","Connects shirt and trouser without matching them literally.",26),
    ],
  },
  {
    id:"pleat-axis",
    name:"Pleat Axis",
    thesis:"Let trouser architecture carry the statement while the shirt remains controlled.",
    principle:RESEARCH.movement,
    patch:{trouser:"Pleated Trouser"},
    treatments:()=>[
      treatment("pleat-axis","pleat","Extended pleat axis","Use the main pleat as a strong uninterrupted visual line; avoid decorative stitching around it.","Builds height and movement through construction lines.",52,"supported"),
      treatment("quiet-shirt","shirt-body","Quiet shirt field","Keep the shirt body free of a second large motif.","Lets proportion, not surface decoration, lead the look.",12,"supported"),
    ],
  },
  {
    id:"asymmetric-pocket",
    name:"Single Shift",
    thesis:"Introduce one controlled asymmetry and leave everything around it disciplined.",
    principle:RESEARCH.framing,
    treatments:()=>[
      treatment("shift-pocket","pocket","Shifted pocket geometry","Use one pocket with an extended lower corner or offset top line; do not mirror the alteration elsewhere.","Creates tension through one deliberate irregularity.",64,"experimental"),
      treatment("quiet-front","placket","Quiet front","Keep the front closure visually simple.","Makes asymmetry feel intentional rather than busy.",18,"supported"),
    ],
  },
  {
    id:"negative-space",
    name:"Negative Space",
    thesis:"Design the empty areas as carefully as the motif.",
    principle:RESEARCH.colour,
    treatments:()=>[
      treatment("empty-center","shirt-body","Protected centre field","Reserve a clean vertical field around the placket and move visual activity toward the outer third of the shirt.","Makes the body look calmer and more architectural.",48),
    ],
    pattern:(input)=>({
      id:"negative-space-pattern",name:"Outer Field",family:"placement",
      layout:"Sparse micro marks become gradually denser toward the side seams while the centre front stays clear.",
      scale:"micro",coverage:28,palette:palette(input,"#F1ECE3"),placement:"Outer shirt body only; no motif within the centre-front protected field.",
      note:"Placement logic is generated; artwork and repeat engineering still require development.",
    }),
  },
  {
    id:"collar-extension",
    name:"Long Point",
    thesis:"Change the face frame through proportion before adding decoration.",
    principle:RESEARCH.framing,
    patch:{collar:choice("collar",/point/i,"Point (Standard) Collar")},
    treatments:()=>[
      treatment("long-point","collar","Extended point proportion","Lengthen the point visually while keeping spread controlled; avoid adding contrast at the same time.","Changes character through geometry rather than ornament.",67,"atelier"),
      treatment("short-cuff","cuff","Restrained cuff","Keep cuff depth conventional.","Balances the stronger collar proportion.",16,"supported"),
    ],
  },
  {
    id:"micro-chevron",
    name:"Drift Chevron",
    thesis:"Use a directional micro-pattern that changes angle slowly across the body.",
    principle:RESEARCH.movement,
    treatments:()=>[
      treatment("direction-control","shirt-body","Directional control","Keep motif small enough that the changing angle is discovered at closer distance.","Creates movement without a loud print.",40),
    ],
    pattern:(input)=>({
      id:"drift-chevron-pattern",name:"Drift Chevron",family:"geometric",
      layout:"Micro chevrons rotate a few degrees across successive vertical bands instead of repeating at one fixed angle.",
      scale:"micro",coverage:38,palette:palette(input,"#EAE5DC"),placement:"Shirt body; reset direction at placket for a clean centre.",
      note:"A generated surface concept that needs print/weave sampling and optical review at real garment scale.",
    }),
  },
];

function treatmentLoad(treatments:CreativeTreatment[],pattern?:CreativePattern) {
  const base=treatments.reduce((sum,item)=>sum+item.intensity,0);
  return base + (pattern ? pattern.coverage*.9 : 0);
}

function duplicateZones(treatments:CreativeTreatment[]) {
  return treatments.length-new Set(treatments.map((item)=>item.zone)).size;
}

function researchFit(seed:Seed,input:CreativeLabInput) {
  let score=74;
  if(seed.principle.id==="movement-volume" && /Casual|Smart-Casual/.test(input.occasion)) score+=10;
  if(seed.principle.id==="event-narrative" && /Semi-Formal|Formal/.test(input.occasion)) score+=8;
  if(seed.principle.id==="archive-framing" && input.context.intention!=="Understated") score+=5;
  return clamp(score);
}

function sourceDistance(seed:Seed,treatments:CreativeTreatment[],pattern?:CreativePattern) {
  const zones=new Set(treatments.map((item)=>item.zone)).size;
  let score=54;
  if(seed.id.startsWith("mutation-")) score+=18;
  if(seed.id.startsWith("hybrid-")) score+=22;
  if(seed.id.startsWith("frontier-")) score+=20;
  score+=Math.min(18,(seed.extraPrinciples?.length || 0)*8);
  score+=Math.min(10,Math.max(0,zones-1)*5);
  if(pattern) score+=5;
  if(seed.id.startsWith("research-") && !(seed.extraPrinciples?.length)) score-=4;
  return clamp(score);
}

function criticsFor(
  seed:Seed,input:CreativeLabInput,style:DesignerStyle,treatments:CreativeTreatment[],pattern:CreativePattern|undefined,
  recommendation:DesignerRecommendation,
) {
  const load=treatmentLoad(treatments,pattern);
  const zones=new Set(treatments.map((item)=>item.zone)).size;
  const experimental=treatments.filter((item)=>item.buildability==="experimental").length;
  const atelier=treatments.filter((item)=>item.buildability==="atelier").length;
  const fit=assessFitConstruction(input.measurements,style,{climate:input.context.climate,shirtFabric:input.shirt,trouserFabric:input.pant,observations:input.observations});
  const brand=evaluateLinenEarthBrandLanguage(input.shirt,input.pant,style,input.occasion,input.context);

  const proportionFacet=clamp(
    74
    +(treatments.some((item)=>/proportion|depth|breadth|volume|length|scale/i.test(item.instruction+" "+item.visualPurpose))?10:0)
    -(load>145?10:0)
  );
  const hierarchyFacet=clamp(
    76
    +(treatments.some((item)=>/quiet|protected|restrained|stable|anchor/i.test(item.label+" "+item.instruction))?11:0)
    -(treatments.filter((item)=>item.intensity>=60).length>2?13:0)
  );
  const rhythmFacet=clamp(
    72
    +(pattern?8:0)
    +(treatments.some((item)=>/repeat|echo|rhythm|line|spacing|axis/i.test(item.instruction+" "+item.visualPurpose))?9:0)
    -duplicateZones(treatments)*4
  );
  const harmonyFacet=clamp(
    77
    +(zones>=2&&zones<=3?7:0)
    -(load>135?8:0)
    -(pattern && pattern.coverage>48?6:0)
  );

  let aesthetic=proportionFacet*.27+hierarchyFacet*.31+rhythmFacet*.20+harmonyFacet*.22;
  aesthetic-=Math.max(0,load-150)*.12;
  aesthetic+=pattern && pattern.coverage<=42?3:0;
  // Research on apparel aesthetics suggests novelty and complexity should not
  // both be maximized. High novelty is allowed, but only when another system is quiet.
  const complexity=treatments.length+(pattern?1:0)+Math.round(load/70);
  const noveltyBase=54+zones*7+(pattern?13:0)+atelier*4+experimental*7;
  if(noveltyBase>82 && complexity>=5) aesthetic-=9;
  else if(noveltyBase>76 && complexity<=4) aesthetic+=4;
  if(input.context.intention==="Understated" && load>95) aesthetic-=14;
  if(input.context.intention==="Expressive" && load<45) aesthetic-=9;

  const referenceDistance=sourceDistance(seed,treatments,pattern);
  let originality=54+zones*7+(pattern?13:0)+atelier*4+experimental*7;
  if(treatments.length===1&&!pattern) originality-=7;
  originality-=Math.max(0,treatments.length-3)*6;
  originality=originality*.74+referenceDistance*.26;

  const trouserNovelty=treatments.filter((item)=>["waistband","pleat","trouser-leg"].includes(item.zone)).reduce((sum,item)=>sum+item.intensity,0);
  const shirtNovelty=treatments.filter((item)=>["collar","cuff","placket","shirt-body","pocket"].includes(item.zone)).reduce((sum,item)=>sum+item.intensity,0);
  // MAYA evidence is category-sensitive: shirts can carry a more visible novelty
  // signal, while trousers benefit from a stronger familiar tailoring anchor.
  if(shirtNovelty>55 && trouserNovelty<45) originality+=3;
  if(trouserNovelty>95 && shirtNovelty>80) aesthetic-=7;

  let brandScore=brand.score*.72+28;
  if(load>145) brandScore-=10;
  if(pattern && pattern.scale==="micro") brandScore+=4;
  if(has(treatments.map((item)=>item.visualPurpose),/deliberate|precise|quiet|controlled|architectural/i)) brandScore+=4;

  let menswear=recommendation.designFitScore*.82+researchFit(seed,input)*.18;
  if(recommendation.formality.match===false) menswear-=28;
  if(recommendation.rules.some((item)=>item.status==="flag"&&item.severity==="High")) menswear-=24;

  let construction=fit.fitScore*.76+24;
  construction-=experimental*16+atelier*4;
  if(pattern?.family==="placement") construction-=4;
  if(treatments.some((item)=>item.id==="extended-white-cuff") && !/french|double|barrel/i.test(txt(style.cuff))) construction-=8;

  const reads:CreativeCriticRead[]=[
    {id:"aesthetic",label:"Aesthetic critic",score:round(aesthetic),verdict:verdict(aesthetic),rationale:[
      hierarchyFacet<68?"Too many elements compete for attention; one focal system needs to lead.":"The concept has a readable focal hierarchy rather than equal emphasis everywhere.",
      proportionFacet<68?"The relationship between detail scale and silhouette needs another pass.":"Detail scale and silhouette remain proportionally legible.",
      rhythmFacet<68?"The visual rhythm is weak or repetitive without purpose.":"Repetition, spacing or echo creates a deliberate visual rhythm.",
      "Final visual review should inspect the hero detail together with collar/armhole/waist/side-seam relationships rather than judging one isolated focal point.",
    ],facets:[
      {label:"Proportion",score:round(proportionFacet)},
      {label:"Hierarchy",score:round(hierarchyFacet)},
      {label:"Rhythm",score:round(rhythmFacet)},
      {label:"Harmony",score:round(harmonyFacet)},
    ]},
    {id:"originality",label:"Originality critic",score:round(originality),verdict:verdict(originality),rationale:[
      pattern?"The surface logic is generated as a placement/repeat proposal rather than selected from the stock pattern labels.":"Originality comes from garment detailing and proportion rather than a new surface repeat.",
      experimental?"One element deliberately leaves the normal house vocabulary and needs human design review.":"The idea mutates familiar menswear codes without relying on random novelty.",
      referenceDistance<62?"The concept is still too close to a single source mechanism; prefer mutation, cross-zone transfer or hybrid research before promotion.":"The source principle has been transformed far enough to read as a new design hypothesis.",
      trouserNovelty>95?"Trouser novelty is high; preserve a recognisable tailoring anchor so difference reads as intentional.":"Typicality and novelty remain in a readable relationship.",
    ],facets:[
      {label:"Novelty",score:round(Math.min(100,54+zones*8+(pattern?15:0)+experimental*8))},
      {label:"Typicality anchor",score:round(100-Math.min(70,(trouserNovelty+shirtNovelty)*.22))},
      {label:"Transformation",score:round(62+(atelier+experimental)*8+(pattern?12:0))},
      {label:"Source distance",score:round(referenceDistance)},
    ]},
    {id:"brand",label:"Linen Earth critic",score:round(brandScore),verdict:verdict(brandScore),rationale:[
      "Uses the existing Linen Earth brand-language evaluator as a soft signal, not a veto.",
      load>145?"The amount of visual activity risks overpowering the cloth.":"The treatment leaves enough quiet cloth for the fabric to remain visible.",
    ],facets:[
      {label:"House language",score:round(brand.score)},
      {label:"Cloth visibility",score:round(100-Math.max(0,load-70)*.45)},
      {label:"Restraint",score:round(92-Math.max(0,treatments.length-2)*10-(pattern&&pattern.coverage>42?8:0))},
    ]},
    {id:"menswear",label:"Menswear critic",score:round(menswear),verdict:verdict(menswear),rationale:[
      recommendation.formality.match===false?"The base cut conflicts with the selected occasion band.":"The underlying cut remains inside the current occasion grammar.",
      "Research is converted into a design principle rather than copied as a finished look.",
    ],facets:[
      {label:"Occasion code",score:round(
        recommendation.formality.match===true ? 92
          : recommendation.formality.match===false ? Math.max(18,58-Math.abs(recommendation.formality.delta ?? 1)*14)
            : 58
      )},
      {label:"Design fit",score:round(recommendation.designFitScore)},
      {label:"Research translation",score:round(researchFit(seed,input))},
    ]},
    {id:"construction",label:"Construction critic",score:round(construction),verdict:verdict(construction),rationale:[
      experimental?"Experimental detail needs a toile/sample before approval.":atelier?"Atelier-level detailing needs pattern-maker review but is not treated as impossible.":"The main treatment stays close to supported construction.",
      "Construction is a guardrail with lower ranking weight; it does not dominate the visual decision.",
    ],facets:[
      {label:"Base fit",score:round(fit.fitScore)},
      {label:"Pattern risk",score:round(92-experimental*24-atelier*7)},
      {label:"Sample readiness",score:round(94-experimental*28-atelier*9-(pattern?.family==="placement"?6:0))},
    ]},
  ];
  return {reads,fit,brand};
}

function scoreCritics(reads:CreativeCriticRead[],freedom:CreativeFreedom) {
  const map=Object.fromEntries(reads.map((item)=>[item.id,item.score])) as Record<CreativeCriticId,number>;
  if(freedom==="maximum") {
    // Maximum-research mode intentionally gives the creative critics most of the
    // influence. Brand, convention and construction still speak, but cannot dominate.
    return round(
      map.aesthetic*.38+
      map.originality*.34+
      map.brand*.06+
      map.menswear*.08+
      map.construction*.06
    );
  }
  if(freedom==="exploratory") {
    return round(map.aesthetic*.34+map.originality*.26+map.brand*.13+map.menswear*.16+map.construction*.11);
  }
  return round(map.aesthetic*.32+map.originality*.23+map.brand*.16+map.menswear*.19+map.construction*.10);
}

function certaintyFor(recommendation:DesignerRecommendation,seed:Seed,treatments:CreativeTreatment[],pattern?:CreativePattern) {
  const buildKnown=treatments.filter((item)=>item.buildability==="supported").length/Math.max(1,treatments.length);
  const research=seed.principle.sourceUrl?100:45;
  const patternPenalty=pattern?9:0;
  return round(recommendation.confidenceScore*.55+research*.20+buildKnown*100*.25-patternPenalty);
}

function hardBlocked(recommendation:DesignerRecommendation,freedom:CreativeFreedom) {
  const absoluteFeasibilityBlock=recommendation.rules.some((item)=>
    item.status==="flag" &&
    item.severity==="High" &&
    /safety|impossible|unavailable|not[ -]?in[ -]?stock|cannot[ -]?be[ -]?constructed|invalid material/i.test(item.id+" "+item.explanation)
  );
  // Even maximum-research mode should not spend render/critique cycles on a
  // literally unavailable or physically impossible base. Everything else,
  // including unusual proportions and formality tension, stays open.
  if(absoluteFeasibilityBlock) return true;
  if(freedom==="maximum") return false;
  if(freedom==="exploratory") return false;
  return recommendation.formality.match===false || recommendation.rules.some((item)=>item.status==="flag"&&item.severity==="High");
}

function buildDirection(seed:Seed,input:CreativeLabInput,iteration:number,treatmentsOverride?:CreativeTreatment[],patternOverride?:CreativePattern,refinement:string[]=[],variant="core"):CreativeDirection|null {
  const style=safePatch(input,seed.patch);
  const recommendation=evaluateDesignerCombo(input.shirt,input.pant,input.occasion,style,undefined,input.context);
  const freedom=input.researchFreedom || "maximum";
  if(hardBlocked(recommendation,freedom)) return null;
  const treatments=treatmentsOverride || seed.treatments(input);
  const pattern=patternOverride===undefined ? seed.pattern?.(input) : patternOverride;
  const {reads}=criticsFor(seed,input,style,treatments,pattern,recommendation);
  const learning=creativeLearningSignalFor(seed.id,input.creativeLearning);
  const researchExpansionBonus=freedom==="maximum"
    ? Math.min(14,
        (pattern?4:0)
        +treatments.filter((item)=>item.buildability==="experimental").length*3
        +Math.max(0,treatments.length-1)*1.5
        +(seed.extraPrinciples?.length?3:0)
        +(["research-","mutation-","hybrid-","frontier-"].some((prefix)=>seed.id.startsWith(prefix))?3:0)
      )
    : freedom==="exploratory" ? 2 : 0;
  const overall=round(scoreCritics(reads,freedom)+learning.score+researchExpansionBonus);
  const renderPenalty=learning.renderRisk==="high"?10:learning.renderRisk==="moderate"?4:0;
  const certainty=round(certaintyFor(recommendation,seed,treatments,pattern)-renderPenalty);
  const construction=reads.find((item)=>item.id==="construction")?.score ?? 0;
  const aesthetic=reads.find((item)=>item.id==="aesthetic")?.score ?? 0;
  const ruleConflict=recommendation.formality.match===false || recommendation.rules.some((item)=>item.status==="flag"&&item.severity==="High");
  const risk:CreativeDirection["risk"]=construction<52||ruleConflict?"high":certainty<58||aesthetic<62?"moderate":"low";
  return {
    id:`creative:${seed.id}:${variant}:v${iteration}`,name:seed.name,thesis:seed.thesis,baseStyle:style,recommendation,
    treatments,pattern,critics:reads,overall,certainty,risk,research:[seed.principle,...(seed.extraPrinciples || [])],iteration,refinement,
    visualSummary:[
      ...treatments.slice(0,2).map((item)=>`${item.label}: ${item.visualPurpose}`),
      ...(pattern?[ `${pattern.name}: ${pattern.layout}` ]:[]),
    ].slice(0,3),
    learning,
    researchUtilization:round(
      38
      +Math.min(26,(1+(seed.extraPrinciples?.length || 0))*13)
      +(pattern?10:0)
      +Math.min(16,treatments.filter((item)=>item.buildability!=="supported").length*6)
      +(seed.id.startsWith("mutation-")?8:0)
      +(seed.id.startsWith("hybrid-")?10:0)
      +(seed.id.startsWith("frontier-")?12:0)
    ),
    explorationClass:variant==="radical"||seed.id.startsWith("frontier-")
      ?"frontier"
      :(seed.extraPrinciples?.length||["research-","mutation-","hybrid-"].some((prefix)=>seed.id.startsWith(prefix)))
        ?"research-led"
        :"balanced",
    constraintMode:freedom,
  };
}

function criticFacetScore(direction:CreativeDirection,criticId:CreativeCriticId,label:string) {
  return direction.critics.find((item)=>item.id===criticId)?.facets?.find((facet)=>facet.label===label)?.score ?? 0;
}

function refine(seed:Seed,input:CreativeLabInput,first:CreativeDirection,iteration=2):CreativeDirection {
  let treatments=first.treatments.map((item)=>({...item}));
  let pattern=first.pattern?{...first.pattern,palette:[...first.pattern.palette]}:undefined;
  const notes:string[]=[];
  const aesthetic=first.critics.find((item)=>item.id==="aesthetic")?.score ?? 0;
  const brand=first.critics.find((item)=>item.id==="brand")?.score ?? 0;
  const construction=first.critics.find((item)=>item.id==="construction")?.score ?? 0;
  const proportion=criticFacetScore(first,"aesthetic","Proportion");
  const hierarchy=criticFacetScore(first,"aesthetic","Hierarchy");
  const rhythm=criticFacetScore(first,"aesthetic","Rhythm");
  const harmony=criticFacetScore(first,"aesthetic","Harmony");
  const freedom=input.researchFreedom || "maximum";

  if(freedom==="maximum") {
    // Maximum mode keeps the frontier idea, but the critic is allowed to edit
    // supporting signals so unusual work still reads as intentional rather than noisy.
    if(hierarchy<72 && treatments.length>1) {
      const hero=Math.max(...treatments.map((item)=>item.intensity));
      let keptHero=false;
      treatments=treatments.map((item)=>{
        if(!keptHero && item.intensity===hero){keptHero=true;return item;}
        return {...item,intensity:Math.max(16,Math.round(item.intensity*.84))};
      });
      if(pattern && pattern.coverage>44) pattern={...pattern,coverage:Math.max(34,pattern.coverage-8),note:`${pattern.note} Secondary coverage reduced after hierarchy critique.`};
      notes.push("Visual critic protected one hero move and quietened competing secondary signals.");
    }
    if(proportion<70 && treatments.length) {
      const ordered=[...treatments].sort((a,b)=>b.intensity-a.intensity);
      const heroId=ordered[0]?.id;
      treatments=treatments.map((item)=>item.id===heroId
        ? {...item,intensity:Math.min(100,item.intensity+6)}
        : {...item,intensity:Math.max(18,Math.round(item.intensity*.92))});
      notes.push("Rebalanced hero-to-supporting detail scale to strengthen proportion.");
    }
    if(harmony<70 && treatmentLoad(treatments,pattern)>150) {
      treatments=treatments.map((item,index)=>index===0?item:{...item,intensity:Math.max(18,Math.round(item.intensity*.90))});
      if(pattern && pattern.coverage>50) pattern={...pattern,coverage:46,note:`${pattern.note} Coverage tuned after harmony critique.`};
      notes.push("Reduced total visual load without removing the research-led concept.");
    }
    if(rhythm<66 && pattern && pattern.coverage<24) {
      pattern={...pattern,coverage:Math.min(34,pattern.coverage+8),note:`${pattern.note} Repeat visibility increased to create a clearer visual rhythm.`};
      notes.push("Strengthened the repeated surface signal so the idea reads as rhythm, not isolated decoration.");
    }
    if(aesthetic<55 && treatmentLoad(treatments,pattern)>175) {
      treatments=treatments.map((item,index)=>index===0?item:{...item,intensity:Math.max(18,Math.round(item.intensity*.88))});
      if(pattern && pattern.coverage>54) pattern={...pattern,coverage:50,note:`${pattern.note} Coverage was reduced only enough to restore a readable focal hierarchy.`};
      notes.push("Pulled back only the most competing secondary signals; the research-led idea remains intentionally strong.");
    }
    if(construction<52) notes.push("Kept the experimental geometry intact; require toile/sample engineering rather than simplifying the idea prematurely.");
    if(brand<55) notes.push("House-language tension is preserved as an intentional frontier test instead of being edited away.");
  } else {
    if(aesthetic<78 && treatmentLoad(treatments,pattern)>110) {
      treatments=treatments.map((item,index)=>index===0?item:{...item,intensity:Math.max(12,Math.round(item.intensity*.72))});
      if(pattern && pattern.coverage>30) pattern={...pattern,coverage:Math.round(pattern.coverage*.78),note:`${pattern.note} Refinement reduced motif coverage to protect the focal hierarchy.`};
      notes.push("Reduced secondary visual load so one idea leads.");
    }
    if(brand<74 && pattern && pattern.scale!=="micro") {
      pattern={...pattern,scale:"micro",coverage:Math.min(pattern.coverage,32)};
      notes.push("Tightened pattern scale to keep the cloth reading premium and controlled.");
    }
    if(construction<65) {
      const experimentalIndex=treatments.findIndex((item)=>item.buildability==="experimental");
      if(experimentalIndex>=0) {
        treatments[experimentalIndex]={...treatments[experimentalIndex],buildability:"atelier",intensity:Math.max(40,treatments[experimentalIndex].intensity-12),instruction:`${treatments[experimentalIndex].instruction} Refine the geometry on a toile before committing.`};
        notes.push("Converted the most experimental detail into an atelier-review version.");
      }
    }
  }
  const variant=first.id.split(":")[2] || "core";
  return buildDirection(seed,input,iteration,treatments,pattern,[...first.refinement,...notes],variant) || first;
}

function revisionMerit(direction:CreativeDirection) {
  const aesthetic=direction.critics.find((item)=>item.id==="aesthetic")?.score ?? 0;
  const originality=direction.critics.find((item)=>item.id==="originality")?.score ?? 0;
  const hierarchy=criticFacetScore(direction,"aesthetic","Hierarchy");
  const proportion=criticFacetScore(direction,"aesthetic","Proportion");
  const riskPenalty=direction.risk==="high"?8:direction.risk==="moderate"?3:0;
  return direction.overall+aesthetic*.18+originality*.08+hierarchy*.05+proportion*.05-riskPenalty;
}

function redesignLoop(seed:Seed,input:CreativeLabInput,first:CreativeDirection) {
  const pass2=refine(seed,input,first,2);
  const pass3=refine(seed,input,pass2,3);
  return [first,pass2,pass3].sort((a,b)=>revisionMerit(b)-revisionMerit(a))[0];
}

function signature(item:CreativeDirection) {
  return [
    item.baseStyle.collar,
    item.baseStyle.cuff,
    item.pattern?.family||"none",
    item.pattern?.scale||"none",
    ...item.treatments.map((t)=>`${t.zone}:${t.id}:${Math.round(t.intensity/10)*10}`)
  ].join("|");
}

function directionDiversity(direction:CreativeDirection) {
  const hero=[...direction.treatments].sort((a,b)=>b.intensity-a.intensity)[0];
  return {
    heroZone:hero?.zone || "none",
    patternFamily:direction.pattern?.family || "none",
    researchIds:new Set(direction.research.map((item)=>item.id)),
    class:direction.explorationClass,
  };
}

function diversityBonus(candidate:CreativeDirection,chosen:CreativeDirection[]) {
  if(!chosen.length) return 0;
  const read=directionDiversity(candidate);
  let bonus=0;
  const zones=new Set(chosen.map((item)=>directionDiversity(item).heroZone));
  const patterns=new Set(chosen.map((item)=>directionDiversity(item).patternFamily));
  const classes=new Set(chosen.map((item)=>directionDiversity(item).class));
  if(!zones.has(read.heroZone)) bonus+=12;
  if(!patterns.has(read.patternFamily)) bonus+=read.patternFamily==="none"?3:10;
  if(!classes.has(read.class)) bonus+=6;
  const usedResearch=new Set(chosen.flatMap((item)=>item.research.map((research)=>research.id)));
  const freshResearch=[...read.researchIds].filter((id)=>!usedResearch.has(id)).length;
  bonus+=Math.min(12,freshResearch*5);
  return bonus;
}

function pairwisePreference(a:CreativeDirection,b:CreativeDirection,freedom:CreativeFreedom) {
  const score=(item:CreativeDirection,id:CreativeCriticId)=>item.critics.find((critic)=>critic.id===id)?.score ?? 0;
  const weights:Record<CreativeCriticId,number>=freedom==="maximum"
    ? {aesthetic:.40,originality:.34,brand:.06,menswear:.08,construction:.12}
    : freedom==="exploratory"
      ? {aesthetic:.35,originality:.27,brand:.12,menswear:.14,construction:.12}
      : {aesthetic:.32,originality:.23,brand:.16,menswear:.18,construction:.11};
  let margin=0;
  for(const id of ["aesthetic","originality","brand","menswear","construction"] as CreativeCriticId[]) {
    const delta=score(a,id)-score(b,id);
    // A tiny difference is not meaningful enough to count as a real preference.
    if(Math.abs(delta)>=3) margin+=Math.sign(delta)*weights[id]*Math.min(16,Math.abs(delta));
  }
  const aHierarchy=criticFacetScore(a,"aesthetic","Hierarchy");
  const bHierarchy=criticFacetScore(b,"aesthetic","Hierarchy");
  if(Math.abs(aHierarchy-bHierarchy)>=4) margin+=Math.sign(aHierarchy-bHierarchy)*.55;
  const aDistance=a.critics.find((critic)=>critic.id==="originality")?.facets?.find((facet)=>facet.label==="Source distance")?.score ?? 0;
  const bDistance=b.critics.find((critic)=>critic.id==="originality")?.facets?.find((facet)=>facet.label==="Source distance")?.score ?? 0;
  if(Math.abs(aDistance-bDistance)>=5) margin+=Math.sign(aDistance-bDistance)*.45;
  if(a.risk!==b.risk) {
    const riskValue={low:0,moderate:1,high:2};
    margin+=(riskValue[b.risk]-riskValue[a.risk])*.35;
  }
  return margin;
}

function pairwiseTournament(items:CreativeDirection[],freedom:CreativeFreedom) {
  const reads=items.map((item)=>({item,wins:0,losses:0,margin:0}));
  for(let i=0;i<reads.length;i+=1) {
    for(let j=i+1;j<reads.length;j+=1) {
      const margin=pairwisePreference(reads[i].item,reads[j].item,freedom);
      reads[i].margin+=margin;
      reads[j].margin-=margin;
      if(margin>0.18){reads[i].wins+=1;reads[j].losses+=1;}
      else if(margin<-0.18){reads[j].wins+=1;reads[i].losses+=1;}
    }
  }
  return reads
    .sort((a,b)=>
      (b.wins-b.losses)-(a.wins-a.losses)
      || b.margin-a.margin
      || revisionMerit(b.item)-revisionMerit(a.item)
    )
    .map((read)=>read.item);
}

function refinementShortlist(
  items:Array<{seed:Seed;direction:CreativeDirection}>,
  count:number,
  freedom:CreativeFreedom,
) {
  const picked:Array<{seed:Seed;direction:CreativeDirection}>=[];
  const seen=new Set<string>();
  const add=(entry:{seed:Seed;direction:CreativeDirection}|undefined)=>{
    if(!entry || picked.length>=count || seen.has(entry.direction.id)) return;
    seen.add(entry.direction.id);
    picked.push(entry);
  };
  const by=(read:(direction:CreativeDirection)=>number)=>
    [...items].sort((a,b)=>read(b.direction)-read(a.direction));

  const overall=by((item)=>item.overall);
  const aesthetic=by((item)=>creativeCriticScore(item,"aesthetic"));
  const originality=by((item)=>creativeCriticScore(item,"originality"));
  const sourceDistance=by((item)=>item.critics.find((critic)=>critic.id==="originality")?.facets?.find((facet)=>facet.label==="Source distance")?.score ?? 0);
  const research=by((item)=>item.researchUtilization+(item.explorationClass==="frontier"?18:0));

  const lanes=freedom==="maximum"
    ? [
        [overall,.28],[aesthetic,.24],[originality,.24],[sourceDistance,.12],[research,.12],
      ] as Array<[Array<{seed:Seed;direction:CreativeDirection}>,number]>
    : [
        [overall,.40],[aesthetic,.24],[originality,.18],[sourceDistance,.08],[research,.10],
      ] as Array<[Array<{seed:Seed;direction:CreativeDirection}>,number]>;

  for(const [lane,share] of lanes) {
    const quota=Math.max(1,Math.round(count*share));
    for(const entry of lane.slice(0,quota*2)) {
      add(entry);
      if(picked.length>=count || picked.filter((x)=>lane.includes(x)).length>=quota) break;
    }
  }
  for(const entry of overall) {
    add(entry);
    if(picked.length>=count) break;
  }
  return picked;
}

/**
 * V5 Creative Lab.
 * It intentionally ranks visual/aesthetic and originality judgment above construction.
 * In maximum-research mode, aesthetic + originality dominate; brand, convention
 * and construction remain visible diagnostics rather than creative vetoes.
 */
export function generateCreativeDirections(input:CreativeLabInput):CreativeDirection[] {
  const freedom=input.researchFreedom || "maximum";
  const learnedLimit=freedom==="maximum"?160:freedom==="exploratory"?60:24;
  const allActiveSignals=(input.creativeResearch?.signals || [])
    .filter((signal)=>signal.active && Boolean(signal.sourceUrl));
  const activeSignals=diverseResearchSignals(allActiveSignals,learnedLimit);
  const learnedSeeds=activeSignals.map(researchSeed);
  const mutationSeeds=freedom==="maximum"
    ? researchMutationSeeds(activeSignals,Math.min(40,activeSignals.length))
    : freedom==="exploratory"
      ? researchMutationSeeds(activeSignals,Math.min(10,activeSignals.length)).filter((_,index)=>index%2===0)
      : [];
  const hybridSeeds:Seed[]=[];
  if(freedom==="maximum" && activeSignals.length>=2) {
    // Cross-pollinate distant research signals to avoid example fixation.
    // Keep this bounded: the system should broaden the search, not explode combinatorially.
    for(let i=0;i<Math.min(48,activeSignals.length);i+=1) {
      const a=activeSignals[i];
      if(!a) continue;
      const b=distantPartner(a,activeSignals);
      if(!b) continue;
      hybridSeeds.push(hybridResearchSeed(a,b,i));
    }
  }
  const frontierSeeds=freedom==="maximum"
    ? [...mutationSeeds,...learnedSeeds,...hybridSeeds,...SEEDS].slice(0,72).map((seed,index)=>frontierCrossZoneSeed(seed,index))
    : [];
  const seedPool=[...SEEDS,...learnedSeeds,...mutationSeeds,...hybridSeeds,...frontierSeeds];

  // Maximum mode intentionally expands before it converges. Every curated
  // research signal can be expressed directly, mutated through five design
  // operators, cross-pollinated with a second source, then pushed through core,
  // pushed and radical variants. Critic scores and risk labels stay visible
  // instead of acting as early blockers.
  const first=seedPool.flatMap((seed)=>{
    const baseTreatments=seed.treatments(input);
    const basePattern=seed.pattern?.(input);
    const variants:Array<{name:string;scale:number;coverageDelta:number;note:string}>=[
      {name:"core",scale:1,coverageDelta:0,note:""},
      {name:"pushed",scale:1.16,coverageDelta:8,note:"Started from a deliberately stronger visual exploration."},
      ...(freedom==="maximum"?[{name:"radical",scale:1.34,coverageDelta:16,note:"Maximum-research mode deliberately pushed the source principle beyond normal house defaults before critique."}]:[]),
    ];
    return variants.map((variant)=>{
      const treatments=variant.name==="core" ? undefined : baseTreatments.map((item)=>({
        ...item,
        intensity:Math.min(100,Math.round(item.intensity*variant.scale)),
        buildability:variant.name==="radical" && item.buildability==="supported" ? "atelier" as const : item.buildability,
      }));
      const pattern=basePattern && variant.name!=="core" ? {
        ...basePattern,
        coverage:Math.min(60,basePattern.coverage+variant.coverageDelta),
        note:`${basePattern.note} ${variant.note}`.trim(),
      } : variant.name==="core" ? undefined : basePattern;
      return {
        seed,
        direction:buildDirection(seed,input,1,treatments,pattern,variant.note?[variant.note]:[],variant.name),
      };
    });
  }).filter((item):item is {seed:Seed;direction:CreativeDirection}=>Boolean(item.direction));

  const refineCount=freedom==="maximum"?Math.min(64,first.length):freedom==="exploratory"?Math.min(18,first.length):Math.min(8,first.length);
  const shortlist=refinementShortlist(first,refineCount,freedom);
  const refined=shortlist.map(({seed,direction})=>redesignLoop(seed,input,direction));
  const tournamentRanked=pairwiseTournament(refined,freedom);

  const output:CreativeDirection[]=[];
  const limit=Math.max(1,input.limit||3);
  const add=(item:CreativeDirection|undefined)=>{
    if(!item || output.length>=limit) return;
    if(output.every((chosen)=>signature(chosen)!==signature(item))) output.push(item);
  };

  // Do not let a single conservative aggregate score erase the research frontier.
  add(tournamentRanked[0]);
  if(freedom==="maximum" && limit>1) {
    add([...tournamentRanked].sort((a,b)=>{
      const ao=a.critics.find((x)=>x.id==="originality")?.score || 0;
      const bo=b.critics.find((x)=>x.id==="originality")?.score || 0;
      return bo-ao || b.researchUtilization-a.researchUtilization;
    })[0]);
  }
  if(freedom==="maximum" && limit>2) {
    add([...tournamentRanked].sort((a,b)=>
      (b.explorationClass==="frontier"?1:0)-(a.explorationClass==="frontier"?1:0)
      || b.researchUtilization-a.researchUtilization
      || b.overall-a.overall
    )[0]);
  }
  while(output.length<limit) {
    const candidate=[...tournamentRanked]
      .filter((item)=>output.every((chosen)=>signature(chosen)!==signature(item)))
      .sort((a,b)=>
        (revisionMerit(b)+diversityBonus(b,output))-(revisionMerit(a)+diversityBonus(a,output))
      )[0];
    if(!candidate) break;
    add(candidate);
  }
  return output;
}

function creativeCriticScore(direction:CreativeDirection,id:CreativeCriticId) {
  return direction.critics.find((item)=>item.id===id)?.score ?? 0;
}

function creativeSeedFamily(direction:CreativeDirection) {
  const parts=direction.id.split(":");
  return parts[0]==="creative" && parts[1] ? parts[1] : direction.id;
}

export function chooseCreativeRedesign(
  candidates:CreativeDirection[],
  current:CreativeDirection,
  reason:CreativeFeedbackReason,
):CreativeDirection|undefined {
  const alternatives=candidates.filter((item)=>item.id!==current.id && signature(item)!==signature(current));
  const pool=alternatives.length ? alternatives : candidates.filter((item)=>item.id!==current.id);
  if(!pool.length) return undefined;

  const currentFamily=creativeSeedFamily(current);
  const score=(item:CreativeDirection)=>{
    const sameFamily=creativeSeedFamily(item)===currentFamily;
    const repairFamilyBonus=["visual_balance","too_busy","pattern_detail","proportion","render_mismatch"].includes(reason)
      ? (sameFamily?24:0)
      : ["too_safe","originality"].includes(reason)
        ? (sameFamily?-12:0)
        : 0;
    const aesthetic=creativeCriticScore(item,"aesthetic");
    const originality=creativeCriticScore(item,"originality");
    const construction=creativeCriticScore(item,"construction");
    const hierarchy=criticFacetScore(item,"aesthetic","Hierarchy");
    const harmony=criticFacetScore(item,"aesthetic","Harmony");
    const rhythm=criticFacetScore(item,"aesthetic","Rhythm");
    const proportion=criticFacetScore(item,"aesthetic","Proportion");
    const distance=item.critics.find((critic)=>critic.id==="originality")?.facets?.find((facet)=>facet.label==="Source distance")?.score ?? 0;
    const load=treatmentLoad(item.treatments,item.pattern);

    if(reason==="visual_balance") return repairFamilyBonus+aesthetic*1.2+hierarchy*.8+harmony*.7-load*.08;
    if(reason==="too_busy") return repairFamilyBonus+aesthetic+hierarchy*.8+harmony*.7+Math.max(0,160-load)*.35;
    if(reason==="too_safe") return repairFamilyBonus+originality*1.35+item.researchUtilization*.55+(item.explorationClass==="frontier"?18:0)+aesthetic*.35;
    if(reason==="pattern_detail") return repairFamilyBonus+(item.pattern?28:0)+originality*.75+rhythm*.9+item.researchUtilization*.35+(item.pattern?.family===current.pattern?.family?8:0);
    if(reason==="proportion") return repairFamilyBonus+proportion*1.45+aesthetic*.65+hierarchy*.35;
    if(reason==="originality") return repairFamilyBonus+originality*1.4+distance*.8+item.researchUtilization*.45+(item.explorationClass==="frontier"?14:0);
    if(reason==="render_mismatch") return repairFamilyBonus+item.certainty*.8+aesthetic*.75+construction*.35+(item.pattern?2:0);
    return repairFamilyBonus+revisionMerit(item);
  };

  return [...pool].sort((a,b)=>score(b)-score(a))[0];
}

