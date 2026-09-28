import type { DesignerRecommendation, DesignerStyleOverrides } from "@/lib/designer/engine";
import type { FitConstructionAssessment } from "@/lib/designer/fit-construction";
import { suggestDesignerRepairs } from "@/lib/designer/planner";

export type NegotiationVerdict = "provisional_ok" | "negotiate" | "hold";

export type NegotiationIssue = {
  id: string;
  kind: "hard_blocker" | "review" | "missing_fact" | "fit_tradeoff";
  message: string;
};

export type NegotiationAction = {
  id: string;
  label: string;
  patch?: DesignerStyleOverrides;
  route?: "/measurements";
  preserves: string[];
};

export type DesignerNegotiation = {
  version: "designer-negotiation-v1";
  verdict: NegotiationVerdict;
  headline: string;
  preserve: string[];
  blockers: NegotiationIssue[];
  reviews: NegotiationIssue[];
  missingFacts: NegotiationIssue[];
  tradeoffs: NegotiationIssue[];
  actions: NegotiationAction[];
};

function unique<T>(values:T[]) {
  return [...new Set(values)];
}

function actionForFitIssue(id:string,message:string,recommendation:DesignerRecommendation):NegotiationAction | null {
  if(id==="FIT-TROUSER-SEAT" && recommendation.style.trouser.includes("Flat-front")) {
    return {
      id:"TRY-PLEATED-BLOCK",
      label:"Keep the outfit, compare a pleated trouser block for more seat/thigh room.",
      patch:{ trouser:"Pleated Trouser" },
      preserves:[recommendation.shirt.name,recommendation.pant.name,recommendation.occasion],
    };
  }
  if(id==="CONTEXT-EASE" && recommendation.style.shirtFit==="Slim Fit") {
    return {
      id:"KEEP-SLIM-EASE",
      label:"Keep the slim visual line, but protect chest and upper-arm ease inside the provisional range.",
      preserves:[recommendation.shirt.name,recommendation.pant.name,"Slim visual intention"],
    };
  }
  if(id==="CONSTRUCTION-TUCK-LENGTH") {
    return {
      id:"MEASURE-SHIRT-LENGTH",
      label:"Record shirt length before approving the tucked construction.",
      route:"/measurements",
      preserves:[recommendation.shirt.name,recommendation.pant.name,recommendation.style.shirtWear],
    };
  }
  if(id==="CONSTRUCTION-RISE") {
    return {
      id:"MEASURE-FRONT-RISE",
      label:"Record front rise before finalizing waistband position and crotch balance.",
      route:"/measurements",
      preserves:[recommendation.shirt.name,recommendation.pant.name,recommendation.style.rise],
    };
  }
  if(id==="CONSTRUCTION-CUFF") {
    return {
      id:"MEASURE-WRIST",
      label:"Record wrist circumference before finalizing the French cuff.",
      route:"/measurements",
      preserves:[recommendation.shirt.name,recommendation.style.cuff],
    };
  }
  if(id==="FABRIC-DRAPE-TROUSER") {
    return {
      id:"COMPARE-SOFTER-TROUSER-CLOTH",
      label:"Keep the silhouette, but compare a trouser cloth with verified softer drape.",
      preserves:[recommendation.style.trouser,recommendation.occasion],
    };
  }
  if(id==="FABRIC-DRAPE-UNKNOWN") {
    return {
      id:"VERIFY-TROUSER-DRAPE",
      label:"Check the physical trouser roll for drape before approving this pleated/wide shape.",
      preserves:[recommendation.pant.name,recommendation.style.trouser],
    };
  }
  return message ? null : null;
}

export function buildDesignerNegotiation(
  recommendation:DesignerRecommendation,
  fit?:FitConstructionAssessment | null,
):DesignerNegotiation {
  const blockers:NegotiationIssue[]=[];
  const reviews:NegotiationIssue[]=[];
  const missingFacts:NegotiationIssue[]=[];
  const tradeoffs:NegotiationIssue[]=[];

  for(const rule of recommendation.rules) {
    if(rule.status==="flag" && rule.severity==="High") {
      blockers.push({id:rule.id,kind:"hard_blocker",message:rule.explanation});
    } else if(rule.status==="flag") {
      reviews.push({id:rule.id,kind:"review",message:rule.explanation});
    } else if(rule.status==="unknown" && rule.severity!=="Low") {
      missingFacts.push({id:rule.id,kind:"missing_fact",message:rule.explanation});
    }
  }

  for(const check of fit?.checks || []) {
    if(check.severity==="warning") {
      blockers.push({id:check.id,kind:"hard_blocker",message:check.message});
    } else if(check.severity==="review") {
      tradeoffs.push({id:check.id,kind:"fit_tradeoff",message:check.message});
    }
  }

  const repairActions:NegotiationAction[]=suggestDesignerRepairs(recommendation).map((repair,index)=>({
    id:`RULE-REPAIR-${index+1}`,
    label:repair.label,
    patch:repair.patch,
    preserves:[recommendation.shirt.name,recommendation.pant.name,recommendation.occasion],
  }));

  const fitActions=(fit?.checks || [])
    .map((check)=>actionForFitIssue(check.id,check.message,recommendation))
    .filter((action):action is NegotiationAction=>Boolean(action));

  const actions=[...repairActions,...fitActions]
    .filter((action,index,array)=>array.findIndex((candidate)=>candidate.label===action.label)===index)
    .slice(0,5);

  const preserve=unique([
    `${recommendation.shirt.name} shirting`,
    `${recommendation.pant.name} trousers`,
    `${recommendation.occasion} occasion`,
    `${recommendation.style.shirtFit} shirt`,
    `${recommendation.style.trouser}`,
  ]);

  const verdict:NegotiationVerdict = blockers.length ? "hold"
    : reviews.length || missingFacts.length || tradeoffs.length ? "negotiate"
      : "provisional_ok";

  const headline = verdict==="hold"
    ? "Keep the intention, fix the blocking conflict before approval."
    : verdict==="negotiate"
      ? "The direction is workable, but a few facts or fit choices need negotiation."
      : "No major conflict is visible; keep this as a provisional direction.";

  return {
    version:"designer-negotiation-v1",
    verdict,headline,preserve,blockers,reviews,missingFacts,tradeoffs,actions,
  };
}
