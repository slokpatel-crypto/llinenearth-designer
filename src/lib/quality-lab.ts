import type { DesignerBrief } from "@/lib/designer-types";
import { fabricTypes, judgeFabricForBrief, wearTypes, type WearFamily } from "@/lib/fashion-intelligence";

export type QualityCase = {
  id: string;
  label: string;
  material: string;
  role: WearFamily;
  occasion: string;
  venue: string;
  time: string;
  environment: string;
  formality: string;
  expected: "good" | "poor";
};

export const QUALITY_CASES: QualityCase[] = [
  { id:"Q-LINEN-RESORT", label:"Linen · hot resort shirt", material:"Pure linen", role:"shirt", occasion:"Resort / Holiday", venue:"Beach resort", time:"Daytime", environment:"Hot humid outdoor", formality:"Relaxed", expected:"good" },
  { id:"Q-TR-OFFICE", label:"TR/PV · business trouser", material:"TR / PV", role:"trouser", occasion:"Business", venue:"Office", time:"Daytime", environment:"Air-conditioned indoor", formality:"Business", expected:"good" },
  { id:"Q-TRW-WEDDING", label:"TR-Wool · formal wedding suit", material:"TR-Wool", role:"suit", occasion:"Wedding", venue:"Luxury hotel", time:"Evening", environment:"Air-conditioned indoor", formality:"Formal", expected:"good" },
  { id:"Q-POPLIN-SHIRT", label:"Cotton poplin · business shirt", material:"Cotton Poplin", role:"shirt", occasion:"Business", venue:"Boardroom", time:"Daytime", environment:"Indoor", formality:"Formal", expected:"good" },
  { id:"Q-DENIM-BLACKTIE", label:"Denim · black-tie suit", material:"Denim", role:"suit", occasion:"Black tie gala", venue:"Luxury hotel", time:"Evening", environment:"Indoor", formality:"Formal", expected:"poor" },
  { id:"Q-VELVET-HOT", label:"Velvet · hot outdoor suit", material:"Velvet", role:"suit", occasion:"Day wedding", venue:"Outdoor garden", time:"Daytime", environment:"Hot humid outdoor", formality:"Formal", expected:"poor" },
];

function briefFor(test: QualityCase): DesignerBrief {
  return {
    fabric: {
      materialOverride: test.material,
      profile: {
        id:`TEST-${test.id}`,
        source:"development_visual_classifier",
        summary:"Quality benchmark fabric.",
        palette:["#17243a","#d8d0c0"],
        alternatives:[{ family:test.material, confidence:.98, evidence:["Quality benchmark fixture"] }],
        cautions:[],
        observations:[
          { label:"Likely material family", value:test.material, confidence:.98, confidenceLabel:"high", basis:"development_visual_classifier" },
          { label:"Dominant color", value:"Navy", confidence:.98, confidenceLabel:"high", basis:"development_visual_classifier" },
        ],
      },
    },
    context: {
      occasion:test.occasion,
      venue:test.venue,
      time:test.time,
      environment:test.environment,
      formality:test.formality,
      impression:"Refined",
      fit:"Tailored",
      aesthetic:"Modern Classic",
    },
  };
}

export function runQualityBenchmarks() {
  const results = QUALITY_CASES.map((test) => {
    const judgement = judgeFabricForBrief(briefFor(test), test.role);
    const pass = test.expected === "good" ? judgement.overall >= 70 : judgement.overall < 65;
    return { ...test, pass, score:judgement.overall, verdict:judgement.verdict, reason:judgement.reasons[0] };
  });
  return {
    results,
    passed:results.filter((x)=>x.pass).length,
    total:results.length,
    wearCount:wearTypes.length,
    fabricCount:fabricTypes.length,
  };
}
