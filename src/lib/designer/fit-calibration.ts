export type RangeCm={min:number;max:number};
export type ShirtFitClass="slim"|"regular"|"relaxed";
export type TrouserFitClass="flat"|"pleated"|"wide"|"cropped"|"other";

export const FIT_CALIBRATION_VERSION="linen-earth-fit-calibration-provisional-1" as const;

export const SHIRT_EASE_CM:Record<ShirtFitClass,{
  chest:RangeCm;waist:RangeCm;bicep:RangeCm;neck:RangeCm;wrist:RangeCm;
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

export const TROUSER_EASE_CM:Record<TrouserFitClass,{
  waist:RangeCm;seat:RangeCm;thigh:RangeCm;knee:RangeCm;
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

export const FIT_CALIBRATION_NOTES=[
  "These are provisional Linen Earth house ranges, not cutting measurements.",
  "Replace only after measuring and recording the finished dimensions of at least 20 relevant garments.",
  "Any approved change must increment FIT_CALIBRATION_VERSION and update regression tests.",
] as const;
