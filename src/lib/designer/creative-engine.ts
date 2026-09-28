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
};

export type CreativeLabInput = {
  shirt:DesignerFabric;
  pant:DesignerFabric;
  occasion:OccasionTier;
  style:DesignerStyle;
  context:DesignerContext;
  measurements?:MeasurementProfile|null;
  observations?:TailorObservationProfile|null;
  limit?:number;
};

type Seed = {
  id:string;
  name:string;
  thesis:string;
  principle:CreativeResearchTrace;
  patch?:DesignerStyleOverrides;
  treatments:(input:CreativeLabInput)=>CreativeTreatment[];
  pattern?:(input:CreativeLabInput)=>CreativePattern|undefined;
};

const RESEARCH = {
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

const SEEDS:Seed[]=[
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

  let aesthetic=76;
  aesthetic+=zones>=2&&zones<=3?7:0;
  aesthetic-=duplicateZones(treatments)*5;
  aesthetic-=Math.max(0,load-125)*.18;
  aesthetic+=pattern && pattern.coverage<=45?5:0;
  aesthetic+=treatments.some((item)=>/quiet|protected|restrained/i.test(item.label+" "+item.instruction))?5:0;
  if(input.context.intention==="Understated" && load>95) aesthetic-=14;
  if(input.context.intention==="Expressive" && load<45) aesthetic-=9;

  let originality=54+zones*7+(pattern?13:0)+atelier*4+experimental*7;
  if(treatments.length===1&&!pattern) originality-=7;
  originality-=Math.max(0,treatments.length-3)*6;

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
      load>125?"Visual load is high; preserve one dominant idea and quiet the secondary zones.":"The focal load stays controlled enough for the main idea to read.",
      zones>=2?"Details relate across more than one zone, creating composition instead of a single isolated trick.":"The idea depends on one focal zone, so proportion must carry the result.",
    ]},
    {id:"originality",label:"Originality critic",score:round(originality),verdict:verdict(originality),rationale:[
      pattern?"The surface logic is generated as a new placement/repeat proposal rather than selected from the stock pattern labels.":"Originality comes from garment detailing and proportion rather than a new surface repeat.",
      experimental?"One element deliberately leaves the normal house vocabulary and needs human design review.":"The idea mutates familiar menswear codes without relying on random novelty.",
    ]},
    {id:"brand",label:"Linen Earth critic",score:round(brandScore),verdict:verdict(brandScore),rationale:[
      "Uses the existing Linen Earth brand-language evaluator as a soft signal, not a veto.",
      load>145?"The amount of visual activity risks overpowering the cloth.":"The treatment leaves enough quiet cloth for the fabric to remain visible.",
    ]},
    {id:"menswear",label:"Menswear critic",score:round(menswear),verdict:verdict(menswear),rationale:[
      recommendation.formality.match===false?"The base cut conflicts with the selected occasion band.":"The underlying cut remains inside the current occasion grammar.",
      "Research is converted into a design principle rather than copied as a finished look.",
    ]},
    {id:"construction",label:"Construction critic",score:round(construction),verdict:verdict(construction),rationale:[
      experimental?"Experimental detail needs a toile/sample before approval.":atelier?"Atelier-level detailing needs pattern-maker review but is not treated as impossible.":"The main treatment stays close to supported construction.",
      "Construction is a guardrail with lower ranking weight; it does not dominate the visual decision.",
    ]},
  ];
  return {reads,fit,brand};
}

function scoreCritics(reads:CreativeCriticRead[]) {
  const map=Object.fromEntries(reads.map((item)=>[item.id,item.score])) as Record<CreativeCriticId,number>;
  return round(map.aesthetic*.32+map.originality*.23+map.brand*.16+map.menswear*.19+map.construction*.10);
}

function certaintyFor(recommendation:DesignerRecommendation,seed:Seed,treatments:CreativeTreatment[],pattern?:CreativePattern) {
  const buildKnown=treatments.filter((item)=>item.buildability==="supported").length/Math.max(1,treatments.length);
  const research=seed.principle.sourceUrl?100:45;
  const patternPenalty=pattern?9:0;
  return round(recommendation.confidenceScore*.55+research*.20+buildKnown*100*.25-patternPenalty);
}

function hardBlocked(recommendation:DesignerRecommendation) {
  return recommendation.formality.match===false || recommendation.rules.some((item)=>item.status==="flag"&&item.severity==="High");
}

