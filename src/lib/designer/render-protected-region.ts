export type ProtectedRegionStatus="strong"|"review"|"weak"|"unavailable";

export const PROTECTED_REGION_DELTA_REFERENCE=.22;
export const PROTECTED_REGION_REVIEW_PERCENT=34;
export const PROTECTED_REGION_WEAK_PERCENT=60;

export function protectedRegionChangePercent(deltas:unknown[]):number|null{
  const values=deltas
    .map((value)=>Number(value))
    .filter((value)=>Number.isFinite(value)&&value>=0);
  if(!values.length) return null;
  const average=values.reduce((sum,value)=>sum+value,0)/values.length;
  return Math.round(Math.min(100,average/PROTECTED_REGION_DELTA_REFERENCE*100));
}

export function classifyProtectedRegionChange(changePercent:unknown):ProtectedRegionStatus{
  const value=Number(changePercent);
  if(!Number.isFinite(value)||value<0) return "unavailable";
  if(value>PROTECTED_REGION_WEAK_PERCENT) return "weak";
  if(value>PROTECTED_REGION_REVIEW_PERCENT) return "review";
  return "strong";
}
