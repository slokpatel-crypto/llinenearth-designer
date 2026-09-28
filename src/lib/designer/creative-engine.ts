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
import { creativeLearningSignalFor, type CreativeLearningBook, type CreativeLearningSignal } from "@/lib/designer/creative-learning";
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

  let originality=54+zones*7+(pattern?13:0)+atelier*4+experimental*7;
  if(treatments.length===1&&!pattern) originality-=7;
  originality-=Math.max(0,treatments.length-3)*6;

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
    ],facets:[
      {label:"Proportion",score:round(proportionFacet)},
      {label:"Hierarchy",score:round(hierarchyFacet)},
      {label:"Rhythm",score:round(rhythmFacet)},
      {label:"Harmony",score:round(harmonyFacet)},
    ]},
    {id:"originality",label:"Originality critic",score:round(originality),verdict:verdict(originality),rationale:[
      pattern?"The surface logic is generated as a placement/repeat proposal rather than selected from the stock pattern labels.":"Originality comes from garment detailing and proportion rather than a new surface repeat.",
      experimental?"One element deliberately leaves the normal house vocabulary and needs human design review.":"The idea mutates familiar menswear codes without relying on random novelty.",
      trouserNovelty>95?"Trouser novelty is high; preserve a recognisable tailoring anchor so difference reads as intentional.":"Typicality and novelty remain in a readable relationship.",
    ],facets:[
      {label:"Novelty",score:round(Math.min(100,54+zones*8+(pattern?15:0)+experimental*8))},
      {label:"Typicality anchor",score:round(100-Math.min(70,(trouserNovelty+shirtNovelty)*.22))},
      {label:"Transformation",score:round(62+(atelier+experimental)*8+(pattern?12:0))},
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
  if(freedom==="maximum") return false;
  if(freedom==="exploratory") {
    return recommendation.rules.some((item)=>item.status==="flag"&&item.severity==="High"&&/safety|impossible|unavailable/i.test(item.id+" "+item.explanation));
  }
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
        +(seed.id.startsWith("research-")||seed.id.startsWith("hybrid-")?2:0)
      )
    : freedom==="exploratory" ? 2 : 0;
  const overall=round(scoreCritics(reads,freedom)+learning.score+researchExpansionBonus);
  const certainty=certaintyFor(recommendation,seed,treatments,pattern);
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
      42
      +Math.min(26,(1+(seed.extraPrinciples?.length || 0))*13)
      +(pattern?10:0)
      +Math.min(16,treatments.filter((item)=>item.buildability!=="supported").length*6)
    ),
    explorationClass:variant==="radical"?"frontier":(seed.extraPrinciples?.length||seed.id.startsWith("research-")||seed.id.startsWith("hybrid-"))?"research-led":"balanced",
    constraintMode:freedom,
  };
}

function refine(seed:Seed,input:CreativeLabInput,first:CreativeDirection):CreativeDirection {
  let treatments=first.treatments.map((item)=>({...item}));
  let pattern=first.pattern?{...first.pattern,palette:[...first.pattern.palette]}:undefined;
  const notes:string[]=[];
  const aesthetic=first.critics.find((item)=>item.id==="aesthetic")?.score ?? 0;
  const brand=first.critics.find((item)=>item.id==="brand")?.score ?? 0;
  const construction=first.critics.find((item)=>item.id==="construction")?.score ?? 0;
  const freedom=input.researchFreedom || "maximum";

  if(freedom==="maximum") {
    // In maximum-research mode critique is diagnostic, not a style police layer.
    // Only rescue concepts that are collapsing visually; do not normalise unusual
    // proportions, patterns or experimental construction merely because they are unfamiliar.
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
  return buildDirection(seed,input,2,treatments,pattern,notes,variant) || first;
}

function signature(item:CreativeDirection) {
  return [item.baseStyle.collar,item.baseStyle.cuff,item.pattern?.family||"none",...item.treatments.map((t)=>t.zone)].join("|");
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
  const activeSignals=(input.creativeResearch?.signals || [])
    .filter((signal)=>signal.active && Boolean(signal.sourceUrl))
    .slice(0,learnedLimit);
  const learnedSeeds=activeSignals.map(researchSeed);
  const hybridSeeds:Seed[]=[];
  if(freedom==="maximum" && activeSignals.length>=2) {
    // Cross-pollinate distant research signals to avoid example fixation.
    // Keep this bounded: the system should broaden the search, not explode combinatorially.
    for(let i=0;i<Math.min(48,activeSignals.length);i+=1) {
      const a=activeSignals[i];
      const b=activeSignals[(i*7+3)%activeSignals.length];
      if(a.id===b.id) continue;
      hybridSeeds.push(hybridResearchSeed(a,b,i));
    }
  }
  const frontierSeeds=freedom==="maximum"
    ? [...learnedSeeds,...hybridSeeds,...SEEDS].slice(0,60).map((seed,index)=>frontierCrossZoneSeed(seed,index))
    : [];
  const seedPool=[...SEEDS,...learnedSeeds,...hybridSeeds,...frontierSeeds];

  // Maximum mode intentionally expands before it converges. Research is allowed
  // to create radical candidates; critic scores and risk labels stay visible
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

  first.sort((a,b)=>b.direction.overall-a.direction.overall);
  const refineCount=freedom==="maximum"?Math.min(48,first.length):freedom==="exploratory"?Math.min(18,first.length):Math.min(8,first.length);
  const refined=first.slice(0,refineCount).map(({seed,direction})=>refine(seed,input,direction));
  refined.sort((a,b)=>b.overall-a.overall || b.certainty-a.certainty);

  const output:CreativeDirection[]=[];
  const limit=Math.max(1,input.limit||3);
  const add=(item:CreativeDirection|undefined)=>{
    if(!item || output.length>=limit) return;
    if(output.every((chosen)=>signature(chosen)!==signature(item))) output.push(item);
  };

  // Do not let a single conservative aggregate score erase the research frontier.
  add(refined[0]);
  if(freedom==="maximum" && limit>1) {
    add([...refined].sort((a,b)=>{
      const ao=a.critics.find((x)=>x.id==="originality")?.score || 0;
      const bo=b.critics.find((x)=>x.id==="originality")?.score || 0;
      return bo-ao || b.researchUtilization-a.researchUtilization;
    })[0]);
  }
  if(freedom==="maximum" && limit>2) {
    add([...refined].sort((a,b)=>
      (b.explorationClass==="frontier"?1:0)-(a.explorationClass==="frontier"?1:0)
      || b.researchUtilization-a.researchUtilization
      || b.overall-a.overall
    )[0]);
  }
  for(const item of refined) {
    add(item);
    if(output.length>=limit) break;
  }
  return output;
}
