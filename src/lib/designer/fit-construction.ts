import type { MeasurementProfile } from "@/lib/measurements";
import type { DesignerClimate, DesignerFabric, DesignerStyle } from "@/lib/designer/engine";

export type FitConstructionSeverity = "info" | "review" | "warning";
export type RangeCm = { min: number; max: number };

export type FinishedTarget = {
  label: string;
  bodyCm: number;
  easeCm?: RangeCm;
  finishedCm: RangeCm;
  basis: "body_plus_ease" | "recorded_anchor" | "customer_desired";
};

export type ConstructionCheck = {
  id: string;
  severity: FitConstructionSeverity;
  message: string;
};

export type FitConstructionAssessment = {
  version: "fit-construction-provisional-1";
  status: "insufficient_measurements" | "provisional";
  source: "provisional_house_defaults";
  shirtTargets: FinishedTarget[];
  trouserTargets: FinishedTarget[];
  checks: ConstructionCheck[];
  fitScore: number;
  caveats: string[];
};

type FitClass = "slim" | "regular" | "relaxed";
type TrouserClass = "flat" | "pleated" | "wide" | "cropped" | "other";

const SHIRT_EASE: Record<FitClass,{ chest: RangeCm; waist: RangeCm; bicep: RangeCm; neck: RangeCm; wrist: RangeCm }> = {
  slim: {
    chest:{ min:7.5,max:10 }, waist:{ min:6,max:9 }, bicep:{ min:5,max:7 },
    neck:{ min:1,max:1.5 }, wrist:{ min:2,max:3 },
  },
  regular: {
    chest:{ min:10,max:14 }, waist:{ min:9,max:13 }, bicep:{ min:6,max:9 },
    neck:{ min:1,max:1.5 }, wrist:{ min:2.5,max:3.5 },
  },
  relaxed: {
    chest:{ min:15,max:20 }, waist:{ min:14,max:19 }, bicep:{ min:8,max:12 },
    neck:{ min:1.2,max:1.8 }, wrist:{ min:3,max:4.5 },
  },
};

const TROUSER_EASE: Record<TrouserClass,{ waist: RangeCm; seat: RangeCm; thigh: RangeCm; knee: RangeCm }> = {
  flat: {
    waist:{ min:1,max:3 }, seat:{ min:6,max:9 }, thigh:{ min:4,max:6 }, knee:{ min:3,max:5 },
  },
  pleated: {
    waist:{ min:1.5,max:3.5 }, seat:{ min:8,max:12 }, thigh:{ min:6,max:9 }, knee:{ min:4,max:7 },
  },
  wide: {
    waist:{ min:1.5,max:4 }, seat:{ min:10,max:14 }, thigh:{ min:8,max:12 }, knee:{ min:8,max:14 },
  },
  cropped: {
    waist:{ min:1,max:3 }, seat:{ min:6,max:9 }, thigh:{ min:4,max:7 }, knee:{ min:3,max:5 },
  },
  other: {
    waist:{ min:1.5,max:3.5 }, seat:{ min:7,max:10 }, thigh:{ min:5,max:8 }, knee:{ min:4,max:6 },
  },
};

function round(value:number){ return Math.round(value*10)/10; }
function range(value:number,ease:RangeCm):RangeCm {
  return { min:round(value+ease.min), max:round(value+ease.max) };
}
function direct(value:number):RangeCm {
  const rounded=round(value); return { min:rounded,max:rounded };
}
function target(label:string,bodyCm:number,easeCm:RangeCm,basis:FinishedTarget["basis"]="body_plus_ease"):FinishedTarget {
  return { label, bodyCm:round(bodyCm), easeCm, finishedCm:range(bodyCm,easeCm), basis };
}
function anchor(label:string,bodyCm:number,basis:FinishedTarget["basis"]="recorded_anchor"):FinishedTarget {
  return { label, bodyCm:round(bodyCm), finishedCm:direct(bodyCm), basis };
}

function shirtFitClass(style:DesignerStyle):FitClass {
  const value=style.shirtFit.toLowerCase();
  if(value.includes("slim")) return "slim";
  if(value.includes("relaxed")) return "relaxed";
  return "regular";
}
function trouserFitClass(style:DesignerStyle):TrouserClass {
  const value=style.trouser.toLowerCase();
  if(value.includes("wide")||value.includes("relaxed")) return "wide";
  if(value.includes("pleat")) return "pleated";
  if(value.includes("cropped")||value.includes("ankle")) return "cropped";
  if(value.includes("flat-front")||value.includes("formal trouser")) return "flat";
  return "other";
}

