export type FabricGroundTruthStatusRow={
  fabric_id:string|null;
  review_status:string;
};

export function summarizeFabricGroundTruth(
  rows:FabricGroundTruthStatusRow[],
  target=50,
){
  const reviewed=new Set<string>();
  const pending=new Set<string>();
  const bound=new Set<string>();

  for(const row of rows){
    const fabricId=String(row.fabric_id||"").trim();
    if(!fabricId) continue;
    bound.add(fabricId);
    if(row.review_status==="approved" || row.review_status==="corrected") reviewed.add(fabricId);
    else if(row.review_status==="unreviewed") pending.add(fabricId);
  }

  // A reviewed record wins over an older/pending duplicate for the same stock
  // fabric, so a re-analysis row cannot inflate both sides of the progress bar.
  for(const id of reviewed) pending.delete(id);

  const safeTarget=Math.max(1,Math.round(target));
  return {
    target:safeTarget,
    reviewedFabrics:reviewed.size,
    pendingFabrics:pending.size,
    stockBoundProfiles:bound.size,
    remaining:Math.max(0,safeTarget-reviewed.size),
  };
}
