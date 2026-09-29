import type { CrossGarmentRule } from "./types.ts";

const wideFits=new Set(["korean_straight_wide","baggy_wide","wide_leg_drape","pleated_straight"]);
const shortBalancedLengths=new Set(["shirt_length_short"]);
const formalOccasions=new Set(["Formal"]);
const formalOrSemi=new Set(["Formal","Semi-Formal"]);

export const CROSS_GARMENT_RULES:readonly CrossGarmentRule[]=[
  {
    id:"CG-RISE-TUCK",
    name:"High rise and shirt finish",
    appliesWhen:({spec})=>["high_rise","extra_high_rise"].includes(spec.pant.rise)
      && spec.shirt.wear==="untucked"
      && !shortBalancedLengths.has(spec.shirt.length),
    effect:"penalty",
    severity:"Medium",
    explanation:()=> "High or extra-high-rise trousers are better balanced by a tucked or deliberately short shirt; the current untucked length may hide the waistline.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-WIDE-PROPORTION",
    name:"Wide trouser proportion balance",
    appliesWhen:({spec})=>wideFits.has(spec.pant.fit)
      && spec.shirt.wear==="untucked"
      && !["shirt_length_short","boxy_oversized"].includes(spec.shirt.length)
      && spec.shirt.fit!=="boxy_oversized",
    effect:"penalty",
    severity:"Medium",
    explanation:()=> "A wide or Korean-wide trouser needs a cleaner top proportion; prefer a tuck, shorter length, or boxier shirt before final approval.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-LOW-RISE-TAIL",
    name:"Low rise and tuck length",
    appliesWhen:({spec})=>spec.pant.rise==="low_rise" && spec.shirt.wear==="tucked" && spec.shirt.length==="shirt_length_tuck",
    effect:"penalty",
    severity:"Low",
    explanation:()=> "A low-rise waistband with a long tuck-length shirt can create excess fabric at the waist; confirm the finished body length with the tailor.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-CAMP-UNTUCKED",
    name:"Camp collar wear method",
    appliesWhen:({spec})=>(spec.shirt.type==="camp_collar_resort" || spec.shirt.collar==="cuban_camp_collar") && spec.shirt.wear==="tucked",
    effect:"block",
    severity:"High",
    explanation:()=> "The camp/cuban-collar direction is designed as an open, untucked shirt; choose an untucked finish or a different collar.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-PATTERN-LOAD",
    name:"Pattern load",
    appliesWhen:({shirtPatternScale,pantPatternScale,shirtPatternContrast,pantPatternContrast})=>{
      const bold=(v?:string|null)=>v==="Bold"||v==="Medium-Bold"||v==="bold";
      const high=(v?:string|null)=>String(v||"").toLowerCase()==="high";
      return (bold(shirtPatternScale)&&bold(pantPatternScale)) || (high(shirtPatternContrast)&&high(pantPatternContrast));
    },
    effect:"block",
    severity:"High",
    explanation:()=> "Two bold or high-contrast patterns compete. Keep one garment as the hero and make the other visually quieter.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-CASUAL-TOP-FORMAL",
    name:"Casual shirt formality cap",
    appliesWhen:({spec,occasion})=>formalOrSemi.has(occasion)
      && ["camp_collar_resort","overshirt"].includes(spec.shirt.type),
    effect:"block",
    severity:"High",
    explanation:({occasion})=> `The selected shirt type caps the look below the requested ${occasion.toLowerCase()} register; use a dress or cleaner band-collar shirt.`,
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-WING-COLLAR",
    name:"Wing collar occasion floor",
    appliesWhen:({spec,occasion})=>spec.shirt.collar==="wing_collar" && !formalOccasions.has(occasion),
    effect:"block",
    severity:"High",
    explanation:()=> "Wing collar is reserved for high-formality evening directions, not everyday casual or semi-formal outfits.",
    provenance:"reference-source",
    reviewStatus:"provisional",
  },
  {
    id:"CG-BOXY-FORMALITY",
    name:"Oversized shirt formality cap",
    appliesWhen:({spec,occasion})=>formalOccasions.has(occasion) && spec.shirt.fit==="boxy_oversized",
    effect:"penalty",
    severity:"Medium",
    explanation:()=> "The boxy/oversized shirt fit softens the formal line; use a regular, slim, or athletic-taper fit for this formal direction.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-HOT-HEAVY",
    name:"Hot-humid verified weight check",
    appliesWhen:({climate,shirtWeightClass,pantWeightClass})=>climate==="Hot / humid"
      && shirtWeightClass==="Heavy" && pantWeightClass==="Heavy",
    effect:"penalty",
    severity:"Medium",
    explanation:()=> "Both garments are confirmed in the heavy weight class for a hot/humid context; consider a lighter verified cloth combination.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-WIDE-DRAPE-VERIFY",
    name:"Wide silhouette drape verification",
    appliesWhen:({spec,pantDrapeVerified})=>wideFits.has(spec.pant.fit) && !pantDrapeVerified,
    effect:"penalty",
    severity:"Low",
    explanation:()=> "This wide silhouette depends on how the real cloth falls, but physical drape is not verified. Confirm the roll with the tailor; the preview only shows appearance.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
  {
    id:"CG-FESTIVE-BAND",
    name:"Festive band-collar direction",
    appliesWhen:({spec,occasion})=>["Semi-Formal","Smart-Casual"].includes(occasion)
      && (spec.shirt.type==="band_collar_shirt" || spec.shirt.collar==="mandarin_band_collar")
      && spec.pant.type==="jodhpuri_churidar",
    effect:"bonus",
    severity:"Low",
    explanation:()=> "The band-collar shirt and Jodhpuri/churidar direction form a coherent festive/fusion combination.",
    provenance:"owner-provided",
    reviewStatus:"provisional",
  },
];