function buildDirection(seed:Seed,input:CreativeLabInput,iteration:number,treatmentsOverride?:CreativeTreatment[],patternOverride?:CreativePattern,refinement:string[]=[],variant="core"):CreativeDirection|null {
  const style=safePatch(input,seed.patch);
  const recommendation=evaluateDesignerCombo(input.shirt,input.pant,input.occasion,style,undefined,input.context);
  if(hardBlocked(recommendation)) return null;
  const treatments=treatmentsOverride || seed.treatments(input);
  const pattern=patternOverride===undefined ? seed.pattern?.(input) : patternOverride;
  const {reads}=criticsFor(seed,input,style,treatments,pattern,recommendation);
  const overall=scoreCritics(reads);
  const certainty=certaintyFor(recommendation,seed,treatments,pattern);
  const construction=reads.find((item)=>item.id==="construction")?.score ?? 0;
  const aesthetic=reads.find((item)=>item.id==="aesthetic")?.score ?? 0;
  const risk:CreativeDirection["risk"]=construction<52?"high":certainty<58||aesthetic<62?"moderate":"low";
  return {
    id:`creative:${seed.id}:${variant}:v${iteration}`,name:seed.name,thesis:seed.thesis,baseStyle:style,recommendation,
    treatments,pattern,critics:reads,overall,certainty,risk,research:[seed.principle],iteration,refinement,
    visualSummary:[
      ...treatments.slice(0,2).map((item)=>`${item.label}: ${item.visualPurpose}`),
      ...(pattern?[ `${pattern.name}: ${pattern.layout}` ]:[]),
    ].slice(0,3),
  };
}

function refine(seed:Seed,input:CreativeLabInput,first:CreativeDirection):CreativeDirection {
  let treatments=first.treatments.map((item)=>({...item}));
  let pattern=first.pattern?{...first.pattern,palette:[...first.pattern.palette]}:undefined;
  const notes:string[]=[];
  const aesthetic=first.critics.find((item)=>item.id==="aesthetic")?.score ?? 0;
  const brand=first.critics.find((item)=>item.id==="brand")?.score ?? 0;
  const construction=first.critics.find((item)=>item.id==="construction")?.score ?? 0;

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
  const variant=first.id.split(":")[2] || "core";
  return buildDirection(seed,input,2,treatments,pattern,notes,variant) || first;
}

function signature(item:CreativeDirection) {
  return [item.baseStyle.collar,item.baseStyle.cuff,item.pattern?.family||"none",...item.treatments.map((t)=>t.zone)].join("|");
}

/**
 * V5 Creative Lab.
 * It intentionally ranks visual/aesthetic and originality judgment above construction.
 * Construction remains a guardrail and receives only 10% of the creative score.
 */
export function generateCreativeDirections(input:CreativeLabInput):CreativeDirection[] {
  // Explore two visual intensities for every research seed. This gives the critic
  // panel twenty internal concepts before refinement without asking an LLM to
  // randomly improvise unsupported garment facts.
  const first=SEEDS.flatMap((seed)=>{
    const core=buildDirection(seed,input,1,undefined,undefined,[],"core");
    const pushedTreatments=seed.treatments(input).map((item)=>({
      ...item,
      intensity:Math.min(100,Math.round(item.intensity*1.14)),
    }));
    const basePattern=seed.pattern?.(input);
    const pushedPattern=basePattern ? {
      ...basePattern,
      coverage:Math.min(58,basePattern.coverage+8),
      note:`${basePattern.note} This exploration deliberately pushes coverage before the critic pass.`,
    } : undefined;
    const pushed=buildDirection(seed,input,1,pushedTreatments,pushedPattern,["Started from a deliberately stronger visual exploration."],"pushed");
    return [{seed,direction:core},{seed,direction:pushed}];
  }).filter((item):item is {seed:Seed;direction:CreativeDirection}=>Boolean(item.direction));

  first.sort((a,b)=>b.direction.overall-a.direction.overall);
  const refined=first.slice(0,8).map(({seed,direction})=>refine(seed,input,direction));
  refined.sort((a,b)=>b.overall-a.overall || b.certainty-a.certainty);

  const output:CreativeDirection[]=[];
  for(const item of refined) {
    if(output.every((chosen)=>signature(chosen)!==signature(item))) output.push(item);
    if(output.length>=(input.limit||3)) break;
  }
  return output;
}