function pushCheck(checks:ConstructionCheck[],id:string,severity:FitConstructionSeverity,message:string){
  checks.push({id,severity,message});
}

export function assessFitConstruction(
  profile:MeasurementProfile | null | undefined,
  style:DesignerStyle,
  options: {
    climate?: DesignerClimate;
    shirtFabric?: Pick<DesignerFabric,"drape"|"weightClass"|"weave"|"name"> | null;
    trouserFabric?: Pick<DesignerFabric,"drape"|"weightClass"|"weave"|"name"> | null;
  } = {},
):FitConstructionAssessment {
  const caveats=[
    "Ease values are provisional Linen Earth house ranges, not final cutting measurements.",
    "A tailor must verify posture, shoulder slope, armhole, seat balance and pattern/block adjustments before cutting.",
  ];
  if(!profile){
    return {
      version:"fit-construction-provisional-1",status:"insufficient_measurements",source:"provisional_house_defaults",
      shirtTargets:[],trouserTargets:[],checks:[{id:"FIT-DATA",severity:"review",message:"Add body measurements before the Designer can assess fit and construction."}],
      fitScore:50,caveats,
    };
  }

  const checks:ConstructionCheck[]=[];
  const shirtTargets:FinishedTarget[]=[];
  const trouserTargets:FinishedTarget[]=[];
  const sf=shirtFitClass(style);
  const tf=trouserFitClass(style);
  const se=SHIRT_EASE[sf];
  const te=TROUSER_EASE[tf];

  if(profile.shirt.neck) shirtTargets.push(target("Finished collar circumference",profile.shirt.neck,se.neck));
  if(profile.shirt.chest) shirtTargets.push(target("Finished shirt chest",profile.shirt.chest,se.chest));
  if(profile.shirt.waist) shirtTargets.push(target("Finished shirt waist",profile.shirt.waist,se.waist));
  if(profile.shirt.bicep) shirtTargets.push(target("Finished upper-arm circumference",profile.shirt.bicep,se.bicep));
  if(profile.shirt.wrist) shirtTargets.push(target("Finished cuff circumference",profile.shirt.wrist,se.wrist));
  if(profile.shirt.shoulder) shirtTargets.push(anchor("Shoulder-width anchor",profile.shirt.shoulder));
  if(profile.shirt.sleeve) shirtTargets.push(anchor("Sleeve-length anchor",profile.shirt.sleeve));
  if(profile.shirt.shirtLength) shirtTargets.push(anchor("Shirt-length anchor",profile.shirt.shirtLength,"customer_desired"));

  if(profile.pants.waist) trouserTargets.push(target("Finished trouser waist",profile.pants.waist,te.waist));
  if(profile.pants.seat) trouserTargets.push(target("Finished trouser seat",profile.pants.seat,te.seat));
  if(profile.pants.thigh) trouserTargets.push(target("Finished upper-thigh circumference",profile.pants.thigh,te.thigh));
  if(profile.pants.knee) trouserTargets.push(target("Finished knee circumference",profile.pants.knee,te.knee));
  if(profile.pants.frontRise) trouserTargets.push(anchor("Front-rise anchor",profile.pants.frontRise));
  if(profile.pants.inseam) trouserTargets.push(anchor("Inseam anchor",profile.pants.inseam,"customer_desired"));
  if(profile.pants.outseam) trouserTargets.push(anchor("Outseam anchor",profile.pants.outseam,"customer_desired"));
  if(profile.pants.hem) trouserTargets.push(anchor("Hem circumference target",profile.pants.hem,"customer_desired"));

  const chest=profile.shirt.chest;
  const waist=profile.shirt.waist;
  if(chest&&waist){
    const delta=chest-waist;
    if(sf==="slim"&&delta>=18) pushCheck(checks,"FIT-SHIRT-TAPER","warning","A slim shirt on this chest-to-waist difference can over-suppress the lower torso. Preserve chest mobility and shape the waist gradually.");
    else if(sf==="relaxed"&&delta<=6) pushCheck(checks,"FIT-SHIRT-VOLUME","info","The relaxed shirt fit will read intentionally straight through the torso; avoid adding unnecessary waist suppression.");
    else pushCheck(checks,"FIT-SHIRT-BALANCE","info","The selected shirt fit is compatible with the recorded chest-to-waist proportion at a provisional level.");
  } else pushCheck(checks,"FIT-SHIRT-DATA","review","Chest and shirt-waist measurements are needed to assess body taper.");

  if(style.shirtWear==="Tucked"){
    if(!profile.shirt.shirtLength) pushCheck(checks,"CONSTRUCTION-TUCK-LENGTH","review","A tucked shirt needs a confirmed shirt-length anchor before cutting so it stays inside the trouser through movement.");
    else pushCheck(checks,"CONSTRUCTION-TUCK-LENGTH","info","A shirt-length anchor is available for the tucked construction.");
  }

  if(style.cuff==="French / Double Cuff"&&!profile.shirt.wrist){
    pushCheck(checks,"CONSTRUCTION-CUFF","review","Record wrist circumference before finalizing a French cuff.");
  }

  const seat=profile.pants.seat;
  const pantWaist=profile.pants.waist;
  if(seat&&pantWaist){
    const delta=seat-pantWaist;
    if(delta>=24&&tf==="flat") pushCheck(checks,"FIT-TROUSER-SEAT","warning","The recorded seat-to-waist difference needs more upper-block room than a very clean flat-front cut usually provides. Compare a pleated block before approval.");
    else if(delta>=24&&tf==="pleated") pushCheck(checks,"FIT-TROUSER-SEAT","info","The pleated direction gives useful room through the seat and upper thigh for this proportion.");
    else pushCheck(checks,"FIT-TROUSER-BALANCE","info","The selected trouser shape is provisionally compatible with the recorded waist-to-seat proportion.");
  } else pushCheck(checks,"FIT-TROUSER-DATA","review","Trouser waist and seat measurements are needed to assess the upper block.");

  if((style.rise==="High Rise"||style.rise==="Mid Rise")&&!profile.pants.frontRise){
    pushCheck(checks,"CONSTRUCTION-RISE","review","Record front rise before finalizing the waistband position and crotch balance.");
  }

  if(profile.pants.inseam&&!profile.pants.outseam){
    pushCheck(checks,"CONSTRUCTION-LENGTH","review","Add outseam as well as inseam so the tailor can check rise balance and final hem placement.");
  }

  if(options.climate==="Hot / humid"&&sf==="slim"){
    pushCheck(checks,"CONTEXT-EASE","review","For hot or humid use, keep the slim visual line but avoid reducing chest, armhole or bicep ease below the provisional range.");
  }

  if(tf==="wide"&&options.trouserFabric?.drape==="Structured"){
    pushCheck(checks,"FABRIC-DRAPE-TROUSER","warning","A structured trouser cloth may not fall naturally in the selected wide/relaxed silhouette. Compare a cloth with verified softer drape.");
  }
  if((tf==="pleated"||tf==="wide")&&options.trouserFabric?.drape==null){
    pushCheck(checks,"FABRIC-DRAPE-UNKNOWN","review","Confirm trouser drape before approving a pleated or wide silhouette.");
  }
  if(style.collar.includes("Spread")&&options.shirtFabric?.weightClass==="Heavy"){
    pushCheck(checks,"FABRIC-COLLAR","review","A heavy shirting can make a spread collar bulky; confirm collar construction and interlining on the real cloth.");
  }

  const warnings=checks.filter((item)=>item.severity==="warning").length;
  const reviews=checks.filter((item)=>item.severity==="review").length;
  const dataCount=shirtTargets.length+trouserTargets.length;
  const fitScore=Math.max(0,Math.min(100,70+Math.min(16,dataCount)*2-warnings*18-reviews*6));

  return {
    version:"fit-construction-provisional-1",
    status:dataCount>=6?"provisional":"insufficient_measurements",
    source:"provisional_house_defaults",
    shirtTargets,trouserTargets,checks,fitScore,caveats,
  };
}

export function formatFinishedRange(target:FinishedTarget,unit:"cm"|"in"="in"){
  const factor=unit==="in"?1/2.54:1;
  const min=target.finishedCm.min*factor;
  const max=target.finishedCm.max*factor;
  const suffix=unit==="in"?"in":"cm";
  return Math.abs(max-min)<0.05 ? `${min.toFixed(1)} ${suffix}` : `${min.toFixed(1)}–${max.toFixed(1)} ${suffix}`;
}
