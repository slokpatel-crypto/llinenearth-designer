export type EaseRangeCm={min:number;max:number};
export type ShirtEaseClass="slim"|"regular"|"relaxed";
export type TrouserEaseClass="flat"|"pleated"|"wide"|"cropped"|"other";

export const HOUSE_EASE_TABLE_VERSION="linen-earth-house-ease-provisional-v1" as const;

export const HOUSE_SHIRT_EASE:Record<ShirtEaseClass,{
  chest:EaseRangeCm;waist:EaseRangeCm;bicep:EaseRangeCm;neck:EaseRangeCm;wrist:EaseRangeCm;
}>={
  slim:{
    chest:{min:7.5,max:10},waist:{min:6,max:9},bicep:{min:5,max:7},
    neck:{min:1,max:1.5},wrist:{min:2,max:3},
  },
  regular:{
    chest:{min:10,max:14},waist:{min:9,max:13},bicep:{min:6,max:9},
    neck:{min:1,max:1.5},wrist:{min:2.5,max:3.5},
  },
  relaxed:{
    chest:{min:15,max:20},waist:{min:14,max:19},bicep:{min:8,max:12},
    neck:{min:1.2,max:1.8},wrist:{min:3,max:4.5},
  },
};

export const HOUSE_TROUSER_EASE:Record<TrouserEaseClass,{
  waist:EaseRangeCm;seat:EaseRangeCm;thigh:EaseRangeCm;knee:EaseRangeCm;
}>={
  flat:{
    waist:{min:1,max:3},seat:{min:6,max:9},thigh:{min:4,max:6},knee:{min:3,max:5},
  },
  pleated:{
    waist:{min:1.5,max:3.5},seat:{min:8,max:12},thigh:{min:6,max:9},knee:{min:4,max:7},
  },
  wide:{
    waist:{min:1.5,max:4},seat:{min:10,max:14},thigh:{min:8,max:12},knee:{min:8,max:14},
  },
  cropped:{
    waist:{min:1,max:3},seat:{min:6,max:9},thigh:{min:4,max:7},knee:{min:3,max:5},
  },
  other:{
    waist:{min:1.5,max:3.5},seat:{min:7,max:10},thigh:{min:5,max:8},knee:{min:4,max:6},
  },
};

export function validEaseRange(value:EaseRangeCm){
  return Number.isFinite(value.min)&&Number.isFinite(value.max)&&value.min>=0&&value.max>=value.min;
}

export function validateHouseEaseTables(){
  const shirt=Object.values(HOUSE_SHIRT_EASE).every((row)=>Object.values(row).every(validEaseRange));
  const trouser=Object.values(HOUSE_TROUSER_EASE).every((row)=>Object.values(row).every(validEaseRange));
  return shirt&&trouser;
}
