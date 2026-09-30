export type ConstructionReviewSummary={
  total:number;
  approved:number;
  rejected:number;
  pending:number;
  decided:number;
  completionPercent:number;
};

export function summarizeConstructionReviews(input:{
  total:number;
  approved:number;
  rejected:number;
  pending:number;
}):ConstructionReviewSummary{
  const total=Math.max(0,Math.floor(Number(input.total)||0));
  const approved=Math.max(0,Math.floor(Number(input.approved)||0));
  const rejected=Math.max(0,Math.floor(Number(input.rejected)||0));
  const pending=Math.max(0,Math.floor(Number(input.pending)||0));
  const decided=Math.min(total,approved+rejected);
  return {
    total,
    approved,
    rejected,
    pending,
    decided,
    completionPercent:total?Math.round(decided/total*100):0,
  };
}
